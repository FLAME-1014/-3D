/* 广州大剧院近景 · 程序化纹理（无外部贴图） */
(function () {
  "use strict";

  var seed = 20261031;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  function range(a, b) { return a + rnd() * (b - a); }

  function canvasTexture(draw, w, h, opts) {
    opts = opts || {};
    var c = document.createElement("canvas");
    c.width = w || 512;
    c.height = h || 512;
    draw(c.getContext("2d"), c.width, c.height);
    var t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = opts.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    t.repeat.set(opts.rx || 1, opts.ry || 1);
    t.anisotropy = 4;
    t.encoding = opts.linear ? THREE.LinearEncoding : THREE.sRGBEncoding;
    return t;
  }

  function noise(ctx, w, h, n, alpha) {
    for (var i = 0; i < n; i++) {
      var g = Math.floor(rnd() * 80);
      ctx.fillStyle = "rgba(" + g + "," + g + "," + (g + 3) + "," + (alpha * (0.3 + rnd() * 0.7)).toFixed(3) + ")";
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
    }
  }

  /* 三角板缝：三族平行线，斜线周期与画布宽度对齐，保证无缝 */
  function triangleSeams(ctx, w, h, color, width, alpha) {
    var step = w / 4;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha;
    var dy = (w * Math.tan(Math.PI / 6)) / 4;
    for (var y = 0; y <= h + step; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (var c = -h; c <= w + h; c += dy) {
      ctx.beginPath(); ctx.moveTo(c - h * 0.577, 0); ctx.lineTo(c, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c + h * 0.577, 0); ctx.lineTo(c, h); ctx.stroke();
    }
    ctx.restore();
  }

  function rainStreaks(ctx, w, h, light, dark, count) {
    for (var i = 0; i < count; i++) {
      var x = rnd() * w;
      var len = h * (0.25 + rnd() * 0.75);
      var wid = 1 + rnd() * 9;
      var g = ctx.createLinearGradient(0, 0, 0, len);
      var col = rnd() > 0.45 ? light : dark;
      g.addColorStop(0, "rgba(" + col + "," + (0.05 + rnd() * 0.1).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + col + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, wid, len);
    }
  }

  function stoneTexture(base, light, dark, seams, rainLight, rainDark) {
    return canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      // 大尺度斑驳
      for (var i = 0; i < 30; i++) {
        var g = ctx.createRadialGradient(rnd() * w, rnd() * h, 8, rnd() * w, rnd() * h, 110 + rnd() * 220);
        g.addColorStop(0, "rgba(" + (rnd() > 0.5 ? light : dark) + "," + (0.05 + rnd() * 0.09).toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + dark + ",0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      // 大三角板块的轻微色差（石材铺贴 + 风化）
      for (var p = 0; p < 34; p++) {
        var cx = rnd() * w, cy = rnd() * h, r = 70 + rnd() * 210;
        var a1 = rnd() * Math.PI * 2;
        ctx.fillStyle = "rgba(" + (rnd() > 0.5 ? light : dark) + "," + (0.035 + rnd() * 0.06).toFixed(3) + ")";
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a1) * r, cy + Math.sin(a1) * r);
        ctx.lineTo(cx + Math.cos(a1 + 2.1) * r, cy + Math.sin(a1 + 2.1) * r);
        ctx.lineTo(cx + Math.cos(a1 + 4.2) * r, cy + Math.sin(a1 + 4.2) * r);
        ctx.closePath();
        ctx.fill();
      }
      noise(ctx, w, h, 4600, 0.09);
      for (var k = 0; k < 1500; k++) {
        ctx.fillStyle = "rgba(255,255,255," + (0.008 + rnd() * 0.04).toFixed(3) + ")";
        ctx.fillRect(rnd() * w, rnd() * h, 1, 1);
      }
      rainStreaks(ctx, w, h, rainLight, rainDark, 40);
      triangleSeams(ctx, w, h, seams, 1.5, 0.34);
      triangleSeams(ctx, w, h, "rgba(255,255,255,0.10)", 0.7, 0.5);
      for (var q = 0; q < 14; q++) {
        ctx.fillStyle = "rgba(" + dark + "," + (0.05 + rnd() * 0.1).toFixed(3) + ")";
        ctx.beginPath();
        ctx.ellipse(rnd() * w, rnd() * h, 10 + rnd() * 46, 6 + rnd() * 28, rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 1024, 1024);
  }

  function lattice(ctx, w, h, step, stroke, width, nodeColor) {
    var dy = (w * Math.tan(Math.PI / 6)) / (w / step);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    for (var y = 0; y <= h; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (var c = -h; c <= w + h; c += dy) {
      ctx.beginPath(); ctx.moveTo(c - h * 0.577, 0); ctx.lineTo(c, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(c + h * 0.577, 0); ctx.lineTo(c, h); ctx.stroke();
    }
    if (nodeColor) {
      ctx.fillStyle = nodeColor;
      for (var yy = 0; yy <= h; yy += step) {
        for (var xx = ((yy / step) % 2) * step * 0.5; xx <= w; xx += step) {
          ctx.beginPath(); ctx.arc(xx, yy, 1.8, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  function build(renderer) {
    var stoneDark = stoneTexture("#3c3f40", "128,134,136", "16,18,19", "rgba(12,14,15,0.55)", "150,156,158", "10,12,13");
    var stoneLight = stoneTexture("#d5d0c4", "255,251,240", "120,116,106", "rgba(108,104,94,0.42)", "150,146,136", "92,90,82");

    var stoneBump = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#7a7a7a";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 4200, 0.22);
      triangleSeams(ctx, w, h, "rgba(16,16,16,0.85)", 2.4, 0.85);
      triangleSeams(ctx, w, h, "rgba(240,240,240,0.4)", 0.9, 0.55);
    }, 512, 512, { linear: true });

    var glassGrid = canvasTexture(function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#8aa3ae");
      g.addColorStop(0.45, "#5d7885");
      g.addColorStop(1, "#3f5763");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      var sky = ctx.createLinearGradient(0, 0, w, h);
      sky.addColorStop(0, "rgba(224,240,246,0.28)");
      sky.addColorStop(0.5, "rgba(255,255,255,0)");
      sky.addColorStop(1, "rgba(20,36,44,0.22)");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      lattice(ctx, w, h, 64, "rgba(232,244,248,0.55)", 1.6, "rgba(240,250,252,0.7)");
      lattice(ctx, w, h, 128, "rgba(24,38,46,0.3)", 1.2, null);
    }, 512, 512);

    var glassMouth = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#2e4650";
      ctx.fillRect(0, 0, w, h);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(196,222,232,0.35)");
      g.addColorStop(0.5, "rgba(90,126,140,0.16)");
      g.addColorStop(1, "rgba(240,246,248,0.22)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      lattice(ctx, w, h, 74, "rgba(246,250,252,0.72)", 2.4, "rgba(255,255,255,0.75)");
      lattice(ctx, w, h, 148, "rgba(14,24,30,0.36)", 1.6, null);
    }, 512, 512);

    var paving = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b7b1a5";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 3200, 0.14);
      ctx.strokeStyle = "rgba(88,86,80,0.42)";
      ctx.lineWidth = 2;
      for (var x = 0; x <= w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y <= h; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      for (var x2 = 2; x2 <= w; x2 += 128) { ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, h); ctx.stroke(); }
      for (var i = 0; i < 22; i++) {
        ctx.fillStyle = "rgba(110,104,94," + (0.03 + rnd() * 0.06).toFixed(3) + ")";
        ctx.fillRect(rnd() * w, rnd() * h, 24 + rnd() * 120, 18 + rnd() * 80);
      }
    }, 512, 512);

    var pavingWarm = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#bdb4a2";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 2800, 0.12);
      ctx.strokeStyle = "rgba(104,94,78,0.4)";
      ctx.lineWidth = 2;
      for (var x = 0; x <= w; x += 96) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y <= h; y += 96) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      for (var i = 0; i < 26; i++) {
        ctx.fillStyle = "rgba(104,92,74," + (0.04 + rnd() * 0.07).toFixed(3) + ")";
        ctx.fillRect(rnd() * w, rnd() * h, 20 + rnd() * 90, 14 + rnd() * 60);
      }
    }, 512, 512);

    var grass = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4c6138";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 26; i++) {
        var g = ctx.createRadialGradient(rnd() * w, rnd() * h, 4, rnd() * w, rnd() * h, 60 + rnd() * 120);
        g.addColorStop(0, "rgba(" + (rnd() > 0.5 ? "120,146,78" : "44,62,34") + "," + (0.1 + rnd() * 0.22).toFixed(3) + ")");
        g.addColorStop(1, "rgba(60,78,44,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
      for (var k = 0; k < 7000; k++) {
        var v = 78 + Math.floor(rnd() * 84);
        ctx.strokeStyle = "rgba(" + Math.floor(v * 0.62) + "," + v + "," + Math.floor(v * 0.46) + "," + (0.16 + rnd() * 0.4).toFixed(2) + ")";
        ctx.lineWidth = 0.7 + rnd() * 1.1;
        var x = rnd() * w, y = rnd() * h;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 2, y - 2 - rnd() * 6); ctx.stroke();
      }
      // 少量黄色干草点，避免“全新草坪”
      for (var d = 0; d < 300; d++) {
        ctx.fillStyle = "rgba(150,138,92," + (0.1 + rnd() * 0.22).toFixed(2) + ")";
        ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 2 + rnd() * 4);
      }
    }, 512, 512);

    var tallGrass = canvasTexture(function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < 120; i++) {
        var x = rnd() * w;
        var base = h;
        var top = h * (0.08 + rnd() * 0.5);
        var bend = (rnd() - 0.5) * 30;
        var v = 92 + Math.floor(rnd() * 80);
        ctx.strokeStyle = "rgba(" + Math.floor(v * 0.6) + "," + v + "," + Math.floor(v * 0.42) + "," + (0.5 + rnd() * 0.5).toFixed(2) + ")";
        ctx.lineWidth = 1.2 + rnd() * 1.8;
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.quadraticCurveTo(x + bend * 0.4, (base + top) * 0.5, x + bend, top);
        ctx.stroke();
      }
    }, 256, 256);

    var water = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#6f6f6f";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 520; i++) {
        var a = 0.04 + rnd() * 0.16;
        ctx.strokeStyle = "rgba(255,255,255," + a.toFixed(3) + ")";
        ctx.lineWidth = 0.6 + rnd() * 1.6;
        var y = rnd() * h, x = rnd() * w, len = 8 + rnd() * 80;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + len * 0.5, y + (rnd() - 0.5) * 6, x + len, y);
        ctx.stroke();
      }
      noise(ctx, w, h, 900, 0.08);
    }, 512, 512, { linear: true });

    var leaf = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#43563a";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 2400; i++) {
        var g = 70 + Math.floor(rnd() * 74);
        ctx.fillStyle = "rgba(" + Math.floor(g * 0.58) + "," + g + "," + Math.floor(g * 0.44) + "," + (0.16 + rnd() * 0.42).toFixed(2) + ")";
        ctx.beginPath(); ctx.arc(rnd() * w, rnd() * h, 0.8 + rnd() * 2.2, 0, Math.PI * 2); ctx.fill();
      }
      for (var j = 0; j < 90; j++) {
        ctx.strokeStyle = "rgba(28,40,26," + (0.08 + rnd() * 0.18).toFixed(2) + ")";
        ctx.lineWidth = 0.6 + rnd() * 1.2;
        var x = rnd() * w, y = rnd() * h;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (rnd() - 0.5) * 26, y + 6 + rnd() * 18); ctx.stroke();
      }
    }, 256, 256);

    var trunk = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#5e5348";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 70; i++) {
        ctx.strokeStyle = "rgba(38,32,26," + (0.12 + rnd() * 0.26).toFixed(2) + ")";
        ctx.lineWidth = 0.8 + rnd() * 2.2;
        var x = rnd() * w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (rnd() - 0.5) * 8, h); ctx.stroke();
      }
    }, 128, 128);

    var cityWindow = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#2b343b";
      ctx.fillRect(0, 0, w, h);
      for (var y = 12; y < h - 8; y += 24) {
        for (var x = 8; x < w - 8; x += 18) {
          var lit = rnd();
          if (lit > 0.55) {
            ctx.fillStyle = lit > 0.85 ? "rgba(255,222,176," + (0.65 + rnd() * 0.35).toFixed(2) + ")"
              : "rgba(200,224,255," + (0.4 + rnd() * 0.5).toFixed(2) + ")";
            ctx.fillRect(x, y, 7, 11);
          } else {
            ctx.fillStyle = "rgba(38,48,58,0.8)";
            ctx.fillRect(x, y, 7, 11);
          }
        }
        if (((y - 12) / 24) % 4 === 0) {
          ctx.fillStyle = "rgba(20,26,32,0.6)";
          ctx.fillRect(0, y + 13, w, 3);
        }
      }
      ctx.fillStyle = "rgba(120,134,144,0.18)";
      for (var bx = 0; bx < w; bx += 64) ctx.fillRect(bx, 0, 3, h);
    }, 512, 512, { rx: 2, ry: 3 });

    var facade = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#a7aeb2";
      ctx.fillRect(0, 0, w, h);
      for (var y = 10; y < h - 8; y += 18) {
        ctx.fillStyle = "rgba(66,76,84,0.3)";
        ctx.fillRect(0, y, w, 7);
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(0, y + 7, w, 2);
      }
      for (var x = 8; x < w; x += 26) {
        ctx.fillStyle = "rgba(62,72,80,0.16)";
        ctx.fillRect(x, 0, 2, h);
      }
      for (var i = 0; i < 420; i++) {
        ctx.fillStyle = "rgba(" + (rnd() > 0.5 ? "236,242,246" : "62,72,80") + "," + (0.05 + rnd() * 0.12).toFixed(2) + ")";
        ctx.fillRect(rnd() * w, rnd() * h, 3 + rnd() * 10, 2 + rnd() * 5);
      }
      for (var b = 0; b < 14; b++) {
        ctx.fillStyle = "rgba(60,70,78," + (0.05 + rnd() * 0.08).toFixed(2) + ")";
        ctx.fillRect(rnd() * w, 0, 6 + rnd() * 26, h);
      }
    }, 512, 512, { rx: 2, ry: 3 });

    var ribbon = canvasTexture(function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(255,232,200,0)");
      g.addColorStop(0.35, "rgba(255,238,214,0.95)");
      g.addColorStop(0.65, "rgba(255,226,186,0.9)");
      g.addColorStop(1, "rgba(255,232,200,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "destination-out";
      for (var i = 0; i < 26; i++) {
        ctx.beginPath();
        var y = rnd() * h;
        ctx.strokeStyle = "rgba(0,0,0," + (0.08 + rnd() * 0.22).toFixed(2) + ")";
        ctx.lineWidth = 1 + rnd() * 4;
        ctx.moveTo(-10, y);
        for (var x = 0; x <= w + 10; x += 32) {
          ctx.lineTo(x, y + Math.sin(x * 0.04 + i) * 5);
        }
        ctx.stroke();
      }
      ctx.globalCompositeOperation = "source-over";
    }, 512, 64, { clamp: true });

    var glow = (function () {
      var c = document.createElement("canvas");
      c.width = c.height = 128;
      var ctx = c.getContext("2d");
      var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,244,224,1)");
      g.addColorStop(0.28, "rgba(255,232,198,0.55)");
      g.addColorStop(0.62, "rgba(255,214,166,0.16)");
      g.addColorStop(1, "rgba(255,210,160,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      return t;
    })();

    var sign = canvasTexture(function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, "#4c4f50");
      g.addColorStop(0.5, "#6a6d6c");
      g.addColorStop(1, "#3e4142");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 2600, 0.12);
      ctx.strokeStyle = "rgba(30,32,33,0.4)";
      ctx.lineWidth = 3;
      for (var x = 0; x <= w; x += 170) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      // 双砾轮廓
      ctx.strokeStyle = "rgba(228,232,230,0.6)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(60, 150);
      ctx.bezierCurveTo(90, 118, 96, 84, 126, 76);
      ctx.bezierCurveTo(160, 66, 190, 92, 204, 122);
      ctx.bezierCurveTo(216, 148, 232, 156, 240, 164);
      ctx.lineTo(60, 164);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(252, 164);
      ctx.bezierCurveTo(262, 142, 268, 128, 286, 126);
      ctx.bezierCurveTo(306, 124, 318, 142, 326, 164);
      ctx.stroke();
      ctx.fillStyle = "rgba(238,240,236,0.92)";
      ctx.font = "600 60px 'Songti SC','SimSun',serif";
      ctx.fillText("广州大剧院", 356, 128);
      ctx.font = "500 26px 'Songti SC','SimSun',serif";
      ctx.fillStyle = "rgba(232,234,230,0.78)";
      ctx.fillText("GUANGZHOU OPERA HOUSE", 358, 166);
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, 0, w, h / 2);
    }, 1024, 256, { clamp: true });

    var lobby = canvasTexture(function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#241d16");
      g.addColorStop(0.42, "#6d5536");
      g.addColorStop(0.72, "#c79a5c");
      g.addColorStop(1, "#f0cf9c");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      // 斜向钢构件剪影
      ctx.strokeStyle = "rgba(16,14,12,0.6)";
      for (var i = 0; i < 14; i++) {
        ctx.lineWidth = 3 + rnd() * 9;
        ctx.beginPath();
        var x = rnd() * w;
        ctx.moveTo(x, h);
        ctx.lineTo(x + (rnd() - 0.5) * 90, 0);
        ctx.stroke();
      }
      for (var j = 0; j < 9; j++) {
        ctx.strokeStyle = "rgba(20,17,14,0.45)";
        ctx.lineWidth = 2 + rnd() * 6;
        ctx.beginPath();
        ctx.moveTo(0, rnd() * h);
        ctx.lineTo(w, rnd() * h);
        ctx.stroke();
      }
      var glowG = ctx.createRadialGradient(w * 0.5, h * 0.66, 8, w * 0.5, h * 0.66, w * 0.6);
      glowG.addColorStop(0, "rgba(255,238,206,0.65)");
      glowG.addColorStop(1, "rgba(255,220,170,0)");
      ctx.fillStyle = glowG;
      ctx.fillRect(0, 0, w, h);
    }, 512, 512, { clamp: true });

    var tiles = [stoneDark, stoneLight, stoneBump, glassGrid, glassMouth, paving, pavingWarm, grass, tallGrass, water, leaf, trunk, cityWindow, facade, ribbon, sign, lobby];
    if (renderer && renderer.capabilities) {
      var maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
      tiles.forEach(function (t) { t.anisotropy = maxAniso; });
    }

    return {
      stoneDark: stoneDark,
      stoneLight: stoneLight,
      stoneBump: stoneBump,
      glassGrid: glassGrid,
      glassMouth: glassMouth,
      paving: paving,
      pavingWarm: pavingWarm,
      grass: grass,
      tallGrass: tallGrass,
      water: water,
      leaf: leaf,
      trunk: trunk,
      cityWindow: cityWindow,
      facade: facade,
      ribbon: ribbon,
      glow: glow,
      sign: sign,
      lobby: lobby
    };
  }

  window.OperaHouseTextures = { build: build };
})();
