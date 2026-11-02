/* 中山纪念堂近景 · 程序化纹理
   蓝琉璃瓦、赭黄墙、白花岗岩、朱红柱、彩绘梁枋、草坪/铺装/树皮/围栏。
   所有纹理在运行时用 canvas 生成，不引入外部图片。 */
(function () {
  "use strict";

  function canvasTexture(draw, w, h, rx, ry) {
    var c = document.createElement("canvas");
    c.width = w || 512;
    c.height = h || 512;
    draw(c.getContext("2d"), c.width, c.height);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx || 1, ry || 1);
    t.anisotropy = 4;
    return t;
  }

  function noise(ctx, w, h, count, size, colors, alpha) {
    for (var i = 0; i < count; i++) {
      ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
      ctx.globalAlpha = alpha == null ? 0.35 : alpha;
      ctx.fillRect(Math.random() * w, Math.random() * h, size, size);
    }
    ctx.globalAlpha = 1;
  }

  function build(renderer) {
    var blueTile = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#173152";
      ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 56) {
        ctx.fillStyle = "rgba(8,18,34,0.6)";
        ctx.fillRect(0, y, w, 5);
        for (var x = 0; x < w; x += 56) {
          var v = 46 + Math.floor(Math.random() * 42);
          ctx.fillStyle = "rgb(" + Math.floor(v * 0.62) + "," + Math.floor(v * 0.96) + "," + (v + 62) + ")";
          ctx.fillRect(x + 3, y + 7, 50, 46);
          ctx.fillStyle = "rgba(150,190,225,0.22)";
          ctx.fillRect(x + 6, y + 8, 8, 42);
          ctx.fillStyle = "rgba(4,12,24,0.3)";
          ctx.fillRect(x + 48, y + 7, 5, 46);
        }
      }
      ctx.strokeStyle = "rgba(180,210,235,0.12)";
      ctx.lineWidth = 1;
      for (var xx = 0; xx < w; xx += 56) {
        ctx.beginPath();
        ctx.moveTo(xx, 0);
        ctx.lineTo(xx, h);
        ctx.stroke();
      }
    }, 512, 512, 4, 2);

    var ochreWall = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#bf965a";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 4200, 2, ["#cfa870", "#ad8249", "#d5b47c", "#9d7743"], 0.35);
      for (var y = 0; y < h; y += 64) {
        ctx.fillStyle = "rgba(120,84,40,0.08)";
        ctx.fillRect(0, y, w, 2);
      }
      ctx.fillStyle = "rgba(255,236,195,0.08)";
      ctx.fillRect(0, 0, w, 18);
    }, 512, 512, 4, 4);

    var granite = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#c6c0b2";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 5200, 2, ["#ddd8cc", "#b1aa9a", "#e8e3d7", "#9c9586"], 0.45);
      for (var i = 0; i < 90; i++) {
        ctx.strokeStyle = "rgba(120,114,100,0.16)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        var x = Math.random() * w, y = Math.random() * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 12 + Math.random() * 28, y + (Math.random() - 0.5) * 8);
        ctx.stroke();
      }
    }, 512, 512, 6, 6);

    var graniteLight = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#ded8cc";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 3800, 2, ["#ece7db", "#ccc5b7", "#f5f0e6", "#bbb3a3"], 0.32);
    }, 512, 512, 4, 4);

    var paving = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#a8a295";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 3000, 2, ["#b7b1a4", "#999387", "#c2bcaf"], 0.28);
      ctx.strokeStyle = "rgba(82,78,68,0.3)";
      ctx.lineWidth = 2;
      for (var n = 0; n <= w; n += 64) {
        ctx.beginPath(); ctx.moveTo(n, 0); ctx.lineTo(n, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, n); ctx.lineTo(w, n); ctx.stroke();
      }
    }, 512, 512, 18, 18);

    var grass = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#405c36";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 6200; i++) {
        var g = 66 + Math.floor(Math.random() * 54);
        ctx.fillStyle = "rgba(" + Math.floor(g * 0.55) + "," + g + "," + Math.floor(g * 0.48) + ",0.5)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      for (var j = 0; j < 22; j++) {
        ctx.fillStyle = "rgba(70,92,48,0.18)";
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, 18 + Math.random() * 30, 10 + Math.random() * 18, Math.random() * 3, 0, 6.3);
        ctx.fill();
      }
    }, 512, 512, 22, 22);

    var redLacquer = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#8e3028";
      ctx.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 5) {
        ctx.strokeStyle = "rgba(" + (105 + Math.random() * 40) + "," + (30 + Math.random() * 20) + "," + (24 + Math.random() * 16) + ",0.35)";
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.random() - 0.5) * 4, h);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255,190,150,0.08)";
      ctx.fillRect(0, 0, 10, h);
    }, 256, 512, 2, 2);

    var paintedBeam = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#1e4650";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#c9a25a";
      ctx.fillRect(0, 0, w, 6);
      ctx.fillRect(0, h - 6, w, 6);
      for (var x = 0; x < w; x += 96) {
        ctx.fillStyle = "#8f2f28";
        ctx.fillRect(x + 8, 18, 38, h - 36);
        ctx.fillStyle = "#d9b16a";
        ctx.fillRect(x + 14, 26, 4, h - 52);
        ctx.fillRect(x + 36, 26, 4, h - 52);
        ctx.fillStyle = "#e7dfc7";
        ctx.beginPath();
        ctx.moveTo(x + 62, 22);
        ctx.lineTo(x + 80, h / 2);
        ctx.lineTo(x + 62, h - 22);
        ctx.lineTo(x + 48, h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#8f2f28";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(220,190,130,0.5)";
      ctx.lineWidth = 2;
      ctx.strokeRect(4, 10, w - 8, h - 20);
    }, 512, 128, 4, 1);

    var brick = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#9f6a3d";
      ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 32) {
        var off = (Math.floor(y / 32) % 2) * 32;
        for (var x = -32; x < w; x += 64) {
          var v = 128 + Math.floor(Math.random() * 34);
          ctx.fillStyle = "rgb(" + v + "," + Math.floor(v * 0.67) + "," + Math.floor(v * 0.42) + ")";
          ctx.fillRect(x + off + 2, y + 2, 60, 28);
        }
        ctx.fillStyle = "rgba(84,56,32,0.45)";
        ctx.fillRect(0, y, w, 3);
      }
    }, 512, 512, 5, 5);

    var leaf = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#2e4a2e";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 2600; i++) {
        var g = 62 + Math.floor(Math.random() * 58);
        ctx.fillStyle = "rgba(" + Math.floor(g * 0.55) + "," + g + "," + Math.floor(g * 0.46) + ",0.5)";
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 6.3);
        ctx.fill();
      }
    }, 512, 512, 2, 2);

    var leafDark = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#223a28";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 2100; i++) {
        var g = 46 + Math.floor(Math.random() * 46);
        ctx.fillStyle = "rgba(" + Math.floor(g * 0.5) + "," + g + "," + Math.floor(g * 0.42) + ",0.55)";
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 6.3);
        ctx.fill();
      }
    }, 512, 512, 2, 2);

    var trunk = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#5c4936";
      ctx.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 7) {
        ctx.strokeStyle = "rgba(" + (38 + Math.random() * 32) + "," + (28 + Math.random() * 22) + "," + (18 + Math.random() * 16) + ",0.45)";
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.random() - 0.5) * 16, h);
        ctx.stroke();
      }
      for (var i = 0; i < 90; i++) {
        ctx.fillStyle = "rgba(120,140,80,0.18)";
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 6.3);
        ctx.fill();
      }
    }, 256, 512, 2, 3);

    var asphalt = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#34393c";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 5200, 2, ["#464b4e", "#262b2e", "#555a5c"], 0.25);
      ctx.fillStyle = "rgba(220,220,210,0.5)";
      for (var x = 10; x < w; x += 96) ctx.fillRect(x, h * 0.48, 46, 4);
    }, 512, 512, 12, 2);

    var cityWindow = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#8f938f";
      ctx.fillRect(0, 0, w, h);
      for (var y = 8; y < h; y += 18) {
        for (var x = 8; x < w; x += 18) {
          ctx.fillStyle = Math.random() > 0.34 ? "rgba(56,70,78,0.8)" : "rgba(216,194,146,0.7)";
          ctx.fillRect(x, y, 10, 9);
        }
      }
    }, 256, 256, 4, 7);

    var fence = canvasTexture(function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#2b3336";
      ctx.fillRect(0, 12, w, 12);
      ctx.fillRect(0, h - 18, w, 10);
      for (var x = 8; x < w; x += 28) {
        ctx.fillRect(x, 16, 5, h - 30);
        ctx.beginPath();
        ctx.moveTo(x - 2, 16);
        ctx.lineTo(x + 2.5, 2);
        ctx.lineTo(x + 7, 16);
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = "rgba(210,220,220,0.16)";
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 13, w - 2, 10);
    }, 512, 256, 8, 1);

    var windowTex = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#2a3742";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#8f2f28";
      ctx.fillRect(0, 0, w, 12);
      ctx.fillRect(0, h - 30, w, 12);
      ctx.fillRect(0, 0, 12, h);
      ctx.fillRect(w - 12, 0, 12, h);
      ctx.fillRect(w / 2 - 4, 10, 8, h - 30);
      ctx.fillRect(0, h * 0.5 - 4, w, 8);
      ctx.fillStyle = "rgba(18,26,32,0.55)";
      ctx.fillRect(16, 22, w - 32, h * 0.44);
      ctx.fillStyle = "#c6c0b2";
      ctx.fillRect(0, h - 18, w, 18);
    }, 128, 256, 1, 1);

    var doorTex = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#5b211d";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#c9a25a";
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.strokeRect(22, 24, w - 44, h * 0.42);
      ctx.strokeRect(22, h * 0.55, w - 44, h * 0.38);
      ctx.fillStyle = "#d9b56e";
      for (var y = 34; y < h - 28; y += 30) {
        for (var x = 32; x < w - 24; x += 28) {
          ctx.beginPath();
          ctx.arc(x, y, 2.2, 0, 6.3);
          ctx.fill();
        }
      }
    }, 128, 256, 1, 1);

    var gateBars = canvasTexture(function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#71241f";
      for (var x = 14; x < w; x += 34) ctx.fillRect(x, 0, 5, h);
      for (var y = 12; y < h; y += 62) ctx.fillRect(0, y, w, 5);
    }, 256, 256, 1, 1);

    return {
      blueTile: blueTile,
      ochreWall: ochreWall,
      granite: granite,
      graniteLight: graniteLight,
      paving: paving,
      grass: grass,
      redLacquer: redLacquer,
      paintedBeam: paintedBeam,
      brick: brick,
      leaf: leaf,
      leafDark: leafDark,
      trunk: trunk,
      asphalt: asphalt,
      cityWindow: cityWindow,
      fence: fence,
      window: windowTex,
      door: doorTex,
      gateBars: gateBars
    };
  }

  function makePlaque(text, w, h) {
    var c = document.createElement("canvas");
    c.width = w || 768;
    c.height = h || 224;
    var ctx = c.getContext("2d");
    var grad = ctx.createLinearGradient(0, 0, 0, c.height);
    grad.addColorStop(0, "#1d4167");
    grad.addColorStop(1, "#102b49");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#8f2f28";
    ctx.lineWidth = Math.max(12, c.height * 0.07);
    ctx.strokeRect(ctx.lineWidth / 2 + 2, ctx.lineWidth / 2 + 2, c.width - ctx.lineWidth - 4, c.height - ctx.lineWidth - 4);
    ctx.strokeStyle = "#d9b56e";
    ctx.lineWidth = Math.max(2, c.height * 0.012);
    ctx.strokeRect(ctx.lineWidth + 12, ctx.lineWidth + 12, c.width - ctx.lineWidth * 2 - 24, c.height - ctx.lineWidth * 2 - 24);
    ctx.fillStyle = "#e7c47c";
    ctx.font = "bold " + Math.floor(c.height * 0.46) + "px 'Songti SC', 'STSong', 'SimSun', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, c.height / 2 + c.height * 0.02);
    ctx.fillStyle = "rgba(231,196,124,0.7)";
    var corner = Math.max(5, c.height * 0.025);
    [[20, 20], [c.width - 20 - corner, 20], [20, c.height - 20 - corner], [c.width - 20 - corner, c.height - 20 - corner]].forEach(function (p) {
      ctx.fillRect(p[0], p[1], corner, corner);
    });
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function makeInscription() {
    var c = document.createElement("canvas");
    c.width = 384;
    c.height = 512;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#d6cdbb";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#8a7f6b";
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, c.width - 16, c.height - 16);
    ctx.fillStyle = "#413a2e";
    ctx.font = "bold 40px 'Songti SC', 'STSong', 'SimSun', serif";
    ctx.textAlign = "center";
    ctx.fillText("建国大纲", c.width / 2, 62);
    ctx.strokeStyle = "#7a6e59";
    ctx.lineWidth = 1;
    for (var col = 0; col < 9; col++) {
      var x = 52 + col * 34;
      for (var row = 0; row < 12; row++) {
        var y = 100 + row * 30;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 18);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 8, y + 5);
        ctx.lineTo(x + 8, y + 5);
        ctx.stroke();
      }
    }
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  function makeTextTexture(text, w, h, color, bg) {
    var c = document.createElement("canvas");
    c.width = w || 512;
    c.height = h || 128;
    var ctx = c.getContext("2d");
    if (bg) {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    ctx.fillStyle = color || "#e8dcc4";
    ctx.font = "bold " + Math.floor(c.height * 0.54) + "px 'Songti SC', 'STSong', 'SimSun', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, c.width / 2, c.height / 2 + c.height * 0.02);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    return t;
  }

  window.MemorialTextures = { build: build, makePlaque: makePlaque, makeInscription: makeInscription, makeTextTexture: makeTextTexture };
})();
