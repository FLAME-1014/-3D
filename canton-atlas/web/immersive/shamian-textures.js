/* 沙面 · 大街一段近景 · 程序化纹理（不依赖外部图片） */
(function () {
  "use strict";

  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function canvasTexture(draw, w, h, rx, ry, clamp) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    var ctx = c.getContext("2d");
    draw(ctx, w, h);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    tex.repeat.set(rx || 1, ry || 1);
    tex.anisotropy = 4;
    return tex;
  }

  function makeTextTexture(text, w, h, color, bg, font, size) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = (size || Math.floor(h * 0.58)) + "px " + (font || '"Noto Serif SC","Songti SC",serif');
    ctx.fillText(text, w / 2, h / 2 + h * 0.03);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  function drawNoise(ctx, w, h, count, rnd, alpha) {
    for (var i = 0; i < count; i++) {
      var x = rnd() * w, y = rnd() * h;
      var s = 0.5 + rnd() * 2.2;
      ctx.fillStyle = "rgba(" + (rnd() > 0.5 ? "255,255,255" : "60,48,32") + "," + (alpha * (0.3 + rnd() * 0.7)) + ")";
      ctx.fillRect(x, y, s, s);
    }
  }

  function plaster(base, fleck, stain) {
    return function (ctx, w, h) {
      var rnd = mulberry32(20261031 + base.length);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 30; i++) {
        var x = rnd() * w, y = rnd() * h, r = 18 + rnd() * 70;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(" + fleck + "," + (0.04 + rnd() * 0.05) + ")");
        g.addColorStop(1, "rgba(" + fleck + ",0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      drawNoise(ctx, w, h, 5200, rnd, 0.05);
      for (var k = 0; k < 16; k++) {
        ctx.strokeStyle = "rgba(" + stain + "," + (0.025 + rnd() * 0.04) + ")";
        ctx.lineWidth = 1 + rnd() * 5;
        ctx.beginPath();
        var sx = rnd() * w;
        ctx.moveTo(sx, h * (0.25 + rnd() * 0.45));
        ctx.lineTo(sx + (rnd() - 0.5) * 26, h);
        ctx.stroke();
      }
      for (var b = 0; b < 10; b++) {
        ctx.fillStyle = "rgba(70,58,42," + (0.02 + rnd() * 0.03) + ")";
        ctx.fillRect(rnd() * w, h * 0.85 + rnd() * h * 0.12, 10 + rnd() * 50, 2 + rnd() * 6);
      }
    };
  }

  function brickTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(7719);
      ctx.fillStyle = "#cbbaa2";
      ctx.fillRect(0, 0, w, h);
      var bw = 64, bh = 26, gap = 3;
      for (var row = -1; row < h / bh + 1; row++) {
        var off = (row % 2) ? -bw / 2 : 0;
        for (var col = -1; col < w / bw + 1; col++) {
          var x = col * bw + off;
          var y = row * bh;
          var shade = rnd();
          ctx.fillStyle = shade > 0.72 ? "#b96246" : shade > 0.42 ? "#a54d36" : shade > 0.18 ? "#8e4231" : "#c06d50";
          ctx.fillRect(x + gap, y + gap, bw - gap * 2, bh - gap * 2);
          ctx.fillStyle = "rgba(255,220,190,0.08)";
          ctx.fillRect(x + gap + 2, y + gap + 2, bw - gap * 2 - 4, 2);
        }
      }
      drawNoise(ctx, w, h, 2600, rnd, 0.05);
    };
  }

  function ashlar(base, joint, dark) {
    return function (ctx, w, h) {
      var rnd = mulberry32(3311);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      var bw = 128, bh = 62;
      for (var row = 0; row < h / bh + 1; row++) {
        var off = (row % 2) ? -bw / 2 : 0;
        for (var col = -1; col < w / bw + 1; col++) {
          var x = col * bw + off, y = row * bh;
          ctx.fillStyle = "rgba(" + (rnd() > 0.5 ? dark : base) + ",0.16)";
          ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
        }
      }
      ctx.strokeStyle = joint;
      ctx.lineWidth = 2;
      for (var yy = 0; yy < h; yy += bh) {
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke();
      }
      drawNoise(ctx, w, h, 3600, rnd, 0.06);
    };
  }

  function pavingTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(8823);
      ctx.fillStyle = "#b9b2a3";
      ctx.fillRect(0, 0, w, h);
      var bw = 128, bh = 84;
      for (var row = 0; row < h / bh + 1; row++) {
        var off = (row % 2) ? -bw / 2 : 0;
        for (var col = -1; col < w / bw + 1; col++) {
          var x = col * bw + off, y = row * bh;
          ctx.fillStyle = ["#bcb5a5", "#c5beae", "#aea798", "#c9c2b2"][Math.floor(rnd() * 4)];
          ctx.fillRect(x + 2, y + 2, bw - 4, bh - 4);
          ctx.fillStyle = "rgba(255,255,255,0.07)";
          ctx.fillRect(x + 4, y + 4, bw - 8, 2);
        }
      }
      ctx.strokeStyle = "rgba(96,90,78,0.45)";
      ctx.lineWidth = 1.5;
      for (var yy = 0; yy < h; yy += bh) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
      drawNoise(ctx, w, h, 4200, rnd, 0.06);
    };
  }

  function sidewalkTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(5731);
      ctx.fillStyle = "#b8a78f";
      ctx.fillRect(0, 0, w, h);
      var bw = 64, bh = 32;
      for (var row = 0; row < h / bh + 1; row++) {
        var off = (row % 2) ? -bw / 2 : 0;
        for (var col = -1; col < w / bw + 1; col++) {
          var x = col * bw + off, y = row * bh;
          ctx.fillStyle = ["#bda98e", "#c7b398", "#ad9a82", "#d0bba0"][Math.floor(rnd() * 4)];
          ctx.fillRect(x + 1, y + 1, bw - 2, bh - 2);
        }
      }
      drawNoise(ctx, w, h, 2400, rnd, 0.06);
    };
  }

  function tileTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(4471);
      ctx.fillStyle = "#6d6157";
      ctx.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 18) {
        ctx.fillStyle = "rgba(30,25,20,0.35)";
        ctx.fillRect(x, 0, 2, h);
        ctx.fillStyle = "rgba(255,240,220,0.06)";
        ctx.fillRect(x + 3, 0, 5, h);
      }
      for (var y = 0; y < h; y += 46) {
        ctx.fillStyle = "rgba(30,25,20,0.28)";
        ctx.fillRect(0, y, w, 3);
      }
      for (var i = 0; i < 900; i++) {
        ctx.fillStyle = "rgba(" + (rnd() > 0.5 ? "210,190,160" : "30,26,20") + ",0.05)";
        ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 4, 1 + rnd() * 4);
      }
    };
  }

  function slateTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(6607);
      ctx.fillStyle = "#5b6063";
      ctx.fillRect(0, 0, w, h);
      for (var x = 0; x < w; x += 15) {
        ctx.fillStyle = "rgba(22,26,28,0.4)";
        ctx.fillRect(x, 0, 2, h);
        ctx.fillStyle = "rgba(210,222,226,0.07)";
        ctx.fillRect(x + 3, 0, 4, h);
      }
      for (var y = 0; y < h; y += 38) {
        ctx.fillStyle = "rgba(20,24,26,0.32)";
        ctx.fillRect(0, y, w, 2);
      }
      for (var i = 0; i < 1200; i++) {
        ctx.fillStyle = "rgba(" + (rnd() > 0.5 ? "190,205,208" : "24,28,30") + ",0.06)";
        ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 3);
      }
    };
  }

  function washStoneTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(5519);
      ctx.fillStyle = "#d8c4a0";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 14000; i++) {
        var t = rnd();
        ctx.fillStyle = t > 0.72 ? "rgba(255,246,224,0.5)" : t > 0.36 ? "rgba(150,128,96,0.3)" : "rgba(110,92,66,0.22)";
        var s = 0.8 + rnd() * 2.2;
        ctx.fillRect(rnd() * w, rnd() * h, s, s);
      }
      for (var b = 0; b < 18; b++) {
        var x = rnd() * w, y = rnd() * h, r = 14 + rnd() * 48;
        var g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, "rgba(120,100,72," + (0.03 + rnd() * 0.04) + ")");
        g.addColorStop(1, "rgba(120,100,72,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    };
  }

  function belfryTexture() {
    return function (ctx, w, h) {
      ctx.fillStyle = "#2c2a25";
      ctx.fillRect(0, 0, w, h);
      for (var y = 6; y < h; y += 16) {
        ctx.fillStyle = "rgba(196,182,158,0.34)";
        ctx.fillRect(4, y, w - 8, 5);
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(4, y + 5, w - 8, 3);
      }
      ctx.strokeStyle = "rgba(238,226,203,0.55)";
      ctx.lineWidth = 7;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    };
  }

  function woodTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(9929);
      ctx.fillStyle = "#4a3023";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 90; i++) {
        ctx.strokeStyle = "rgba(" + (rnd() > 0.5 ? "28,18,12" : "120,82,55") + "," + (0.08 + rnd() * 0.16) + ")";
        ctx.lineWidth = 1 + rnd() * 2;
        ctx.beginPath();
        var x = rnd() * w;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + (rnd() - 0.5) * 18, h * 0.3, x + (rnd() - 0.5) * 18, h * 0.7, x + (rnd() - 0.5) * 10, h);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(20,12,8,0.5)";
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    };
  }

  function shutterTexture() {
    return function (ctx, w, h) {
      ctx.fillStyle = "#4d6a52";
      ctx.fillRect(0, 0, w, h);
      for (var y = 5; y < h; y += 9) {
        ctx.fillStyle = "rgba(30,48,34,0.55)";
        ctx.fillRect(5, y, w - 10, 4);
        ctx.fillStyle = "rgba(190,210,180,0.16)";
        ctx.fillRect(5, y - 2, w - 10, 2);
      }
      ctx.strokeStyle = "rgba(28,42,30,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    };
  }

  function leafTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(6101);
      ctx.fillStyle = "#3f5f3a";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 1500; i++) {
        var x = rnd() * w, y = rnd() * h;
        var r = 1.2 + rnd() * 3.8;
        ctx.fillStyle = ["#4f7444", "#5f854d", "#365534", "#72935a", "#2f4e31"][Math.floor(rnd() * 5)];
        ctx.beginPath();
        ctx.ellipse(x, y, r * 1.5, r * 0.7, rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    };
  }

  function barkTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(3127);
      ctx.fillStyle = "#6d5a47";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 90; i++) {
        ctx.strokeStyle = "rgba(" + (rnd() > 0.45 ? "48,36,26" : "150,128,101") + "," + (0.12 + rnd() * 0.22) + ")";
        ctx.lineWidth = 1 + rnd() * 4;
        ctx.beginPath();
        var x = rnd() * w;
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + (rnd() - 0.5) * 20, h * 0.35, x + (rnd() - 0.5) * 24, h * 0.7, x + (rnd() - 0.5) * 14, h);
        ctx.stroke();
      }
      for (var k = 0; k < 50; k++) {
        ctx.fillStyle = "rgba(35,28,20,0.18)";
        ctx.beginPath();
        ctx.ellipse(rnd() * w, rnd() * h, 2 + rnd() * 6, 1 + rnd() * 3, rnd() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    };
  }

  function roseWindowTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 256;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 256, 256);
    var cx = 128, cy = 128;
    ctx.fillStyle = "#d8cbb2";
    ctx.beginPath(); ctx.arc(cx, cy, 124, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1c2a2e";
    ctx.beginPath(); ctx.arc(cx, cy, 112, 0, Math.PI * 2); ctx.fill();
    var cols = ["#a83b3b", "#3c6ea5", "#c69a45", "#4e7d55", "#8e4c78", "#3f8a8a"];
    for (var i = 0; i < 12; i++) {
      var a0 = (i / 12) * Math.PI * 2;
      var a1 = ((i + 1) / 12) * Math.PI * 2;
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, 108, a0 + 0.03, a1 - 0.03);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "#d8cbb2";
    ctx.lineWidth = 5;
    for (var k = 0; k < 12; k++) {
      var a = (k / 12) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 112, cy + Math.sin(a) * 112); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 36, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#e6c68e";
    ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill();
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  function pointedWindowTexture() {
    var c = document.createElement("canvas");
    c.width = 160; c.height = 320;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 160, 320);
    ctx.fillStyle = "#d8cbb2";
    ctx.beginPath();
    ctx.moveTo(16, 312); ctx.lineTo(16, 120); ctx.quadraticCurveTo(80, -22, 144, 120); ctx.lineTo(144, 312); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1b2a2e";
    ctx.beginPath();
    ctx.moveTo(28, 300); ctx.lineTo(28, 126); ctx.quadraticCurveTo(80, 8, 132, 126); ctx.lineTo(132, 300); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#d8cbb2";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(80, 30); ctx.lineTo(80, 300); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(28, 180); ctx.lineTo(132, 180); ctx.stroke();
    ctx.fillStyle = "rgba(120,160,190,0.18)";
    ctx.fillRect(34, 40, 40, 240);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  function windowTexture() {
    var c = document.createElement("canvas");
    c.width = 256; c.height = 320;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 256, 320);
    /* 石框 */
    ctx.fillStyle = "#ded3bd";
    ctx.fillRect(24, 8, 208, 304);
    ctx.fillStyle = "#c9bda5";
    ctx.fillRect(30, 14, 196, 292);
    /* 窗洞 */
    ctx.fillStyle = "#1d2a2d";
    ctx.fillRect(50, 30, 156, 250);
    /* 玻璃反光 */
    var g = ctx.createLinearGradient(50, 30, 206, 280);
    g.addColorStop(0, "rgba(122,156,164,0.45)");
    g.addColorStop(0.45, "rgba(32,48,52,0.2)");
    g.addColorStop(1, "rgba(16,24,26,0.8)");
    ctx.fillStyle = g;
    ctx.fillRect(50, 30, 156, 250);
    /* 窗棂 */
    ctx.strokeStyle = "#d9cfba";
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(128, 30); ctx.lineTo(128, 280); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(50, 150); ctx.lineTo(206, 150); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(50, 225); ctx.lineTo(206, 225); ctx.stroke();
    /* 绿色百叶 */
    for (var side = 0; side < 2; side++) {
      var x = side ? 206 : 8;
      ctx.fillStyle = "#4d6a52";
      ctx.fillRect(x, 30, 42, 250);
      for (var y = 38; y < 278; y += 10) {
        ctx.fillStyle = "rgba(30,48,34,0.55)";
        ctx.fillRect(x + 3, y, 36, 4);
      }
      ctx.strokeStyle = "rgba(28,42,30,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x + 1, 30, 40, 250);
    }
    /* 窗台 */
    ctx.fillStyle = "#cfc3ab";
    ctx.fillRect(18, 286, 220, 14);
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  function doorTexture() {
    var c = document.createElement("canvas");
    c.width = 256; c.height = 384;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 256, 384);
    ctx.fillStyle = "#d6cbb5";
    ctx.fillRect(12, 6, 232, 372);
    ctx.fillStyle = "#4a3023";
    ctx.fillRect(28, 22, 200, 350);
    ctx.strokeStyle = "rgba(20,12,8,0.55)";
    ctx.lineWidth = 7;
    ctx.strokeRect(28, 22, 200, 350);
    ctx.beginPath(); ctx.moveTo(128, 22); ctx.lineTo(128, 372); ctx.stroke();
    for (var side = 0; side < 2; side++) {
      var x = side ? 138 : 38;
      ctx.strokeStyle = "rgba(190,150,110,0.28)";
      ctx.lineWidth = 3;
      ctx.strokeRect(x, 60, 80, 120);
      ctx.strokeRect(x, 205, 80, 140);
    }
    ctx.fillStyle = "#b08a55";
    ctx.beginPath(); ctx.arc(118, 206, 5, 0, Math.PI * 2); ctx.fill();
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = 4;
    return tex;
  }

  function waterTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(771);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#7d9296");
      g.addColorStop(0.5, "#647c82");
      g.addColorStop(1, "#536b72");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 160; i++) {
        ctx.strokeStyle = "rgba(220,235,235," + (0.03 + rnd() * 0.08) + ")";
        ctx.lineWidth = 1 + rnd() * 2;
        var y = rnd() * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(w * 0.3, y + (rnd() - 0.5) * 12, w * 0.7, y + (rnd() - 0.5) * 12, w, y);
        ctx.stroke();
      }
    };
  }

  function grassTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(9011);
      ctx.fillStyle = "#4e6a43";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 2400; i++) {
        ctx.fillStyle = ["#55744a", "#628455", "#45613c", "#6f8f5d", "#3c5636"][Math.floor(rnd() * 5)];
        ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 4);
      }
    };
  }

  function cityWindowTexture() {
    return function (ctx, w, h) {
      var rnd = mulberry32(2201);
      ctx.fillStyle = "#30363a";
      ctx.fillRect(0, 0, w, h);
      for (var y = 6; y < h; y += 18) {
        for (var x = 6; x < w; x += 16) {
          ctx.fillStyle = rnd() > 0.42 ? "rgba(220,205,170,0.45)" : "rgba(20,24,26,0.7)";
          ctx.fillRect(x, y, 8, 9);
        }
      }
    };
  }

  function build(renderer) {
    var maxAniso = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 4;
    var mats = {
      plasterCream: canvasTexture(plaster("#eee2cb", "255,248,230", "90,74,52"), 512, 512, 2, 2),
      plasterYellow: canvasTexture(plaster("#e6c37f", "255,240,200", "120,88,40"), 512, 512, 2, 2),
      plasterMint: canvasTexture(plaster("#d6dfc8", "250,255,240", "70,90,60"), 512, 512, 2, 2),
      plasterGrey: canvasTexture(plaster("#d9d2c0", "255,250,235", "80,78,68"), 512, 512, 2, 2),
      brick: canvasTexture(brickTexture(), 512, 512, 2, 2),
      stone: canvasTexture(ashlar("#a9a89f", "rgba(90,90,82,0.5)", "128,128,118"), 512, 512, 2, 2),
      stoneLight: canvasTexture(ashlar("#e8e0cf", "rgba(150,140,120,0.4)", "206,196,178"), 512, 512, 2, 2),
      paving: canvasTexture(pavingTexture(), 512, 512, 3, 3),
      sidewalk: canvasTexture(sidewalkTexture(), 512, 512, 3, 3),
      roof: canvasTexture(tileTexture(), 256, 512, 2, 2),
      slate: canvasTexture(slateTexture(), 256, 512, 2, 2),
      washStone: canvasTexture(washStoneTexture(), 512, 512, 2, 2),
      belfry: canvasTexture(belfryTexture(), 128, 256, 1, 1),
      wood: canvasTexture(woodTexture(), 256, 512, 1, 1),
      shutter: canvasTexture(shutterTexture(), 128, 256, 1, 1),
      leaf: canvasTexture(leafTexture(), 256, 256, 1, 1),
      bark: canvasTexture(barkTexture(), 256, 512, 1, 1),
      water: canvasTexture(waterTexture(), 512, 512, 4, 2),
      grass: canvasTexture(grassTexture(), 256, 256, 2, 2),
      cityWindow: canvasTexture(cityWindowTexture(), 256, 256, 4, 4),
      rose: roseWindowTexture(),
      pointed: pointedWindowTexture(),
      window: windowTexture(),
      door: doorTexture(),
      streetSign: makeTextTexture("沙面大街", 512, 128, "#f4efe2", "#2f4a3c", '"Noto Serif SC","Songti SC",serif', 58),
      signEn: makeTextTexture("SHAMIAN DAJIE", 512, 96, "#d9cfb6", "#2f4a3c", "Georgia,serif", 34),
      plaque14: makeTextTexture("14", 128, 96, "#2c2a24", "#e8dfc8", "Georgia,serif", 52),
      plaque48: makeTextTexture("48", 128, 96, "#2c2a24", "#e8dfc8", "Georgia,serif", 52)
    };
    Object.keys(mats).forEach(function (key) {
      if (mats[key] && mats[key].isTexture) mats[key].anisotropy = maxAniso;
    });
    return mats;
  }

  window.ShamianTextures = {
    build: build,
    makeTextTexture: makeTextTexture,
    canvasTexture: canvasTexture
  };
})();
