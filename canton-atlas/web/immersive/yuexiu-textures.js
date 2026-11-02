/* 越秀公园 · 五羊—明城墙—镇海楼近景 · 程序化纹理
   所有纹理在 canvas 里生成，不依赖外部图片。 */
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
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function makeTextTexture(text, w, h, color, bg) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var chars = text.split("");
    if (chars.length <= 5) {
      var size = Math.min(w * 0.78, h * 0.62);
      ctx.font = "bold " + Math.floor(size) + "px 'Songti SC', 'SimSun', 'STSong', serif";
      ctx.fillText(text, w / 2, h / 2 + h * 0.02);
    } else {
      var per = Math.ceil(chars.length / 2);
      var lineSize = Math.min(w * 0.82, h * 0.34);
      ctx.font = "bold " + Math.floor(lineSize) + "px 'Songti SC', 'SimSun', 'STSong', serif";
      ctx.fillText(chars.slice(0, per).join(""), w / 2, h / 2 - lineSize * 0.58);
      ctx.fillText(chars.slice(per).join(""), w / 2, h / 2 + lineSize * 0.58);
    }
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function makeVerticalTextTexture(text, w, h, color, bg) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    var chars = text.split("");
    var size = Math.floor(Math.min(w * 0.72, h / (chars.length + 0.8)));
    ctx.font = "bold " + size + "px 'Songti SC', 'SimSun', 'STSong', serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    var gap = (h - size * chars.length) / (chars.length + 1);
    chars.forEach(function (ch, i) {
      ctx.fillText(ch, w / 2, gap + size * (i + 0.5) + gap * i);
    });
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function makeTextTextureTransparent(text, w, h, color, fontScale) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = color;
    var size = Math.floor(h * (fontScale || 0.5));
    ctx.font = "bold " + size + "px 'Songti SC', 'SimSun', 'STSong', serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2 + h * 0.02);
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function makeBrickTexture(base, mortar, repeatX, repeatY, moss) {
    return canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = mortar; ctx.fillRect(0, 0, w, h);
      var course = 34, brick = 92;
      for (var y = 0; y < h; y += course) {
        var off = (Math.floor(y / course) % 2) * (brick / 2);
        for (var x = -brick; x < w; x += brick) {
          var v = 0.78 + Math.random() * 0.3;
          var r = Math.floor(base[0] * v);
          var g = Math.floor(base[1] * v);
          var b = Math.floor(base[2] * v);
          ctx.fillStyle = "rgb(" + r + "," + g + "," + b + ")";
          ctx.fillRect(x + off + 2, y + 2, brick - 4, course - 4);
          ctx.fillStyle = "rgba(255,255,255,0.045)";
          ctx.fillRect(x + off + 4, y + 3, brick - 8, 4);
          if (Math.random() < 0.14) {
            ctx.fillStyle = "rgba(38,42,34,0.16)";
            ctx.fillRect(x + off + 8 + Math.random() * 40, y + 6, 18 + Math.random() * 30, course - 10);
          }
        }
      }
      if (moss) {
        for (var i = 0; i < 260; i++) {
          var gx = Math.random() * w, gy = Math.random() * h;
          var gr = 1 + Math.random() * 6;
          ctx.fillStyle = "rgba(" + (58 + Math.random() * 26) + "," + (78 + Math.random() * 30) + "," + (48 + Math.random() * 20) + "," + (0.08 + Math.random() * 0.16) + ")";
          ctx.beginPath(); ctx.arc(gx, gy, gr, 0, 6.3); ctx.fill();
        }
      }
    }, 512, 512, repeatX, repeatY);
  }

  function build(renderer) {
    var granite = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#c9b892"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 5200; i++) {
        var v = 150 + Math.floor(Math.random() * 74);
        ctx.fillStyle = "rgba(" + v + "," + (v - 8) + "," + (v - 26) + "," + (0.18 + Math.random() * 0.3) + ")";
        var r = 1 + Math.random() * 5;
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, r, 0, 6.3); ctx.fill();
      }
      for (var s = 0; s < 90; s++) {
        ctx.strokeStyle = "rgba(92,78,58,0.16)";
        ctx.lineWidth = 1 + Math.random() * 1.5;
        var x = Math.random() * w, y = Math.random() * h;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + 12 + Math.random() * 46, y + (Math.random() - 0.5) * 18);
        ctx.stroke();
      }
    }, 512, 512, 1, 1);

    var graniteLight = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#d6c8a6"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 4200; i++) {
        var v = 178 + Math.floor(Math.random() * 58);
        ctx.fillStyle = "rgba(" + v + "," + (v - 6) + "," + (v - 22) + "," + (0.12 + Math.random() * 0.24) + ")";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
      for (var c = 0; c < 24; c++) {
        ctx.strokeStyle = "rgba(110,94,70,0.13)";
        ctx.lineWidth = 1;
        var x = Math.random() * w, y = Math.random() * h;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 20 + Math.random() * 60, y + 10 + Math.random() * 30); ctx.stroke();
      }
    }, 512, 512, 1, 1);

    var brickGrey = makeBrickTexture([78, 82, 76], "#2f312c", 5, 3, true);
    var brickGreyWall = makeBrickTexture([76, 80, 74], "#2d302b", 22, 2, true);
    var brickRed = makeBrickTexture([90, 54, 42], "#331f19", 4, 2, true);
    var brickRedWall = makeBrickTexture([88, 52, 40], "#301d17", 18, 2, true);

    var redPlaster = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#54140e"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 3600; i++) {
        var v = 54 + Math.floor(Math.random() * 30);
        ctx.fillStyle = "rgba(" + v + "," + Math.floor(v * 0.34) + "," + Math.floor(v * 0.26) + "," + (0.08 + Math.random() * 0.16) + ")";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2);
      }
      for (var y = 0; y < h; y += 46) {
        ctx.strokeStyle = "rgba(40,12,8,0.14)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      for (var k = 0; k < 40; k++) {
        ctx.fillStyle = "rgba(180,112,80,0.08)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 16, 1 + Math.random() * 4);
      }
    }, 512, 512, 3, 2);

    var paving = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#a9a296"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 64) {
        for (var x = 0; x < w; x += 64) {
          var v = 162 + Math.floor(Math.random() * 24);
          ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 12) + ")";
          ctx.fillRect(x + 2, y + 2, 60, 60);
        }
      }
      ctx.strokeStyle = "rgba(58,54,46,0.36)"; ctx.lineWidth = 3;
      for (var gx = 0; gx <= w; gx += 64) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (var gy = 0; gy <= h; gy += 64) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    }, 512, 512, 8, 8);

    var pavingRed = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#9d7864"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 42) {
        var off = (Math.floor(y / 42) % 2) * 48;
        for (var x = -48; x < w; x += 96) {
          var v = 140 + Math.floor(Math.random() * 34);
          ctx.fillStyle = "rgb(" + v + "," + Math.floor(v * 0.72) + "," + Math.floor(v * 0.6) + ")";
          ctx.fillRect(x + off + 1, y + 1, 94, 40);
        }
      }
      ctx.strokeStyle = "rgba(70,48,38,0.34)"; ctx.lineWidth = 2;
      for (var yy = 0; yy <= h; yy += 42) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 5, 4);

    var tileGreen = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#244535"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 22) {
        for (var x = 0; x < w; x += 28) {
          var v = 0.8 + Math.random() * 0.35;
          ctx.fillStyle = "rgb(" + Math.floor(36 * v) + "," + Math.floor(76 * v) + "," + Math.floor(56 * v) + ")";
          ctx.fillRect(x, y, 26, 19);
          ctx.fillStyle = "rgba(196,224,190,0.18)";
          ctx.fillRect(x + 2, y + 2, 22, 3);
        }
      }
      ctx.strokeStyle = "rgba(16,36,28,0.5)"; ctx.lineWidth = 2;
      for (var yy = 0; yy <= h; yy += 22) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 7, 3);

    var tileGreenDark = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#182f24"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 20) {
        for (var x = 0; x < w; x += 26) {
          var v = 0.7 + Math.random() * 0.3;
          ctx.fillStyle = "rgb(" + Math.floor(28 * v) + "," + Math.floor(54 * v) + "," + Math.floor(40 * v) + ")";
          ctx.fillRect(x, y, 24, 17);
        }
      }
    }, 512, 512, 6, 3);

    var wood = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#5c3826"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 180; i++) {
        ctx.strokeStyle = "rgba(30,18,10,0.34)";
        ctx.beginPath(); ctx.moveTo(0, i * 3); ctx.lineTo(w, i * 3 + Math.sin(i * 0.7) * 6); ctx.stroke();
      }
    }, 512, 512, 2, 2);

    var trunk = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#5a4634"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 120; i++) {
        ctx.strokeStyle = "rgba(28,20,12,0.4)";
        ctx.lineWidth = 1 + Math.random() * 2;
        var x = Math.random() * w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + (Math.random() - 0.5) * 20, h); ctx.stroke();
      }
      for (var k = 0; k < 40; k++) {
        ctx.fillStyle = "rgba(120,104,82,0.2)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 14, 2 + Math.random() * 5);
      }
    }, 256, 512, 2, 3);

    var root = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#6d5540"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 100; i++) {
        ctx.strokeStyle = "rgba(36,24,14,0.45)";
        ctx.lineWidth = 1 + Math.random() * 3;
        var x = Math.random() * w;
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 8, h * 0.3, x - 8, h * 0.7, x + 3, h); ctx.stroke();
      }
    }, 256, 512, 1, 3);

    var leaf = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#26452e"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 1900; i++) {
        var g = 56 + Math.floor(Math.random() * 66);
        ctx.fillStyle = "rgba(" + (g - 28) + "," + g + "," + (g - 34) + "," + (0.3 + Math.random() * 0.35) + ")";
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 0, 6.3); ctx.fill();
      }
    }, 512, 512, 1, 1);

    var leafOlive = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#3c5132"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 1700; i++) {
        var g = 66 + Math.floor(Math.random() * 54);
        ctx.fillStyle = "rgba(" + (g - 18) + "," + g + "," + (g - 38) + "," + (0.3 + Math.random() * 0.3) + ")";
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 6.3); ctx.fill();
      }
    }, 512, 512, 1, 1);

    var cityWindow = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#1a211f"; ctx.fillRect(0, 0, w, h);
      for (var y = 5; y < h; y += 13) {
        for (var x = 5; x < w; x += 11) {
          ctx.fillStyle = Math.random() > 0.45 ? "rgba(255,206,132,0.9)" : "rgba(32,38,36,0.92)";
          ctx.fillRect(x, y, 6, 6);
        }
      }
    }, 256, 256, 6, 10);

    var lattice = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#2b120c"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#c59a58"; ctx.lineWidth = 3;
      for (var x = 0; x <= w; x += 42) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y <= h; y += 42) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(197,154,88,0.5)"; ctx.lineWidth = 2;
      for (var i = -h; i < w; i += 42) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.stroke();
      }
    }, 512, 512, 2, 2);

    var relief = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b7a98e"; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(92,76,54,0.5)"; ctx.lineWidth = 4;
      for (var i = 0; i < 14; i++) {
        ctx.beginPath();
        var x = 20 + Math.random() * (w - 40);
        var y = 20 + Math.random() * (h - 40);
        ctx.arc(x, y, 8 + Math.random() * 22, 0.4, 4.8);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(72,58,40,0.6)"; ctx.lineWidth = 3;
      for (var k = 0; k < 8; k++) {
        var bx = 20 + k * (w - 40) / 7;
        ctx.beginPath(); ctx.moveTo(bx, h * 0.72); ctx.lineTo(bx + 8, h * 0.42); ctx.lineTo(bx + 16, h * 0.64); ctx.stroke();
      }
      ctx.fillStyle = "rgba(66,52,36,0.55)";
      for (var m = 0; m < 6; m++) {
        ctx.beginPath(); ctx.arc(w * 0.5 + (m - 2.5) * 18, h * 0.35, 4, 0, 6.3); ctx.fill();
      }
      ctx.strokeStyle = "rgba(66,52,36,0.5)"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(w * 0.5, h * 0.35); ctx.bezierCurveTo(w * 0.5 + 40, h * 0.2, w * 0.5 + 70, h * 0.4, w * 0.5 + 30, h * 0.46); ctx.stroke();
    }, 512, 512, 1, 1);

    var softGrass = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4a5e3c"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 7200; i++) {
        var g = 66 + Math.floor(Math.random() * 62);
        ctx.fillStyle = "rgba(" + (g - 26) + "," + g + "," + (g - 34) + ",0.45)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }, 512, 512, 18, 18);

    var graniteCoarse = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b4a283"; ctx.fillRect(0, 0, w, h);
      for (var p = 0; p < 70; p++) {
        var pv = 132 + Math.floor(Math.random() * 46);
        ctx.fillStyle = "rgba(" + pv + "," + (pv - 10) + "," + (pv - 30) + "," + (0.06 + Math.random() * 0.08) + ")";
        ctx.beginPath();
        ctx.ellipse(Math.random() * w, Math.random() * h, 18 + Math.random() * 70, 12 + Math.random() * 46, Math.random() * 3, 0, 6.3);
        ctx.fill();
      }
      for (var i = 0; i < 3600; i++) {
        var v = 118 + Math.floor(Math.random() * 82);
        ctx.fillStyle = "rgba(" + v + "," + (v - 9) + "," + (v - 26) + "," + (0.16 + Math.random() * 0.3) + ")";
        var r = 0.6 + Math.random() * 3.2;
        ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, r, 0, 6.3); ctx.fill();
      }
      for (var s = 0; s < 220; s++) {
        ctx.strokeStyle = "rgba(78,64,46," + (0.1 + Math.random() * 0.16) + ")";
        ctx.lineWidth = 0.8 + Math.random() * 1.6;
        var x = Math.random() * w, y = Math.random() * h;
        ctx.beginPath(); ctx.moveTo(x, y);
        ctx.lineTo(x + 6 + Math.random() * 34, y + (Math.random() - 0.5) * 12);
        ctx.stroke();
      }
    }, 512, 512, 2, 2);

    var roofBlue = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#162f45"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 22) {
        for (var x = 0; x < w; x += 28) {
          var v = 0.78 + Math.random() * 0.4;
          ctx.fillStyle = "rgb(" + Math.floor(28 * v) + "," + Math.floor(58 * v) + "," + Math.floor(92 * v) + ")";
          ctx.fillRect(x, y, 26, 19);
          ctx.fillStyle = "rgba(150,196,226,0.2)";
          ctx.fillRect(x + 2, y + 2, 22, 3);
        }
      }
      ctx.strokeStyle = "rgba(8,20,32,0.55)"; ctx.lineWidth = 2;
      for (var yy = 0; yy <= h; yy += 22) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 5, 3);

    var tileGrey = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#3f4240"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 20) {
        for (var x = 0; x < w; x += 26) {
          var v = 0.72 + Math.random() * 0.4;
          ctx.fillStyle = "rgb(" + Math.floor(72 * v) + "," + Math.floor(74 * v) + "," + Math.floor(70 * v) + ")";
          ctx.fillRect(x, y, 24, 17);
          ctx.fillStyle = "rgba(190,196,188,0.14)";
          ctx.fillRect(x + 2, y + 2, 20, 2);
        }
      }
      ctx.strokeStyle = "rgba(24,26,24,0.5)"; ctx.lineWidth = 2;
      for (var yy = 0; yy <= h; yy += 20) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 6, 4);

    var mossOverlay = canvasTexture(function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      for (var s = 0; s < 90; s++) {
        var sx = Math.random() * w;
        var sw = 2 + Math.random() * 12;
        var grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0, "rgba(36,44,34,0)");
        grad.addColorStop(0.35, "rgba(36,44,34," + (0.03 + Math.random() * 0.06) + ")");
        grad.addColorStop(1, "rgba(28,36,26," + (0.08 + Math.random() * 0.12) + ")");
        ctx.fillStyle = grad;
        ctx.fillRect(sx, 0, sw, h);
      }
      for (var i = 0; i < 900; i++) {
        var y = h * 0.35 + Math.random() * h * 0.65;
        var r = 1 + Math.random() * 9;
        var g = 70 + Math.random() * 50;
        ctx.fillStyle = "rgba(" + Math.floor(g * 0.62) + "," + Math.floor(g) + "," + Math.floor(g * 0.5) + "," + (0.06 + Math.random() * 0.24) + ")";
        ctx.beginPath(); ctx.arc(Math.random() * w, y, r, 0, 6.3); ctx.fill();
      }
      ctx.fillStyle = "rgba(30,38,28,0.18)";
      ctx.fillRect(0, h * 0.9, w, h * 0.1);
    }, 512, 512, 1, 1);

    return {
      granite: granite,
      graniteCoarse: graniteCoarse,
      graniteLight: graniteLight,
      brickGrey: brickGrey,
      brickGreyWall: brickGreyWall,
      brickRed: brickRed,
      brickRedWall: brickRedWall,
      paving: paving,
      pavingRed: pavingRed,
      tileGreen: tileGreen,
      tileGreenDark: tileGreenDark,
      wood: wood,
      trunk: trunk,
      root: root,
      leaf: leaf,
      leafOlive: leafOlive,
      cityWindow: cityWindow,
      lattice: lattice,
      relief: relief,
      grass: softGrass,
      redPlaster: redPlaster,
      roofBlue: roofBlue,
      tileGrey: tileGrey,
      mossOverlay: mossOverlay
    };
  }

  window.YuexiuTextures = {
    build: build,
    makeTextTexture: makeTextTexture,
    makeVerticalTextTexture: makeVerticalTextTexture,
    makeTextTextureTransparent: makeTextTextureTransparent
  };
})();
