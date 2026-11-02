(function () {
  "use strict";

  var canvas = document.getElementById("scene");
  var ui = {
    intro: document.getElementById("intro"),
    loading: document.getElementById("loading"),
    fallback: document.getElementById("fallback"),
    hotspots: document.getElementById("hotspots"),
    spotCard: document.getElementById("spotCard"),
    spotKicker: document.getElementById("spotKicker"),
    spotName: document.getElementById("spotName"),
    spotSig: document.getElementById("spotSig"),
    spotFacts: document.getElementById("spotFacts"),
    spotNearby: document.getElementById("spotNearby"),
    chapter: document.getElementById("chapter"),
    progressFill: document.getElementById("progressFill"),
    progress: document.querySelector(".progress"),
    hint: document.getElementById("hint"),
    dayBtn: document.getElementById("dayBtn"),
    soundBtn: document.getElementById("soundBtn"),
    skipBtn: document.getElementById("skipBtn"),
    replayBtn: document.getElementById("replayBtn"),
    startBtn: document.getElementById("startBtn"),
    skipIntroBtn: document.getElementById("skipIntroBtn"),
    flyBtn: document.getElementById("flyBtn"),
    detailBtn: document.getElementById("detailBtn"),
    backBtn: document.getElementById("backBtn"),
    spotClose: document.getElementById("spotClose"),
    landmarkToggle: document.getElementById("landmarkToggle"),
    landmarkPanel: document.getElementById("landmarkPanel"),
    lmList: document.getElementById("lmList"),
    lmClose: document.getElementById("lmClose"),
    toast: document.getElementById("toast")
  };

  var isMobile = window.matchMedia("(max-width: 820px)").matches || /Mobi|Android/i.test(navigator.userAgent);
  var width = window.innerWidth;
  var height = window.innerHeight;

  if (!window.THREE) {
    ui.loading.classList.add("hidden");
    ui.intro.classList.add("hidden");
    ui.fallback.hidden = false;
    return;
  }

  var renderer, scene, camera, clock;
  var unitBox, unitEdges;
  var glowTexture, reflectionTexture;
  var skyUniforms, starField, moonSprite, sunSprite, ambientLight, hemiLight, dirLight;
  var waterUniforms, riverCurve;
  var towerLineMaterial, towerSurfaceMaterial;
  var towerDeckMaterials = [];
  var towerLatticeGeometry, towerLatticeNightColors, towerLatticeDayColors;
  var buildingMaterials = [];
  var edgeMaterials = [];
  var windowMaterials = [];
  var glows = [];
  var boats = [];
  var spots = [];
  var hotspots = [];
  var dayState = false;
  var orbit = { target: new THREE.Vector3(35, 28, 42), radius: 130, theta: 2.55, phi: 1.4 };
  var flight = null;
  var flightSequence = null;
  var terrainUniforms = null;
  var baiyunMist = [];
  var baiyunCable = null;
  var baiyunPeak = new THREE.Vector3(-45, 32, -183);
  var lastTarget = new THREE.Vector3(30, 25, 0);
  var activeSpot = null;
  var toastTimer = null;
  var audio = null;
  var soundOn = false;
  var localPointers = new Map();
  var pinchStart = null;
  var dragState = null;

  var state = {
    mode: "intro",
    time: 0,
    duration: 18,
    paused: false,
    fps: 60,
    frames: 0,
    lastFpsAt: performance.now(),
    webgl: true
  };

  var posCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-110, 40, 70),
    new THREE.Vector3(-60, 24, 60),
    new THREE.Vector3(0, 26, 130),
    new THREE.Vector3(105, 36, 115),
    new THREE.Vector3(125, 52, 100),
    new THREE.Vector3(120, 58, 118)
  ], false, "catmullrom", 0.5);

  var targetCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(25, 24, 32),
    new THREE.Vector3(30, 24, 34),
    new THREE.Vector3(34, 30, 38),
    new THREE.Vector3(30, 32, 36),
    new THREE.Vector3(30, 28, 32),
    new THREE.Vector3(30, 26, 30)
  ], false, "catmullrom", 0.5);

  var SPOT_DATA = [
    {
      id: "tower",
      name: "广州塔",
      kicker: "地标 · 海珠",
      primary: true,
      pos: new THREE.Vector3(35, 44, 45),
      cam: new THREE.Vector3(100, 38, 100),
      target: new THREE.Vector3(35, 28, 45),
      sig: "600 米扭转双曲面，世界高塔里少见的「小蛮腰」。夜里灯一亮，它就是整条江岸的坐标。",
      facts: [["总高", "600 m"], ["主体", "454 m"], ["摩天轮", "450 m"]]
    },
    {
      id: "skyline",
      name: "天河天际线",
      kicker: "城市 · 天河",
      primary: true,
      pos: new THREE.Vector3(66, 34, -45),
      cam: new THREE.Vector3(8, 34, 34),
      target: new THREE.Vector3(60, 26, -48),
      sig: "东塔、西塔和大剧院挤在同一条新中轴上；从江面看过去，是广州最现代的一条轮廓线。",
      facts: [["东塔", "530 m"], ["西塔", "438 m"], ["中轴", "珠江新城"]]
    },
    {
      id: "river",
      name: "珠江",
      kicker: "水系 · 穿城",
      primary: true,
      pos: new THREE.Vector3(-25, 1.5, 24),
      cam: new THREE.Vector3(10, 20, 84),
      target: new THREE.Vector3(-20, 5, 24),
      sig: "广州的城市轴线是沿江长出来的。白天看船，晚上看灯，最合适的视角始终在水面附近。",
      facts: [["穿城", "东西向"], ["夜游", "天字码头"], ["两岸", "灯光带"]]
    },
    {
      id: "baiyun",
      name: "白云山",
      kicker: "自然 · 白云",
      pos: new THREE.Vector3(-70, 16, -175),
      cam: new THREE.Vector3(20, 60, 30),
      target: new THREE.Vector3(-70, 8, -175),
      sig: "摩星岭 382 米，广州城区的最高点；从山脊往南看，整条城市中轴和珠江一起出现。",
      facts: [["主峰", "382 m"], ["别称", "羊城第一秀"], ["视角", "城市高点"]]
    },
    {
      id: "chenjiaci",
      name: "陈家祠",
      kicker: "建筑 · 西关",
      pos: new THREE.Vector3(-105, 10, -38),
      cam: new THREE.Vector3(-150, 34, 30),
      target: new THREE.Vector3(-105, 7, -38),
      sig: "一座书院，把岭南的「三雕两塑一铸」全刻在身上；屋脊本身就是一台戏。",
      facts: [["建成", "1894 年"], ["工艺", "三雕两塑一铸"], ["现为", "民间工艺博物馆"]]
    },
    {
      id: "sacredheart",
      name: "石室圣心大教堂",
      kicker: "建筑 · 一德路",
      pos: new THREE.Vector3(-62, 24, -40),
      cam: new THREE.Vector3(-22, 32, 26),
      target: new THREE.Vector3(-62, 13, -38),
      sig: "整座教堂用花岗岩砌成，双尖塔从一德路的骑楼群里拔起；进到内部，彩色玻璃才把石构点亮。",
      facts: [["建成", "1888 年"], ["材质", "花岗岩"], ["双塔", "58.5 m"]]
    },
    {
      id: "shamian",
      name: "沙面",
      kicker: "街区 · 西关",
      pos: new THREE.Vector3(-95, 9, 24),
      cam: new THREE.Vector3(-140, 24, 78),
      target: new THREE.Vector3(-95, 6, 24),
      sig: "0.3 平方公里的江心岛上，排着上百栋欧陆建筑；教堂尖顶和榕树一起构成西关的另一面。",
      facts: [["面积", "约 0.3 km²"], ["建筑", "150 栋以上"], ["前身", "英法租界"]]
    },
    {
      id: "yongqingfang",
      name: "永庆坊",
      kicker: "街区 · 西关",
      pos: new THREE.Vector3(-80, 6, -8),
      cam: new THREE.Vector3(-118, 24, 55),
      target: new THREE.Vector3(-80, 5, -8),
      sig: "骑楼底下做微改造，老西关和新店铺挤在同一条巷子；一盏灯就能把骑楼连廊照亮。",
      facts: [["位置", "恩宁路"], ["形态", "骑楼 + 微改造"], ["看点", "粤剧艺术博物馆"]]
    },
    {
      id: "beijinglu",
      name: "北京路",
      kicker: "街区 · 老城",
      pos: new THREE.Vector3(-25, 9, -55),
      cam: new THREE.Vector3(-65, 30, 5),
      target: new THREE.Vector3(-25, 7, -55),
      sig: "脚下玻璃罩着千年古道，头上是广州最热闹的商业街；一条街同时叠着好几个年代。",
      facts: [["古道", "千年"], ["遗址", "玻璃罩展示"], ["地标", "大佛寺"]]
    },
    {
      id: "partypier",
      name: "琶醍",
      kicker: "江岸 · 海珠",
      pos: new THREE.Vector3(132, 7, 52),
      cam: new THREE.Vector3(95, 28, 100),
      target: new THREE.Vector3(132, 6, 50),
      sig: "珠江啤酒厂旧址，旧厂房和啤酒罐变成江边酒吧；正对珠江新城，日落位很抢手。",
      facts: [["前身", "珠江啤酒厂"], ["现在", "江边酒吧街"], ["时段", "日落至深夜"]]
    },
    {
      id: "operahouse",
      name: "广州大剧院",
      kicker: "建筑 · 天河",
      pos: new THREE.Vector3(80, 8, -30),
      cam: new THREE.Vector3(45, 28, 20),
      target: new THREE.Vector3(80, 7, -30),
      sig: "扎哈·哈迪德的两块「圆润双砾」，几乎找不到直角；走一圈，建筑的曲面一直在变。",
      facts: [["设计", "扎哈·哈迪德"], ["造型", "圆润双砾"], ["启用", "2010 年"]]
    }
  ];

  // 高德 Web端(JS API) 配置由 poi-config.js 提供；key 和安全密钥会随前端发布。
  var POI_CACHE_TTL = 10 * 60 * 1000;
  var amapPromise = null;
  var SPOT_COORDS = {
    tower: [113.3245, 23.1066],
    skyline: [113.3270, 23.1180],
    river: [113.2740, 23.1080],
    baiyun: [113.2980, 23.1830],
    chenjiaci: [113.2452, 23.1294],
    sacredheart: [113.2638, 23.1174],
    shamian: [113.2425, 23.1068],
    yongqingfang: [113.2461, 23.1155],
    beijinglu: [113.2690, 23.1250],
    partypier: [113.3230, 23.0990],
    operahouse: [113.3260, 23.1160]
  };
  var ATLAS_SPOT_IDS = {
    tower: "canton-tower",
    skyline: "huacheng",
    river: "river-cruise",
    baiyun: "baiyun",
    chenjiaci: "chenjiaci",
    sacredheart: "sacred-heart",
    shamian: "shamian",
    yongqingfang: "yongqingfang",
    beijinglu: "beijinglu",
    partypier: "party-pier",
    operahouse: "opera-house"
  };

  function atlasMarkFor(spotId) {
    try {
      var marks = JSON.parse(localStorage.getItem("canton-atlas-marks") || "{}");
      var atlasId = ATLAS_SPOT_IDS[spotId];
      return atlasId && marks ? marks[atlasId] : null;
    } catch (error) {
      return null;
    }
  }

  var NEARBY_DEMO = {
    tower: [["江景咖啡", "咖啡 / 甜品", "约 260 m"], ["粤菜小馆", "粤菜", "约 420 m"], ["便利店", "便利", "约 180 m"]],    skyline: [["商场食街", "美食广场", "约 300 m"], ["街角咖啡", "咖啡", "约 180 m"], ["书店", "文化", "约 350 m"]],
    river: [["江边酒吧", "酒吧", "约 240 m"], ["游船码头", "票务", "约 120 m"], ["茶室", "茶饮", "约 400 m"]],
    baiyun: [["山脚茶室", "茶饮", "约 300 m"], ["豆腐花", "小吃", "约 150 m"], ["农家菜", "粤菜", "约 800 m"]],
    chenjiaci: [["西关茶楼", "早茶", "约 300 m"], ["手作店", "文创", "约 220 m"], ["糖水铺", "甜品", "约 350 m"]],
    sacredheart: [["一德路海味街", "干货 / 老街", "约 120 m"], ["石室咖啡", "咖啡", "约 260 m"], ["北京路小吃", "小吃", "约 900 m"]],
    shamian: [["江边咖啡", "咖啡", "约 200 m"], ["西餐厅", "西餐", "约 350 m"], ["文创店", "文创", "约 280 m"]],
    yongqingfang: [["骑楼咖啡", "咖啡", "约 120 m"], ["粤剧茶座", "茶饮", "约 260 m"], ["糖水铺", "甜品", "约 180 m"]],
    beijinglu: [["牛杂", "小吃", "约 150 m"], ["肠粉", "小吃", "约 200 m"], ["糖水铺", "甜品", "约 260 m"]],
    partypier: [["江景酒吧", "酒吧", "约 180 m"], ["精酿", "酒吧", "约 240 m"], ["烧烤", "夜宵", "约 300 m"]],
    operahouse: [["剧院咖啡", "咖啡", "约 200 m"], ["简餐", "西餐", "约 280 m"], ["书店", "文化", "约 350 m"]]
  };

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function showToast(message) {
    ui.toast.textContent = message;
    ui.toast.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { ui.toast.classList.remove("show"); }, 2200);
  }

  function showFallback() {
    state.webgl = false;
    ui.loading.classList.add("hidden");
    ui.intro.classList.add("hidden");
    ui.fallback.hidden = false;
  }

  function makeGlowTexture() {
    var c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    var ctx = c.getContext("2d");
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.28, "rgba(255,255,255,0.55)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  function makeReflectionTexture() {
    var c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    var ctx = c.getContext("2d");
    var g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.32, "rgba(255,255,255,0.55)");
    g.addColorStop(0.55, "rgba(255,255,255,0.8)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 256);
    return new THREE.CanvasTexture(c);
  }

  function makeFacadeTexture(night, seed) {
    var c = document.createElement("canvas");
    c.width = 128;
    c.height = 256;
    var ctx = c.getContext("2d");
    var rand = mulberry32(seed);
    ctx.fillStyle = night ? "#050c14" : "#93a7b2";
    ctx.fillRect(0, 0, 128, 256);

    var cols = 8;
    var rows = 20;
    var padX = 4;
    var padY = 5;
    var gapX = 4;
    var gapY = 3;
    var cellW = (128 - padX * 2 - gapX * (cols - 1)) / cols;
    var cellH = (256 - padY * 2 - gapY * (rows - 1)) / rows;

    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var lit = rand() < (night ? 0.28 : 0.14);
        if (night) {
          var palette = ["#ffd9a8", "#9fd8e8", "#f2b58f", "#c9c2ff"];
          ctx.fillStyle = lit ? palette[Math.floor(rand() * palette.length)] : "#081620";
          ctx.globalAlpha = lit ? 0.45 + rand() * 0.4 : 0.65;
        } else {
          ctx.fillStyle = lit ? "#d9e3e8" : "#2a3b45";
          ctx.globalAlpha = 0.85;
        }
        ctx.fillRect(
          padX + x * (cellW + gapX),
          padY + y * (cellH + gapY),
          cellW,
          cellH
        );
      }
    }
    ctx.globalAlpha = 1;

    ctx.strokeStyle = night ? "rgba(80, 140, 165, 0.16)" : "rgba(40, 60, 70, 0.35)";
    ctx.lineWidth = 1;
    for (var m = 0; m <= cols; m++) {
      var mx = padX + m * (cellW + gapX) - gapX / 2;
      ctx.beginPath();
      ctx.moveTo(mx, 0);
      ctx.lineTo(mx, 256);
      ctx.stroke();
    }

    var texture = new THREE.CanvasTexture(c);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = 4;
    return texture;
  }

  function addGlow(x, y, z, color, scale, opacity) {
    var material = new THREE.SpriteMaterial({
      map: glowTexture,
      color: color,
      transparent: true,
      opacity: opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    var sprite = new THREE.Sprite(material);
    sprite.position.set(x, y, z);
    sprite.scale.set(scale, scale, 1);
    sprite.userData.baseOpacity = opacity;
    scene.add(sprite);
    glows.push(sprite);
    return sprite;
  }

  function initThree() {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        antialias: !isMobile,
        alpha: false,
        powerPreference: "high-performance"
      });
    } catch (error) {
      showFallback();
      return false;
    }
    if (!renderer || !renderer.getContext()) {
      showFallback();
      return false;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.2 : 1.8));
    renderer.setSize(width, height, false);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.07;
    renderer.setClearColor(0x04080d, 1);

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0e2a38, 0.00235);

    camera = new THREE.PerspectiveCamera(isMobile ? 55 : 42, width / height, 0.1, 2400);
    camera.position.copy(posCurve.getPointAt(0));
    camera.lookAt(targetCurve.getPointAt(0));

    clock = new THREE.Clock();
    unitBox = new THREE.BoxGeometry(1, 1, 1);
    unitEdges = new THREE.EdgesGeometry(unitBox);
    glowTexture = makeGlowTexture();
    reflectionTexture = makeReflectionTexture();

    buildSky();
    buildLights();
    buildRiver();
    buildGround();
    buildCity();
    buildWesternLandmarks();
    buildTower();
    buildMountain();
    buildBridges();
    buildBoats();
    buildReflections();
    buildHotspots();
    buildLandmarkPanel();
    bindUI();
    bindControls();
    bindResize();
    sampleCinematic(0);
    setDay(false);
    hideLoading();
    startLoop();
    handleQuery();
    return true;
  }

  function hideLoading() {
    window.setTimeout(function () { ui.loading.classList.add("hidden"); }, 180);
  }

  /* ---------------- 天空与光 ---------------- */

  function buildSky() {
    var skyGeo = new THREE.SphereGeometry(1400, 32, 18);
    skyUniforms = {
      topColor: { value: new THREE.Color(0x02060d) },
      horizonColor: { value: new THREE.Color(0x163b4c) },
      glowColor: { value: new THREE.Color(0xb56f4a) },
      sunDir: { value: new THREE.Vector3(-0.45, 0.08, -1).normalize() },
      sunPower: { value: 0.9 }
    };
    var skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: skyUniforms,
      vertexShader: [
        "varying vec3 vDir;",
        "void main() {",
        "  vDir = normalize(position);",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vDir;",
        "uniform vec3 topColor;",
        "uniform vec3 horizonColor;",
        "uniform vec3 glowColor;",
        "uniform vec3 sunDir;",
        "uniform float sunPower;",
        "void main() {",
        "  float h = smoothstep(-0.08, 0.55, vDir.y);",
        "  vec3 col = mix(horizonColor, topColor, h);",
        "  float sun = pow(max(dot(normalize(vDir), normalize(sunDir)), 0.0), 7.0);",
        "  col += glowColor * sun * sunPower;",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    });
    var sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    scene.add(sky);

    var starGeo = new THREE.BufferGeometry();
    var positions = [];
    for (var i = 0; i < 800; i++) {
      var angle = Math.random() * Math.PI * 2;
      var elevation = Math.random() * Math.PI * 0.48;
      var radius = 1000 + Math.random() * 180;
      positions.push(
        Math.cos(angle) * Math.cos(elevation) * radius,
        Math.sin(elevation) * radius,
        Math.sin(angle) * Math.cos(elevation) * radius
      );
    }
    starGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    var starMat = new THREE.PointsMaterial({
      color: 0xdfe9ff,
      size: 1.9,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.9,
      depthWrite: false
    });
    starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);

    moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xdfe8ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    moonSprite.position.set(-260, 200, -760);
    moonSprite.scale.set(110, 110, 1);
    scene.add(moonSprite);

    sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffc07a,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    sunSprite.position.set(420, 170, -900);
    sunSprite.scale.set(70, 70, 1);
    sunSprite.visible = false;
    scene.add(sunSprite);
  }

  function buildLights() {
    ambientLight = new THREE.AmbientLight(0x3b5066, 0.55);
    scene.add(ambientLight);
    hemiLight = new THREE.HemisphereLight(0x6f9ec4, 0x0a1218, 0.35);
    scene.add(hemiLight);
    dirLight = new THREE.DirectionalLight(0x9db8ff, 0.5);
    dirLight.position.set(-80, 100, -60);
    scene.add(dirLight);

    var towerLightA = new THREE.PointLight(0x6fe3e1, 1.4, 110, 2);
    towerLightA.position.set(35, 18, 45);
    scene.add(towerLightA);
    var towerLightB = new THREE.PointLight(0xe36bb2, 1.1, 90, 2);
    towerLightB.position.set(35, 42, 45);
    scene.add(towerLightB);
    var bridgeLight = new THREE.PointLight(0xffb46a, 0.8, 90, 2);
    bridgeLight.position.set(105, 12, 20);
    scene.add(bridgeLight);
  }

  /* ---------------- 地面与道路 ---------------- */

  function buildGround() {
    var ground = new THREE.Mesh(
      new THREE.PlaneGeometry(6000, 6000),
      new THREE.MeshStandardMaterial({ color: 0x050b11, roughness: 0.96, metalness: 0.05 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.55;
    scene.add(ground);

    var roadMat = new THREE.LineBasicMaterial({ color: 0x2d6e8e, transparent: true, opacity: 0.2 });
    var warmMat = new THREE.LineBasicMaterial({ color: 0xd99a5d, transparent: true, opacity: 0.28 });
    var points = [];

    function addLine(x1, z1, x2, z2, mat, y) {
      var geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x1, y || -0.38, z1),
        new THREE.Vector3(x2, y || -0.38, z2)
      ]);
      scene.add(new THREE.Line(geo, mat));
    }

    for (var x = -140; x <= 180; x += 24) {
      addLine(x, -118, x, -20, roadMat);
      addLine(x, 38, x, 100, roadMat);
    }
    for (var z = -110; z <= -26; z += 20) {
      addLine(-140, z, 180, z, roadMat);
    }
    for (var z2 = 42; z2 <= 94; z2 += 18) {
      addLine(-80, z2, 120, z2, roadMat);
    }

    addLine(-140, 34, 180, 40, warmMat);
    addLine(-140, -18, 180, -24, warmMat);

    var axisPoints = [];
    for (var i = 0; i <= 40; i++) {
      axisPoints.push(new THREE.Vector3(35, -0.28, 48 - i * 2.9));
    }
    var axisGeo = new THREE.BufferGeometry().setFromPoints(axisPoints);
    scene.add(new THREE.Line(axisGeo, new THREE.LineBasicMaterial({
      color: 0x6fe3e1, transparent: true, opacity: 0.24
    })));

    var foregroundLights = [];
    for (var fl = 0; fl <= 46; fl++) {
      foregroundLights.push(new THREE.Vector3(-120 + fl * 5.2, 0.35, 54));
    }
    var foregroundGeo = new THREE.BufferGeometry().setFromPoints(foregroundLights);
    scene.add(new THREE.Points(foregroundGeo, new THREE.PointsMaterial({
      color: 0xffd1a3, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.6, depthWrite: false
    })));

    var railingGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-140, 0.7, 52),
      new THREE.Vector3(150, 0.7, 52)
    ]);
    scene.add(new THREE.Line(railingGeo, new THREE.LineBasicMaterial({
      color: 0xffc08a, transparent: true, opacity: 0.22
    })));

    [-110, -70, -30, 10, 50, 90, 130].forEach(function (lx) {
      addGlow(lx, 2.1, 54, 0xffc98f, 2.8, 0.32);
    });

    var parkRand = mulberry32(5150);
    var parkTreeMat = new THREE.MeshBasicMaterial({ color: 0x0c1f17 });
    var parkTreeGeo = new THREE.ConeGeometry(0.9, 3.2, 5);
    var parkCount = isMobile ? 16 : 30;
    var parkTrees = new THREE.InstancedMesh(parkTreeGeo, parkTreeMat, parkCount);
    var parkDummy = new THREE.Object3D();
    for (var pt = 0; pt < parkCount; pt++) {
      var px = -135 + parkRand() * 275;
      if (px > -34 && px < 88) px += px < 27 ? -46 : 46;
      var pz = 58 + parkRand() * 24;
      var ps = 0.7 + parkRand() * 0.8;
      parkDummy.position.set(px, 1.6 * ps, pz);
      parkDummy.scale.set(ps, ps, ps);
      parkDummy.rotation.y = parkRand() * Math.PI;
      parkDummy.updateMatrix();
      parkTrees.setMatrixAt(pt, parkDummy.matrix);
    }
    scene.add(parkTrees);
    parkTrees.instanceMatrix.needsUpdate = true;

    var plaza = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 48),
      new THREE.MeshStandardMaterial({ color: 0x0a1a17, roughness: 0.92, metalness: 0.08 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(44, -0.35, -38);
    scene.add(plaza);

    var plazaLights = [];
    for (var k = 0; k < 20; k++) {
      plazaLights.push(new THREE.Vector3(30 + (k % 2) * 27, 0.25, -16 - Math.floor(k / 2) * 4.2));
    }
    var lightGeo = new THREE.BufferGeometry().setFromPoints(plazaLights);
    scene.add(new THREE.Points(lightGeo, new THREE.PointsMaterial({
      color: 0xffc98f, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false
    })));

    var promenade = [];
    for (var j = 0; j <= 60; j++) {
      var t = j / 60;
      var p = riverCurve ? riverCurve.getPointAt(t) : new THREE.Vector3(-200 + t * 400, 0, 15);
      promenade.push(new THREE.Vector3(p.x, 0.2, p.z + 20));
      promenade.push(new THREE.Vector3(p.x, 0.2, p.z - 20));
    }
    var promGeo = new THREE.BufferGeometry().setFromPoints(promenade);
    scene.add(new THREE.Points(promGeo, new THREE.PointsMaterial({
      color: 0xffd1a3, size: 1.3, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false
    })));
  }

  /* ---------------- 珠江 ---------------- */

  function buildRiver() {
    var pts = [
      new THREE.Vector3(-280, 0, 34),
      new THREE.Vector3(-190, 0, 28),
      new THREE.Vector3(-110, 0, 24),
      new THREE.Vector3(-40, 0, 18),
      new THREE.Vector3(30, 0, 14),
      new THREE.Vector3(95, 0, 20),
      new THREE.Vector3(160, 0, 30),
      new THREE.Vector3(230, 0, 40),
      new THREE.Vector3(300, 0, 48)
    ];
    riverCurve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);

    var segments = 180;
    var halfWidth = 17;
    var positions = [];
    var uvs = [];
    var indices = [];

    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var p = riverCurve.getPointAt(t);
      var tangent = riverCurve.getTangentAt(t);
      var normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      var left = p.clone().addScaledVector(normal, halfWidth);
      var right = p.clone().addScaledVector(normal, -halfWidth);
      positions.push(left.x, 0.06, left.z, right.x, 0.06, right.z);
      uvs.push(0, t, 1, t);
      if (i < segments) {
        var a = i * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }

    var geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);

    waterUniforms = {
      time: { value: 0 },
      cDeep: { value: new THREE.Color(0x051e28) },
      cShallow: { value: new THREE.Color(0x104a58) },
      cGlow: { value: new THREE.Color(0x6fe3e1) },
      fogColor: { value: new THREE.Color(0x0e2a38) }
    };

    var material = new THREE.ShaderMaterial({
      uniforms: waterUniforms,
      transparent: false,
      side: THREE.DoubleSide,
      vertexShader: [
        "varying vec3 vWorld;",
        "void main() {",
        "  vec4 world = modelMatrix * vec4(position, 1.0);",
        "  vWorld = world.xyz;",
        "  gl_Position = projectionMatrix * viewMatrix * world;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vWorld;",
        "uniform float time;",
        "uniform vec3 cDeep;",
        "uniform vec3 cShallow;",
        "uniform vec3 cGlow;",
        "uniform vec3 fogColor;",
        "void main() {",
        "  float wx = sin(vWorld.x * 0.18 + time * 0.7);",
        "  float wz = sin(vWorld.z * 0.42 - time * 0.55);",
        "  float wave = wx * wz * 0.5 + 0.5;",
        "  vec3 col = mix(cDeep, cShallow, 0.35 + wave * 0.3);",
        "  float streak = smoothstep(0.78, 1.0, sin(vWorld.x * 0.085 + vWorld.z * 0.22 + time * 0.32));",
        "  col += cGlow * streak * 0.28;",
        "  float dist = length(cameraPosition - vWorld);",
        "  float fog = 1.0 - exp(-dist * dist * 0.0000015);",
        "  col = mix(col, fogColor, clamp(fog, 0.0, 0.9));",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    });

    var river = new THREE.Mesh(geometry, material);
    river.renderOrder = 1;
    scene.add(river);

    var bankMat = new THREE.LineBasicMaterial({ color: 0x2c6a82, transparent: true, opacity: 0.45 });
    var bankGeoA = new THREE.BufferGeometry();
    var bankGeoB = new THREE.BufferGeometry();
    var bankA = [];
    var bankB = [];
    for (var j = 0; j <= segments; j++) {
      var t2 = j / segments;
      var p2 = riverCurve.getPointAt(t2);
      var tan2 = riverCurve.getTangentAt(t2);
      var nor2 = new THREE.Vector3(-tan2.z, 0, tan2.x).normalize();
      var a2 = p2.clone().addScaledVector(nor2, halfWidth + 0.6);
      var b2 = p2.clone().addScaledVector(nor2, -halfWidth - 0.6);
      bankA.push(new THREE.Vector3(a2.x, 0.2, a2.z));
      bankB.push(new THREE.Vector3(b2.x, 0.2, b2.z));
    }
    bankGeoA.setFromPoints(bankA);
    bankGeoB.setFromPoints(bankB);
    scene.add(new THREE.Line(bankGeoA, bankMat));
    scene.add(new THREE.Line(bankGeoB, bankMat));
  }

  /* ---------------- 城市 ---------------- */

  function buildCity() {
    var rand = mulberry32(20261030);
    var accentColors = [0x2c9fbd, 0x5a8fdc, 0xb06fd1, 0x4bb49a];
    var windowColors = [0xffd39a, 0x9fe8ff, 0xffab7a];

    var nightMaps = [makeFacadeTexture(true, 11), makeFacadeTexture(true, 29), makeFacadeTexture(true, 47)];
    var dayMaps = [makeFacadeTexture(false, 11), makeFacadeTexture(false, 29), makeFacadeTexture(false, 47)];

    for (var mi = 0; mi < 3; mi++) {
      var material = new THREE.MeshStandardMaterial({
        map: nightMaps[mi],
        emissiveMap: nightMaps[mi],
        emissive: 0xffffff,
        emissiveIntensity: 0.55,
        color: 0xffffff,
        roughness: 0.82,
        metalness: 0.24
      });
      material.userData.dayMap = dayMaps[mi];
      material.userData.nightMap = nightMaps[mi];
      buildingMaterials.push(material);
    }

    accentColors.forEach(function (color) {
      edgeMaterials.push(new THREE.LineBasicMaterial({
        color: color, transparent: true, opacity: 0.3
      }));
    });
    windowColors.forEach(function (color) {
      windowMaterials.push(new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false
      }));
    });

    var exclusions = [
      { x: 35, z: 45, r: 20 },
      { x: 80, z: -30, r: 15 },
      { x: 60, z: -62, r: 13 },
      { x: 45, z: -38, r: 32 },
      { x: 68, z: -45, r: 13 },
      { x: 48, z: -52, r: 11 },
      { x: 0, z: -80, r: 10 },
      { x: 105, z: 20, r: 12 },
      { x: -55, z: 18, r: 10 },
      { x: -95, z: 24, r: 16 },
      { x: -105, z: -38, r: 20 },
      { x: -62, z: -40, r: 16 },
      { x: -80, z: -8, r: 18 },
      { x: -25, z: -55, r: 22 },
      { x: 132, z: 52, r: 18 }
    ];

    function blocked(x, z) {
      for (var i = 0; i < exclusions.length; i++) {
        var dx = x - exclusions[i].x;
        var dz = z - exclusions[i].z;
        if (dx * dx + dz * dz < exclusions[i].r * exclusions[i].r) return true;
      }
      if (z > -18 && z < 38) return true;
      return false;
    }

    function addBuilding(x, z, w, d, h, accentIndex) {
      var mat = buildingMaterials[accentIndex % buildingMaterials.length];
      var mesh = new THREE.Mesh(unitBox, mat);
      mesh.position.set(x, h / 2, z);
      mesh.scale.set(w, h, d);
      scene.add(mesh);

      var edge = new THREE.LineSegments(unitEdges, edgeMaterials[accentIndex % edgeMaterials.length]);
      edge.position.copy(mesh.position);
      edge.scale.set(w, h, d);
      scene.add(edge);

      var frontZ = z > 0 ? z - d / 2 - 0.05 : z + d / 2 + 0.05;
      var stripCount = 2 + Math.floor(rand() * 3);
      for (var i = 0; i < stripCount; i++) {
        var strip = new THREE.Mesh(unitBox, windowMaterials[(accentIndex + i) % windowMaterials.length]);
        strip.position.set(x, 1.5 + rand() * (h - 3), frontZ);
        strip.scale.set(w * (0.45 + rand() * 0.32), 0.11, 0.06);
        scene.add(strip);
      }

      var top = h;
      if (h > 17 && rand() > 0.45) {
        var upperH = h * (0.16 + rand() * 0.18);
        var upperW = w * (0.58 + rand() * 0.16);
        var upperD = d * (0.58 + rand() * 0.16);
        var upper = new THREE.Mesh(unitBox, mat);
        upper.position.set(x, h + upperH / 2, z);
        upper.scale.set(upperW, upperH, upperD);
        scene.add(upper);
        var upperEdge = new THREE.LineSegments(unitEdges, edgeMaterials[accentIndex % edgeMaterials.length]);
        upperEdge.position.copy(upper.position);
        upperEdge.scale.copy(upper.scale);
        scene.add(upperEdge);
        top = h + upperH;
      }

      if (top > 28 && rand() > 0.65) {
        var antennaGeo = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(x, top, z),
          new THREE.Vector3(x, top + 3.2, z)
        ]);
        scene.add(new THREE.Line(antennaGeo, new THREE.LineBasicMaterial({
          color: accentIndex % 2 ? 0x9fe8ff : 0xffc98f,
          transparent: true, opacity: 0.5
        })));
      }

      if (top > 19) {
        addGlow(x, top + 0.8, z, accentIndex % 2 ? 0x9fe8ff : 0xffc98f, 3.4, 0.35);
      }
    }

    for (var gx = 0; gx < 9; gx++) {
      for (var gz = 0; gz < 6; gz++) {
        var x = 4 + gx * 18 + (rand() - 0.5) * 6;
        var z = -27 - gz * 15 - rand() * 4;
        if (x > 165 || z < -120 || blocked(x, z)) continue;
        var h = 5 + rand() * (gx > 4 ? 26 : 19);
        addBuilding(x, z, 5 + rand() * 6, 5 + rand() * 6, h, Math.floor(rand() * 4));
      }
    }

    for (var ox = 0; ox < 6; ox++) {
      for (var oz = 0; oz < 4; oz++) {
        var lx = -128 + ox * 18 + (rand() - 0.5) * 6;
        var lz = -28 - oz * 16 - rand() * 4;
        if (lx > -8 || lz < -104 || blocked(lx, lz)) continue;
        addBuilding(lx, lz, 4 + rand() * 4, 4 + rand() * 4, 3 + rand() * 5, Math.floor(rand() * 4));
      }
    }

    addTwinTower(68, -45, 10, 10, 53, 0x6fe3e1);
    addTwinTower(48, -52, 9, 9, 44, 0x8fb6ff);

    var citic = new THREE.Mesh(
      new THREE.CylinderGeometry(3.4, 4.6, 39, 8),
      new THREE.MeshStandardMaterial({ color: 0x0a1522, roughness: 0.84, metalness: 0.3, emissive: 0x02070c })
    );
    citic.position.set(-2, 19.5, -82);
    scene.add(citic);
    var citicEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(citic.geometry),
      new THREE.LineBasicMaterial({ color: 0x5a8fdc, transparent: true, opacity: 0.35 })
    );
    citicEdges.position.copy(citic.position);
    scene.add(citicEdges);
    addGlow(-2, 40, -82, 0x9fe8ff, 5, 0.4);

    var opera = new THREE.Mesh(
      new THREE.SphereGeometry(1, 28, 16),
      new THREE.MeshStandardMaterial({ color: 0x1c2a36, roughness: 0.55, metalness: 0.4, emissive: 0x06131d })
    );
    opera.position.set(80, 3.2, -30);
    opera.scale.set(9, 3.4, 6);
    scene.add(opera);
    var operaWire = new THREE.Mesh(
      opera.geometry,
      new THREE.MeshBasicMaterial({ color: 0x6fe3e1, wireframe: true, transparent: true, opacity: 0.14 })
    );
    operaWire.position.copy(opera.position);
    operaWire.scale.copy(opera.scale);
    scene.add(operaWire);

    var opera2 = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 14),
      new THREE.MeshStandardMaterial({ color: 0x1a2630, roughness: 0.6, metalness: 0.35, emissive: 0x051019 })
    );
    opera2.position.set(88, 2.4, -35);
    opera2.scale.set(6, 2.5, 4.5);
    scene.add(opera2);

    var museum = new THREE.Mesh(
      unitBox,
      new THREE.MeshStandardMaterial({ color: 0x2a1d13, roughness: 0.7, metalness: 0.25, emissive: 0x0a0502 })
    );
    museum.position.set(60, 4.5, -62);
    museum.scale.set(14, 9, 10);
    scene.add(museum);
    var museumEdges = new THREE.LineSegments(unitEdges, new THREE.LineBasicMaterial({
      color: 0xf0b35e, transparent: true, opacity: 0.42
    }));
    museumEdges.position.copy(museum.position);
    museumEdges.scale.copy(museum.scale);
    scene.add(museumEdges);

    var museumGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 6),
      new THREE.MeshBasicMaterial({
        color: 0xf0b35e, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false
      })
    );
    museumGlow.position.set(60, 4.6, -56.9);
    scene.add(museumGlow);

    var axisLights = [];
    for (var i = 0; i <= 30; i++) {
      axisLights.push(new THREE.Vector3(35 + i * 0.1, 0.2, 26 - i * 3.1));
    }
    var axisGeo = new THREE.BufferGeometry().setFromPoints(axisLights);
    scene.add(new THREE.Points(axisGeo, new THREE.PointsMaterial({
      color: 0xffd7a1, size: 1.4, sizeAttenuation: true, transparent: true, opacity: 0.75, depthWrite: false
    })));

    var shamian = new THREE.Mesh(
      new THREE.PlaneGeometry(28, 12),
      new THREE.MeshStandardMaterial({ color: 0x0c1718, roughness: 0.9 })
    );
    shamian.rotation.x = -Math.PI / 2;
    shamian.position.set(-95, -0.1, 24);
    scene.add(shamian);
    for (var k = 0; k < 7; k++) {
      var bx = -106 + k * 3.6;
      var bz = 20 + (k % 2) * 6;
      var b = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({
        color: 0x2a2118, roughness: 0.9, emissive: 0x0a0603
      }));
      b.position.set(bx, 2.2, bz);
      b.scale.set(2.6, 4.4, 2.6);
      scene.add(b);
      addGlow(bx, 4.8, bz, 0xffc98f, 2, 0.25);
    }
  }

  function addTwinTower(x, z, w, d, h, accent) {
    var mat = new THREE.MeshStandardMaterial({
      color: 0x0a1622, roughness: 0.6, metalness: 0.5, emissive: 0x030b12
    });
    var body = new THREE.Mesh(unitBox, mat);
    body.position.set(x, h * 0.36, z);
    body.scale.set(w, h * 0.72, d);
    scene.add(body);
    var upper = new THREE.Mesh(unitBox, mat);
    upper.position.set(x, h * 0.72 + h * 0.14, z);
    upper.scale.set(w * 0.72, h * 0.28, d * 0.72);
    scene.add(upper);

    [body, upper].forEach(function (mesh) {
      var edge = new THREE.LineSegments(unitEdges, new THREE.LineBasicMaterial({
        color: accent, transparent: true, opacity: 0.42
      }));
      edge.position.copy(mesh.position);
      edge.scale.copy(mesh.scale);
      scene.add(edge);
    });

    var stripMat = new THREE.MeshBasicMaterial({
      color: accent, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false
    });
    for (var i = 0; i < 4; i++) {
      var strip = new THREE.Mesh(unitBox, stripMat);
      var sx = x + (i % 2 ? 1 : -1) * (w / 2 - 0.35);
      var sz = z + (i < 2 ? 1 : -1) * (d / 2 + 0.05);
      strip.position.set(sx, h * 0.38, sz);
      strip.scale.set(0.22, h * 0.6, 0.12);
      scene.add(strip);
    }

    var crown = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({
      color: accent, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false
    }));
    crown.position.set(x, h + 0.4, z);
    crown.scale.set(w * 0.4, 0.5, d * 0.4);
    scene.add(crown);

    addGlow(x, h + 1, z, accent, 6, 0.5);
  }

  /* ---------------- 西关 / 老城 / 江岸地标 ---------------- */

  function buildWesternLandmarks() {
    var matCache = {};
    var edgeCache = {};
    var glowCache = {};

    function lmMat(color, emissive) {
      var key = color + ":" + (emissive || 0);
      if (!matCache[key]) {
        matCache[key] = new THREE.MeshStandardMaterial({
          color: color,
          roughness: 0.82,
          metalness: 0.18,
          emissive: emissive || 0x000000,
          emissiveIntensity: 1
        });
      }
      return matCache[key];
    }

    function lmEdge(color) {
      if (!edgeCache[color]) {
        edgeCache[color] = new THREE.LineBasicMaterial({
          color: color, transparent: true, opacity: 0.3
        });
      }
      return edgeCache[color];
    }

    function lmGlowMat(color, opacity) {
      var key = color + ":" + opacity;
      if (!glowCache[key]) {
        glowCache[key] = new THREE.MeshBasicMaterial({
          color: color, transparent: true, opacity: opacity,
          blending: THREE.AdditiveBlending, depthWrite: false
        });
      }
      return glowCache[key];
    }

    function box(group, x, y, z, w, h, d, color, emissive, edgeColor) {
      var mesh = new THREE.Mesh(unitBox, lmMat(color, emissive));
      mesh.position.set(x, y + h / 2, z);
      mesh.scale.set(w, h, d);
      group.add(mesh);
      var edge = new THREE.LineSegments(unitEdges, lmEdge(edgeColor || 0x6a8a96));
      edge.position.copy(mesh.position);
      edge.scale.copy(mesh.scale);
      group.add(edge);
      return mesh;
    }

    function roof(group, x, y, z, w, h, d, color) {
      var mesh = new THREE.Mesh(
        new THREE.ConeGeometry(1, 1, 4),
        new THREE.MeshBasicMaterial({ color: color })
      );
      mesh.rotation.y = Math.PI / 4;
      mesh.position.set(x, y + h / 2, z);
      mesh.scale.set(w * 0.72, h, d * 0.72);
      group.add(mesh);
      var edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(mesh.geometry),
        lmEdge(0xb8894a)
      );
      edge.position.copy(mesh.position);
      edge.rotation.y = Math.PI / 4;
      edge.scale.copy(mesh.scale);
      group.add(edge);
      return mesh;
    }

    function glowBox(group, x, y, z, w, h, d, color, opacity) {
      var mesh = new THREE.Mesh(unitBox, lmGlowMat(color, opacity));
      mesh.position.set(x, y + h / 2, z);
      mesh.scale.set(w, h, d);
      group.add(mesh);
      return mesh;
    }

    /* 陈家祠 */
    var chen = new THREE.Group();
    chen.position.set(-105, 0, -38);
    box(chen, 0, 0, 0, 26, 1.1, 18, 0x2a2118, 0x030201, 0x8a6a3f);
    box(chen, 0, 1.1, 0, 18, 0.4, 12, 0x15110d, 0x020101, 0x8a6a3f);
    box(chen, 0, 1.2, -3.5, 15, 5.2, 8, 0x3a2418, 0x0a0503, 0xb8894a);
    roof(chen, 0, 6.4, -3.5, 18, 3.2, 11, 0x101a20);
    box(chen, -10.5, 1.2, 0, 4, 3.6, 11, 0x332116, 0x080402, 0xb8894a);
    box(chen, 10.5, 1.2, 0, 4, 3.6, 11, 0x332116, 0x080402, 0xb8894a);
    roof(chen, -10.5, 4.8, 0, 5, 2.1, 12, 0x101a20);
    roof(chen, 10.5, 4.8, 0, 5, 2.1, 12, 0x101a20);
    glowBox(chen, 0, 3.2, 0.55, 10, 1.1, 0.1, 0xffb46a, 0.55);
    glowBox(chen, -10.5, 2.7, 5.55, 3, 0.9, 0.1, 0xffb46a, 0.4);
    glowBox(chen, 10.5, 2.7, 5.55, 3, 0.9, 0.1, 0xffb46a, 0.4);
    box(chen, 0, 6.4, -3.5, 19, 0.16, 0.2, 0x8a6a3f, 0x1a0e04, 0xd9a45a);
    addGlow(-115, 5, -32, 0xffb46a, 3, 0.4);
    addGlow(-95, 5, -32, 0xffb46a, 3, 0.4);
    scene.add(chen);

    /* 石室圣心大教堂 */
    var sacred = new THREE.Group();
    sacred.position.set(-62, 0, -40);
    box(sacred, 0, 0, 18, 22, 0.3, 8, 0x3a342b, 0x040404, 0x8a6a3f);
    box(sacred, 0, 0, 0, 26, 0.8, 34, 0x2b2a26, 0x040404, 0x8a6a3f);
    box(sacred, 0, 0.8, -2, 14, 11, 24, 0x6e6a5f, 0x060606, 0xcfc6b4);
    roof(sacred, 0, 11.8, -2, 15, 4.6, 25, 0x101a20);
    box(sacred, 0, 0.8, 11.6, 16, 13, 1.6, 0x77726a, 0x060606, 0xded6c2);
    box(sacred, 0, 0.8, -6, 25, 9.4, 6, 0x6e6a5f, 0x060606, 0xcfc6b4);
    roof(sacred, 0, 10.2, -6, 26, 3.2, 7, 0x101a20);
    box(sacred, 0, 0.8, -15, 10, 8.4, 4.4, 0x6e6a5f, 0x060606, 0xcfc6b4);
    roof(sacred, 0, 9.2, -15, 11, 3, 5.4, 0x101a20);
    [-6.5, 6.5].forEach(function (tx) {
      box(sacred, tx, 0.8, 12.2, 5.2, 20, 5.2, 0x77726a, 0x060606, 0xded6c2);
      roof(sacred, tx, 20.8, 12.2, 6.4, 13.5, 6.4, 0x0f171c);
    });
    glowBox(sacred, 0, 7.2, 12.5, 3.2, 3.2, 0.12, 0x7fb4e6, 0.55);
    glowBox(sacred, 0, 1.0, 12.5, 2.2, 3.4, 0.12, 0xffb46a, 0.5);
    glowBox(sacred, -4.9, 1.0, 12.5, 1.6, 2.6, 0.12, 0xffb46a, 0.45);
    glowBox(sacred, 4.9, 1.0, 12.5, 1.6, 2.6, 0.12, 0xffb46a, 0.45);
    box(sacred, 0, 12.9, 12.45, 16.2, 0.45, 0.45, 0xd9d2c2, 0x0a0908, 0x8a6a3f);
    box(sacred, 0, 13.4, 11.9, 5.6, 3.0, 0.5, 0x77726a, 0x060606, 0xded6c2);
    roof(sacred, 0, 16.4, 11.9, 6.4, 2.6, 2.6, 0x0f171c);
    [-9, -3, 3].forEach(function (wz) {
      glowBox(sacred, -7.08, 3.6, wz, 0.12, 2.4, 1.6, 0x6fa8d0, 0.4);
      glowBox(sacred, 7.08, 3.6, wz, 0.12, 2.4, 1.6, 0x6fa8d0, 0.4);
    });
    addGlow(-62, 3, -20, 0xffc987, 2.2, 0.4);
    var sacredWash = new THREE.PointLight(0xffc48a, 1.5, 55, 2);
    sacredWash.position.set(-62, 9, -19);
    scene.add(sacredWash);
    addGlow(-56.5, 24, -28, 0x9fc6ff, 2.6, 0.25);
    addGlow(-67.5, 24, -28, 0x9fc6ff, 2.6, 0.25);
    scene.add(sacred);

    /* 永庆坊骑楼街 */
    var yong = new THREE.Group();
    yong.position.set(-80, 0, -8);
    for (var yi = 0; yi < 5; yi++) {
      var yx = -11 + yi * 5.5;
      box(yong, yx, 0, 0, 5, 4.6, 6, 0x2a2119, 0x080503, 0x8a6a3f);
      box(yong, yx, 4.6, 0, 5.6, 0.4, 6.6, 0x111a1e, 0x030607, 0xb8894a);
      glowBox(yong, yx, 1.5, 3.05, 3.6, 1.15, 0.08, 0xffb46a, 0.6);
    }
    box(yong, 0, 3.2, 3.2, 27, 0.3, 2.6, 0x1b1410, 0x040201, 0x8a6a3f);
    box(yong, 0, 3.5, 3.2, 27, 0.12, 0.12, 0x8a6a3f, 0x170c03, 0xd9a45a);
    var yongLights = [];
    for (var yl = 0; yl < 18; yl++) {
      yongLights.push(new THREE.Vector3(-13 + yl * 1.55, 3.6, 4.5));
    }
    scene.add(new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(yongLights),
      new THREE.PointsMaterial({ color: 0xffd1a3, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false })
    ));
    scene.add(yong);

    /* 沙面岛 */
    var shamianChurch = new THREE.Group();
    shamianChurch.position.set(-100, 0, 24);
    box(shamianChurch, 0, 0, 0, 3, 7, 3, 0xc9c1ae, 0x0a0906, 0xb8a98c);
    roof(shamianChurch, 0, 7, 0, 3.6, 4.5, 3.6, 0x5a5046);
    box(shamianChurch, 0, 11, 0, 0.18, 2.4, 0.18, 0x6a5a4a, 0x090603, 0xb8a98c);
    box(shamianChurch, 0, 13.1, 0, 1.2, 0.16, 0.16, 0x6a5a4a, 0x090603, 0xb8a98c);
    addGlow(-100, 8, 24, 0xffd7a1, 3.5, 0.3);
    scene.add(shamianChurch);

    var shamianTrees = new THREE.InstancedMesh(
      new THREE.ConeGeometry(0.8, 3.4, 5),
      new THREE.MeshBasicMaterial({ color: 0x10271d }),
      10
    );
    var shamianDummy = new THREE.Object3D();
    for (var st = 0; st < 10; st++) {
      shamianDummy.position.set(-108 + st * 2.4, 1.7, st % 2 ? 31 : 17);
      shamianDummy.scale.set(0.8, 0.8, 0.8);
      shamianDummy.updateMatrix();
      shamianTrees.setMatrixAt(st, shamianDummy.matrix);
    }
    scene.add(shamianTrees);
    shamianTrees.instanceMatrix.needsUpdate = true;

    /* 北京路 */
    var bj = new THREE.Group();
    bj.position.set(-25, 0, -55);
    var street = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 46),
      new THREE.MeshStandardMaterial({ color: 0x0d1418, roughness: 0.92, metalness: 0.05 })
    );
    street.rotation.x = -Math.PI / 2;
    street.position.y = 0.04;
    bj.add(street);
    box(bj, 0, 0.06, 0, 2.4, 0.05, 30, 0x123d4a, 0x0a2a33, 0x6fe3e1);
    box(bj, -5.5, 0, 20, 1.4, 8, 1.4, 0x3a2418, 0x080403, 0xb8894a);
    box(bj, 5.5, 0, 20, 1.4, 8, 1.4, 0x3a2418, 0x080403, 0xb8894a);
    box(bj, 0, 8, 20, 13, 1.2, 2, 0x2a1d14, 0x070402, 0xb8894a);
    roof(bj, 0, 9.2, 20, 15, 2.2, 4, 0x101a20);
    for (var bi = 0; bi < 4; bi++) {
      var bz = -14 + bi * 9;
      box(bj, -8.5, 0, bz, 4, 5.5, 7, 0x241a13, 0x070403, 0x8a6a3f);
      box(bj, 8.5, 0, bz, 4, 5.5, 7, 0x241a13, 0x070403, 0x8a6a3f);
      glowBox(bj, -6.45, 1.6, bz, 0.08, 1.2, 4.8, 0xffb46a, 0.55);
      glowBox(bj, 6.45, 1.6, bz, 0.08, 1.2, 4.8, 0x9fe8ff, 0.45);
    }
    var bjLights = [];
    for (var bl = 0; bl < 22; bl++) {
      bjLights.push(new THREE.Vector3(-5.8 + (bl % 2) * 11.6, 4.2, -18 + Math.floor(bl / 2) * 4));
    }
    bj.add(new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(bjLights),
      new THREE.PointsMaterial({ color: 0xffd1a3, size: 1.1, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false })
    ));
    addGlow(-25, 25, -35, 0xffb46a, 4, 0.3);
    scene.add(bj);

    /* 琶醍 */
    var party = new THREE.Group();
    party.position.set(132, 0, 52);
    var neon = [0xe36bb2, 0xffb46a, 0x6fe3e1, 0xffc857];
    for (var pi = 0; pi < 4; pi++) {
      var px = -15 + pi * 10;
      var ph = 4 + (pi % 2) * 2;
      box(party, px, 0, pi % 2 ? 7 : 0, 9, ph, 8, 0x1a2428, 0x050708, 0x55707c);
      glowBox(party, px, 1.4, (pi % 2 ? 7 : 0) + 4.05, 8.4, 0.8, 0.08, neon[pi % neon.length], 0.75);
      glowBox(party, px, 3.1, (pi % 2 ? 7 : 0) + 4.05, 8.4, 0.35, 0.08, 0x9fe8ff, 0.4);
    }
    var partyLights = [];
    for (var pl = 0; pl < 22; pl++) {
      partyLights.push(new THREE.Vector3(-18 + pl * 1.7, 3.4, 13));
    }
    party.add(new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(partyLights),
      new THREE.PointsMaterial({ color: 0xffd1a3, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false })
    ));
    addGlow(132, 6, 52, 0xe36bb2, 7, 0.35);
    scene.add(party);

    /* 大剧院前的光带 */
    var operaRing = new THREE.Mesh(
      new THREE.TorusGeometry(10, 0.08, 4, 64),
      new THREE.MeshBasicMaterial({
        color: 0x9fe8ff, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    operaRing.rotation.x = Math.PI / 2;
    operaRing.position.set(80, 0.12, -30);
    scene.add(operaRing);
    addGlow(80, 5, -30, 0x9fe8ff, 8, 0.22);
  }

  /* ---------------- 广州塔 ---------------- */

  function buildTower() {
    var group = new THREE.Group();
    group.position.set(35, 0, 45);
    var bodyHeight = 46;
    var levels = 34;
    var columns = 24;
    var twist = Math.PI * 0.74;

    function radiusAt(t) {
      return 3.4 + 9.1 * Math.pow(Math.abs(t - 0.62) / 0.62, 2.3);
    }

    var ringPoints = [];
    for (var j = 0; j <= levels; j++) {
      var t = j / levels;
      var y = t * bodyHeight;
      var r = radiusAt(t);
      var row = [];
      for (var i = 0; i < columns; i++) {
        var angle = (i / columns) * Math.PI * 2 + t * twist;
        row.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
      }
      ringPoints.push(row);
    }

    var positions = [];
    var colors = [];
    var colorBottom = new THREE.Color(0x2fc7d8);
    var colorTop = new THREE.Color(0xe36bb2);

    function pushSegment(a, b) {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
      var ca = colorBottom.clone().lerp(colorTop, clamp(a.y / bodyHeight, 0, 1));
      var cb = colorBottom.clone().lerp(colorTop, clamp(b.y / bodyHeight, 0, 1));
      colors.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b);
    }

    for (var j2 = 0; j2 < levels; j2++) {
      for (var i2 = 0; i2 < columns; i2++) {
        pushSegment(ringPoints[j2][i2], ringPoints[j2 + 1][i2]);
        pushSegment(ringPoints[j2][i2], ringPoints[j2 + 1][(i2 + 1) % columns]);
      }
    }
    for (var j3 = 0; j3 <= levels; j3 += 2) {
      for (var i3 = 0; i3 < columns; i3++) {
        pushSegment(ringPoints[j3][i3], ringPoints[j3][(i3 + 1) % columns]);
      }
    }

    var latticeGeo = new THREE.BufferGeometry();
    latticeGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    latticeGeo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    towerLatticeGeometry = latticeGeo;
    towerLatticeNightColors = new Float32Array(colors);
    towerLatticeDayColors = new Float32Array(colors.length);
    var dayLineColor = new THREE.Color(0x5a7c8a);
    for (var dc = 0; dc < colors.length; dc += 3) {
      towerLatticeDayColors[dc] = dayLineColor.r;
      towerLatticeDayColors[dc + 1] = dayLineColor.g;
      towerLatticeDayColors[dc + 2] = dayLineColor.b;
    }
    towerLineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    group.add(new THREE.LineSegments(latticeGeo, towerLineMaterial));

    var surfacePositions = [];
    var surfaceIndices = [];
    for (var j4 = 0; j4 <= levels; j4++) {
      for (var i4 = 0; i4 < columns; i4++) {
        var p = ringPoints[j4][i4];
        surfacePositions.push(p.x, p.y, p.z);
      }
    }
    for (var j5 = 0; j5 < levels; j5++) {
      for (var i5 = 0; i5 < columns; i5++) {
        var a = j5 * columns + i5;
        var b = j5 * columns + (i5 + 1) % columns;
        var c = (j5 + 1) * columns + i5;
        var d = (j5 + 1) * columns + (i5 + 1) % columns;
        surfaceIndices.push(a, b, c, b, d, c);
      }
    }
    var surfaceGeo = new THREE.BufferGeometry();
    surfaceGeo.setAttribute("position", new THREE.Float32BufferAttribute(surfacePositions, 3));
    surfaceGeo.setIndex(surfaceIndices);
    towerSurfaceMaterial = new THREE.MeshBasicMaterial({
      color: 0x0a3542,
      transparent: true,
      opacity: 0.17,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    var surface = new THREE.Mesh(surfaceGeo, towerSurfaceMaterial);
    group.add(surface);

    var deckMatA = new THREE.MeshBasicMaterial({
      color: 0x6fe3e1, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending
    });
    var deckMatB = new THREE.MeshBasicMaterial({
      color: 0xe36bb2, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending
    });
    towerDeckMaterials.push(deckMatA, deckMatB);

    var deckA = new THREE.Mesh(new THREE.TorusGeometry(6.7, 0.25, 6, 64), deckMatA);
    deckA.rotation.x = Math.PI / 2;
    deckA.position.y = 45.2;
    group.add(deckA);

    var deckB = new THREE.Mesh(new THREE.TorusGeometry(5.7, 0.2, 6, 64), deckMatB);
    deckB.rotation.x = Math.PI / 2;
    deckB.position.y = 48.6;
    group.add(deckB);

    var collar = new THREE.Mesh(
      new THREE.CylinderGeometry(4.4, 6.2, 3.4, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x0d2a35, transparent: true, opacity: 0.5,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    collar.position.y = 47.4;
    group.add(collar);

    var antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.4, 13.4, 8),
      new THREE.MeshBasicMaterial({ color: 0x8fa6b8, transparent: true, opacity: 0.9 })
    );
    antenna.position.y = 52.7;
    group.add(antenna);

    var base = new THREE.Mesh(
      new THREE.CylinderGeometry(13, 15, 1.2, 32),
      new THREE.MeshStandardMaterial({ color: 0x0b1720, roughness: 0.8, metalness: 0.3, emissive: 0x03090d })
    );
    base.position.y = 0.6;
    group.add(base);

    scene.add(group);

    addGlow(35, 45.2, 45, 0x6fe3e1, 9, 0.55);
    addGlow(35, 48.6, 45, 0xe36bb2, 7, 0.5);
    addGlow(35, 60, 45, 0xffd8a0, 4.5, 0.45);

    var plaza = new THREE.Mesh(
      new THREE.CircleGeometry(17, 64),
      new THREE.MeshStandardMaterial({ color: 0x0a141b, roughness: 0.9, metalness: 0.1 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(35, 0.02, 45);
    scene.add(plaza);

    var plazaRing = new THREE.Mesh(
      new THREE.TorusGeometry(15.5, 0.09, 4, 64),
      new THREE.MeshBasicMaterial({
        color: 0x6fe3e1, transparent: true, opacity: 0.28,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    plazaRing.rotation.x = Math.PI / 2;
    plazaRing.position.set(35, 0.14, 45);
    scene.add(plazaRing);

    var plazaLights = [];
    for (var pl = 0; pl < 28; pl++) {
      var pa = (pl / 28) * Math.PI * 2;
      plazaLights.push(new THREE.Vector3(35 + Math.cos(pa) * 15.5, 0.3, 45 + Math.sin(pa) * 15.5));
    }
    var plazaGeo = new THREE.BufferGeometry().setFromPoints(plazaLights);
    scene.add(new THREE.Points(plazaGeo, new THREE.PointsMaterial({
      color: 0xbfe9ff, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.8, depthWrite: false
    })));
  }

  /* ---------------- 白云山 ---------------- */

  function buildMountain() {
    var group = new THREE.Group();
    group.position.set(-45, 0, -175);
    scene.add(group);

    function smoothstep(a, b, x) {
      var t = clamp((x - a) / (b - a), 0, 1);
      return t * t * (3 - 2 * t);
    }

    function srgb(hex) {
      return new THREE.Color(hex).convertSRGBToLinear();
    }

    function hash2(x, y) {
      var n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return n - Math.floor(n);
    }

    function noise2(x, y) {
      var xi = Math.floor(x);
      var yi = Math.floor(y);
      var xf = x - xi;
      var yf = y - yi;
      var u = xf * xf * (3 - 2 * xf);
      var v = yf * yf * (3 - 2 * yf);
      var a = hash2(xi, yi);
      var b = hash2(xi + 1, yi);
      var c = hash2(xi, yi + 1);
      var d = hash2(xi + 1, yi + 1);
      return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
    }

    function heightAt(x, z) {
      var h = 0;
      h += 33 * Math.exp(-((x + 5) * (x + 5) / 620 + (z + 8) * (z + 8) / 420));
      h += 22 * Math.exp(-((x - 52) * (x - 52) / 520 + (z - 6) * (z - 6) / 380));
      h += 15 * Math.exp(-((x - 18) * (x - 18) / 760 + (z + 48) * (z + 48) / 480));
      h += 11 * Math.exp(-((x + 68) * (x + 68) / 520 + (z - 18) * (z - 18) / 420));
      h += 5.5 * (noise2(x * 0.055 + 3.1, z * 0.055 - 1.7) - 0.5);
      h *= smoothstep(130, 98, Math.abs(x));
      h *= smoothstep(80, 58, Math.abs(z));
      return Math.max(0, h);
    }

    var width = 260;
    var depth = 160;
    var segX = isMobile ? 76 : 116;
    var segZ = isMobile ? 46 : 74;
    var positions = [];
    var uvs = [];
    var indices = [];

    for (var iz = 0; iz <= segZ; iz++) {
      var z = -depth / 2 + (iz / segZ) * depth;
      for (var ix = 0; ix <= segX; ix++) {
        var x = -width / 2 + (ix / segX) * width;
        var y = heightAt(x, z);
        positions.push(x, y, z);
        uvs.push(ix / segX, iz / segZ);
        if (ix < segX && iz < segZ) {
          var a = iz * (segX + 1) + ix;
          var b = a + 1;
          var c = a + segX + 1;
          var d = c + 1;
          indices.push(a, c, b, b, c, d);
        }
      }
    }

    var terrainGeo = new THREE.BufferGeometry();
    terrainGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    terrainGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    terrainGeo.setIndex(indices);
    terrainGeo.computeVertexNormals();

    terrainUniforms = {
      fogColor: { value: new THREE.Color(0x0e2a38) },
      light: { value: 0.9 },
      contour: { value: 0.4 }
    };

    var terrainMat = new THREE.ShaderMaterial({
      uniforms: terrainUniforms,
      side: THREE.DoubleSide,
      vertexShader: [
        "varying vec3 vWorld;",
        "varying vec3 vNormal;",
        "void main() {",
        "  vec4 world = modelMatrix * vec4(position, 1.0);",
        "  vWorld = world.xyz;",
        "  vNormal = normalize(mat3(modelMatrix) * normal);",
        "  gl_Position = projectionMatrix * viewMatrix * world;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "varying vec3 vWorld;",
        "varying vec3 vNormal;",
        "uniform vec3 fogColor;",
        "uniform float light;",
        "uniform float contour;",
        "void main() {",
        "  float h = vWorld.y;",
        "  vec3 low = vec3(0.028, 0.085, 0.055);",
        "  vec3 mid = vec3(0.07, 0.20, 0.11);",
        "  vec3 high = vec3(0.25, 0.28, 0.18);",
        "  vec3 rock = vec3(0.33, 0.32, 0.27);",
        "  float t = clamp((h - 1.0) / 34.0, 0.0, 1.0);",
        "  vec3 col = mix(low, mid, smoothstep(0.0, 0.55, t));",
        "  col = mix(col, high, smoothstep(0.55, 0.9, t));",
        "  col = mix(col, rock, smoothstep(0.86, 1.0, t) * 0.55);",
        "  float slope = 1.0 - clamp(normalize(vNormal).y, 0.0, 1.0);",
        "  col = mix(col, rock, smoothstep(0.5, 0.9, slope) * 0.5);",
        "  float shadeNoise = 0.88 + 0.22 * sin(vWorld.x * 0.17 + vWorld.z * 0.11) * sin(vWorld.z * 0.23 - vWorld.x * 0.07);",
        "  col *= shadeNoise;",
        "  float band = abs(fract(h * 0.28) - 0.5);",
        "  col += vec3(0.08, 0.13, 0.09) * smoothstep(0.47, 0.5, band) * contour;",
        "  vec3 n = normalize(vNormal);",
        "  float lit = 0.35 + 0.65 * max(dot(n, normalize(vec3(-0.4, 0.8, 0.25))), 0.0);",
        "  col *= lit * light;",
        "  float dist = length(cameraPosition - vWorld);",
        "  float fog = 1.0 - exp(-dist * dist * 0.0000012);",
        "  col = mix(col, fogColor, clamp(fog, 0.0, 0.9));",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    });

    var terrain = new THREE.Mesh(terrainGeo, terrainMat);
    group.add(terrain);

    var peakH = heightAt(0, -8);
    baiyunPeak.set(-45, peakH, -183);

    var bspot = SPOT_DATA.find(function (item) { return item.id === "baiyun"; });
    if (bspot) {
      bspot.pos.set(-45, peakH + 5, -183);
      bspot.cam.set(48, peakH + 7, -104);
      bspot.target.set(-42, peakH - 4, -183);
    }

    /* 树林 */
    var treeRand = mulberry32(202611);
    var treeData = [];
    var targetTrees = isMobile ? 260 : 760;
    var tries = 0;
    while (treeData.length < targetTrees && tries < targetTrees * 6) {
      tries++;
      var tx = treeRand() * 240 - 120;
      var tz = treeRand() * 148 - 74;
      var th = heightAt(tx, tz);
      if (th < 1.2 || th > peakH - 3) continue;
      var slopeX = Math.abs(heightAt(tx + 2, tz) - heightAt(tx - 2, tz));
      var slopeZ = Math.abs(heightAt(tx, tz + 2) - heightAt(tx, tz - 2));
      if (slopeX + slopeZ > 5.2) continue;
      if (Math.abs(tx) < 9 && Math.abs(tz + 8) < 9) continue;
      if (tx > 18 && tx < 58 && tz > 48 && tz < 78) continue;
      var shade = treeRand() < 0.35 ? 3 : Math.floor(treeRand() * 3);
      treeData.push({
        x: tx, z: tz, h: th,
        s: 0.55 + treeRand() * 1.05,
        shade: shade
      });
    }

    var trunkGeo = new THREE.CylinderGeometry(0.1, 0.18, 1.3, 5);
    trunkGeo.translate(0, 0.65, 0);
    var canopyGeo = new THREE.ConeGeometry(0.9, 2.6, 6);
    canopyGeo.translate(0, 1.3, 0);
    var trunkMesh = new THREE.InstancedMesh(
      trunkGeo,
      new THREE.MeshBasicMaterial({ color: srgb(0x1a130d) }),
      treeData.length
    );
    var canopyMats = [
      new THREE.MeshBasicMaterial({ color: srgb(0x081f13) }),
      new THREE.MeshBasicMaterial({ color: srgb(0x0d2b1a) }),
      new THREE.MeshBasicMaterial({ color: srgb(0x123a22) })
    ];
    var canopyMeshes = canopyMats.map(function (mat) {
      return new THREE.InstancedMesh(canopyGeo, mat, treeData.length);
    });
    var broadleafGeo = new THREE.IcosahedronGeometry(0.85, 0);
    broadleafGeo.translate(0, 1.35, 0);
    var broadleafMesh = new THREE.InstancedMesh(
      broadleafGeo,
      new THREE.MeshBasicMaterial({ color: srgb(0x0e301c) }),
      treeData.length
    );
    var dummy = new THREE.Object3D();
    var shadeCounts = [0, 0, 0];
    var broadleafCount = 0;

    treeData.forEach(function (tree, index) {
      dummy.position.set(tree.x, tree.h, tree.z);
      dummy.scale.set(tree.s, tree.s, tree.s);
      dummy.rotation.y = treeRand() * Math.PI;
      dummy.updateMatrix();
      trunkMesh.setMatrixAt(index, dummy.matrix);
      if (tree.shade === 3) {
        broadleafMesh.setMatrixAt(broadleafCount, dummy.matrix);
        broadleafCount++;
      } else {
        canopyMeshes[tree.shade].setMatrixAt(shadeCounts[tree.shade], dummy.matrix);
        shadeCounts[tree.shade]++;
      }
    });

    trunkMesh.instanceMatrix.needsUpdate = true;
    group.add(trunkMesh);
    canopyMeshes.forEach(function (mesh, i) {
      mesh.count = shadeCounts[i];
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    });
    broadleafMesh.count = broadleafCount;
    broadleafMesh.instanceMatrix.needsUpdate = true;
    group.add(broadleafMesh);

    /* 岩石 */
    var rockRand = mulberry32(4610);
    var rockGeo = new THREE.DodecahedronGeometry(0.8, 0);
    var rocks = new THREE.InstancedMesh(
      rockGeo,
      new THREE.MeshStandardMaterial({ color: 0x30352f, roughness: 1, metalness: 0 }),
      isMobile ? 35 : 70
    );
    var rockDummy = new THREE.Object3D();
    var rockIndex = 0;
    for (var r = 0; r < 240 && rockIndex < rocks.count; r++) {
      var rx = rockRand() * 230 - 115;
      var rz = rockRand() * 140 - 70;
      var rh = heightAt(rx, rz);
      if (rh < 2) continue;
      var rs = 0.35 + rockRand() * 0.9;
      rockDummy.position.set(rx, rh + rs * 0.2, rz);
      rockDummy.scale.set(rs, rs * 0.7, rs);
      rockDummy.rotation.set(rockRand(), rockRand() * Math.PI, rockRand());
      rockDummy.updateMatrix();
      rocks.setMatrixAt(rockIndex, rockDummy.matrix);
      rockIndex++;
    }
    rocks.count = rockIndex;
    rocks.instanceMatrix.needsUpdate = true;
    group.add(rocks);

    /* 登山步道 */
    var trailLocal = [
      [34, 72], [22, 60], [38, 48], [14, 34],
      [28, 20], [6, 6], [-2, -5]
    ];
    var trailPoints = trailLocal.map(function (p) {
      return new THREE.Vector3(p[0], heightAt(p[0], p[1]) + 0.55, p[1]);
    });
    var trailCurve = new THREE.CatmullRomCurve3(trailPoints);
    var trail = new THREE.Mesh(
      new THREE.TubeGeometry(trailCurve, 120, 0.2, 5, false),
      new THREE.MeshBasicMaterial({ color: 0xd8a45e, transparent: true, opacity: 0.62 })
    );
    group.add(trail);
    for (var tl = 0; tl <= 12; tl++) {
      var tp = trailCurve.getPointAt(tl / 12);
      addGlow(group.position.x + tp.x, group.position.y + tp.y + 0.6, group.position.z + tp.z, 0xffd7a1, 2.4, 0.25);
    }

    /* 索道 */
    var cableGroup = new THREE.Group();
    var cableStartX = 55;
    var cableStartZ = 65;
    var cablePoints = [
      new THREE.Vector3(cableStartX, heightAt(cableStartX, cableStartZ) + 7, cableStartZ),
      new THREE.Vector3(20, heightAt(20, 32) + 22, 32),
      new THREE.Vector3(5, heightAt(5, -2) + 27, -2)
    ];
    var cableCurve = new THREE.CatmullRomCurve3(cablePoints);

    var stationBase = new THREE.Mesh(
      unitBox,
      new THREE.MeshStandardMaterial({ color: 0x222a2e, roughness: 0.8, metalness: 0.3, emissive: 0x050a0c })
    );
    stationBase.scale.set(7, 2.4, 6);
    stationBase.position.set(cableStartX, heightAt(cableStartX, cableStartZ) + 1.2, cableStartZ);
    cableGroup.add(stationBase);
    var stationRoof = new THREE.Mesh(
      new THREE.ConeGeometry(5.2, 1.8, 4),
      new THREE.MeshStandardMaterial({ color: 0x151d22, roughness: 0.7, metalness: 0.3 })
    );
    stationRoof.rotation.y = Math.PI / 4;
    stationRoof.position.set(cableStartX, heightAt(cableStartX, cableStartZ) + 3.2, cableStartZ);
    cableGroup.add(stationRoof);
    addGlow(group.position.x + cableStartX, group.position.y + heightAt(cableStartX, cableStartZ) + 4.5, group.position.z + cableStartZ, 0xffc98f, 4, 0.4);

    [-0.32, 0.32].forEach(function (offset) {
      var shifted = cablePoints.map(function (p) {
        return new THREE.Vector3(p.x + offset, p.y + 0.35, p.z);
      });
      var lineGeo = new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(shifted).getPoints(60));
      cableGroup.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({
        color: 0x6f828a, transparent: true, opacity: 0.42
      })));
    });

    [0.28, 0.68].forEach(function (u) {
      var p = cableCurve.getPointAt(u);
      var ground = heightAt(p.x, p.z);
      var tower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.4, p.y - ground, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.8, metalness: 0.4 })
      );
      tower.position.set(p.x, ground + (p.y - ground) / 2, p.z);
      cableGroup.add(tower);
      addGlow(group.position.x + p.x, group.position.y + p.y, group.position.z + p.z, 0xffd7a1, 2, 0.3);
    });

    var cabins = [];
    for (var ci = 0; ci < 2; ci++) {
      var cabin = new THREE.Group();
      var body = new THREE.Mesh(
        unitBox,
        new THREE.MeshStandardMaterial({ color: 0x1c2a33, roughness: 0.6, metalness: 0.4, emissive: 0x04121a })
      );
      body.scale.set(1.6, 1.3, 1.2);
      cabin.add(body);
      var windowMat = new THREE.MeshBasicMaterial({ color: 0xffd7a1, transparent: true, opacity: 0.8 });
      var win = new THREE.Mesh(unitBox, windowMat);
      win.scale.set(1.4, 0.4, 0.08);
      win.position.set(0, 0.15, 0.62);
      cabin.add(win);
      var cabinGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color: 0xffc98f, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      cabinGlow.scale.set(3, 3, 1);
      cabin.add(cabinGlow);
      cableGroup.add(cabin);
      cabins.push({ mesh: cabin, offset: ci * 0.5 });
    }
    group.add(cableGroup);
    baiyunCable = { curve: cableCurve, cabins: cabins, t: 0 };

    /* 摩星岭观景亭 */
    var pavilion = new THREE.Group();
    pavilion.position.set(0, peakH, -8);
    var stone = new THREE.MeshStandardMaterial({ color: 0x3c3a32, roughness: 0.9, metalness: 0.08 });
    var wood = new THREE.MeshStandardMaterial({ color: 0x3a2418, roughness: 0.8, metalness: 0.1 });
    var roofMat = new THREE.MeshStandardMaterial({
      color: 0x3a2a20, roughness: 0.7, metalness: 0.22, emissive: 0x0a0402
    });
    var goldMat = new THREE.MeshStandardMaterial({ color: 0x9a6f3a, roughness: 0.5, metalness: 0.6, emissive: 0x120a02 });

    var deck = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.8, 8), stone);
    deck.position.y = 0.4;
    pavilion.add(deck);

    for (var rail = 0; rail < 16; rail++) {
      var ra = (rail / 16) * Math.PI * 2;
      var post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 5), goldMat);
      post.position.set(Math.cos(ra) * 4.7, 1.0, Math.sin(ra) * 4.7);
      pavilion.add(post);
    }
    var railRing = new THREE.Mesh(
      new THREE.TorusGeometry(4.7, 0.06, 4, 48),
      new THREE.MeshBasicMaterial({ color: 0xffcd91, transparent: true, opacity: 0.35 })
    );
    railRing.rotation.x = Math.PI / 2;
    railRing.position.y = 1.5;
    pavilion.add(railRing);

    for (var col = 0; col < 4; col++) {
      var cx = col < 2 ? -2.5 : 2.5;
      var cz = col % 2 ? -2.2 : 2.2;
      var column = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 3.4, 8), wood);
      column.position.set(cx, 2.2, cz);
      pavilion.add(column);
    }
    var beam = new THREE.Mesh(new THREE.BoxGeometry(6, 0.28, 0.3), goldMat);
    beam.position.set(0, 3.9, 2.2);
    pavilion.add(beam);
    var beam2 = beam.clone();
    beam2.position.z = -2.2;
    pavilion.add(beam2);
    var roof1 = new THREE.Mesh(new THREE.ConeGeometry(5.2, 2.0, 8), roofMat);
    roof1.rotation.y = Math.PI / 8;
    roof1.position.y = 4.8;
    pavilion.add(roof1);
    var roof2 = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.3, 8), roofMat);
    roof2.rotation.y = Math.PI / 8;
    roof2.position.y = 6.05;
    pavilion.add(roof2);
    var roofRing = new THREE.Mesh(
      new THREE.TorusGeometry(5.0, 0.07, 4, 48),
      new THREE.MeshBasicMaterial({ color: 0xd9a45a, transparent: true, opacity: 0.55 })
    );
    roofRing.rotation.x = Math.PI / 2;
    roofRing.position.y = 3.82;
    pavilion.add(roofRing);
    var roofRing2 = new THREE.Mesh(
      new THREE.TorusGeometry(3.35, 0.05, 4, 40),
      new THREE.MeshBasicMaterial({ color: 0xd9a45a, transparent: true, opacity: 0.45 })
    );
    roofRing2.rotation.x = Math.PI / 2;
    roofRing2.position.y = 5.42;
    pavilion.add(roofRing2);

    var ridgePositions = [];
    for (var ridge = 0; ridge < 8; ridge++) {
      var rAngle = (ridge / 8) * Math.PI * 2 + Math.PI / 8;
      ridgePositions.push(0, 6.85, 0);
      ridgePositions.push(Math.cos(rAngle) * 5.02, 3.85, Math.sin(rAngle) * 5.02);
    }
    var ridgeGeo = new THREE.BufferGeometry();
    ridgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(ridgePositions, 3));
    pavilion.add(new THREE.LineSegments(ridgeGeo, new THREE.LineBasicMaterial({
      color: 0xd9a45a, transparent: true, opacity: 0.6
    })));

    var finial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.16, 1.4, 6), goldMat);
    finial.position.y = 6.9;
    pavilion.add(finial);

    var peakLight = new THREE.PointLight(0xffb46a, 1.6, 46, 2);
    peakLight.position.set(0, 5, 0);
    pavilion.add(peakLight);

    var stele = new THREE.Mesh(unitBox, stone);
    stele.scale.set(0.55, 2.2, 0.4);
    stele.position.set(3.7, 1.7, 2.7);
    pavilion.add(stele);
    var sign = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xffd7a1, transparent: true, opacity: 0.6 }));
    sign.scale.set(0.28, 1.0, 0.06);
    sign.position.set(3.7, 1.75, 2.92);
    pavilion.add(sign);

    [[4.1, 4.1], [-4.1, 4.1], [4.1, -4.1], [-4.1, -4.1]].forEach(function (corner) {
      var lantern = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xd34a3a })
      );
      lantern.position.set(corner[0], 1.8, corner[1]);
      pavilion.add(lantern);
      addGlow(
        group.position.x + corner[0],
        group.position.y + peakH + 1.8,
        group.position.z - 8 + corner[1],
        0xff8a5a, 1.6, 0.3
      );
    });

    group.add(pavilion);
    addGlow(group.position.x, group.position.y + peakH + 7, group.position.z - 8, 0xffd7a1, 5, 0.32);
    addGlow(group.position.x - 4.5, group.position.y + peakH + 2, group.position.z - 6, 0xffb46a, 2.5, 0.24);
    addGlow(group.position.x + 4.5, group.position.y + peakH + 2, group.position.z - 6, 0xffb46a, 2.5, 0.24);

    /* 云台花园 */
    var garden = new THREE.Group();
    var gardenX = 34;
    var gardenZ = 68;
    var gardenY = heightAt(gardenX, gardenZ) + 0.35;
    garden.position.set(gardenX, gardenY, gardenZ);
    var terrace = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color: 0x2a2b25, roughness: 0.95 }));
    terrace.scale.set(38, 0.5, 24);
    terrace.position.y = 0.25;
    garden.add(terrace);
    var bedColors = [0xd05a78, 0xe0b35a, 0x9ec9a0, 0xd989b1, 0x8fb8d9, 0xe2d7a1];
    for (var bed = 0; bed < 6; bed++) {
      var bx = -13 + (bed % 3) * 12;
      var bz = bed < 3 ? -5 : 6;
      var bedMesh = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: srgb(bedColors[bed]) }));
      bedMesh.scale.set(8, 0.25, 4.2);
      bedMesh.position.set(bx, 0.62, bz);
      garden.add(bedMesh);
    }
    var hedgeMat = new THREE.MeshStandardMaterial({ color: 0x17402a, roughness: 1 });
    [-18, 18].forEach(function (hx) {
      var hedge = new THREE.Mesh(unitBox, hedgeMat);
      hedge.scale.set(1.2, 1.2, 22);
      hedge.position.set(hx, 0.85, 0);
      garden.add(hedge);
    });
    var fountain = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, 0.8, 24), stone);
    fountain.position.set(0, 0.7, 1);
    garden.add(fountain);
    var fountainWater = new THREE.Mesh(
      new THREE.CylinderGeometry(2.8, 2.8, 0.08, 24),
      new THREE.MeshBasicMaterial({ color: 0x6fe3e1, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending })
    );
    fountainWater.position.set(0, 1.12, 1);
    garden.add(fountainWater);
    addGlow(group.position.x + gardenX, group.position.y + gardenY + 2, group.position.z + gardenZ + 1, 0x9fe8ff, 5, 0.25);
    group.add(garden);

    /* 山雾 */
    var cloudCanvas = document.createElement("canvas");
    cloudCanvas.width = 256;
    cloudCanvas.height = 128;
    var cctx = cloudCanvas.getContext("2d");
    for (var cg = 0; cg < 7; cg++) {
      var gx = 40 + Math.random() * 176;
      var gy = 40 + Math.random() * 48;
      var gr = 26 + Math.random() * 36;
      var grad = cctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      grad.addColorStop(0, "rgba(220,235,238,0.28)");
      grad.addColorStop(1, "rgba(220,235,238,0)");
      cctx.fillStyle = grad;
      cctx.fillRect(0, 0, 256, 128);
    }
    var cloudTexture = new THREE.CanvasTexture(cloudCanvas);
    var mistRand = mulberry32(7731);
    for (var mi = 0; mi < 12; mi++) {
      var mist = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTexture, color: 0xdce8ea, transparent: true,
        opacity: 0.12 + mistRand() * 0.1, depthWrite: false
      }));
      var mx = mistRand() * 220 - 110;
      var mz = mistRand() * 120 - 60;
      var my = 8 + mistRand() * 22;
      mist.position.set(mx, my, mz);
      var ms = 38 + mistRand() * 50;
      mist.scale.set(ms, ms * 0.36, 1);
      group.add(mist);
      baiyunMist.push({ sprite: mist, baseX: mx, speed: 0.08 + mistRand() * 0.14 });
    }
  }

  /* ---------------- 桥 ---------------- */

  function buildBridges() {
    addCableBridge(105, 20, 44, 13, 0x6fe3e1);
    addCableBridge(-55, 18, 38, 10, 0xffb46a);

    var archCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-55, 10, -2),
      new THREE.Vector3(-55, 16, 18),
      new THREE.Vector3(-55, 10, 38)
    );
    var archPoints = archCurve.getPoints(36);
    var archGeo = new THREE.BufferGeometry().setFromPoints(archPoints);
    scene.add(new THREE.Line(archGeo, new THREE.LineBasicMaterial({
      color: 0xffb46a, transparent: true, opacity: 0.55
    })));
  }

  function addCableBridge(x, zCenter, length, pylonHeight, color) {
    var deck = new THREE.Mesh(
      unitBox,
      new THREE.MeshStandardMaterial({ color: 0x12202a, roughness: 0.8, metalness: 0.3, emissive: 0x040a0f })
    );
    deck.position.set(x, 3, zCenter);
    deck.scale.set(4, 0.9, length);
    scene.add(deck);

    var deckEdge = new THREE.LineSegments(unitEdges, new THREE.LineBasicMaterial({
      color: color, transparent: true, opacity: 0.4
    }));
    deckEdge.position.copy(deck.position);
    deckEdge.scale.copy(deck.scale);
    scene.add(deckEdge);

    var pylonMat = new THREE.MeshStandardMaterial({
      color: 0x111e28, roughness: 0.7, metalness: 0.4, emissive: 0x03090d
    });
    var pylonPositions = [zCenter - length * 0.24, zCenter + length * 0.24];
    var cablePoints = [];

    pylonPositions.forEach(function (pz) {
      var pylon = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, pylonHeight, 8), pylonMat);
      pylon.position.set(x, 3 + pylonHeight / 2, pz);
      scene.add(pylon);
      addGlow(x, 3 + pylonHeight + 0.6, pz, color, 4, 0.45);
      for (var i = 0; i <= 8; i++) {
        var targetZ = pz + (i - 4) * (length / 10);
        cablePoints.push(
          new THREE.Vector3(x, 3 + pylonHeight, pz),
          new THREE.Vector3(x, 3.4, targetZ)
        );
      }
    });

    var cableGeo = new THREE.BufferGeometry().setFromPoints(cablePoints);
    scene.add(new THREE.LineSegments(cableGeo, new THREE.LineBasicMaterial({
      color: 0xbfe6ff, transparent: true, opacity: 0.28
    })));

    var lightStrip = new THREE.Mesh(
      unitBox,
      new THREE.MeshBasicMaterial({
        color: color, transparent: true, opacity: 0.65,
        blending: THREE.AdditiveBlending, depthWrite: false
      })
    );
    lightStrip.position.set(x, 3.55, zCenter);
    lightStrip.scale.set(4.2, 0.08, length);
    scene.add(lightStrip);
  }

  /* ---------------- 船只 ---------------- */

  function buildBoats() {
    var rand = mulberry32(707);
    for (var i = 0; i < 6; i++) {
      var group = new THREE.Group();
      var hull = new THREE.Mesh(
        unitBox,
        new THREE.MeshStandardMaterial({ color: 0x16242e, roughness: 0.7, metalness: 0.3, emissive: 0x040b10 })
      );
      hull.scale.set(2.4, 0.5, 0.9);
      hull.position.y = 0.3;
      group.add(hull);

      var cabin = new THREE.Mesh(
        unitBox,
        new THREE.MeshBasicMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.75 })
      );
      cabin.scale.set(1.1, 0.45, 0.65);
      cabin.position.set(-0.2, 0.8, 0);
      group.add(cabin);

      var glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTexture, color: 0xffd6a0, transparent: true, opacity: 0.55,
        blending: THREE.AdditiveBlending, depthWrite: false
      }));
      glow.position.set(0, 0.6, 0);
      glow.scale.set(4, 4, 1);
      group.add(glow);

      group.userData.t = i / 6 + rand() * 0.04;
      group.userData.speed = 0.006 + rand() * 0.006;
      group.userData.dir = i % 2 === 0 ? 1 : -1;
      scene.add(group);
      boats.push(group);
    }
  }

  /* ---------------- 倒影 ---------------- */

  function buildReflections() {
    addReflection(35, 5, 28, 58, 0x6fe3e1, 0.46);
    addReflection(62, 18, 8, 48, 0x8fb6ff, 0.32);
    addReflection(105, 8, 18, 34, 0xffb46a, 0.3);
    addReflection(-55, 6, 18, 30, 0xffb46a, 0.22);
  }

  function addReflection(x, w, z, length, color, opacity) {
    var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: reflectionTexture,
        color: color,
        transparent: true,
        opacity: opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.22, z + length * 0.24);
    mesh.scale.set(w, length, 1);
    mesh.userData.baseOpacity = opacity;
    scene.add(mesh);
    return mesh;
  }

  /* ---------------- 热点 ---------------- */

  function buildHotspots() {
    SPOT_DATA.forEach(function (data) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "hotspot";
      button.innerHTML = '<span class="dot"></span><span class="label">' + data.name + "</span>";
      button.addEventListener("click", function () { openSpot(data); });
      ui.hotspots.appendChild(button);
      spots.push(data);
      hotspots.push({ data: data, el: button });
    });
  }

  function buildLandmarkPanel() {
    ui.lmList.innerHTML = SPOT_DATA.map(function (spot, index) {
      return '<button class="lm-item' + (spot.primary ? " is-primary" : "") + '" type="button" data-spot-id="' + spot.id + '">' +
        '<span class="lm-no">' + String(index + 1).padStart(2, "0") + "</span>" +
        "<span>" +
          '<span class="lm-name">' + spot.name + "</span>" +
          '<span class="lm-meta">' + spot.kicker + (spot.primary ? " · 主镜头" : "") + "</span>" +
          '<span class="lm-sig">' + spot.sig + "</span>" +
        "</span>" +
      "</button>";
    }).join("");
    document.querySelector(".lm-toggle-count").textContent = String(SPOT_DATA.length);
  }

  function openLandmarkPanel() {
    closeSpot();
    ui.landmarkPanel.classList.add("open");
    ui.landmarkPanel.setAttribute("aria-hidden", "false");
    ui.landmarkToggle.setAttribute("aria-expanded", "true");
  }

  function closeLandmarkPanel() {
    ui.landmarkPanel.classList.remove("open");
    ui.landmarkPanel.setAttribute("aria-hidden", "true");
    ui.landmarkToggle.setAttribute("aria-expanded", "false");
  }

  function updateHotspots() {
    var introVisible = !ui.intro.classList.contains("hidden");
    camera.updateMatrixWorld();
    spots.forEach(function (spot, index) {
      var item = hotspots[index];
      if (!item) return;
      var v = spot.pos.clone().project(camera);
      var isActive = activeSpot && activeSpot.id === spot.id;
      var labelAllowed = spot.primary || isActive;
      var visible = !introVisible && labelAllowed && v.z < 1 && v.x > -1.05 && v.x < 1.05 && v.y > -1.05 && v.y < 1.05;
      item.el.classList.toggle("visible", visible);
      if (visible) {
        var sx = (v.x * 0.5 + 0.5) * width;
        var sy = (-v.y * 0.5 + 0.5) * height;
        item.el.style.left = clamp(sx, 78, width - 78) + "px";
        item.el.style.top = clamp(sy, 38, height - 86) + "px";
      }
      item.el.classList.toggle("is-active", isActive);
    });
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function nearbyMarkup(itemsHtml, badge, note) {
    return '<div class="nearby-head"><h3>附近店铺</h3><span>' + badge + "</span></div>" +
      itemsHtml +
      '<p class="nearby-note">' + note + "</p>";
  }

  function nearbyList(items) {
    return "<ul>" + items.map(function (item) {
      return "<li><div><b>" + item[0] + "</b><span>" + item[1] + "</span></div><em>" + item[2] + "</em></li>";
    }).join("") + "</ul>";
  }

  function renderDemoNearby(spot, notePrefix) {
    var items = NEARBY_DEMO[spot.id] || [];
    ui.spotNearby.innerHTML = nearbyMarkup(
      nearbyList(items),
      "示例数据 · 未配置高德",
      (notePrefix || "") + "在 poi-config.js 填入 JS API key 和安全密钥后，这里会显示真实 POI。"
    );
  }

  function poiConfig() {
    var cfg = window.CANTON_AMAP;
    if (!cfg || cfg.enabled !== true) return null;
    if (typeof cfg.key !== "string" || !cfg.key.trim()) return null;
    if (typeof cfg.securityJsCode !== "string" || !cfg.securityJsCode.trim()) return null;
    return cfg;
  }

  function loadAmap() {
    if (amapPromise) return amapPromise;
    amapPromise = new Promise(function (resolve, reject) {
      var cfg = poiConfig();
      if (!cfg) {
        reject(new Error("not_configured"));
        return;
      }
      if (window.AMap && window.AMap.PlaceSearch) {
        resolve(window.AMap);
        return;
      }
      window._AMapSecurityConfig = { securityJsCode: cfg.securityJsCode };
      var script = document.createElement("script");
      script.src = "https://webapi.amap.com/maps?v=2.0&key=" + encodeURIComponent(cfg.key);
      script.async = true;
      script.onload = function () {
        if (!window.AMap) {
          reject(new Error("amap_missing"));
          return;
        }
        window.AMap.plugin("AMap.PlaceSearch", function () {
          if (window.AMap.PlaceSearch) resolve(window.AMap);
          else reject(new Error("amap_plugin_missing"));
        });
      };
      script.onerror = function () {
        reject(new Error("amap_load_failed"));
      };
      document.head.appendChild(script);
    });
    return amapPromise;
  }

  function readPoiCache(spotId) {
    try {
      var raw = localStorage.getItem("canton3d-poi:v2:" + spotId);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || !Array.isArray(data.pois) || Date.now() - data.at > POI_CACHE_TTL) return null;
      return data.pois;
    } catch (error) {
      return null;
    }
  }

  function writePoiCache(spotId, pois) {
    try {
      localStorage.setItem("canton3d-poi:v2:" + spotId, JSON.stringify({ at: Date.now(), pois: pois }));
    } catch (error) { /* 本地缓存不可用时忽略 */ }
  }

  function normalizePoi(poi) {
    return {
      name: String(poi.name || "").slice(0, 80),
      type: String(poi.type || "").slice(0, 80),
      address: String(poi.address || "").slice(0, 120),
      distance: String(poi.distance || "").slice(0, 12)
    };
  }

  function renderPoiItems(pois) {
    if (!pois.length) {
      ui.spotNearby.innerHTML = nearbyMarkup(
        '<p class="nearby-empty">附近暂时没有返回店铺。</p>',
        "高德 · 800 m",
        "POI 数据 © 高德地图"
      );
      return;
    }
    var items = pois.slice(0, 5).map(function (poi) {
      var type = String(poi.type || "").split(";").filter(Boolean).pop() || "附近";
      var distance = poi.distance ? "约 " + poi.distance + " m" : "";
      return [
        escapeHtml(poi.name),
        escapeHtml(type),
        escapeHtml(distance)
      ];
    });
    ui.spotNearby.innerHTML = nearbyMarkup(
      nearbyList(items),
      "高德 · 800 m",
      "POI 数据 © 高德地图"
    );
  }

  function renderNearby(spot) {
    var cfg = poiConfig();
    var coord = SPOT_COORDS[spot.id];
    if (!cfg) {
      renderDemoNearby(spot, "还没有配置高德 JS API key。");
      return;
    }
    if (!coord) {
      renderDemoNearby(spot, "这个地点还没有坐标。");
      return;
    }
    var cached = readPoiCache(spot.id);
    if (cached) {
      renderPoiItems(cached);
      return;
    }
    var requestedId = spot.id;
    ui.spotNearby.innerHTML = nearbyMarkup(
      '<p class="nearby-loading">正在查询附近店铺…</p>',
      "高德 · 800 m",
      "POI 数据 © 高德地图"
    );
    loadAmap()
      .then(function (AMap) {
        if (!activeSpot || activeSpot.id !== requestedId) return;
        var placeSearch = new AMap.PlaceSearch({
          type: "050000|060000",
          pageSize: 8,
          extensions: "base"
        });
        placeSearch.searchNearBy("", [coord[0], coord[1]], 800, function (status, result) {
          if (!activeSpot || activeSpot.id !== requestedId) return;
          if (status === "complete" && result && result.poiList && Array.isArray(result.poiList.pois)) {
            var pois = result.poiList.pois.slice(0, 8).map(normalizePoi);
            writePoiCache(spot.id, pois);
            renderPoiItems(pois);
            return;
          }
          ui.spotNearby.innerHTML = nearbyMarkup(
            '<p class="nearby-empty">高德没有返回附近店铺。</p>',
            "高德 · 未连接",
            "请检查 JS API key、securityJsCode 与域名白名单。"
          );
        });
      })
      .catch(function (error) {
        if (!activeSpot || activeSpot.id !== requestedId) return;
        if (error && error.message === "not_configured") {
          renderDemoNearby(spot, "还没有配置高德 JS API key。");
          return;
        }
        // Only expose our fixed diagnostic codes; never log credentials or SDK URLs.
        var reasons = {
          amap_missing: "SDK 脚本已加载，但 AMap 对象未就绪",
          amap_plugin_missing: "SDK 已就绪，但 PlaceSearch 插件未就绪",
          amap_load_failed: "浏览器未能加载高德 SDK 脚本"
        };
        var code = error && Object.prototype.hasOwnProperty.call(reasons, error.message)
          ? error.message : "amap_unknown_error";
        console.warn("[Canton POI] " + code);
        // A rejected loader must not permanently prevent a later retry.
        amapPromise = null;
        ui.spotNearby.innerHTML = nearbyMarkup(
          '<p class="nearby-empty">附近店铺暂时不可用。</p>',
          "高德 · 未连接",
          "接入诊断：" + (reasons[code] || "加载过程发生未知异常") + "（" + code + "）。"
        );
      });
  }

  function openSpot(spot) {
    if (state.mode === "cinematic") endCinematic();
    closeLandmarkPanel();
    activeSpot = spot;
    var atlasMark = atlasMarkFor(spot.id);
    ui.spotKicker.textContent = spot.kicker +
      (atlasMark === "visited" ? " · 图鉴：去过" :
       atlasMark === "wishlist" ? " · 图鉴：想去" : "");
    ui.spotName.textContent = spot.name;
    ui.spotSig.textContent = spot.sig;
    ui.spotFacts.innerHTML = spot.facts.map(function (fact) {
      return "<div><span>" + fact[0] + "</span><strong>" + fact[1] + "</strong></div>";
    }).join("");
    if (ui.detailBtn) ui.detailBtn.hidden = spot.id !== "chenjiaci" && spot.id !== "sacredheart" && spot.id !== "baiyun" && spot.id !== "shamian" && spot.id !== "yongqingfang" && spot.id !== "tower" && spot.id !== "beijinglu" && spot.id !== "operahouse";
    renderNearby(spot);
    ui.spotCard.classList.add("open");
    ui.spotCard.setAttribute("aria-hidden", "false");
    updateHotspots();
  }

  function closeSpot() {
    activeSpot = null;
    ui.spotCard.classList.remove("open");
    ui.spotCard.setAttribute("aria-hidden", "true");
    updateHotspots();
  }

  /* ---------------- 相机 ---------------- */

  function sampleCinematic(t) {
    var u = clamp(t / state.duration, 0, 1);
    var pos = posCurve.getPointAt(u);
    var target = targetCurve.getPointAt(u);
    if (isMobile) {
      pos = target.clone().add(pos.clone().sub(target).multiplyScalar(1.38));
    }
    camera.position.copy(pos);
    lastTarget.copy(target);
    camera.lookAt(target);
  }

  function applyOrbitCamera() {
    var target = orbit.target;
    camera.position.set(
      target.x + orbit.radius * Math.sin(orbit.phi) * Math.cos(orbit.theta),
      target.y + orbit.radius * Math.cos(orbit.phi),
      target.z + orbit.radius * Math.sin(orbit.phi) * Math.sin(orbit.theta)
    );
    camera.lookAt(target);
    lastTarget.copy(target);
  }

  function deriveOrbitFromCamera() {
    orbit.target.copy(lastTarget);
    var offset = camera.position.clone().sub(orbit.target);
    orbit.radius = clamp(offset.length(), 36, 220);
    orbit.phi = Math.acos(clamp(offset.y / orbit.radius, -1, 1));
    orbit.theta = Math.atan2(offset.z, offset.x);
  }

  function startCinematic(auto) {
    hideIntro();
    closeLandmarkPanel();
    flight = null;
    flightSequence = null;
    ui.spotCard.classList.remove("open");
    ui.spotCard.setAttribute("aria-hidden", "true");
    activeSpot = null;
    state.mode = "cinematic";
    state.time = 0;
    state.paused = false;
    document.body.classList.add("is-cinematic");
    document.body.classList.remove("has-explored");
    ui.hint.classList.remove("visible");
    sampleCinematic(0);
    updateProgress();
    if (!auto) showToast("进入运镜 · 拖动画面可随时接管");
  }

  function endCinematic() {
    if (state.mode !== "cinematic") return;
    state.mode = "free";
    deriveOrbitFromCamera();
    document.body.classList.remove("is-cinematic");
    document.body.classList.add("has-explored");
    ui.hint.classList.add("visible");
    ui.progressFill.style.width = "100%";
    ui.progress.setAttribute("aria-valuenow", String(state.duration));
    ui.chapter.textContent = "自由探索 · 镜头已交给你";
  }

  function startFree() {
    hideIntro();
    state.mode = "free";
    state.time = state.duration;
    state.paused = false;
    flight = null;
    flightSequence = null;
    orbit.target.set(35, 28, 42);
    orbit.radius = 130;
    orbit.theta = 2.55;
    orbit.phi = 1.4;
    applyOrbitCamera();
    document.body.classList.remove("is-cinematic");
    document.body.classList.add("has-explored");
    ui.hint.classList.add("visible");
    ui.progressFill.style.width = "100%";
    ui.progress.setAttribute("aria-valuenow", String(state.duration));
    ui.chapter.textContent = "自由探索 · 镜头已交给你";
    updateHotspots();
  }

  function flyTo(point, target, duration) {
    flightSequence = null;
    state.mode = "focus";
    flight = {
      t: 0,
      duration: duration || 1.8,
      fromPos: camera.position.clone(),
      fromTarget: lastTarget.clone(),
      toPos: point.clone(),
      toTarget: target.clone()
    };
  }

  function updateFlight(dt) {
    if (flightSequence) {
      flightSequence.t += dt / flightSequence.duration;
      var su = clamp(flightSequence.t, 0, 1);
      var se = su * su * (3 - 2 * su);
      camera.position.copy(flightSequence.positions.getPointAt(se));
      lastTarget.copy(flightSequence.targets.getPointAt(se));
      camera.lookAt(lastTarget);
      if (su >= 1) {
        orbit.target.copy(lastTarget);
        var soffset = camera.position.clone().sub(orbit.target);
        orbit.radius = clamp(soffset.length(), 36, 260);
        orbit.phi = Math.acos(clamp(soffset.y / orbit.radius, -1, 1));
        orbit.theta = Math.atan2(soffset.z, soffset.x);
        state.mode = "free";
        flightSequence = null;
      }
      return;
    }
    if (!flight) return;
    flight.t += dt / flight.duration;
    var u = clamp(flight.t, 0, 1);
    var e = u * u * (3 - 2 * u);
    camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
    lastTarget.lerpVectors(flight.fromTarget, flight.toTarget, e);
    camera.lookAt(lastTarget);
    if (u >= 1) {
      orbit.target.copy(lastTarget);
      var offset = camera.position.clone().sub(orbit.target);
      orbit.radius = clamp(offset.length(), 36, 220);
      orbit.phi = Math.acos(clamp(offset.y / orbit.radius, -1, 1));
      orbit.theta = Math.atan2(offset.z, offset.x);
      state.mode = "free";
      flight = null;
    }
  }

  function flyBaiyunSequence() {
    var peak = baiyunPeak;
    var points = [
      camera.position.clone(),
      new THREE.Vector3(-10, 16, -80),
      new THREE.Vector3(20, 30, -95),
      new THREE.Vector3(32, peak.y + 20, -140),
      new THREE.Vector3(55, peak.y + 9, -96),
      new THREE.Vector3(-80, 62, -240)
    ];
    var targets = [
      lastTarget.clone(),
      new THREE.Vector3(-11, 3, -107),
      new THREE.Vector3(-30, 18, -170),
      new THREE.Vector3(-45, peak.y - 2, -183),
      new THREE.Vector3(-40, peak.y - 6, -183),
      new THREE.Vector3(-30, 10, -40)
    ];
    flight = null;
    flightSequence = {
      t: 0,
      duration: 10,
      positions: new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4),
      targets: new THREE.CatmullRomCurve3(targets, false, "catmullrom", 0.4)
    };
    state.mode = "focus";
    showToast("白云山 · 山脚花园 → 摩星岭 → 城市远景");
  }

  function flyToSpot(spot) {
    if (!spot) return;
    if (spot.id === "baiyun") {
      flyBaiyunSequence();
      return;
    }
    flyTo(spot.cam, spot.target, 1.9);
  }

  function flyToOverview() {
    var point = new THREE.Vector3(-71, 50, 113);
    var target = new THREE.Vector3(35, 28, 42);
    flyTo(point, target, 1.6);
  }

  /* ---------------- 交互 ---------------- */

  function bindUI() {
    ui.startBtn.addEventListener("click", function () {
      ui.intro.classList.add("hidden");
      initAudio();
      setSound(true);
      startCinematic(false);
    });

    ui.skipIntroBtn.addEventListener("click", function () {
      initAudio();
      startFree();
    });

    ui.skipBtn.addEventListener("click", function () {
      endCinematic();
      showToast("已接管镜头");
    });

    ui.replayBtn.addEventListener("click", function () {
      closeSpot();
      startCinematic(false);
    });

    ui.dayBtn.addEventListener("click", function () { setDay(!dayState); });
    ui.soundBtn.addEventListener("click", function () { setSound(!soundOn); });

    ui.spotClose.addEventListener("click", closeSpot);
    ui.flyBtn.addEventListener("click", function () { flyToSpot(activeSpot); });
    ui.detailBtn.addEventListener("click", function () {
      var isSacred = activeSpot && activeSpot.id === "sacredheart";
      var isBaiyun = activeSpot && activeSpot.id === "baiyun";
      var isShamian = activeSpot && activeSpot.id === "shamian";
      var isYong = activeSpot && activeSpot.id === "yongqingfang";
      var isTower = activeSpot && activeSpot.id === "tower";
      var isBeijing = activeSpot && activeSpot.id === "beijinglu";
      var isOpera = activeSpot && activeSpot.id === "operahouse";
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: isOpera ? "canton-open-opera" : isTower ? "canton-open-tower" : isBeijing ? "canton-open-beijinglu" : isYong ? "canton-open-yongqingfang" : isBaiyun ? "canton-open-baiyun" : isShamian ? "canton-open-shamian" : isSacred ? "canton-open-sacred" : "canton-open-chen" }, "*");
      } else {
        window.location.href = isOpera ? "operahouse.html?view=plaza" : isTower ? "canton-tower.html?view=base" : isBeijing ? "beijinglu.html?view=ancient" : isYong ? "yongqingfang.html?view=gate" : isBaiyun ? "baiyun.html?view=gate" : isShamian ? "shamian.html?view=lourdes" : isSacred ? "sacred.html?view=street" : "chen.html?view=gate";
      }
    });
    ui.backBtn.addEventListener("click", function () {
      closeSpot();
      flyToOverview();
    });

    ui.landmarkToggle.addEventListener("click", function () {
      if (ui.landmarkPanel.classList.contains("open")) closeLandmarkPanel();
      else openLandmarkPanel();
    });
    ui.lmClose.addEventListener("click", closeLandmarkPanel);
    ui.lmList.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-spot-id]");
      if (!btn) return;
      var spot = SPOT_DATA.find(function (item) { return item.id === btn.dataset.spotId; });
      if (!spot) return;
      closeLandmarkPanel();
      openSpot(spot);
      flyToSpot(spot);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSpot();
        closeLandmarkPanel();
      }
      if (state.mode !== "free") return;
      var step = 0.08;
      if (event.key === "ArrowLeft") { orbit.theta -= step; applyOrbitCamera(); }
      if (event.key === "ArrowRight") { orbit.theta += step; applyOrbitCamera(); }
      if (event.key === "ArrowUp") { orbit.phi = clamp(orbit.phi - step, 0.25, 1.48); applyOrbitCamera(); }
      if (event.key === "ArrowDown") { orbit.phi = clamp(orbit.phi + step, 0.25, 1.48); applyOrbitCamera(); }
      if (event.key === "+" || event.key === "=") { orbit.radius = clamp(orbit.radius * 0.92, 36, 220); applyOrbitCamera(); }
      if (event.key === "-") { orbit.radius = clamp(orbit.radius * 1.08, 36, 220); applyOrbitCamera(); }
    });
  }

  function bindControls() {
    canvas.addEventListener("pointerdown", function (event) {
      closeLandmarkPanel();
      if (state.mode === "cinematic") {
        endCinematic();
        showToast("已接管镜头");
      }
      if (state.mode !== "free") return;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("dragging");
      localPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (localPointers.size === 1) {
        dragState = { x: event.clientX, y: event.clientY };
      } else if (localPointers.size === 2) {
        var pts = Array.from(localPointers.values());
        pinchStart = {
          distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
          radius: orbit.radius
        };
        dragState = null;
      }
    });

    canvas.addEventListener("pointermove", function (event) {
      if (!localPointers.has(event.pointerId)) return;
      localPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (localPointers.size === 2 && pinchStart) {
        var pts = Array.from(localPointers.values());
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        orbit.radius = clamp(pinchStart.radius * (pinchStart.distance / Math.max(1, dist)), 36, 220);
        applyOrbitCamera();
        return;
      }

      if (dragState && state.mode === "free") {
        var dx = event.clientX - dragState.x;
        var dy = event.clientY - dragState.y;
        orbit.theta -= dx * 0.005;
        orbit.phi = clamp(orbit.phi - dy * 0.004, 0.25, 1.48);
        dragState = { x: event.clientX, y: event.clientY };
        applyOrbitCamera();
      }
    });

    function endPointer(event) {
      localPointers.delete(event.pointerId);
      if (localPointers.size === 0) {
        dragState = null;
        pinchStart = null;
        canvas.classList.remove("dragging");
      }
    }
    canvas.addEventListener("pointerup", endPointer);
    canvas.addEventListener("pointercancel", endPointer);

    canvas.addEventListener("wheel", function (event) {
      if (state.mode !== "free") return;
      event.preventDefault();
      orbit.radius = clamp(orbit.radius * (1 + event.deltaY * 0.0009), 36, 220);
      applyOrbitCamera();
    }, { passive: false });
  }

  function bindResize() {
    window.addEventListener("resize", function () {
      width = window.innerWidth;
      height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.2 : 1.8));
      renderer.setSize(width, height, false);
    });
  }

  /* ---------------- 昼夜 ---------------- */

  function setDay(value) {
    dayState = value;
    skyUniforms.topColor.value.setHex(value ? 0x3b5a7a : 0x02060d);
    skyUniforms.horizonColor.value.setHex(value ? 0xc99a6e : 0x163b4c);
    skyUniforms.glowColor.value.setHex(value ? 0xffb877 : 0xb56f4a);
    skyUniforms.sunDir.value.set(value ? 0.55 : -0.45, value ? 0.25 : 0.08, -1).normalize();
    skyUniforms.sunPower.value = value ? 0.4 : 0.9;

    scene.fog.color.setHex(value ? 0x8fa3ad : 0x0e2a38);
    scene.fog.density = value ? 0.0019 : 0.00235;
    if (terrainUniforms) {
      terrainUniforms.fogColor.value.copy(scene.fog.color);
      terrainUniforms.light.value = value ? 1.18 : 0.9;
    }
    renderer.toneMappingExposure = value ? 0.88 : 1.07;
    ambientLight.intensity = value ? 0.6 : 0.55;
    hemiLight.intensity = value ? 0.42 : 0.35;
    dirLight.intensity = value ? 0.7 : 0.5;
    dirLight.color.setHex(value ? 0xffd9b0 : 0x9db8ff);
    dirLight.position.set(value ? 120 : -80, value ? 160 : 100, value ? -80 : -60);

    starField.material.opacity = value ? 0 : 0.9;
    moonSprite.visible = !value;
    sunSprite.visible = value;

    waterUniforms.cDeep.value.setHex(value ? 0x2e5660 : 0x051e28);
    waterUniforms.cShallow.value.setHex(value ? 0x7ba6ab : 0x104a58);
    waterUniforms.cGlow.value.setHex(value ? 0xffe0b0 : 0x6fe3e1);
    waterUniforms.fogColor.value.setHex(value ? 0x8fa3ad : 0x0e2a38);

    buildingMaterials.forEach(function (material) {
      material.map = value ? material.userData.dayMap : material.userData.nightMap;
      material.emissiveMap = material.map;
      material.color.setHex(value ? 0xb9c9d0 : 0xffffff);
      material.emissiveIntensity = value ? 0.32 : 0.55;
      material.needsUpdate = true;
    });
    edgeMaterials.forEach(function (material) { material.opacity = value ? 0.24 : 0.3; });
    windowMaterials.forEach(function (material) { material.opacity = value ? 0.3 : 0.85; });
    glows.forEach(function (sprite) {
      sprite.material.opacity = value ? sprite.userData.baseOpacity * 0.2 : sprite.userData.baseOpacity;
    });

    towerLineMaterial.vertexColors = true;
    towerLineMaterial.color.setHex(0xffffff);
    towerLineMaterial.opacity = value ? 0.82 : 0.74;
    towerLineMaterial.blending = value ? THREE.NormalBlending : THREE.AdditiveBlending;
    towerLineMaterial.needsUpdate = true;
    if (towerLatticeGeometry) {
      var sourceColors = value ? towerLatticeDayColors : towerLatticeNightColors;
      towerLatticeGeometry.setAttribute("color", new THREE.Float32BufferAttribute(sourceColors, 3));
      towerLatticeGeometry.attributes.color.needsUpdate = true;
    }
    towerSurfaceMaterial.opacity = value ? 0.06 : 0.17;
    if (towerDeckMaterials.length === 2) {
      towerDeckMaterials[0].color.setHex(value ? 0x4f7f8e : 0x6fe3e1);
      towerDeckMaterials[0].opacity = value ? 0.3 : 0.9;
      towerDeckMaterials[1].color.setHex(value ? 0x8a6a72 : 0xe36bb2);
      towerDeckMaterials[1].opacity = value ? 0.28 : 0.85;
    }

    ui.dayBtn.textContent = value ? "夜景" : "黄昏";
    ui.dayBtn.setAttribute("aria-pressed", String(value));
  }

  /* ---------------- 声音 ---------------- */

  function initAudio() {
    if (audio) {
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      return;
    }
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      var ctx = new Ctx();
      var master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      var osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 55;
      var osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.value = 82.5;
      var oscGain = ctx.createGain();
      oscGain.gain.value = 0.035;
      osc1.connect(oscGain);
      osc2.connect(oscGain);
      oscGain.connect(master);

      var bufferSize = ctx.sampleRate * 2;
      var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      var data = buffer.getChannelData(0);
      var last = 0;
      for (var i = 0; i < bufferSize; i++) {
        var white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 2.4;
      }
      var noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      var noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = "lowpass";
      noiseFilter.frequency.value = 420;
      var noiseGain = ctx.createGain();
      noiseGain.gain.value = 0.05;
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(master);

      osc1.start();
      osc2.start();
      noise.start();
      audio = { ctx: ctx, master: master };
    } catch (error) {
      audio = null;
    }
  }

  function setSound(value) {
    soundOn = value;
    if (!audio) initAudio();
    if (audio) {
      if (audio.ctx.state === "suspended") audio.ctx.resume();
      audio.master.gain.linearRampToValueAtTime(value ? 0.55 : 0.0, audio.ctx.currentTime + 0.8);
    }
    ui.soundBtn.textContent = value ? "声音 开" : "声音 关";
    ui.soundBtn.setAttribute("aria-pressed", String(value));
  }

  /* ---------------- 主循环 ---------------- */

  function updateProgress() {
    var ratio = clamp(state.time / state.duration, 0, 1);
    ui.progressFill.style.width = (ratio * 100) + "%";
    ui.progress.setAttribute("aria-valuenow", String(Math.round(state.time)));
    var chapter = "01 / 序章 · 江面";
    if (state.time >= 4 && state.time < 9) chapter = "02 / 珠江 · 低空";
    else if (state.time >= 9 && state.time < 14) chapter = "03 / 天际线";
    else if (state.time >= 14) chapter = "04 / 广州塔";
    if (state.mode === "cinematic") ui.chapter.textContent = chapter;
  }

  function updateWorld(dt) {
    if (waterUniforms) waterUniforms.time.value += dt;
    if (baiyunCable) {
      baiyunCable.t = (baiyunCable.t + dt * 0.018) % 1;
      baiyunCable.cabins.forEach(function (cabin, index) {
        var t = (baiyunCable.t + cabin.offset) % 1;
        var point = baiyunCable.curve.getPointAt(t);
        cabin.mesh.position.set(point.x, point.y - 1.0 + Math.sin(performance.now() * 0.001 + index) * 0.08, point.z);
      });
    }
    baiyunMist.forEach(function (mist, index) {
      mist.sprite.position.x = mist.baseX + Math.sin(performance.now() * 0.00005 * (index + 1) + index) * 12;
      mist.sprite.position.z += Math.sin(performance.now() * 0.00003 + index) * 0.002;
    });
    boats.forEach(function (boat) {
      boat.userData.t = (boat.userData.t + dt * boat.userData.speed * boat.userData.dir + 1) % 1;
      var p = riverCurve.getPointAt(boat.userData.t);
      var tangent = riverCurve.getTangentAt(boat.userData.t);
      boat.position.set(p.x, 0.7, p.z);
      boat.rotation.y = Math.atan2(tangent.x, tangent.z) + (boat.userData.dir < 0 ? Math.PI : 0);
    });
    if (state.mode === "cinematic" && !state.paused) {
      state.time += dt;
      if (state.time >= state.duration) {
        state.time = state.duration;
        sampleCinematic(state.time);
        updateProgress();
        endCinematic();
      } else {
        sampleCinematic(state.time);
        updateProgress();
      }
    } else if (state.mode === "focus") {
      updateFlight(dt);
    }
  }

  function startLoop() {
    function frame() {
      window.requestAnimationFrame(frame);
      var dt = Math.min(clock.getDelta(), 0.12);
      updateWorld(dt);
      renderer.render(scene, camera);
      updateHotspots();
      state.frames++;
      var now = performance.now();
      if (now - state.lastFpsAt > 600) {
        state.fps = Math.round((state.frames * 1000) / (now - state.lastFpsAt));
        state.frames = 0;
        state.lastFpsAt = now;
      }
    }
    frame();
  }

  /* ---------------- 查询 / 调试 ---------------- */

  function hideIntro() {
    ui.intro.classList.add("hidden");
    document.body.classList.remove("intro-active");
  }

  function handleQuery() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("embed") === "1") {
      document.body.classList.add("embed");
    }
    if (params.get("auto") === "1" || params.has("t")) {
      hideIntro();
      state.mode = "cinematic";
      document.body.classList.add("is-cinematic");
      var t = params.has("t") ? parseFloat(params.get("t")) : 0;
      state.time = clamp(isNaN(t) ? 0 : t, 0, state.duration);
      state.paused = true;
      sampleCinematic(state.time);
      updateProgress();
      updateHotspots();
      if (params.get("day") === "1") setDay(true);
    }
    var spotId = params.get("spot");
    if (spotId) {
      var spot = SPOT_DATA.find(function (item) { return item.id === spotId; });
      if (spot) {
        hideIntro();
        state.mode = "free";
        document.body.classList.remove("is-cinematic");
        document.body.classList.add("has-explored");
        if (params.get("day") === "1") setDay(true);
        ui.progressFill.style.width = "100%";
        ui.chapter.textContent = "自由探索 · 镜头已交给你";
        ui.hint.classList.add("visible");
        openSpot(spot);
        if (params.get("jump") === "1") {
          camera.position.copy(spot.cam);
          lastTarget.copy(spot.target);
          camera.lookAt(lastTarget);
          deriveOrbitFromCamera();
          updateHotspots();
        } else {
          flyToSpot(spot);
        }
      }
    }
    if (params.get("panel") === "1") {
      hideIntro();
      document.body.classList.remove("is-cinematic");
      document.body.classList.add("has-explored");
      openLandmarkPanel();
    }
  }

  window.__CANTON3D__ = {
    start: function () { hideIntro(); startCinematic(true); },
    seek: function (t) {
      hideIntro();
      state.mode = "cinematic";
      document.body.classList.add("is-cinematic");
      state.time = clamp(Number(t) || 0, 0, state.duration);
      state.paused = true;
      sampleCinematic(state.time);
      updateProgress();
      updateHotspots();
    },
    play: function () { state.paused = false; },
    end: function () { endCinematic(); },
    free: function () { startFree(); },
    day: function (v) { setDay(!!v); },
    sound: function (v) { setSound(!!v); },
    hotspots: function () {
      return SPOT_DATA.map(function (spot) {
        return { id: spot.id, name: spot.name, pos: spot.pos.toArray(), cam: spot.cam.toArray(), target: spot.target.toArray() };
      });
    },
    getState: function () {
      return {
        mode: state.mode,
        time: Number(state.time.toFixed(2)),
        paused: state.paused,
        fps: state.fps,
        day: dayState,
        webgl: state.webgl,
        calls: renderer ? renderer.info.render.calls : 0,
        triangles: renderer ? renderer.info.render.triangles : 0,
        size: [width, height],
        fov: camera ? camera.fov : 0,
        isMobile: isMobile,
        camera: camera ? camera.position.toArray().map(function (n) { return Number(n.toFixed(2)); }) : null,
        spots: spots.length
      };
    }
  };

  if (!initThree()) {
    showFallback();
  }
})();
