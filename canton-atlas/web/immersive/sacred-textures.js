/* 石室圣心大教堂近景 · 程序化材质
   所有贴图在浏览器里用 Canvas 现画，避免外部图片依赖与版权问题。
   花岗岩、彩窗与玫瑰窗按公开实景的构图与配色重绘，不对应单张照片。 */
(function () {
  "use strict";

  var TAU = Math.PI * 2;
  var seed = 1863;

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

  function texture(c, repeat, clamp) {
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
    tex.encoding = THREE.sRGBEncoding;
    tex.anisotropy = 8;
    if (repeat) tex.repeat.set(repeat[0], repeat[1]);
    return tex;
  }

  function noise(ctx, w, h, amount, alpha) {
    for (var i = 0; i < amount; i++) {
      var x = Math.random() * w;
      var y = Math.random() * h;
      var s = 0.5 + Math.random() * 1.8;
      ctx.fillStyle = "rgba(0,0,0," + (Math.random() * alpha).toFixed(3) + ")";
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = "rgba(255,255,255," + (Math.random() * alpha * 0.6).toFixed(3) + ")";
      ctx.fillRect(w - x, h - y, s, s);
    }
  }

  function granite(rand) {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#98938a";
    x.fillRect(0, 0, 512, 512);
    var course = 64;
    for (var row = 0; row < 8; row++) {
      var y = row * course;
      var off = (row % 2) * 64;
      for (var col = -1; col < 5; col++) {
        var bx = col * 128 + off;
        var shade = 142 + Math.floor(rand() * 30);
        x.fillStyle = "rgb(" + (shade + 6) + "," + (shade + 1) + "," + (shade - 10) + ")";
        x.fillRect(bx + 2, y + 2, 124, course - 4);
        x.strokeStyle = "rgba(52,45,35,0.62)";
        x.lineWidth = 4;
        x.strokeRect(bx + 1, y + 1, 126, course - 2);
        x.strokeStyle = "rgba(45,39,30,0.32)";
        x.lineWidth = 2;
        x.beginPath();
        x.moveTo(bx + 126, y + 2);
        x.lineTo(bx + 126, y + course - 2);
        x.stroke();
        x.strokeStyle = "rgba(255,250,235,0.14)";
        x.lineWidth = 1;
        x.strokeRect(bx + 4, y + 4, 120, course - 8);
        for (var k = 0; k < 9; k++) {
          x.fillStyle = "rgba(70,60,44," + (0.05 + rand() * 0.1).toFixed(3) + ")";
          x.fillRect(bx + 6 + rand() * 108, y + 5 + rand() * 50, 2 + rand() * 10, 1 + rand() * 3);
        }
        if (rand() > 0.72) {
          x.fillStyle = "rgba(45,38,28,0.16)";
          x.fillRect(bx + 10 + rand() * 80, y + 8, 2 + rand() * 5, 40 + rand() * 10);
        }
      }
    }
    noise(x, 512, 512, 13000, 0.22);
    return c;
  }

  function graniteBump(rand) {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#808080";
    x.fillRect(0, 0, 512, 512);
    var course = 64;
    for (var row = 0; row < 8; row++) {
      var y = row * course;
      var off = (row % 2) * 64;
      for (var col = -1; col < 5; col++) {
        var bx = col * 128 + off;
        var shade = 110 + Math.floor(rand() * 40);
        x.fillStyle = "rgb(" + shade + "," + shade + "," + shade + ")";
        x.fillRect(bx + 2, y + 2, 124, course - 4);
        x.strokeStyle = "rgba(30,30,30,0.5)";
        x.lineWidth = 3;
        x.strokeRect(bx + 1, y + 1, 126, course - 2);
      }
    }
    noise(x, 512, 512, 7000, 0.2);
    return c;
  }

  function trimTexture(rand) {
    var c = canvas(256, 256);
    var x = c.getContext("2d");
    x.fillStyle = "#cabfa9";
    x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 220; i++) {
      x.fillStyle = "rgba(90,80,64," + (0.03 + rand() * 0.06).toFixed(3) + ")";
      x.fillRect(rand() * 256, rand() * 256, 1 + rand() * 4, 1 + rand() * 2);
    }
    return c;
  }

  function roofTexture(rand) {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#484a45";
    x.fillRect(0, 0, 512, 512);
    for (var row = 0; row < 16; row++) {
      for (var col = 0; col < 16; col++) {
        var shade = 62 + Math.floor(rand() * 20);
        x.fillStyle = "rgb(" + shade + "," + (shade + 2) + "," + (shade - 2) + ")";
        x.fillRect(col * 32 + 1, row * 32 + 1, 30, 30);
        x.strokeStyle = "rgba(18,19,17,0.35)";
        x.lineWidth = 1;
        x.strokeRect(col * 32, row * 32, 32, 32);
      }
    }
    noise(x, 512, 512, 3000, 0.12);
    return c;
  }

  function pavingTexture(rand) {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#a69d8e";
    x.fillRect(0, 0, 512, 512);
    for (var row = 0; row < 8; row++) {
      var off = (row % 2) * 64;
      for (var col = -1; col < 5; col++) {
        var bx = col * 128 + off;
        var y = row * 64;
        var shade = 150 + Math.floor(rand() * 26);
        x.fillStyle = "rgb(" + (shade + 8) + "," + shade + "," + (shade - 12) + ")";
        x.fillRect(bx + 2, y + 2, 124, 60);
        x.strokeStyle = "rgba(85,80,70,0.25)";
        x.lineWidth = 1.5;
        x.strokeRect(bx + 1, y + 1, 126, 62);
      }
    }
    noise(x, 512, 512, 5000, 0.12);
    return c;
  }

  function asphaltTexture(rand) {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#303335";
    x.fillRect(0, 0, 512, 512);
    noise(x, 512, 512, 12000, 0.22);
    return c;
  }

  function sidewalkTexture(rand) {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#9a9488";
    x.fillRect(0, 0, 512, 512);
    for (var row = 0; row < 8; row++) {
      for (var col = 0; col < 8; col++) {
        var shade = 138 + Math.floor(rand() * 24);
        x.fillStyle = "rgb(" + (shade + 5) + "," + shade + "," + (shade - 10) + ")";
        x.fillRect(col * 64 + 1, row * 64 + 1, 62, 62);
        x.strokeStyle = "rgba(75,72,64,0.28)";
        x.strokeRect(col * 64, row * 64, 64, 64);
      }
    }
    noise(x, 512, 512, 4000, 0.1);
    return c;
  }

  function stainedGlass(w, h, variant) {
    var c = canvas(w, h);
    var x = c.getContext("2d");
    var palettes = [
      { field: "#132f66", accent: "#8e2024", light: "#2c5fac", gold: "#b1811f", green: "#185445", violet: "#3d2a63" },
      { field: "#1a3a78", accent: "#7c1c22", light: "#3a6fbd", gold: "#c09327", green: "#1c5f4c", violet: "#462f6e" },
      { field: "#162f5e", accent: "#93262a", light: "#2f61a8", gold: "#a9791b", green: "#155244", violet: "#352456" }
    ];
    var pal = palettes[variant % palettes.length];
    var rand = rng(1863 + variant * 97);
    x.fillStyle = "#0a0f17";
    x.fillRect(0, 0, w, h);

    function leadLine(x0, y0, x1, y1, wdt, color) {
      x.strokeStyle = color || "#0a0d12";
      x.lineWidth = wdt;
      x.beginPath();
      x.moveTo(x0, y0);
      x.lineTo(x1, y1);
      x.stroke();
    }
    function diamond(cx, cy, rx, ry, fill, stroke) {
      x.beginPath();
      x.moveTo(cx, cy - ry);
      x.lineTo(cx + rx, cy);
      x.lineTo(cx, cy + ry);
      x.lineTo(cx - rx, cy);
      x.closePath();
      x.fillStyle = fill;
      x.fill();
      x.strokeStyle = stroke || "#c9a23a";
      x.lineWidth = 2;
      x.stroke();
    }
    function medallion(cx, cy, r, base, petal, center) {
      x.fillStyle = base;
      x.beginPath();
      x.arc(cx, cy, r, 0, TAU);
      x.fill();
      x.strokeStyle = "#080b10";
      x.lineWidth = 4;
      x.stroke();
      for (var i = 0; i < 8; i++) {
        var a = (i / 8) * TAU;
        x.fillStyle = petal;
        x.beginPath();
        x.arc(cx + Math.cos(a) * r * 0.52, cy + Math.sin(a) * r * 0.52, r * 0.3, 0, TAU);
        x.fill();
        x.strokeStyle = "#c9a23a";
        x.lineWidth = 1.6;
        x.stroke();
      }
      x.fillStyle = center;
      x.beginPath();
      x.arc(cx, cy, r * 0.26, 0, TAU);
      x.fill();
      x.strokeStyle = "#c9a23a";
      x.lineWidth = 2;
      x.stroke();
    }
    function panel(px0, py0, px1, py1, base, accent) {
      x.fillStyle = base;
      x.fillRect(px0, py0, px1 - px0, py1 - py0);
      var mx = (px0 + px1) / 2;
      var my = (py0 + py1) / 2;
      var pw = (px1 - px0) * 0.32;
      var ph = (py1 - py0) * 0.3;
      x.fillStyle = accent;
      x.beginPath();
      x.moveTo(mx, py0 + 4);
      x.lineTo(px1 - 4, my);
      x.lineTo(mx, py1 - 4);
      x.lineTo(px0 + 4, my);
      x.closePath();
      x.fill();
      x.strokeStyle = "#080b10";
      x.lineWidth = 3;
      x.stroke();
      diamond(mx, my, pw, ph, accent === pal.accent ? pal.gold : pal.accent);
      x.strokeStyle = "rgba(8,11,16,0.85)";
      x.lineWidth = 3;
      x.strokeRect(px0 + 1.5, py0 + 1.5, px1 - px0 - 3, py1 - py0 - 3);
    }

    var bw = Math.max(12, Math.round(w * 0.06));
    var seg = Math.max(26, Math.round(h * 0.045));
    for (var by = 0; by < h; by += seg) {
      x.fillStyle = ((by / seg) | 0) % 2 ? pal.accent : pal.field;
      x.fillRect(0, by + 1, bw, seg - 2);
      x.fillStyle = ((by / seg) | 0) % 2 ? pal.field : pal.accent;
      x.fillRect(w - bw, by + 1, bw, seg - 2);
      x.strokeStyle = "rgba(8,10,14,0.85)";
      x.lineWidth = 1.5;
      x.strokeRect(0.5, by + 0.5, bw, seg - 2);
      x.strokeRect(w - bw - 0.5, by + 0.5, bw, seg - 2);
    }
    for (var bx = 0; bx < w; bx += seg) {
      x.fillStyle = pal.gold;
      x.fillRect(bx + 1, 0, seg - 2, bw);
      x.fillStyle = pal.gold;
      x.fillRect(bx + 1, h - bw, seg - 2, bw);
    }

    var ix0 = bw + 4;
    var ix1 = w - bw - 4;
    var topB = h > 700 ? Math.round(h * 0.24) : Math.round(h * 0.3);
    medallion((ix0 + ix1) / 2, Math.round(topB * 0.52), Math.round((ix1 - ix0) * 0.32), pal.field, pal.accent, pal.gold);

    var bodyTop = topB + 8;
    var bodyBottom = h - bw - 8;
    var count = h > 700 ? 4 : 2;
    var ph2 = (bodyBottom - bodyTop) / count;
    for (var k = 0; k < count; k++) {
      var y0 = bodyTop + k * ph2 + 4;
      var y1 = bodyTop + (k + 1) * ph2 - 4;
      panel(ix0, y0, ix1, y1, k % 2 ? pal.field : pal.light, k % 2 ? pal.accent : pal.green);
      leadLine(ix0, y1 + 4, ix1, y1 + 4, 3);
      if (k < count - 1) {
        x.fillStyle = k % 2 ? pal.green : pal.gold;
        x.fillRect(ix0 + 3, y1 + 6, ix1 - ix0 - 6, 5);
      }
    }
    diamond((ix0 + ix1) / 2, bodyTop + ph2 * count - ph2 / 2, (ix1 - ix0) * 0.2, ph2 * 0.2, pal.violet);

    for (var s = 0; s < 26; s++) {
      var sx = ix0 + rand() * (ix1 - ix0);
      var sy = bodyTop + rand() * (bodyBottom - bodyTop);
      x.fillStyle = "rgba(255,238,196," + (0.05 + rand() * 0.1).toFixed(3) + ")";
      x.fillRect(sx, sy, 2 + rand() * 4, 2 + rand() * 5);
    }
    return c;
  }

  function roseGlass(rand) {
    var c = canvas(1024, 1024);
    var x = c.getContext("2d");
    x.fillStyle = "#101826";
    x.fillRect(0, 0, 1024, 1024);
    var cx = 512;
    var cy = 512;
    var blues = ["#14346e", "#1d4f9a", "#163f86"];
    function glassFill(i, ri) {
      var k = (i * 37 + ri * 61) % 100;
      if (k < 58) return blues[(i + ri) % 3];
      if (k < 76) return "#8e2024";
      if (k < 86) return "#b47d18";
      if (k < 93) return "#1c5d4d";
      return "#4a2e70";
    }
    var rings = [
      { r: 500, n: 24 },
      { r: 430, n: 24 },
      { r: 342, n: 16 },
      { r: 260, n: 16 },
      { r: 184, n: 12 },
      { r: 116, n: 8 }
    ];
    for (var ri = 0; ri < rings.length; ri++) {
      var inner = ri + 1 < rings.length ? rings[ri + 1].r : 42;
      var outer = rings[ri].r;
      var n = rings[ri].n;
      for (var i = 0; i < n; i++) {
        var a0 = (i / n) * TAU + (ri % 2) * 0.035;
        var a1 = ((i + 1) / n) * TAU + (ri % 2) * 0.035;
        x.beginPath();
        x.arc(cx, cy, outer, a0, a1);
        x.arc(cx, cy, inner, a1, a0, true);
        x.closePath();
        x.fillStyle = glassFill(i, ri);
        x.fill();
        x.strokeStyle = "rgba(8,10,14,0.92)";
        x.lineWidth = 4;
        x.stroke();
        x.strokeStyle = "rgba(255,238,190,0.18)";
        x.lineWidth = 1;
        x.stroke();
      }
    }
    x.fillStyle = "#b47d18";
    x.beginPath();
    x.arc(cx, cy, 64, 0, TAU);
    x.fill();
    x.strokeStyle = "rgba(8,10,14,0.95)";
    x.lineWidth = 5;
    x.stroke();
    x.strokeStyle = "rgba(255,238,190,0.4)";
    x.lineWidth = 2;
    x.beginPath();
    x.arc(cx, cy, 48, 0, TAU);
    x.stroke();
    return c;
  }

  function roseTracery() {
    var c = canvas(1024, 1024);
    var x = c.getContext("2d");
    x.fillStyle = "#000";
    x.fillRect(0, 0, 1024, 1024);
    var cx = 512;
    var cy = 512;
    x.strokeStyle = "#fff";
    x.fillStyle = "#fff";
    x.lineCap = "round";
    [496, 430, 342, 260, 184, 116].forEach(function (r, i) {
      x.lineWidth = i === 0 ? 24 : (i < 3 ? 14 : 11);
      x.beginPath();
      x.arc(cx, cy, r, 0, TAU);
      x.stroke();
    });
    var count = 24;
    function cusp(px, py, r, lobes) {
      var lr = r * 0.58;
      var d = r - lr;
      for (var j = 0; j < lobes; j++) {
        var a = (j / lobes) * TAU - Math.PI / 2;
        x.beginPath();
        x.arc(px + Math.cos(a) * d, py + Math.sin(a) * d, lr, 0, TAU);
        x.fill();
      }
    }
    for (var i = 0; i < count; i++) {
      var a = (i / count) * TAU;
      x.lineWidth = 8;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * 108, cy + Math.sin(a) * 108);
      x.lineTo(cx + Math.cos(a) * 488, cy + Math.sin(a) * 488);
      x.stroke();
      var mx = cx + Math.cos(a + TAU / (count * 2)) * 386;
      var my = cy + Math.sin(a + TAU / (count * 2)) * 386;
      cusp(mx, my, 31, 4);
    }
    for (var k = 0; k < 8; k++) {
      var ak = (k / 8) * TAU + TAU / 16;
      cusp(cx + Math.cos(ak) * 222, cy + Math.sin(ak) * 222, 26, 3);
    }
    x.lineWidth = 12;
    for (var p = 0; p < 8; p++) {
      var ap = (p / 8) * TAU + TAU / 16;
      x.beginPath();
      x.moveTo(cx + Math.cos(ap) * 46, cy + Math.sin(ap) * 46);
      x.lineTo(cx + Math.cos(ap) * 108, cy + Math.sin(ap) * 108);
      x.stroke();
    }
    x.beginPath();
    x.arc(cx, cy, 46, 0, TAU);
    x.lineWidth = 14;
    x.stroke();
    x.beginPath();
    x.arc(cx, cy, 16, 0, TAU);
    x.fill();
    return c;
  }

  function clockTexture() {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.clearRect(0, 0, 512, 512);
    x.fillStyle = "#e9e3d5";
    x.beginPath();
    x.arc(256, 256, 244, 0, TAU);
    x.fill();
    x.strokeStyle = "#5a5449";
    x.lineWidth = 14;
    x.stroke();
    x.strokeStyle = "#33312c";
    x.fillStyle = "#33312c";
    for (var i = 0; i < 12; i++) {
      var a = (i / 12) * TAU - Math.PI / 2;
      var r0 = i % 3 === 0 ? 168 : 188;
      x.lineWidth = i % 3 === 0 ? 10 : 6;
      x.beginPath();
      x.moveTo(256 + Math.cos(a) * r0, 256 + Math.sin(a) * r0);
      x.lineTo(256 + Math.cos(a) * 226, 256 + Math.sin(a) * 226);
      x.stroke();
    }
    x.lineWidth = 12;
    x.beginPath();
    x.moveTo(256, 256);
    x.lineTo(256 + Math.cos(-Math.PI / 3) * 130, 256 + Math.sin(-Math.PI / 3) * 130);
    x.stroke();
    x.lineWidth = 8;
    x.beginPath();
    x.moveTo(256, 256);
    x.lineTo(256 + Math.cos(Math.PI * 0.08) * 190, 256 + Math.sin(Math.PI * 0.08) * 190);
    x.stroke();
    x.beginPath();
    x.arc(256, 256, 14, 0, TAU);
    x.fill();
    return c;
  }

  function woodDoor(rand) {
    var c = canvas(256, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#3b2a20";
    x.fillRect(0, 0, 256, 512);
    for (var i = 0; i < 6; i++) {
      x.fillStyle = i % 2 ? "#463226" : "#3a291f";
      x.fillRect(i * 43, 0, 41, 512);
      x.strokeStyle = "rgba(12,8,6,0.7)";
      x.strokeRect(i * 43, 0, 43, 512);
    }
    for (var k = 0; k < 300; k++) {
      x.fillStyle = "rgba(12,7,4," + (0.04 + rand() * 0.1).toFixed(3) + ")";
      x.fillRect(rand() * 256, rand() * 512, 1 + rand() * 2, 8 + rand() * 40);
    }
    x.fillStyle = "rgba(20,16,12,0.85)";
    x.fillRect(28, 120, 200, 10);
    x.fillRect(28, 380, 200, 10);
    return c;
  }

  function vaultTexture(rand) {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#b58a72";
    x.fillRect(0, 0, 512, 512);
    for (var row = 0; row < 16; row++) {
      for (var col = 0; col < 8; col++) {
        var off = (row % 2) * 32;
        var shade = 154 + Math.floor(rand() * 22);
        x.fillStyle = "rgb(" + (shade + 26) + "," + (shade - 12) + "," + (shade - 36) + ")";
        x.fillRect(col * 64 + off, row * 32, 60, 28);
        x.strokeStyle = "rgba(92,62,48,0.25)";
        x.strokeRect(col * 64 + off, row * 32, 60, 28);
      }
    }
    return c;
  }

  function floorTexture(rand) {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#a89f8f";
    x.fillRect(0, 0, 512, 512);
    for (var row = 0; row < 4; row++) {
      for (var col = 0; col < 4; col++) {
        var shade = 150 + Math.floor(rand() * 24);
        x.fillStyle = "rgb(" + (shade + 8) + "," + shade + "," + (shade - 12) + ")";
        x.fillRect(col * 128 + 2, row * 128 + 2, 124, 124);
        x.strokeStyle = "rgba(80,72,60,0.28)";
        x.lineWidth = 2;
        x.strokeRect(col * 128, row * 128, 128, 128);
      }
    }
    noise(x, 512, 512, 3000, 0.08);
    return c;
  }

  function shophouseTexture(rand) {
    var c = canvas(512, 512);
    var x = c.getContext("2d");
    x.fillStyle = "#8a8174";
    x.fillRect(0, 0, 512, 512);
    x.fillStyle = "#7d7467";
    x.fillRect(0, 0, 512, 48);
    for (var floor = 0; floor < 4; floor++) {
      var y = 56 + floor * 112;
      x.fillStyle = floor % 2 ? "#948a7b" : "#8b8274";
      x.fillRect(0, y, 512, 104);
      for (var col = 0; col < 4; col++) {
        var wx = 26 + col * 124;
        x.fillStyle = "#2b3034";
        x.fillRect(wx, y + 18, 72, 62);
        x.strokeStyle = "#b6aa95";
        x.lineWidth = 4;
        x.strokeRect(wx - 2, y + 16, 76, 66);
        x.strokeStyle = "rgba(214,224,222,0.3)";
        x.lineWidth = 1;
        x.fillStyle = "rgba(160,190,190,0.16)";
        x.fillRect(wx + 4, y + 22, 30, 54);
        x.fillRect(wx + 38, y + 22, 30, 54);
        x.fillStyle = "rgba(20,22,24,0.45)";
        x.fillRect(wx + 34, y + 18, 3, 62);
        x.fillRect(wx, y + 48, 72, 3);
      }
      x.fillStyle = "rgba(60,54,46,0.35)";
      x.fillRect(0, y + 100, 512, 4);
    }
    for (var a = 0; a < 4; a++) {
      var ax = 8 + a * 128;
      x.fillStyle = a % 2 ? "#7f4033" : "#5e4a3a";
      x.fillRect(ax, 330, 112, 12);
      x.fillStyle = "rgba(220,210,190,0.18)";
      x.fillRect(ax, 332, 112, 3);
    }
    x.fillStyle = "rgba(36,32,27,0.55)";
    x.fillRect(0, 0, 512, 8);
    x.fillRect(0, 504, 512, 8);
    noise(x, 512, 512, 9000, 0.18);
    return c;
  }

  function grassTexture(rand) {
    var c = canvas(256, 256);
    var x = c.getContext("2d");
    x.fillStyle = "#3c5234";
    x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 4000; i++) {
      x.fillStyle = "rgba(" + (40 + Math.floor(rand() * 40)) + "," + (70 + Math.floor(rand() * 50)) + "," + (36 + Math.floor(rand() * 30)) + ",0.5)";
      x.fillRect(rand() * 256, rand() * 256, 1, 1 + rand() * 3);
    }
    return c;
  }

  function build(renderer) {
    var rand = rng(1863);
    var max = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 8;
    var graniteCanvas = granite(rand);
    var bumpCanvas = graniteBump(rand);
    var trimCanvas = trimTexture(rand);
    var roofCanvas = roofTexture(rand);
    var pavingCanvas = pavingTexture(rand);
    var asphaltCanvas = asphaltTexture(rand);
    var sidewalkCanvas = sidewalkTexture(rand);
    var roseCanvas = roseGlass(rand);
    var roseTraceryCanvas = roseTracery();
    var clockCanvas = clockTexture();
    var doorCanvas = woodDoor(rand);
    var vaultCanvas = vaultTexture(rand);
    var floorCanvas = floorTexture(rand);
    var grassCanvas = grassTexture(rand);
    var shophouseCanvas = shophouseTexture(rand);

    var graniteTex = texture(graniteCanvas, [1, 1]);
    var graniteBumpTex = new THREE.CanvasTexture(bumpCanvas);
    graniteBumpTex.wrapS = graniteBumpTex.wrapT = THREE.RepeatWrapping;
    graniteBumpTex.anisotropy = 8;

    var trimTex = texture(trimCanvas, [1, 1]);
    var roofTex = texture(roofCanvas, [1, 1]);
    var pavingTex = texture(pavingCanvas, [1, 1]);
    var asphaltTex = texture(asphaltCanvas, [1, 1]);
    var sidewalkTex = texture(sidewalkCanvas, [1, 1]);
    var floorTex = texture(floorCanvas, [1, 1]);
    var vaultTex = texture(vaultCanvas, [1, 1]);
    var grassTex = texture(grassCanvas, [1, 1]);
    var shophouseTex = texture(shophouseCanvas, [1, 1]);
    shophouseTex.repeat.set(2, 2);

    [graniteTex, trimTex, roofTex, pavingTex, asphaltTex, sidewalkTex, floorTex, vaultTex, grassTex, shophouseTex].forEach(function (t) {
      t.anisotropy = max;
    });

    return {
      granite: graniteTex,
      graniteBump: graniteBumpTex,
      trim: trimTex,
      roof: roofTex,
      paving: pavingTex,
      asphalt: asphaltTex,
      sidewalk: sidewalkTex,
      floor: floorTex,
      vault: vaultTex,
      grass: grassTex,
      shophouse: shophouseTex,
      glassTall: [
        texture(stainedGlass(256, 1024, 0), null, true),
        texture(stainedGlass(256, 1024, 1), null, true),
        texture(stainedGlass(256, 1024, 2), null, true)
      ],
      glassSide: [
        texture(stainedGlass(192, 512, 1), null, true),
        texture(stainedGlass(192, 512, 2), null, true)
      ],
      glassRose: texture(roseCanvas, null, true),
      roseTracery: texture(roseTraceryCanvas, null, true),
      clock: texture(clockCanvas, null, true),
      door: texture(doorCanvas, null, true)
    };
  }

  window.SacredTextures = { build: build };
})();
