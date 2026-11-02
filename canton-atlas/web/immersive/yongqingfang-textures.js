/* 永庆坊 · 恩宁路近景 · 程序化纹理
   青砖/红砖/灰砖、麻石、满洲窗、灰塑、店招、水面全部在 canvas 生成，
   不依赖外部图片。 */
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

  function noise(ctx, w, h, count, alpha, hue) {
    for (var i = 0; i < count; i++) {
      var v = 130 + Math.floor(Math.random() * 90);
      ctx.fillStyle = "rgba(" + (v - (hue === "warm" ? 20 : 0)) + "," + (v - (hue === "warm" ? 8 : 3)) + "," + (v - 18) + "," + alpha + ")";
      ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
    }
  }

  function brick(drawBase, drawBrick, w, h, rx, ry) {
    return canvasTexture(function (ctx, cw, ch) {
      drawBase(ctx, cw, ch);
      var bw = 64, bh = 26, gap = 3;
      for (var y = 0; y < ch; y += bh + gap) {
        var off = (Math.floor(y / (bh + gap)) % 2) * (bw / 2);
        for (var x = -bw; x < cw + bw; x += bw + gap) {
          drawBrick(ctx, x + off, y, bw, bh);
        }
      }
      ctx.strokeStyle = "rgba(226, 218, 200, 0.35)";
      ctx.lineWidth = 1.4;
      for (var yy = 0; yy < ch; yy += bh + gap) {
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(cw, yy); ctx.stroke();
      }
      noise(ctx, cw, ch, 900, 0.07, "warm");
    }, w, h, rx, ry);
  }

  function makeSignTexture(text, w, h, fg, bg, border) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    if (border) {
      ctx.strokeStyle = border; ctx.lineWidth = Math.max(3, h * 0.035);
      ctx.strokeRect(ctx.lineWidth * 0.8, ctx.lineWidth * 0.8, w - ctx.lineWidth * 1.6, h - ctx.lineWidth * 1.6);
    }
    ctx.fillStyle = fg;
    var size = h * 0.52;
    ctx.font = "bold " + Math.floor(size) + "px 'Songti SC', 'SimSun', 'STSong', serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    while (ctx.measureText(text).width > w * 0.86 && size > 12) {
      size -= 2;
      ctx.font = "bold " + Math.floor(size) + "px 'Songti SC', 'SimSun', 'STSong', serif";
    }
    ctx.fillText(text, w / 2, h / 2 + h * 0.015);
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
    var size = Math.floor(Math.min(w * 0.68, h / (chars.length + 0.9)));
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

  function manzhouTexture(colors, glowOnly) {
    var c = document.createElement("canvas");
    c.width = c.height = 256;
    var ctx = c.getContext("2d");
    ctx.fillStyle = glowOnly ? "#050403" : "#2b1d15";
    ctx.fillRect(0, 0, 256, 256);
    var pad = 12, cols = 3, rows = 4;
    var cw = (256 - pad * 2) / cols, chh = (256 - pad * 2) / rows;
    for (var r = 0; r < rows; r++) {
      for (var col = 0; col < cols; col++) {
        var x = pad + col * cw, y = pad + r * chh;
        var colr = colors[(r * cols + col) % colors.length];
        var grad = ctx.createLinearGradient(x, y, x + cw, y + chh);
        grad.addColorStop(0, colr[0]);
        grad.addColorStop(0.5, colr[1]);
        grad.addColorStop(1, colr[0]);
        ctx.fillStyle = grad;
        ctx.fillRect(x + 3, y + 3, cw - 6, chh - 6);
        ctx.fillStyle = "rgba(255,255,255,0.16)";
        ctx.fillRect(x + 5, y + 5, cw - 12, 3);
      }
    }
    ctx.strokeStyle = glowOnly ? "#000" : "#22140c";
    ctx.lineWidth = 7;
    for (var i = 0; i <= cols; i++) {
      var gx = pad + i * cw;
      ctx.beginPath(); ctx.moveTo(gx, 4); ctx.lineTo(gx, 252); ctx.stroke();
    }
    for (var j = 0; j <= rows; j++) {
      var gy = pad + j * chh;
      ctx.beginPath(); ctx.moveTo(4, gy); ctx.lineTo(252, gy); ctx.stroke();
    }
    if (!glowOnly) {
      ctx.strokeStyle = "rgba(255, 238, 200, 0.18)";
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, 248, 248);
    }
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function build(renderer) {
    var brickGreen = brick(
      function (ctx, w, h) { ctx.fillStyle = "#b5b6a9"; ctx.fillRect(0, 0, w, h); },
      function (ctx, x, y, w, h) {
        var v = 96 + Math.floor(Math.random() * 26);
        ctx.fillStyle = "rgb(" + (v - 8) + "," + v + "," + (v - 4) + ")";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(210, 216, 198, 0.12)";
        ctx.fillRect(x, y, w, 2);
      }, 512, 512, 2.5, 2.5);

    var brickRed = brick(
      function (ctx, w, h) { ctx.fillStyle = "#c6b5a2"; ctx.fillRect(0, 0, w, h); },
      function (ctx, x, y, w, h) {
        var v = 118 + Math.floor(Math.random() * 32);
        ctx.fillStyle = "rgb(" + (v + 25) + "," + (v - 28) + "," + (v - 42) + ")";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(255, 218, 180, 0.1)";
        ctx.fillRect(x, y, w, 2);
      }, 512, 512, 2.5, 2.5);

    var brickGrey = brick(
      function (ctx, w, h) { ctx.fillStyle = "#c3c0b4"; ctx.fillRect(0, 0, w, h); },
      function (ctx, x, y, w, h) {
        var v = 116 + Math.floor(Math.random() * 26);
        ctx.fillStyle = "rgb(" + v + "," + v + "," + (v - 7) + ")";
        ctx.fillRect(x, y, w, h);
      }, 512, 512, 2.5, 2.5);

    var granite = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b8b3a4"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 64) {
        var off = (Math.floor(y / 64) % 2) * 64;
        for (var x = -64; x < w; x += 128) {
          var v = 164 + Math.floor(Math.random() * 26);
          ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 14) + ")";
          ctx.fillRect(x + off + 2, y + 2, 124, 60);
        }
      }
      noise(ctx, w, h, 2400, 0.09, "warm");
      ctx.strokeStyle = "rgba(74, 70, 60, 0.4)";
      ctx.lineWidth = 2;
      for (var yy = 0; yy < h; yy += 64) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 3, 3);

    var paving = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#a9a294"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 64) {
        for (var x = 0; x < w; x += 64) {
          var v = 156 + Math.floor(Math.random() * 24);
          ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 14) + ")";
          ctx.fillRect(x + 2, y + 2, 60, 60);
        }
      }
      ctx.strokeStyle = "rgba(64, 60, 52, 0.36)"; ctx.lineWidth = 2;
      for (var gx = 0; gx <= w; gx += 64) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (var gy = 0; gy <= h; gy += 64) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
      noise(ctx, w, h, 1500, 0.06, "warm");
    }, 512, 512, 4, 4);

    var asphalt = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#6d6f6a"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 6000; i++) {
        var v = 88 + Math.floor(Math.random() * 58);
        ctx.fillStyle = "rgba(" + v + "," + v + "," + (v - 3) + ",0.35)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      ctx.strokeStyle = "rgba(54, 54, 50, 0.22)";
      ctx.lineWidth = 1;
      for (var k = 0; k < 20; k++) {
        var y = Math.random() * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + (Math.random() - 0.5) * 8); ctx.stroke();
      }
    }, 512, 512, 3, 3);

    var wood = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4a3123"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 160; i++) {
        var y = i * 3.2;
        ctx.strokeStyle = "rgba(22, 12, 7, " + (0.16 + Math.random() * 0.18) + ")";
        ctx.lineWidth = 1 + Math.random() * 1.6;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + Math.sin(i * 0.5) * 5); ctx.stroke();
      }
      for (var g = 0; g < 10; g++) {
        var gx = Math.random() * w, gy = Math.random() * h;
        ctx.strokeStyle = "rgba(214, 170, 116, 0.1)";
        ctx.beginPath(); ctx.ellipse(gx, gy, 8 + Math.random() * 18, 2 + Math.random() * 4, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }, 512, 512, 2, 2);

    var roofTile = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#5c665a"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 22) {
        for (var x = 0; x < w; x += 34) {
          var v = 70 + Math.floor(Math.random() * 28);
          ctx.fillStyle = "rgb(" + (v - 12) + "," + (v + 4) + "," + (v - 8) + ")";
          ctx.fillRect(x + 1, y + 1, 32, 20);
          ctx.fillStyle = "rgba(206, 218, 196, 0.16)";
          ctx.fillRect(x + 3, y + 2, 28, 4);
        }
      }
      ctx.strokeStyle = "rgba(30, 38, 32, 0.45)"; ctx.lineWidth = 2;
      for (var yy = 0; yy <= h; yy += 22) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 3, 3);

    var plaster = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#e4ddcb"; ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 2200, 0.08, "warm");
      for (var i = 0; i < 26; i++) {
        var x = Math.random() * w, y = Math.random() * h;
        var g = ctx.createRadialGradient(x, y, 0, x, y, 20 + Math.random() * 50);
        g.addColorStop(0, "rgba(120, 112, 96, 0.08)");
        g.addColorStop(1, "rgba(120, 112, 96, 0)");
        ctx.fillStyle = g; ctx.fillRect(x - 60, y - 60, 120, 120);
      }
    }, 512, 512, 2, 2);

    var manzhouColors = [
      [["#2a7e8f", "#5bbcae"], ["#d9a13a", "#f0d17a"], ["#3d7d58", "#8fc477"], ["#a64d4d", "#d98a6b"]],
      [["#d6a94a", "#f3d47f"], ["#4d8b9b", "#7fc4c8"], ["#b95a4d", "#e39a7b"], ["#587c58", "#9fbb83"]],
      [["#4c8c8f", "#8ac7bf"], ["#b46b4e", "#e0a07a"], ["#d8be59", "#f4df8d"], ["#5e7f9d", "#9bbbd2"]]
    ];
    var manzhou = manzhouColors.map(function (cols) { return manzhouTexture(cols, false); });
    var manzhouGlow = manzhouColors.map(function (cols) { return manzhouTexture(cols, true); });

    var windowDark = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#1b2629"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 42) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(8, y + 4, w - 16, 6);
      }
      ctx.fillStyle = "rgba(180, 205, 210, 0.06)";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    }, 256, 256, 1, 1);

    var shopfronts = [0, 1, 2].map(function (k) {
      var sf = canvasTexture(function (ctx, w, h) {
        ctx.fillStyle = "#241a13"; ctx.fillRect(0, 0, w, h);
        var grd = ctx.createLinearGradient(0, 0, 0, h);
        grd.addColorStop(0, "#3a291b");
        grd.addColorStop(0.45, "#7d5634");
        grd.addColorStop(1, "#2a1c12");
        ctx.fillStyle = grd; ctx.fillRect(8, 8, w - 16, h - 16);
        var palettes = [
          ["#a9743f", "#d7a05a", "#7e5a37"],
          ["#8e5a3d", "#c98a54", "#5f4430"],
          ["#b38750", "#e0b46d", "#735437"]
        ];
        for (var i = 0; i < 3; i++) {
          var x = 14 + i * 78, y = 44, ww = 66, hh = h - 76;
          ctx.fillStyle = palettes[k][i % 3];
          ctx.fillRect(x, y, ww, hh);
          ctx.fillStyle = "rgba(255, 222, 160, 0.22)";
          ctx.fillRect(x + 6, y + 6, ww - 12, hh * 0.36);
          ctx.fillStyle = "rgba(30, 18, 10, 0.65)";
          ctx.fillRect(x, y + hh * 0.55, ww, 5);
          ctx.fillRect(x + ww * 0.48, y, 4, hh);
          ctx.strokeStyle = "#1a100a"; ctx.lineWidth = 4;
          ctx.strokeRect(x, y, ww, hh);
        }
        ctx.fillStyle = "#1b120c"; ctx.fillRect(w * 0.77, 38, 44, h - 54);
        ctx.fillStyle = "#4c3220"; ctx.fillRect(w * 0.785, 42, 34, h - 62);
        ctx.fillStyle = "rgba(255, 213, 150, 0.25)";
        ctx.fillRect(w * 0.8, 50, 22, h * 0.42);
        ctx.strokeStyle = "#120c08"; ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        ctx.fillStyle = "#3a2418"; ctx.fillRect(0, 0, w, 26);
        ctx.fillStyle = "rgba(224, 194, 145, 0.25)";
        ctx.fillRect(8, 6, w - 16, 2);
      }, 256, 256, 1, 1);
      sf.wrapS = sf.wrapT = THREE.ClampToEdgeWrapping;
      return sf;
    });

    var water = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#43787a"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 150; i++) {
        var y = Math.random() * h;
        var x0 = Math.random() * w;
        var len = 30 + Math.random() * 150;
        ctx.strokeStyle = "rgba(196, 230, 226, " + (0.03 + Math.random() * 0.07) + ")";
        ctx.lineWidth = 0.6 + Math.random() * 1.1;
        ctx.beginPath();
        for (var x = 0; x <= len; x += 10) {
          var px = x0 + x;
          var py = y + Math.sin(x * 0.05 + i * 1.7) * 1.6 + Math.sin(x * 0.13 + i) * 0.6;
          if (x === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      for (var m = 0; m < 380; m++) {
        var mx = Math.random() * w, my = Math.random() * h;
        ctx.fillStyle = Math.random() > 0.45 ? "rgba(188, 220, 214, 0.07)" : "rgba(34, 56, 52, 0.07)";
        ctx.fillRect(mx, my, 2 + Math.random() * 9, 1);
      }
      for (var k = 0; k < 26; k++) {
        ctx.fillStyle = "rgba(255, 236, 182, " + (0.05 + Math.random() * 0.07) + ")";
        ctx.fillRect(Math.random() * w, Math.random() * h, 6 + Math.random() * 18, 1);
      }
    }, 512, 512, 1, 1);

    var waterGlint = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 240; i++) {
        var x = Math.random() * w, y = Math.random() * h;
        var len = 4 + Math.random() * 26;
        var a = 0.1 + Math.random() * 0.5;
        ctx.strokeStyle = "rgba(255, 245, 214, " + a + ")";
        ctx.lineWidth = 0.7 + Math.random() * 1.1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y + (Math.random() - 0.5) * 1.5); ctx.stroke();
      }
    }, 512, 512, 1, 1);
    waterGlint.wrapS = waterGlint.wrapT = THREE.RepeatWrapping;

    var reflectArc = (function () {
      var c = document.createElement("canvas");
      c.width = c.height = 512;
      var ctx = c.getContext("2d");
      ctx.clearRect(0, 0, 512, 512);
      var cx = 256, cy = 300, r = 190;
      for (var layer = 0; layer < 3; layer++) {
        var rr = r - layer * 12;
        ctx.strokeStyle = "rgba(255, 243, 214, " + (0.5 - layer * 0.13) + ")";
        ctx.lineWidth = 26 - layer * 6;
        ctx.beginPath(); ctx.arc(cx, cy, rr, Math.PI, Math.PI * 2); ctx.stroke();
      }
      ctx.globalCompositeOperation = "destination-out";
      for (var y = 0; y < cy; y += 5) {
        ctx.fillStyle = "rgba(0,0,0," + (0.08 + Math.random() * 0.26) + ")";
        ctx.fillRect(0, y, 512, 1 + Math.random() * 2);
      }
      ctx.globalCompositeOperation = "source-over";
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      return t;
    })();

    var leaf = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#2d4a2c"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 1800; i++) {
        var g = 54 + Math.floor(Math.random() * 68);
        ctx.fillStyle = "rgba(" + (g - 28) + "," + g + "," + (g - 30) + ",0.5)";
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 0, 6.3);
        ctx.fill();
      }
    }, 256, 256, 2, 2);

    var trunk = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4d3a2a"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 80; i++) {
        ctx.strokeStyle = "rgba(24, 16, 10, 0.35)";
        ctx.lineWidth = 1 + Math.random() * 3;
        ctx.beginPath(); ctx.moveTo(i * 3.3, 0); ctx.lineTo(i * 3.3 + 8, h); ctx.stroke();
      }
      for (var k = 0; k < 30; k++) {
        ctx.fillStyle = "rgba(140, 110, 76, 0.12)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 8, 20 + Math.random() * 60);
      }
    }, 256, 512, 2, 3);

    var cityWindow = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#283133"; ctx.fillRect(0, 0, w, h);
      for (var y = 6; y < h; y += 16) {
        for (var x = 6; x < w; x += 14) {
          ctx.fillStyle = Math.random() > 0.55 ? "rgba(255, 208, 140, 0.85)" : "rgba(32, 42, 46, 0.85)";
          ctx.fillRect(x, y, 7, 8);
        }
      }
    }, 256, 256, 6, 10);

    var glow = (function () {
      var c = document.createElement("canvas");
      c.width = c.height = 128;
      var ctx = c.getContext("2d");
      var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.55)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();

    var signs = {
      yongqingfang: makeSignTexture("永庆坊", 512, 150, "#e7c98d", "#2b1b12", "#9f7b43"),
      luanyu: makeSignTexture("广东粤剧銮舆堂", 640, 118, "#e6c47f", "#2b1b12", "#8d6a39"),
      bruce: makeSignTexture("李小龙祖居", 512, 140, "#e8c684", "#54201b", "#9c5a42"),
      bahe: makeSignTexture("广东八和会馆", 640, 140, "#e8c684", "#3a2216", "#9c6a3f"),
      museum: makeSignTexture("粤剧艺术博物馆", 700, 140, "#3d3328", "#e7dfcc", "#a99778"),
      guangfu: makeSignTexture("广福台", 420, 130, "#e7c98d", "#2b1b12", "#8d6a39"),
      enning: makeSignTexture("恩宁路", 240, 90, "#ffffff", "#1c4d86", "#ffffff"),
      dayi: makeSignTexture("大益茶", 320, 100, "#f0e3c8", "#3a2a1d", "#a98a58"),
      zhongshu: makeSignTexture("钟书阁", 360, 100, "#f4ead4", "#2f3a32", "#bca06a"),
      coffee: makeSignTexture("骑楼咖啡", 380, 96, "#f0e3c8", "#3a2418", "#b58a55"),
      dessert: makeSignTexture("糖水铺", 300, 96, "#f4e5c8", "#54201b", "#a96d4a"),
      wenyi: makeSignTexture("文创", 220, 90, "#f0e3c8", "#2f3a32", "#bca06a"),
      shanhuo: makeSignTexture("山货", 220, 90, "#f0e3c8", "#3a2418", "#b58a55"),
      ju: makeSignTexture("聚", 180, 180, "#e8c684", "#3a2216", "#9c6a3f"),
      cinema: makeSignTexture("金声电影院", 520, 120, "#d9c7a2", "#2a2620", "#8a7654"),
      shanye: makeSignTexture("山野鲜果", 300, 96, "#f0dfb2", "#22382c", "#b99b5e"),
      tea: makeSignTexture("高山好茶", 300, 96, "#f0dfb2", "#22382c", "#b99b5e"),
      liangcha: makeSignTexture("凉茶", 240, 96, "#f0e3c8", "#3f2118", "#b58a55"),
      wonton: makeSignTexture("云吞面", 300, 96, "#f4e5c8", "#54201b", "#a96d4a"),
      bike: makeSignTexture("修单车", 280, 96, "#e7dfcc", "#2b2f2a", "#8f9a8a"),
      grocery: makeSignTexture("士多", 220, 96, "#f0e3c8", "#2f3a32", "#bca06a"),
      barber: makeSignTexture("理发", 240, 96, "#f0e3c8", "#3a2418", "#b58a55"),
      enning177: makeSignTexture("恩宁路 177", 360, 96, "#ffffff", "#1c4d86", "#ffffff")
    };

    return {
      brickGreen: brickGreen,
      brickRed: brickRed,
      brickGrey: brickGrey,
      granite: granite,
      paving: paving,
      asphalt: asphalt,
      wood: wood,
      roofTile: roofTile,
      plaster: plaster,
      manzhou: manzhou,
      manzhouGlow: manzhouGlow,
      shopfronts: shopfronts,
      windowDark: windowDark,
      water: water,
      waterGlint: waterGlint,
      reflectArc: reflectArc,
      leaf: leaf,
      trunk: trunk,
      cityWindow: cityWindow,
      glow: glow,
      signs: signs
    };
  }

  window.YongqingfangTextures = {
    build: build,
    makeSignTexture: makeSignTexture,
    makeVerticalTextTexture: makeVerticalTextTexture
  };
})();
