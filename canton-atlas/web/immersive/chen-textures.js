/* 陈家祠近景 · 程序化材质
   所有贴图在浏览器里用 Canvas 现画，避免外部图片依赖与版权问题。
   颜色与纹样按公开实景资料重绘，不对应单张照片。 */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var seed = 1894;

  function rand() {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function rng(s) {
    var value = s || 1;
    return function () {
      value |= 0;
      value = (value + 0x6D2B79F5) | 0;
      var t = Math.imul(value ^ (value >>> 15), 1 | value);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function canvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function texture(c, repeat) {
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    if (repeat) tex.repeat.set(repeat[0], repeat[1]);
    return tex;
  }

  function grayTexture(c) {
    var g = canvas(c.width, c.height);
    var gx = g.getContext("2d");
    gx.drawImage(c, 0, 0);
    var img = gx.getImageData(0, 0, c.width, c.height);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = l;
    }
    gx.putImageData(img, 0, 0);
    var tex = new THREE.CanvasTexture(g);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  }

  function grain(ctx, w, h, amount, alpha) {
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var n = (rand() - 0.5) * amount;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
      if (alpha) d[i + 3] = alpha;
    }
    ctx.putImageData(img, 0, 0);
  }

  function blotches(ctx, w, h, count, color, alpha, radius) {
    for (var i = 0; i < count; i++) {
      var x = rand() * w;
      var y = rand() * h;
      var r = radius * (0.35 + rand());
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(" + color + "," + alpha + ")");
      g.addColorStop(1, "rgba(" + color + ",0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }

  function line(ctx, x1, y1, x2, y2, color, width, alpha) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  /* ---------------- 青砖 ---------------- */

  function makeBrick() {
    var w = 512, h = 512;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#3f4341";
    ctx.fillRect(0, 0, w, h);

    var bh = 32;
    var bw = 64;
    for (var row = 0; row < h / bh; row++) {
      var off = row % 2 ? -bw / 2 : 0;
      for (var col = -1; col < w / bw + 1; col++) {
        var x = col * bw + off;
        var y = row * bh;
        var l = 20 + rand() * 8;
        var hue = 190 + rand() * 14;
        ctx.fillStyle = "hsl(" + hue + ",4%," + l + "%)";
        ctx.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3);
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(x + 2, y + 2, bw - 4, 2);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(x + 2, y + bh - 4, bw - 4, 2);
        for (var s = 0; s < 10; s++) {
          ctx.fillStyle = rand() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.09)";
          ctx.fillRect(x + 3 + rand() * (bw - 7), y + 3 + rand() * (bh - 7), 1 + rand() * 3, 1);
        }
      }
    }

    blotches(ctx, w, h, 26, "26,30,28", 0.16, 70);
    blotches(ctx, w, h, 18, "118,120,112", 0.12, 44);
    ctx.fillStyle = "rgba(30,34,32,0.18)";
    for (var m = 0; m < 90; m++) {
      var mx = rand() * w;
      var my = rand() * h;
      ctx.fillRect(mx, my, 1 + rand() * 4, 1 + rand() * 2);
    }
    grain(ctx, w, h, 16);
    return c;
  }

  /* ---------------- 青瓦 ---------------- */

  function makeRoof() {
    var w = 512, h = 512;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#353837";
    ctx.fillRect(0, 0, w, h);

    var colW = 32;
    for (var x = 0; x < w; x += colW) {
      var g = ctx.createLinearGradient(x, 0, x + colW, 0);
      g.addColorStop(0, "#232625");
      g.addColorStop(0.18, "#4a4d4b");
      g.addColorStop(0.5, "#636664");
      g.addColorStop(0.82, "#424543");
      g.addColorStop(1, "#1f2221");
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, colW - 3, h);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fillRect(x + colW * 0.42, 0, 2, h);
      ctx.fillStyle = "rgba(0,0,0,0.22)";
      ctx.fillRect(x + colW - 5, 0, 3, h);

      for (var y = 0; y < h; y += 32) {
        ctx.fillStyle = "rgba(20,26,25,0.34)";
        ctx.fillRect(x, y + 26, colW - 3, 5);
        ctx.fillStyle = "rgba(210,214,204,0.1)";
        ctx.fillRect(x + 2, y + 24, colW - 7, 2);
      }
    }

    blotches(ctx, w, h, 22, "44,49,45", 0.2, 60);
    blotches(ctx, w, h, 14, "122,122,112", 0.1, 38);
    for (var i = 0; i < 30; i++) {
      line(ctx, rand() * w, rand() * h, rand() * w, rand() * h, "rgba(30,34,32,0.12)", 1, 1);
    }
    grain(ctx, w, h, 14);
    return c;
  }

  /* ---------------- 花岗岩 ---------------- */

  function makeGranite() {
    var w = 512, h = 512;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#9d998e";
    ctx.fillRect(0, 0, w, h);

    var slab = 128;
    for (var y = 0; y < h; y += slab) {
      for (var x = 0; x < w; x += slab) {
        var l = 58 + rand() * 8;
        ctx.fillStyle = "hsl(42,7%," + l + "%)";
        ctx.fillRect(x + 3, y + 3, slab - 6, slab - 6);
        ctx.fillStyle = "rgba(255,255,255,0.09)";
        ctx.fillRect(x + 3, y + 3, slab - 6, 2);
        ctx.fillStyle = "rgba(40,38,32,0.18)";
        ctx.fillRect(x + 3, y + slab - 5, slab - 6, 2);
      }
    }
    ctx.strokeStyle = "rgba(64,61,54,0.7)";
    ctx.lineWidth = 4;
    for (var j = 0; j <= w; j += slab) {
      ctx.beginPath(); ctx.moveTo(j, 0); ctx.lineTo(j, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke();
    }

    for (var s = 0; s < 3600; s++) {
      var dark = rand() > 0.42;
      ctx.fillStyle = dark ? "rgba(42,40,35," + (0.1 + rand() * 0.2) + ")" : "rgba(240,238,228," + (0.1 + rand() * 0.2) + ")";
      var size = rand() > 0.92 ? 2 : 1;
      ctx.fillRect(rand() * w, rand() * h, size, size);
    }
    blotches(ctx, w, h, 16, "58,55,46", 0.1, 55);
    blotches(ctx, w, h, 8, "114,112,86", 0.08, 34);
    grain(ctx, w, h, 10);
    return c;
  }

  /* ---------------- 木纹 ---------------- */

  function makeWood() {
    var w = 256, h = 512;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#3b2418";
    ctx.fillRect(0, 0, w, h);
    for (var i = 0; i < 90; i++) {
      var x = rand() * w;
      var amp = 2 + rand() * 7;
      var alpha = 0.06 + rand() * 0.16;
      ctx.strokeStyle = rand() > 0.45 ? "rgba(16,8,4," + alpha + ")" : "rgba(150,92,52," + alpha + ")";
      ctx.lineWidth = 0.6 + rand() * 2.4;
      ctx.beginPath();
      for (var y = 0; y <= h; y += 8) {
        var px = x + Math.sin(y * 0.018 + i) * amp;
        if (y === 0) ctx.moveTo(px, y);
        else ctx.lineTo(px, y);
      }
      ctx.stroke();
    }
    for (var k = 0; k < 5; k++) {
      var kx = rand() * w;
      var ky = rand() * h;
      for (var r = 2; r < 14; r += 2) {
        ctx.strokeStyle = "rgba(20,10,5,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 0.6, r, 0, 0, TAU);
        ctx.stroke();
      }
    }
    grain(ctx, w, h, 12);
    return c;
  }

  /* ---------------- 灰塑底 ---------------- */

  function makePlaster() {
    var w = 256, h = 256;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#b4aea0";
    ctx.fillRect(0, 0, w, h);
    blotches(ctx, w, h, 24, "94,92,82", 0.16, 34);
    blotches(ctx, w, h, 14, "220,216,202", 0.16, 28);
    for (var i = 0; i < 18; i++) {
      ctx.strokeStyle = "rgba(70,68,60,0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      var x = rand() * w, y = rand() * h;
      ctx.moveTo(x, y);
      for (var k = 0; k < 4; k++) {
        x += (rand() - 0.5) * 30;
        y += rand() * 18;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    grain(ctx, w, h, 22);
    return c;
  }

  /* ---------------- 陶塑脊带 ---------------- */

  function makeRidgeBand() {
    var w = 1024, h = 256;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    var r = rng(1893);

    ctx.fillStyle = "#6b6a5e";
    ctx.fillRect(0, 0, w, h);
    var bg = ctx.createLinearGradient(0, 24, 0, h - 24);
    bg.addColorStop(0, "#244b42");
    bg.addColorStop(0.5, "#1b3b35");
    bg.addColorStop(1, "#2b4a3e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 24, w, h - 48);

    /* 云纹与山石，作为人物的背景层 */
    for (var cl = 0; cl < 9; cl++) {
      var cx = 50 + cl * 112 + r() * 30;
      var cy = 55 + r() * 130;
      ctx.strokeStyle = "rgba(188,172,118,0.34)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, 20 + r() * 12, 0.3, 4.7);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 24, cy + 4, 12 + r() * 9, 0.1, 4.2);
      ctx.stroke();
      ctx.strokeStyle = "rgba(53,86,74,0.55)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(cx - 10, h - 38);
      ctx.quadraticCurveTo(cx - 24, h - 90, cx - 4, h - 112);
      ctx.stroke();
    }

    /* 花团压低对比，避免近看像壁纸 */
    var petals = ["#8a5a32", "#7a3a2a", "#a28448", "#5a4632", "#4a6a58"];
    for (var f = 0; f < 9; f++) {
      var fx = 40 + r() * (w - 80);
      var fy = 62 + r() * (h - 124);
      var rr = 17 + r() * 20;
      ctx.globalAlpha = 0.38 + r() * 0.18;
      ctx.fillStyle = petals[Math.floor(r() * petals.length)];
      for (var p = 0; p < 7; p++) {
        var pa = (p / 7) * TAU;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(pa) * rr * 0.6, fy + Math.sin(pa) * rr * 0.55, rr * 0.46, rr * 0.3, pa, 0, TAU);
        ctx.fill();
      }
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = "#b08a4a";
      ctx.beginPath();
      ctx.arc(fx, fy, rr * 0.22, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(28,48,40,0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    /* 小亭台剪影 */
    for (var pv = 0; pv < 4; pv++) {
      var px = 90 + pv * 260 + r() * 40;
      var py = 190;
      ctx.fillStyle = "rgba(164,142,90,0.42)";
      ctx.fillRect(px, py - 38, 54, 38);
      ctx.beginPath();
      ctx.moveTo(px - 12, py - 38);
      ctx.lineTo(px + 27, py - 62);
      ctx.lineTo(px + 66, py - 38);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(34,56,48,0.8)";
      ctx.fillRect(px + 8, py - 30, 6, 30);
      ctx.fillRect(px + 40, py - 30, 6, 30);
    }

    /* 上下灰塑压边 */
    ctx.fillStyle = "#8c8674";
    ctx.fillRect(0, 0, w, 26);
    ctx.fillRect(0, h - 30, w, 30);
    ctx.fillStyle = "#a49d8a";
    ctx.fillRect(0, 20, w, 6);
    ctx.fillStyle = "rgba(44,48,40,0.42)";
    ctx.fillRect(0, h - 34, w, 4);
    ctx.strokeStyle = "rgba(201,154,82,0.5)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 36);
    ctx.lineTo(w, 36);
    ctx.stroke();
    grain(ctx, w, h, 8);
    return c;
  }

  /* ---------------- 铁铸通花栏板 ---------------- */

  function makeIronPanel() {
    var w = 512, h = 256;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#292d2b";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#6f7167";
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = "#565a52";
    ctx.lineWidth = 3;
    ctx.strokeRect(22, 22, w - 44, h - 44);

    ctx.strokeStyle = "#7d7f72";
    ctx.lineWidth = 4;
    for (var i = 0; i < 4; i++) {
      var cx = 70 + i * 124;
      var cy = h / 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 34, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 18, 0, TAU);
      ctx.stroke();
      for (var k = 0; k < 8; k++) {
        var a = (k / 8) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * 36, cy + Math.sin(a) * 36);
        ctx.quadraticCurveTo(
          cx + Math.cos(a + 0.6) * 58, cy + Math.sin(a + 0.6) * 58,
          cx + Math.cos(a + 1.1) * 42, cy + Math.sin(a + 1.1) * 42
        );
        ctx.stroke();
      }
    }
    ctx.strokeStyle = "#4c5048";
    ctx.lineWidth = 2;
    for (var x = 24; x < w - 24; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 24);
      ctx.quadraticCurveTo(x + 9, h / 2, x, h - 24);
      ctx.stroke();
    }
    for (var r = 0; r < 2; r++) {
      for (var q = 0; q < 2; q++) {
        ctx.fillStyle = "#8b8c7d";
        ctx.beginPath();
        ctx.arc(34 + q * (w - 68), 34 + r * (h - 68), 5, 0, TAU);
        ctx.fill();
      }
    }
    grain(ctx, w, h, 10);
    return c;
  }

  /* ---------------- 满洲窗 ---------------- */

  function makeWindow() {
    var w = 256, h = 256;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#2a1b12";
    ctx.fillRect(0, 0, w, h);
    var colors = ["#5f8f9b", "#8a5d48", "#a9b98b", "#c7a35a", "#6c7f9b", "#9b5a4d"];
    var cell = 40;
    for (var y = 0; y < 6; y++) {
      for (var x = 0; x < 6; x++) {
        var col = colors[Math.floor(rand() * colors.length)];
        ctx.fillStyle = col;
        ctx.globalAlpha = 0.82;
        ctx.fillRect(10 + x * cell, 10 + y * cell, cell - 6, cell - 6);
        ctx.globalAlpha = 1;
        var g = ctx.createLinearGradient(10 + x * cell, 10 + y * cell, 10 + x * cell + cell, 10 + y * cell + cell);
        g.addColorStop(0, "rgba(255,255,255,0.35)");
        g.addColorStop(1, "rgba(0,0,0,0.16)");
        ctx.fillStyle = g;
        ctx.fillRect(10 + x * cell, 10 + y * cell, cell - 6, cell - 6);
      }
    }
    ctx.strokeStyle = "#3a2518";
    ctx.lineWidth = 6;
    for (var i = 0; i <= 6; i++) {
      ctx.beginPath(); ctx.moveTo(7 + i * cell, 4); ctx.lineTo(7 + i * cell, h - 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, 7 + i * cell); ctx.lineTo(w - 4, 7 + i * cell); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(220,184,122,0.45)";
    ctx.lineWidth = 1;
    for (var d = 0; d < 6; d++) {
      ctx.beginPath(); ctx.moveTo(7 + d * cell, 7); ctx.lineTo(w - 7, h - 7 - (5 - d) * cell); ctx.stroke();
    }
    grain(ctx, w, h, 8);
    return c;
  }

  function makeCloud() {
    var w = 256, h = 128;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    for (var i = 0; i < 7; i++) {
      ctx.beginPath();
      ctx.arc(30 + i * 32, 70 - Math.sin(i * 1.1) * 18, 22 + rand() * 8, 0, TAU);
      ctx.fill();
    }
    ctx.fillRect(18, 66, 220, 26);
    return c;
  }

  /* ---------------- 砖雕挂线 ---------------- */

  function relief(ctx, draw, fill, light, dark) {
    ctx.save();
    ctx.translate(2.5, 3.5);
    ctx.fillStyle = dark;
    draw(ctx);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(-1.2, -1.2);
    ctx.fillStyle = light;
    draw(ctx);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = fill;
    draw(ctx);
    ctx.fill();
    ctx.restore();
  }

  function tinyFigure(ctx, x, y, s, robe, skin, pose) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(26,34,31,0.5)";
    ctx.beginPath();
    ctx.ellipse(3, 18, 8, 4, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(-7, 2);
    ctx.quadraticCurveTo(-9, 16, -5, 20);
    ctx.lineTo(5, 20);
    ctx.quadraticCurveTo(9, 16, 7, 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, -4, 4.6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#3a2a1d";
    ctx.beginPath();
    ctx.arc(0, -6.5, 4.4, Math.PI, TAU);
    ctx.fill();
    if (pose === 1) {
      ctx.strokeStyle = robe;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(4, 5);
      ctx.lineTo(13, -6);
      ctx.stroke();
    } else if (pose === 2) {
      ctx.strokeStyle = "#59422c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-5, 7);
      ctx.lineTo(-14, 2);
      ctx.stroke();
      ctx.fillStyle = "#d4b77b";
      ctx.fillRect(-18, 1, 5, 2);
    } else if (pose === 3) {
      ctx.strokeStyle = "#59422c";
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(10, -30);
      ctx.stroke();
      ctx.fillStyle = "#b5432f";
      ctx.beginPath();
      ctx.moveTo(10, -30);
      ctx.lineTo(20, -26);
      ctx.lineTo(12, -20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function makeBrickCarving(variant) {
    var w = 640, h = 320;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    var r = rng(1900 + variant * 37);

    ctx.fillStyle = "#66726d";
    ctx.fillRect(0, 0, w, h);
    for (var row = 0; row < 10; row++) {
      for (var col = -1; col < 11; col++) {
        var off = row % 2 ? 30 : 0;
        ctx.fillStyle = "hsla(" + (156 + r() * 10) + ",8%," + (34 + r() * 6) + "%,1)";
        ctx.fillRect(col * 62 + off, row * 32, 59, 29);
      }
    }
    ctx.fillStyle = "rgba(52,63,58,0.5)";
    ctx.fillRect(0, 0, w, h);

    var base = "#78847d";
    var light = "#aab4aa";
    var dark = "#3f4a45";

    /* 远山 */
    relief(ctx, function (g) {
      g.beginPath();
      g.moveTo(0, 220);
      g.lineTo(70, 160);
      g.lineTo(120, 195);
      g.lineTo(190, 130);
      g.lineTo(265, 200);
      g.lineTo(330, 155);
      g.lineTo(410, 215);
      g.lineTo(500, 150);
      g.lineTo(570, 195);
      g.lineTo(640, 165);
      g.lineTo(640, 320);
      g.lineTo(0, 320);
      g.closePath();
    }, "#59655f", "#8b968c", "#37403b");

    /* 云纹 */
    for (var cl = 0; cl < 5; cl++) {
      var cx = 40 + r() * 560;
      var cy = 45 + r() * 70;
      ctx.strokeStyle = "rgba(188,196,184,0.42)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 14 + r() * 8, 0.4, 4.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 18, cy + 4, 10 + r() * 7, 0.2, 4.0);
      ctx.stroke();
    }

    if (variant === 1) {
      /* 梧桐杏柳凤凰：树 + 鸟 */
      relief(ctx, function (g) {
        g.beginPath();
        g.moveTo(320, 300);
        g.quadraticCurveTo(300, 210, 250, 170);
        g.quadraticCurveTo(230, 100, 320, 92);
        g.quadraticCurveTo(380, 80, 430, 150);
        g.quadraticCurveTo(450, 230, 380, 300);
        g.closePath();
      }, "#5c6b60", "#95a58d", "#36433a");
      ctx.strokeStyle = "#3d4a42";
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(330, 300);
      ctx.quadraticCurveTo(340, 210, 320, 140);
      ctx.stroke();
      for (var b = 0; b < 11; b++) {
        var bx = 180 + r() * 300;
        var by = 55 + r() * 130;
        ctx.fillStyle = b % 3 === 0 ? "#b5432f" : (b % 3 === 1 ? "#8b6a3c" : "#2f6b5f");
        ctx.beginPath();
        ctx.ellipse(bx, by, 10 + r() * 8, 4.5 + r() * 3, r() * 3, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(30,40,34,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(bx + 5, by);
        ctx.lineTo(bx + 18, by - 8);
        ctx.stroke();
      }
      for (var t = 0; t < 6; t++) {
        tinyFigure(ctx, 90 + t * 92, 260 + (t % 2) * 8, 1.3, ["#7a3b2d", "#2f5f56", "#7d6842"][t % 3], "#c8a582", 0);
      }
    } else if (variant === 2) {
      /* 聚义厅：亭台 + 人群 */
      relief(ctx, function (g) {
        g.beginPath();
        g.moveTo(170, 250);
        g.lineTo(190, 160);
        g.lineTo(450, 160);
        g.lineTo(470, 250);
        g.closePath();
      }, "#6f7d74", "#a1ada0", "#3c4842");
      relief(ctx, function (g) {
        g.beginPath();
        g.moveTo(140, 166);
        g.lineTo(320, 96);
        g.lineTo(500, 166);
        g.lineTo(460, 178);
        g.lineTo(320, 124);
        g.lineTo(180, 178);
        g.closePath();
      }, "#4f5d56", "#8f9b8e", "#333d38");
      ctx.fillStyle = "#3f4c45";
      for (var v = 0; v < 6; v++) {
        ctx.fillRect(205 + v * 44, 168, 9, 80);
      }
      ctx.fillStyle = "#59665d";
      ctx.fillRect(195, 246, 250, 10);
      for (var p = 0; p < 14; p++) {
        tinyFigure(ctx, 70 + (p % 7) * 78, 258 + Math.floor(p / 7) * 14, 1.25, ["#7a3b2d", "#2f5f56", "#6f5a37", "#813f30"][p % 4], "#cba986", p % 4 === 0 ? 3 : (p % 2 ? 1 : 0));
      }
    } else {
      /* 刘庆伏狼驹：马 + 对峙人群 */
      for (var m = 0; m < 3; m++) {
        var mx = 360 + m * 80;
        var my = 245 - m * 4;
        ctx.fillStyle = "#4a554f";
        ctx.beginPath();
        ctx.ellipse(mx, my, 42, 18, -0.06, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#56645b";
        ctx.beginPath();
        ctx.ellipse(mx + 34, my - 20, 16, 10, -0.4, 0, TAU);
        ctx.fill();
        ctx.fillRect(mx - 26, my + 10, 7, 35);
        ctx.fillRect(mx + 18, my + 10, 7, 35);
        ctx.strokeStyle = "#3c4842";
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(mx + 38, my - 28);
        ctx.lineTo(mx + 46, my - 48);
        ctx.stroke();
        ctx.fillStyle = "#7d3b2e";
        ctx.beginPath();
        ctx.moveTo(mx - 6, my - 30);
        ctx.lineTo(mx + 12, my - 22);
        ctx.lineTo(mx + 4, my - 10);
        ctx.closePath();
        ctx.fill();
      }
      for (var f = 0; f < 13; f++) {
        tinyFigure(ctx, 60 + (f % 6) * 48, 255 + Math.floor(f / 6) * 15, 1.2, ["#7a3b2d", "#2f5f56", "#6f5a37"][f % 3], "#c9a582", f % 3 === 0 ? 1 : 0);
      }
      relief(ctx, function (g) {
        g.beginPath();
        g.arc(320, 120, 22, 0, TAU);
      }, "#a9a27d", "#d2c9a1", "#5c583f");
    }

    /* 边框与题刻 */
    ctx.strokeStyle = "#9aa39a";
    ctx.lineWidth = 10;
    ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.strokeStyle = "rgba(48,57,52,0.8)";
    ctx.lineWidth = 3;
    ctx.strokeRect(18, 18, w - 36, h - 36);
    ctx.fillStyle = "rgba(210,213,201,0.55)";
    ctx.fillRect(22, 26, 78, 4);
    ctx.fillRect(w - 110, h - 30, 88, 4);
    grain(ctx, w, h, 12);
    return c;
  }

  /* ---------------- 木雕屏门 ---------------- */

  function makeScreen() {
    var w = 384, h = 768;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#2d1c12";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "rgba(80,48,28,0.5)";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "#6d4526";
    ctx.lineWidth = 12;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = "#b98a52";
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, w - 36, h - 36);

    /* 格心 */
    var gx0 = 26, gy0 = 26, gw = w - 52, gh = 430;
    ctx.strokeStyle = "rgba(201,154,82,0.75)";
    ctx.lineWidth = 2.5;
    for (var i = 0; i <= 8; i++) {
      ctx.beginPath();
      ctx.moveTo(gx0 + (gw / 8) * i, gy0);
      ctx.lineTo(gx0 + (gw / 8) * i, gy0 + gh);
      ctx.stroke();
    }
    for (var j = 0; j <= 12; j++) {
      ctx.beginPath();
      ctx.moveTo(gx0, gy0 + (gh / 12) * j);
      ctx.lineTo(gx0 + gw, gy0 + (gh / 12) * j);
      ctx.stroke();
    }
    for (var a = 0; a < 8; a++) {
      for (var b = 0; b < 12; b++) {
        var cx = gx0 + a * (gw / 8) + gw / 16;
        var cy = gy0 + b * (gh / 12) + gh / 24;
        var r = 12 + rand() * 8;
        ctx.strokeStyle = "rgba(201,154,82,0.38)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(cx - r, cy - r);
        ctx.lineTo(cx + r, cy + r);
        ctx.moveTo(cx + r, cy - r);
        ctx.lineTo(cx - r, cy + r);
        ctx.stroke();
        if (rand() > 0.62) {
          ctx.fillStyle = "rgba(181,67,47,0.55)";
          ctx.beginPath();
          ctx.arc(cx, cy, 3.5, 0, TAU);
          ctx.fill();
        }
      }
    }

    /* 中绦环板 */
    ctx.fillStyle = "#3e2718";
    ctx.fillRect(24, 470, w - 48, 42);
    ctx.strokeStyle = "#b98a52";
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 476, w - 60, 30);
    for (var k = 0; k < 8; k++) {
      ctx.beginPath();
      ctx.arc(50 + k * 40, 491, 7, 0, TAU);
      ctx.stroke();
    }

    /* 裙板浮雕 */
    var px = 28, py = 526, pw = w - 56, ph = 210;
    ctx.fillStyle = "#452b19";
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = "#b98a52";
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, pw, ph);
    ctx.fillStyle = "#2a1a10";
    ctx.beginPath();
    ctx.moveTo(px, py + ph);
    ctx.lineTo(px + 40, py + 70);
    ctx.lineTo(px + 100, py + 130);
    ctx.lineTo(px + 160, py + 50);
    ctx.lineTo(px + 230, py + 140);
    ctx.lineTo(px + 300, py + 80);
    ctx.lineTo(px + pw, py + ph);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(201,154,82,0.55)";
    ctx.lineWidth = 2;
    for (var s = 0; s < 5; s++) {
      ctx.beginPath();
      ctx.arc(px + 50 + s * 70, py + 160 - s * 8, 18, 0, TAU);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(201,154,82,0.8)";
    ctx.fillRect(px + 18, py + 14, 64, 6);
    ctx.fillRect(px + pw - 84, py + ph - 22, 66, 6);
    grain(ctx, w, h, 14);
    return c;
  }

  /* ---------------- 门神 ---------------- */

  function doorGod(red) {
    var w = 512, h = 1024;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#0d0b0a";
    ctx.fillRect(0, 0, w, h);

    var face = red ? "#aa3f30" : "#2c2a26";
    var faceShade = red ? "#7f2b22" : "#1c1b18";
    var robe = red ? "#8f2f25" : "#2e4d47";
    var armor = red ? "#2f5f56" : "#7c3028";
    var gold = "#d7a85e";
    var goldLight = "#f0d296";
    var ink = "#17130f";

    /* 云气 */
    ctx.save();
    ctx.globalAlpha = 0.34;
    for (var cl = 0; cl < 7; cl++) {
      ctx.strokeStyle = cl % 2 ? "#b5432f" : "#517d73";
      ctx.lineWidth = 5;
      ctx.beginPath();
      var cx = 100 + rand() * 312;
      var cy = 90 + rand() * 760;
      ctx.arc(cx, cy, 22 + rand() * 20, 0.3, 4.6);
      ctx.stroke();
    }
    ctx.restore();

    /* 武器 */
    ctx.save();
    ctx.translate(348, 470);
    ctx.rotate(0.22);
    ctx.strokeStyle = "#6e5a34";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(0, -260);
    ctx.lineTo(0, 360);
    ctx.stroke();
    ctx.fillStyle = gold;
    if (red) {
      ctx.fillRect(-16, -290, 10, 180);
      ctx.fillRect(6, -290, 10, 180);
      ctx.fillStyle = goldLight;
      ctx.fillRect(-16, -290, 4, 180);
      ctx.fillRect(6, -290, 4, 180);
    } else {
      ctx.beginPath();
      ctx.moveTo(-28, -280);
      ctx.quadraticCurveTo(0, -350, 28, -280);
      ctx.lineTo(10, -120);
      ctx.lineTo(-10, -120);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#9b3b2d";
      ctx.beginPath();
      ctx.arc(0, -255, 10, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    /* 靴 */
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(216, 940, 44, 22, -0.12, 0, TAU);
    ctx.ellipse(300, 940, 44, 22, 0.12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = gold;
    ctx.fillRect(192, 914, 48, 6);
    ctx.fillRect(278, 914, 48, 6);

    /* 战裙 */
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(170, 610);
    ctx.quadraticCurveTo(150, 800, 180, 920);
    ctx.lineTo(330, 920);
    ctx.quadraticCurveTo(360, 790, 340, 610);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = "rgba(215,168,94,0.55)";
    ctx.lineWidth = 3;
    for (var f = 0; f < 6; f++) {
      ctx.beginPath();
      ctx.moveTo(185 + f * 4, 680 + f * 38);
      ctx.quadraticCurveTo(255, 720 + f * 34, 325 - f * 4, 680 + f * 38);
      ctx.stroke();
    }

    /* 甲身 */
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.moveTo(162, 330);
    ctx.quadraticCurveTo(255, 292, 348, 330);
    ctx.lineTo(338, 630);
    ctx.quadraticCurveTo(255, 668, 172, 630);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 5;
    ctx.stroke();

    /* 甲片 */
    for (var row = 0; row < 7; row++) {
      for (var col = 0; col < 5; col++) {
        var ax = 190 + col * 32;
        var ay = 366 + row * 34;
        ctx.strokeStyle = "rgba(240,210,150,0.62)";
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(ax + 14, ay, 15, Math.PI * 0.08, Math.PI * 0.92);
        ctx.stroke();
      }
    }

    /* 护心镜 */
    ctx.fillStyle = gold;
    ctx.beginPath();
    ctx.arc(255, 500, 46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#7a4f28";
    ctx.beginPath();
    ctx.arc(255, 500, 34, 0, TAU);
    ctx.fill();
    ctx.fillStyle = goldLight;
    ctx.beginPath();
    ctx.arc(255, 500, 20, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#7a2f24";
    ctx.beginPath();
    ctx.arc(255, 500, 11, 0, TAU);
    ctx.fill();

    /* 肩甲 */
    [-1, 1].forEach(function (side) {
      ctx.save();
      ctx.translate(255 + side * 104, 360);
      ctx.fillStyle = armor;
      ctx.beginPath();
      ctx.ellipse(0, 0, 54, 44, side * 0.18, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = gold;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = gold;
      for (var s = -2; s <= 2; s++) {
        ctx.beginPath();
        ctx.arc(s * 18, -28, 7, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    });

    /* 手臂 */
    ctx.save();
    ctx.translate(150, 400);
    ctx.rotate(0.24);
    ctx.fillStyle = robe;
    ctx.fillRect(-24, 0, 48, 180);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(-24, 0, 48, 180);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 190, 24, 0, TAU);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(360, 410);
    ctx.rotate(-0.32);
    ctx.fillStyle = robe;
    ctx.fillRect(-24, 0, 48, 170);
    ctx.strokeStyle = gold;
    ctx.lineWidth = 4;
    ctx.strokeRect(-24, 0, 48, 170);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(0, 182, 24, 0, TAU);
    ctx.fill();
    ctx.restore();

    /* 颈部与脸 */
    ctx.fillStyle = faceShade;
    ctx.fillRect(230, 270, 50, 50);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.ellipse(255, 225, 58, 70, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.stroke();

    /* 眉眼 */
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.ellipse(232, 210, 12, 7, 0.16, 0, TAU);
    ctx.ellipse(280, 210, 12, 7, -0.16, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f2e2c2";
    ctx.beginPath();
    ctx.arc(232, 209, 4, 0, TAU);
    ctx.arc(280, 209, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(232, 209, 2.2, 0, TAU);
    ctx.arc(280, 209, 2.2, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = ink;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(210, 188);
    ctx.quadraticCurveTo(232, 175, 250, 188);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(260, 188);
    ctx.quadraticCurveTo(280, 175, 302, 190);
    ctx.stroke();

    /* 鼻与口 */
    ctx.strokeStyle = faceShade;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(255, 214);
    ctx.lineTo(252, 242);
    ctx.lineTo(264, 246);
    ctx.stroke();
    ctx.fillStyle = red ? "#4a1813" : "#171412";
    ctx.beginPath();
    ctx.ellipse(255, 272, 20, 8, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#f2e2c2";
    ctx.fillRect(244, 266, 22, 3);

    /* 胡须 */
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.moveTo(232, 250);
    ctx.quadraticCurveTo(220, 300, 255, 330);
    ctx.quadraticCurveTo(292, 300, 280, 250);
    ctx.quadraticCurveTo(270, 278, 255, 286);
    ctx.quadraticCurveTo(242, 278, 232, 250);
    ctx.closePath();
    ctx.fill();
    if (red) {
      ctx.strokeStyle = "#1a1511";
      ctx.lineWidth = 3;
      for (var b = 0; b < 7; b++) {
        ctx.beginPath();
        ctx.moveTo(238 + b * 5, 258);
        ctx.quadraticCurveTo(230 + b * 8, 300, 250 + b * 2, 324);
        ctx.stroke();
      }
    }

    /* 头盔 */
    ctx.fillStyle = armor;
    ctx.beginPath();
    ctx.arc(255, 172, 66, Math.PI, TAU);
    ctx.lineTo(321, 190);
    ctx.lineTo(189, 190);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = gold;
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.fillStyle = gold;
    ctx.fillRect(188, 186, 134, 12);
    ctx.beginPath();
    ctx.arc(255, 110, 18, 0, TAU);
    ctx.fill();
    ctx.fillStyle = "#a8382b";
    ctx.beginPath();
    ctx.arc(255, 110, 10, 0, TAU);
    ctx.fill();

    /* 雉鸡翎 */
    ctx.strokeStyle = red ? "#c98b3f" : "#9ba889";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(205, 150);
    ctx.quadraticCurveTo(110, 40, 58, 120);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(305, 150);
    ctx.quadraticCurveTo(400, 40, 452, 120);
    ctx.stroke();
    ctx.strokeStyle = "rgba(240,210,150,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(205, 150);
    ctx.quadraticCurveTo(110, 40, 58, 120);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(305, 150);
    ctx.quadraticCurveTo(400, 40, 452, 120);
    ctx.stroke();

    /* 金边勾线 */
    ctx.strokeStyle = "rgba(240,210,150,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(180, 650);
    ctx.quadraticCurveTo(255, 690, 330, 650);
    ctx.stroke();

    return c;
  }

  function makeDoorGod(black) {
    return doorGod(!black);
  }

  /* ---------------- 匾额与楹联 ---------------- */

  function makePlaque() {
    var w = 1024, h = 256;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#1b1510";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#8e6a37";
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.strokeStyle = "#c99a52";
    ctx.lineWidth = 3;
    ctx.strokeRect(26, 26, w - 52, h - 52);
    ctx.fillStyle = "#c99a52";
    ctx.font = '600 142px "KaiTi","STKaiti","Songti SC","SimSun",serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("陈 氏 书 院", w / 2, h / 2 + 4);
    ctx.fillStyle = "rgba(181,67,47,0.9)";
    ctx.fillRect(w - 92, 62, 34, 34);
    ctx.fillStyle = "#f2dcc0";
    ctx.font = '22px "KaiTi","STKaiti",serif';
    ctx.fillText("陈", w - 75, 80);
    ctx.fillStyle = "rgba(201,154,82,0.5)";
    ctx.fillRect(64, h - 48, 140, 3);
    ctx.fillRect(w - 204, h - 48, 140, 3);
    grain(ctx, w, h, 10);
    return c;
  }

  function makeCouplet(index) {
    var w = 192, h = 1280;
    var c = canvas(w, h);
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#17120e";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(201,154,82,0.7)";
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    var text = index === 0 ? "四壁灿瑰奇百粤华堂春风又满" : "一祠涵藻采五羊名片晓日增辉";
    ctx.fillStyle = "#d7b77a";
    ctx.font = '600 54px "KaiTi","STKaiti","Songti SC","SimSun",serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (var i = 0; i < text.length; i++) {
      ctx.fillText(text.charAt(i), w / 2, 92 + i * 86);
    }
    ctx.fillStyle = "rgba(181,67,47,0.85)";
    ctx.fillRect(w / 2 - 18, h - 66, 36, 36);
    ctx.fillStyle = "#f2dcc0";
    ctx.font = '20px "KaiTi","STKaiti",serif';
    ctx.fillText(index === 0 ? "春" : "日", w / 2, h - 47);
    grain(ctx, w, h, 8);
    return c;
  }

  /* ---------------- 组装 ---------------- */

  function build(renderer) {
    var maxAniso = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 4;
    var brickCanvas = makeBrick();
    var roofCanvas = makeRoof();
    var graniteCanvas = makeGranite();
    var woodCanvas = makeWood();
    var plasterCanvas = makePlaster();
    var ridgeCanvas = makeRidgeBand();
    var ironCanvas = makeIronPanel();
    var windowCanvas = makeWindow();
    var cloudCanvas = makeCloud();
    var carvingCanvases = [makeBrickCarving(0), makeBrickCarving(1), makeBrickCarving(2)];
    var screenCanvas = makeScreen();
    var godCanvases = [makeDoorGod(true), makeDoorGod(false)];
    var plaqueCanvas = makePlaque();
    var coupletCanvases = [makeCouplet(0), makeCouplet(1)];

    var out = {
      brick: texture(brickCanvas),
      brickBump: grayTexture(brickCanvas),
      roof: texture(roofCanvas),
      roofBump: grayTexture(roofCanvas),
      granite: texture(graniteCanvas),
      graniteBump: grayTexture(graniteCanvas),
      wood: texture(woodCanvas),
      plaster: texture(plasterCanvas),
      plasterBump: grayTexture(plasterCanvas),
      ridge: texture(ridgeCanvas),
      iron: texture(ironCanvas),
      window: texture(windowCanvas),
      cloud: new THREE.CanvasTexture(cloudCanvas),
      carvings: carvingCanvases.map(function (cv) { return texture(cv); }),
      screen: texture(screenCanvas),
      doorGods: godCanvases.map(function (cv) { return texture(cv); }),
      plaque: texture(plaqueCanvas),
      couplets: coupletCanvases.map(function (cv) { return texture(cv); }),
      canvases: {
        brick: brickCanvas,
        roof: roofCanvas,
        granite: graniteCanvas,
        wood: woodCanvas,
        plaster: plasterCanvas
      }
    };
    var clampList = [out.cloud, out.screen, out.plaque].concat(out.carvings, out.doorGods, out.couplets);
    clampList.forEach(function (t) {
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = Math.min(8, maxAniso);
    });
    [out.brick, out.roof, out.granite, out.wood, out.plaster, out.ridge, out.iron, out.window].forEach(function (t) {
      t.anisotropy = Math.min(8, maxAniso);
    });
    return out;
  }

  window.ChenTextures = { build: build };
})();
