/* 广东省博物馆近景 · 程序化纹理（全部 canvas 生成，不使用版权贴图） */
(function () {
  "use strict";

  function makeCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function tex(renderer, canvas, repeat) {
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    t.needsUpdate = true;
    return t;
  }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* 深灰铝板：1.5 m 模数，拉丝 + 细噪点 + 板缝 */
  function metalPlates() {
    var c = makeCanvas(512, 512);
    var g = c.getContext("2d");
    g.fillStyle = "#3f4446";
    g.fillRect(0, 0, 512, 512);
    var r = rng(31);
    for (var i = 0; i < 4200; i++) {
      var x = r() * 512, y = r() * 512;
      var l = 8 + r() * 26;
      g.strokeStyle = "rgba(" + (150 + Math.floor(r() * 40)) + "," + (155 + Math.floor(r() * 40)) + "," + (158 + Math.floor(r() * 40)) + "," + (0.03 + r() * 0.06) + ")";
      g.lineWidth = 0.6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + l);
      g.stroke();
    }
    for (i = 0; i < 900; i++) {
      g.fillStyle = "rgba(20,24,26," + (0.03 + r() * 0.07) + ")";
      g.fillRect(r() * 512, r() * 512, 1 + r() * 2, 1 + r() * 2);
    }
    // 一块板 = 一张贴图；四边板缝
    g.strokeStyle = "rgba(18,21,22,0.92)";
    g.lineWidth = 5;
    g.strokeRect(0, 0, 512, 512);
    g.strokeStyle = "rgba(140,148,150,0.22)";
    g.lineWidth = 1.5;
    g.strokeRect(5, 5, 502, 502);
    return c;
  }

  /* 红漆内壁 */
  function redPaint() {
    var c = makeCanvas(256, 256);
    var g = c.getContext("2d");
    g.fillStyle = "#a51f26";
    g.fillRect(0, 0, 256, 256);
    var r = rng(77);
    for (var i = 0; i < 2600; i++) {
      g.fillStyle = "rgba(" + (120 + Math.floor(r() * 90)) + "," + (12 + Math.floor(r() * 30)) + "," + (16 + Math.floor(r() * 26)) + "," + (0.05 + r() * 0.1) + ")";
      g.fillRect(r() * 256, r() * 256, 1 + r() * 5, 1 + r() * 3);
    }
    for (i = 0; i < 40; i++) {
      g.strokeStyle = "rgba(80,8,12," + (0.06 + r() * 0.08) + ")";
      g.lineWidth = 0.8;
      g.beginPath();
      g.moveTo(r() * 256, r() * 256);
      g.lineTo(r() * 256, r() * 256);
      g.stroke();
    }
    return c;
  }

  /* 深色玻璃（格栅窗内）：无缝平色，避免渐变按 1.5 m 重复成横向条带 */
  function darkGlass() {
    var c = makeCanvas(512, 512);
    var g = c.getContext("2d");
    g.fillStyle = "#24363d";
    g.fillRect(0, 0, 512, 512);
    var r = rng(153);
    for (var i = 0; i < 1400; i++) {
      var v = r();
      g.fillStyle = v > 0.5
        ? "rgba(150,184,198," + (0.012 + r() * 0.03) + ")"
        : "rgba(8,14,17," + (0.02 + r() * 0.04) + ")";
      g.fillRect(r() * 512, r() * 512, 1 + r() * 3, 1 + r() * 3);
    }
    g.strokeStyle = "rgba(8,13,15,0.6)";
    g.lineWidth = 1.6;
    for (i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 128, 0);
      g.lineTo(i * 128, 512);
      g.stroke();
    }
    g.strokeStyle = "rgba(170,200,214,0.09)";
    g.lineWidth = 1.2;
    for (i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(i * 128 + 2, 0);
      g.lineTo(i * 128 + 2, 512);
      g.stroke();
    }
    return c;
  }

  /* 花岗石铺装：4×4 块，1.5 m 一块 → 每 6 m 重复 */
  function paving() {
    var c = makeCanvas(512, 512);
    var g = c.getContext("2d");
    g.fillStyle = "#8b8d8a";
    g.fillRect(0, 0, 512, 512);
    var r = rng(209);
    var cell = 128;
    for (var y = 0; y < 4; y++) {
      for (var x = 0; x < 4; x++) {
        var v = 128 + Math.floor(r() * 26);
        g.fillStyle = "rgb(" + v + "," + (v + 1) + "," + (v - 2) + ")";
        g.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
        for (var i = 0; i < 90; i++) {
          g.fillStyle = "rgba(60,62,60," + (0.03 + r() * 0.05) + ")";
          g.fillRect(x * cell + r() * cell, y * cell + r() * cell, 1 + r() * 2, 1 + r() * 2);
        }
      }
    }
    g.strokeStyle = "rgba(58,60,58,0.75)";
    g.lineWidth = 3;
    for (var k = 0; k <= 4; k++) {
      g.beginPath(); g.moveTo(k * cell, 0); g.lineTo(k * cell, 512); g.stroke();
      g.beginPath(); g.moveTo(0, k * cell); g.lineTo(512, k * cell); g.stroke();
    }
    return c;
  }

  /* 草坡 */
  function grass() {
    var c = makeCanvas(256, 256);
    var g = c.getContext("2d");
    g.fillStyle = "#5b7247";
    g.fillRect(0, 0, 256, 256);
    var r = rng(311);
    for (var i = 0; i < 7000; i++) {
      var v = 70 + Math.floor(r() * 60);
      g.strokeStyle = "rgba(" + (v - 12) + "," + v + "," + (v - 34) + "," + (0.2 + r() * 0.3) + ")";
      g.lineWidth = 1;
      var x = r() * 256, y = r() * 256;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 3, y - 2 - r() * 4);
      g.stroke();
    }
    return c;
  }

  /* 城市窗光：白天深灰窗格，夜间可作 emissiveMap */
  function cityWindows() {
    var c = makeCanvas(256, 512);
    var g = c.getContext("2d");
    g.fillStyle = "#50585c";
    g.fillRect(0, 0, 256, 512);
    var r = rng(419);
    var cols = 12, rows = 26;
    for (var y = 0; y < rows; y++) {
      for (var x = 0; x < cols; x++) {
        var lit = r();
        var color = "#2c3438";
        if (lit > 0.78) {
          color = r() > 0.6 ? "rgba(255,214,160,0.9)" : "rgba(196,232,255,0.85)";
        } else if (lit > 0.66) {
          color = "rgba(150,160,164,0.4)";
        }
        g.fillStyle = color;
        g.fillRect(x * 21 + 4, y * 19 + 4, 13, 11);
      }
    }
    g.strokeStyle = "rgba(10,12,13,0.8)";
    g.lineWidth = 2;
    g.strokeRect(0, 0, 256, 512);
    return c;
  }

  /* 字牌：透明底白字，直接贴在铝板上（只写馆名，不做 LOGO） */
  function signBoard() {
    var c = makeCanvas(1280, 256);
    var g = c.getContext("2d");
    g.fillStyle = "#ece9df";
    g.font = '600 148px "Songti SC", "STSong", "SimSun", serif';
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.shadowColor = "rgba(0,0,0,0.55)";
    g.shadowBlur = 10;
    g.shadowOffsetY = 3;
    g.fillText("广东省博物馆", 640, 136);
    return c;
  }

  /* 屋面砾石 */
  function roofGravel() {
    var c = makeCanvas(256, 256);
    var g = c.getContext("2d");
    g.fillStyle = "#5a5d5b";
    g.fillRect(0, 0, 256, 256);
    var r = rng(523);
    for (var i = 0; i < 6500; i++) {
      var v = 70 + Math.floor(r() * 50);
      g.fillStyle = "rgba(" + v + "," + (v + 1) + "," + (v - 1) + "," + (0.25 + r() * 0.35) + ")";
      g.fillRect(r() * 256, r() * 256, 1 + r() * 2.4, 1 + r() * 2);
    }
    return c;
  }

  /* 中央天窗：深色玻璃 + 2 m 分格 */
  function skylight() {
    var c = makeCanvas(512, 512);
    var g = c.getContext("2d");
    var grd = g.createLinearGradient(0, 0, 512, 512);
    grd.addColorStop(0, "#7d979a");
    grd.addColorStop(0.48, "#547072");
    grd.addColorStop(1, "#395153");
    g.fillStyle = grd;
    g.fillRect(0, 0, 512, 512);
    var r = rng(617);
    for (i = 0; i < 6; i++) {
      g.strokeStyle = "rgba(196,220,222," + (0.05 + r() * 0.06) + ")";
      g.lineWidth = 10 + r() * 22;
      g.beginPath();
      g.moveTo(-40 + r() * 180, 500);
      g.lineTo(300 + r() * 260, -30);
      g.stroke();
    }
    g.strokeStyle = "rgba(14,22,22,0.85)";
    g.lineWidth = 3;
    for (var i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 512); g.stroke();
      g.beginPath(); g.moveTo(0, i * 64); g.lineTo(512, i * 64); g.stroke();
    }
    g.strokeStyle = "rgba(170,196,188,0.18)";
    g.lineWidth = 1;
    for (i = 0; i <= 8; i++) {
      g.beginPath(); g.moveTo(i * 64 + 2, 0); g.lineTo(i * 64 + 2, 512); g.stroke();
    }
    return c;
  }

  /* 珠江水面 */
  function water() {
    var c = makeCanvas(512, 512);
    var g = c.getContext("2d");
    g.fillStyle = "#1c2c33";
    g.fillRect(0, 0, 512, 512);
    var r = rng(631);
    for (var i = 0; i < 900; i++) {
      var y = r() * 512;
      g.strokeStyle = "rgba(" + (90 + Math.floor(r() * 60)) + "," + (110 + Math.floor(r() * 60)) + "," + (118 + Math.floor(r() * 60)) + "," + (0.03 + r() * 0.08) + ")";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(r() * 300, y);
      g.lineTo(r() * 300 + 120, y + (r() - 0.5) * 2);
      g.stroke();
    }
    return c;
  }

  /* 径向光晕 */
  function glow() {
    var c = makeCanvas(128, 128);
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(64, 64, 2, 64, 64, 62);
    grd.addColorStop(0, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.3, "rgba(255,240,214,0.45)");
    grd.addColorStop(1, "rgba(255,240,214,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return c;
  }

  function build(renderer) {
    var T = {};
    T.metal = tex(renderer, metalPlates());
    T.red = tex(renderer, redPaint());
    T.glass = tex(renderer, darkGlass());
    T.paving = tex(renderer, paving());
    T.grass = tex(renderer, grass());
    T.city = tex(renderer, cityWindows());
    T.sign = tex(renderer, signBoard());
    T.roof = tex(renderer, roofGravel());
    T.skylight = tex(renderer, skylight());
    T.water = tex(renderer, water());
    T.glow = tex(renderer, glow());
    T.metal.encoding = THREE.sRGBEncoding;
    return T;
  }

  window.GdMuseumTextures = { build: build };
})();
