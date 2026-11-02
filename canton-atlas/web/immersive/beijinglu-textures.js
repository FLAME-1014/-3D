/* 北京路 · 千年古道近景 · 程序化纹理
   铺地、抹灰、砖石、瓦、木、古道层位、招牌图集、LED 屏、树/城景全部 canvas 生成，
   不使用外部图片、字体文件或真实品牌 logo。 */
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

  function noise(ctx, w, h, count, alpha, warm) {
    for (var i = 0; i < count; i++) {
      var v = 128 + Math.floor(Math.random() * 92);
      ctx.fillStyle = "rgba(" + (v + (warm ? 16 : 0)) + "," + (v + (warm ? 4 : 0)) + "," + (v - 12) + "," + alpha + ")";
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
      ctx.strokeStyle = "rgba(222, 214, 196, 0.28)";
      ctx.lineWidth = 1.3;
      for (var yy = 0; yy < ch; yy += bh + gap) {
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(cw, yy); ctx.stroke();
      }
      noise(ctx, cw, ch, 900, 0.06, true);
    }, w, h, rx, ry);
  }

  function drawCell(ctx, x, y, w, h, o) {
    ctx.fillStyle = o.bg || "#2b1b12";
    ctx.fillRect(x, y, w, h);
    if (o.grad) {
      var grd = ctx.createLinearGradient(x, y, x, y + h);
      grd.addColorStop(0, o.grad[0]);
      grd.addColorStop(1, o.grad[1]);
      ctx.fillStyle = grd;
      ctx.fillRect(x + 4, y + 4, w - 8, h - 8);
    }
    if (o.border) {
      ctx.strokeStyle = o.border;
      ctx.lineWidth = Math.max(3, h * 0.05);
      ctx.strokeRect(x + ctx.lineWidth, y + ctx.lineWidth, w - ctx.lineWidth * 2, h - ctx.lineWidth * 2);
    }
    if (o.blue) {
      ctx.fillStyle = "#1b4f8a";
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 9, y + 9, w - 18, h - 18);
    }
    var chars = (o.text || "").split("");
    var textW = w * (o.narrow ? 0.6 : 0.84);
    var size = Math.floor(h * (o.sub ? 0.46 : 0.52));
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    while (size > 10) {
      ctx.font = (o.weight || "bold") + " " + size + "px " + (o.font || "'Microsoft YaHei', 'PingFang SC', sans-serif");
      if (ctx.measureText(o.text || "").width <= textW) break;
      size -= 2;
    }
    ctx.fillStyle = o.fg || "#f3dfb0";
    ctx.fillText(o.text || "", x + w / 2, y + (o.sub ? h * 0.4 : h * 0.52));
    if (o.sub) {
      var ss = Math.floor(h * 0.15);
      ctx.font = "500 " + ss + "px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillStyle = o.subColor || "rgba(255,255,255,0.62)";
      ctx.fillText(o.sub, x + w / 2, y + h * 0.74);
    }
    if (o.chip) {
      ctx.fillStyle = o.chip;
      ctx.fillRect(x + w * 0.06, y + h * 0.16, w * 0.035, h * 0.68);
    }
  }

  function drawVerticalCell(ctx, x, y, w, h, o) {
    ctx.fillStyle = o.bg || "#2b1b12";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = o.border || "rgba(216,178,106,0.65)";
    ctx.lineWidth = 5;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
    var chars = (o.text || "").split("");
    var size = Math.floor(Math.min(w * 0.62, (h - 60) / (chars.length + 0.6)));
    ctx.font = "bold " + size + "px 'Songti SC', 'SimSun', 'STSong', serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = o.fg || "#f3dfb0";
    var gap = (h - size * chars.length) / (chars.length + 1);
    chars.forEach(function (ch, i) {
      ctx.fillText(ch, x + w / 2, y + gap + size * (i + 0.5) + gap * i);
    });
  }

  /* 招牌图集：4 × 12 格，每格 512 × 128 */
  var H_SIGNS = [
    { text: "广州老字号", bg: "#5a1c14", fg: "#f0d79c", border: "#a87a3a", sub: "老字号一条街" },
    { text: "茶楼", bg: "#25352b", fg: "#f3e5c2", border: "#7d9868" },
    { text: "甜品", bg: "#6a3a24", fg: "#ffe9bc", border: "#c99154" },
    { text: "凉茶", bg: "#2f4536", fg: "#e8e0b8", border: "#829a6e" },
    { text: "云吞面", bg: "#5c2019", fg: "#ffe3a8", border: "#c08a4a" },
    { text: "糖水铺", bg: "#54241c", fg: "#ffd9a0", border: "#b97a48" },
    { text: "百货", bg: "#22323e", fg: "#f4ead2", border: "#7f98a4" },
    { text: "书店", bg: "#2b3a33", fg: "#f3ead0", border: "#7d9282" },
    { text: "钟表", bg: "#241f1a", fg: "#e9c987", border: "#9c7a45" },
    { text: "金铺", bg: "#4a1b13", fg: "#f4d38a", border: "#c39a54" },
    { text: "眼镜", bg: "#1e2b33", fg: "#d9e7ea", border: "#78929c" },
    { text: "烧腊", bg: "#5c1d14", fg: "#ffd9a2", border: "#c08444" },
    { text: "煲仔饭", bg: "#4f2116", fg: "#ffdd9e", border: "#bd8448" },
    { text: "药房", bg: "#25372c", fg: "#eaf0d4", border: "#7e976a" },
    { text: "布匹", bg: "#3a2a3c", fg: "#f0dce6", border: "#93728e" },
    { text: "咖啡", bg: "#33261c", fg: "#f3dcb2", border: "#9a7a50" },
    { text: "牛杂", bg: "#5f2618", fg: "#ffe0a6", border: "#c49252" },
    { text: "肠粉", bg: "#5a2c1c", fg: "#ffe8bc", border: "#c58d52" },
    { text: "粥粉面", bg: "#4c2418", fg: "#ffe4ad", border: "#b88148" },
    { text: "茶餐厅", bg: "#283640", fg: "#f2e6c4", border: "#8199a4" },
    { text: "广州手信", bg: "#5c1c14", fg: "#f7dda1", border: "#c09052" },
    { text: "文创", bg: "#2c3a34", fg: "#f1e8ce", border: "#82998a" },
    { text: "美食花街", bg: "#661d13", fg: "#ffe2a2", border: "#c99a52", sub: "惠福东路" },
    { text: "北京路", blue: true, fg: "#ffffff" },
    { text: "西湖路", blue: true, fg: "#ffffff" },
    { text: "惠福东路", blue: true, fg: "#ffffff" },
    { text: "忠佑大街", blue: true, fg: "#ffffff" },
    { text: "北京路", key: "北京路牌坊", bg: "#2a1d14", fg: "#f2d089", border: "#b98c4e", font: "'STKaiti', 'KaiTi', 'SimSun', serif" },
    { text: "大佛古寺", bg: "#241a12", fg: "#f6d98a", border: "#c9a35c", font: "'STKaiti', 'KaiTi', 'SimSun', serif" },
    { text: "城隍庙", bg: "#311a13", fg: "#f3d489", border: "#b98c4e", font: "'STKaiti', 'KaiTi', 'SimSun', serif" },
    { text: "千年古道遗址", bg: "#15171a", fg: "#e9e3d4", border: "#5e635e", sub: "44 × 3.8 m · 11 层 / 5 期", subColor: "rgba(220,210,190,0.6)" },
    { text: "拱北楼遗址", bg: "#15171a", fg: "#e9e3d4", border: "#5e635e", sub: "32 × 4.7 m · 5 层基址", subColor: "rgba(220,210,190,0.6)" },
    { text: "始于公元前 214 年", bg: "#2a1b13", fg: "#eadcc0", border: "#7a5c3c" },
    { text: "元代铜壶滴漏", bg: "#7d3b2a", fg: "#f6e7c8", border: "#c79a62" },
    { text: "唐 · 路面", bg: "#2a2620", fg: "#eae0c8", border: "#6c6150", chip: "#8a6a48" },
    { text: "南汉 · 路面", bg: "#2a2522", fg: "#eae0c8", border: "#6c6150", chip: "#a1876a" },
    { text: "宋元 · 路面", bg: "#2a2622", fg: "#eae0c8", border: "#6c6150", chip: "#b9a488" },
    { text: "明清 · 路面", bg: "#2a2622", fg: "#eae0c8", border: "#6c6150", chip: "#c6b08a" },
    { text: "民国 · 路面", bg: "#2a2622", fg: "#eae0c8", border: "#6c6150", chip: "#b0aca0" },
    { text: "普觉楼", bg: "#2a1d12", fg: "#f7d98c", border: "#c49a52", font: "'STKaiti', 'KaiTi', 'SimSun', serif" },
    { text: "大雄宝殿", bg: "#2a1d12", fg: "#f7d98c", border: "#c49a52", font: "'STKaiti', 'KaiTi', 'SimSun', serif" },
    { text: "老字号一条街", bg: "#5a1c14", fg: "#f0d79c", border: "#a87a3a" },
    { text: "北京路步行街", bg: "#22323e", fg: "#f4ead2", border: "#7f98a4" },
    { text: "惠福美食花街", bg: "#6a1d12", fg: "#ffe0a0", border: "#c99a52" },
    { text: "骑楼 376 栋", bg: "#1d2b2f", fg: "#e9e2d0", border: "#5c6f70" },
    { text: "铜壶滴漏 2.64 m", bg: "#2a1b13", fg: "#eadcc0", border: "#7a5c3c" },
    { text: "拱北楼 32 × 4.7 m", bg: "#15171a", fg: "#e9e3d4", border: "#5e635e" },
    { text: "古道 44 × 3.8 m", bg: "#15171a", fg: "#e9e3d4", border: "#5e635e" },
    { text: "烧鹅", bg: "#5f1d12", fg: "#ffe3a8", border: "#c89150" },
    { text: "牛腩", bg: "#4e2115", fg: "#ffdca0", border: "#bd8548" },
    { text: "大排档", bg: "#6a2a12", fg: "#ffe9b0", border: "#d09a52" },
    { text: "海鲜", bg: "#1b3c52", fg: "#e6f4f8", border: "#6f9cb0" },
    { text: "鸡煲", bg: "#54240f", fg: "#ffd99a", border: "#bd8440" },
    { text: "烧烤", bg: "#5c1a10", fg: "#ffcf8a", border: "#c07c3c" },
    { text: "早茶", bg: "#263e32", fg: "#f2e8c6", border: "#7e9a78" },
    { text: "面家", bg: "#4f2418", fg: "#ffe4ad", border: "#b88148" },
    { text: "炖品", bg: "#3c2a1c", fg: "#f4dcb0", border: "#967444" },
    { text: "冰室", bg: "#1f3a46", fg: "#e8f2ee", border: "#6f9296" },
    { text: "小吃", bg: "#5f2716", fg: "#ffe0a6", border: "#c49252" },
    { text: "柠檬茶", bg: "#3f4a1f", fg: "#f2f0c0", border: "#8a9a4e" },
    { text: "艇仔粥", bg: "#4a2c1c", fg: "#ffe8bc", border: "#b88850" },
    { text: "布拉肠", bg: "#592c1c", fg: "#ffe8bc", border: "#c58d52" },
    { text: "糖水店", bg: "#54241c", fg: "#ffd9a0", border: "#b97a48" },
    { text: "煲汤", bg: "#4a2418", fg: "#ffe4ad", border: "#b88148" }
  ];

  var V_SIGNS = [
    { text: "茶", bg: "#25352b", fg: "#f3e5c2" },
    { text: "糖水", bg: "#54241c", fg: "#ffd9a0" },
    { text: "凉茶", bg: "#2f4536", fg: "#e8e0b8" },
    { text: "烧腊", bg: "#5c1d14", fg: "#ffd9a2" },
    { text: "粉面", bg: "#5a2c1c", fg: "#ffe8bc" },
    { text: "金铺", bg: "#4a1b13", fg: "#f4d38a" },
    { text: "书店", bg: "#2b3a33", fg: "#f3ead0" },
    { text: "咖啡", bg: "#33261c", fg: "#f3dcb2" },
    { text: "药房", bg: "#25372c", fg: "#eaf0d4" },
    { text: "眼镜", bg: "#1e2b33", fg: "#d9e7ea" },
    { text: "钟表", bg: "#241f1a", fg: "#e9c987" },
    { text: "手信", bg: "#5c1c14", fg: "#f7dda1" },
    { text: "美食", bg: "#661d13", fg: "#ffe2a2" },
    { text: "旅店", bg: "#2c3a34", fg: "#f1e8ce" },
    { text: "大佛寺", bg: "#241a12", fg: "#f6d98a" },
    { text: "城隍庙", bg: "#311a13", fg: "#f3d489" }
  ];

  function buildSignAtlas() {
    var cols = 4, rows = Math.ceil(H_SIGNS.length / cols);
    var c = document.createElement("canvas");
    c.width = 2048; c.height = rows * 128;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#0b0c0c";
    ctx.fillRect(0, 0, c.width, c.height);
    var cw = c.width / cols, ch = c.height / rows;
    var rects = {};
    H_SIGNS.forEach(function (s, i) {
      var col = i % cols, row = Math.floor(i / cols);
      drawCell(ctx, col * cw, row * ch, cw, ch, s);
      rects[s.key || s.text] = [col / cols, 1 - (row + 1) / rows, (col + 1) / cols, 1 - row / rows];
    });
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.encoding = THREE.sRGBEncoding;
    return { texture: t, rects: rects };
  }

  function buildVerticalAtlas() {
    var cols = 8, rows = 2;
    var c = document.createElement("canvas");
    c.width = 1024; c.height = 1024;
    var ctx = c.getContext("2d");
    ctx.fillStyle = "#0b0c0c";
    ctx.fillRect(0, 0, c.width, c.height);
    var cw = c.width / cols, ch = c.height / rows;
    var rects = {};
    V_SIGNS.forEach(function (s, i) {
      var col = i % cols, row = Math.floor(i / cols);
      drawVerticalCell(ctx, col * cw, row * ch, cw, ch, s);
      rects[s.text] = [col / cols, 1 - (row + 1) / rows, (col + 1) / cols, 1 - row / rows];
    });
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 8;
    t.encoding = THREE.sRGBEncoding;
    return { texture: t, rects: rects };
  }

  function build() {
    /* 铺地 */
    var pavingLight = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b6b1a6"; ctx.fillRect(0, 0, w, h);
      var tw = 64, th = 32;
      for (var y = 0; y < h; y += th) {
        var off = (Math.floor(y / th) % 2) * (tw / 2);
        for (var x = -tw; x < w; x += tw) {
          var v = 166 + Math.floor(Math.random() * 22);
          ctx.fillStyle = "rgb(" + v + "," + (v - 3) + "," + (v - 11) + ")";
          ctx.fillRect(x + off + 1.5, y + 1.5, tw - 3, th - 3);
        }
      }
      ctx.strokeStyle = "rgba(76,72,64,0.34)";
      ctx.lineWidth = 1.6;
      for (var yy = 0; yy <= h; yy += th) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
      noise(ctx, w, h, 1800, 0.06, true);
    }, 512, 512, 1, 1);

    var pavingDark = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#6f706a"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 42) {
        for (var x = 0; x < w; x += 84) {
          var v = 96 + Math.floor(Math.random() * 18);
          ctx.fillStyle = "rgb(" + v + "," + v + "," + (v - 4) + ")";
          ctx.fillRect(x + 1.5, y + 1.5, 81, 39);
        }
      }
      ctx.strokeStyle = "rgba(30,32,30,0.45)"; ctx.lineWidth = 2;
      for (var gy = 0; gy <= h; gy += 42) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
      noise(ctx, w, h, 1200, 0.05, false);
    }, 512, 512, 1, 1);

    var pavingArcade = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#8f8980"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 64) {
        for (var x = 0; x < w; x += 64) {
          var v = 130 + Math.floor(Math.random() * 16);
          ctx.fillStyle = "rgb(" + v + "," + (v - 2) + "," + (v - 8) + ")";
          ctx.fillRect(x + 2, y + 2, 60, 60);
        }
      }
      ctx.strokeStyle = "rgba(48,46,42,0.38)"; ctx.lineWidth = 2;
      for (var gx = 0; gx <= w; gx += 64) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (var gy = 0; gy <= h; gy += 64) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
      noise(ctx, w, h, 800, 0.05, false);
    }, 512, 512, 1, 1);

    var asphalt = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#656762"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 5200; i++) {
        var v = 84 + Math.floor(Math.random() * 56);
        ctx.fillStyle = "rgba(" + v + "," + v + "," + (v - 3) + ",0.35)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      ctx.strokeStyle = "rgba(48,48,44,0.2)";
      for (var k = 0; k < 16; k++) {
        var y = Math.random() * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + (Math.random() - 0.5) * 6); ctx.stroke();
      }
    }, 512, 512, 1, 1);

    var sidewalk = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#a8a39a"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 32) {
        for (var x = 0; x < w; x += 32) {
          var v = 148 + Math.floor(Math.random() * 20);
          ctx.fillStyle = "rgb(" + v + "," + (v - 2) + "," + (v - 8) + ")";
          ctx.fillRect(x + 1, y + 1, 30, 30);
        }
      }
      ctx.strokeStyle = "rgba(70,66,58,0.3)"; ctx.lineWidth = 1;
      for (var gx = 0; gx <= w; gx += 32) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (var gy = 0; gy <= h; gy += 32) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    }, 512, 512, 1, 1);

    /* 立面 */
    var plaster = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#e7e0d0"; ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 2400, 0.07, true);
      for (var i = 0; i < 28; i++) {
        var x = Math.random() * w, y = Math.random() * h;
        var g = ctx.createRadialGradient(x, y, 0, x, y, 24 + Math.random() * 56);
        g.addColorStop(0, "rgba(110,102,88,0.07)");
        g.addColorStop(1, "rgba(110,102,88,0)");
        ctx.fillStyle = g; ctx.fillRect(x - 70, y - 70, 140, 140);
      }
      for (var s = 0; s < 12; s++) {
        ctx.strokeStyle = "rgba(120,112,96,0.05)";
        ctx.beginPath();
        var sx = Math.random() * w, sy = Math.random() * h;
        ctx.moveTo(sx, sy); ctx.lineTo(sx + 40 + Math.random() * 60, sy + 30 + Math.random() * 80);
        ctx.stroke();
      }
    }, 512, 512, 1, 1);

    var brickRed = brick(
      function (ctx, w, h) { ctx.fillStyle = "#c6b5a2"; ctx.fillRect(0, 0, w, h); },
      function (ctx, x, y, w, h) {
        var v = 116 + Math.floor(Math.random() * 30);
        ctx.fillStyle = "rgb(" + (v + 26) + "," + (v - 30) + "," + (v - 44) + ")";
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(255, 218, 180, 0.09)";
        ctx.fillRect(x, y, w, 2);
      }, 512, 512, 2, 2);

    var brickGrey = brick(
      function (ctx, w, h) { ctx.fillStyle = "#c3c0b4"; ctx.fillRect(0, 0, w, h); },
      function (ctx, x, y, w, h) {
        var v = 116 + Math.floor(Math.random() * 26);
        ctx.fillStyle = "rgb(" + v + "," + v + "," + (v - 7) + ")";
        ctx.fillRect(x, y, w, h);
      }, 512, 512, 2, 2);

    var stone = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b9ac93"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 86) {
        var off = (Math.floor(y / 86) % 2) * 64;
        for (var x = -64; x < w; x += 128) {
          var v = 168 + Math.floor(Math.random() * 22);
          ctx.fillStyle = "rgb(" + v + "," + (v - 10) + "," + (v - 30) + ")";
          ctx.fillRect(x + off + 2, y + 2, 124, 82);
        }
      }
      ctx.strokeStyle = "rgba(96,82,62,0.35)"; ctx.lineWidth = 2;
      for (var yy = 0; yy <= h; yy += 86) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
      noise(ctx, w, h, 1800, 0.07, true);
    }, 512, 512, 1, 1);

    var whiteStone = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#ddd8c9"; ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 1600, 0.05, false);
      for (var i = 0; i < 30; i++) {
        ctx.strokeStyle = "rgba(150,144,130,0.12)";
        var y = Math.random() * h;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + (Math.random() - 0.5) * 4); ctx.stroke();
      }
    }, 512, 512, 1, 1);

    var roofGrey = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#5b615c"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 22) {
        for (var x = 0; x < w; x += 34) {
          var v = 74 + Math.floor(Math.random() * 24);
          ctx.fillStyle = "rgb(" + (v - 8) + "," + (v + 4) + "," + (v - 4) + ")";
          ctx.fillRect(x + 1, y + 1, 32, 20);
          ctx.fillStyle = "rgba(200, 214, 198, 0.14)";
          ctx.fillRect(x + 3, y + 2, 28, 4);
        }
      }
      ctx.strokeStyle = "rgba(26,34,28,0.45)"; ctx.lineWidth = 2;
      for (var yy = 0; yy <= h; yy += 22) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 2.2, 2.2);

    var roofGreen = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#3f5a3e"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 20) {
        for (var x = 0; x < w; x += 30) {
          var v = 52 + Math.floor(Math.random() * 26);
          ctx.fillStyle = "rgb(" + (v - 14) + "," + (v + 22) + "," + (v - 8) + ")";
          ctx.fillRect(x + 1, y + 1, 28, 18);
          ctx.fillStyle = "rgba(190, 214, 170, 0.2)";
          ctx.fillRect(x + 3, y + 2, 24, 4);
        }
      }
      ctx.strokeStyle = "rgba(20,34,20,0.5)"; ctx.lineWidth = 1.6;
      for (var yy = 0; yy <= h; yy += 20) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 2, 2);

    var roofGold = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#7d5f30"; ctx.fillRect(0, 0, w, h);
      var grd = ctx.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, "#a67d3c");
      grd.addColorStop(0.5, "#c49a52");
      grd.addColorStop(1, "#86663a");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 20) {
        for (var x = 0; x < w; x += 30) {
          ctx.fillStyle = "rgba(" + (196 + Math.floor(Math.random() * 40)) + "," + (158 + Math.floor(Math.random() * 34)) + ",90,0.4)";
          ctx.fillRect(x + 1, y + 1, 28, 18);
          ctx.fillStyle = "rgba(255,236,190,0.22)";
          ctx.fillRect(x + 2, y + 2, 26, 5);
        }
      }
      ctx.strokeStyle = "rgba(70,50,24,0.4)"; ctx.lineWidth = 1.6;
      for (var yy = 0; yy <= h; yy += 20) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 2.4, 1.4);

    /* 寺院瓦面（青灰筒瓦，行距清晰，供曲面屋顶 UV 直铺） */
    var templeTile = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#46544b"; ctx.fillRect(0, 0, w, h);
      var rows = 12, cols = 16, rh = h / rows, cw = w / cols;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = c * cw, y = r * rh;
          var v = 72 + Math.floor(Math.random() * 18);
          ctx.fillStyle = "rgb(" + (v - 10) + "," + (v + 6) + "," + (v - 2) + ")";
          ctx.fillRect(x + 0.6, y + 0.6, cw - 1.2, rh - 1.2);
          ctx.fillStyle = "rgba(198,216,196,0.20)";
          ctx.fillRect(x + 2.4, y + 1.2, 1.8, rh - 3.2);
          ctx.fillStyle = "rgba(12,18,14,0.55)";
          ctx.fillRect(x + 0.6, y + rh - 3.4, cw - 1.2, 2.8);
        }
        ctx.fillStyle = "rgba(9,15,11,0.42)";
        ctx.fillRect(0, r * rh + rh - 1.4, w, 1.4);
      }
      noise(ctx, w, h, 700, 0.05, false);
    }, 512, 512, 1, 1);

    /* 黄铜瓦（普觉楼五重檐近景） */
    var templeGoldTile = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#7a5824"; ctx.fillRect(0, 0, w, h);
      var rows = 12, cols = 16, rh = h / rows, cw = w / cols;
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          var x = c * cw, y = r * rh;
          var v = 128 + Math.floor(Math.random() * 26);
          ctx.fillStyle = "rgb(" + (v + 52) + "," + (v + 20) + "," + (v - 46) + ")";
          ctx.fillRect(x + 0.6, y + 0.6, cw - 1.2, rh - 1.2);
          ctx.fillStyle = "rgba(255,236,186,0.34)";
          ctx.fillRect(x + 2.2, y + 1.4, 1.8, rh - 3.4);
          ctx.fillStyle = "rgba(74,50,18,0.55)";
          ctx.fillRect(x + 0.6, y + rh - 3.4, cw - 1.2, 2.8);
        }
        ctx.fillStyle = "rgba(64,44,16,0.4)";
        ctx.fillRect(0, r * rh + rh - 1.4, w, 1.4);
      }
      noise(ctx, w, h, 600, 0.05, true);
    }, 512, 512, 1, 1);

    /* 格扇门：上部金线格心 + 下部裙板，背后透暖光 */
    var latticeDoor = canvasTexture(function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#3a1d10");
      g.addColorStop(0.5, "#22130b");
      g.addColorStop(1, "#150d08");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#6b3423"; ctx.lineWidth = 14;
      ctx.strokeRect(7, 7, w - 14, h - 14);
      ctx.strokeStyle = "#c9a35c"; ctx.lineWidth = 3;
      ctx.strokeRect(17, 17, w - 34, h - 34);
      var lx = 24, ly = 24, lw = w - 48, lh = h * 0.64;
      var gg = ctx.createRadialGradient(w / 2, ly + lh * 0.45, 8, w / 2, ly + lh * 0.45, lh * 0.66);
      gg.addColorStop(0, "rgba(255,190,110,0.42)");
      gg.addColorStop(1, "rgba(255,150,70,0)");
      ctx.fillStyle = gg; ctx.fillRect(lx, ly, lw, lh);
      ctx.strokeStyle = "#c9a35c"; ctx.lineWidth = 2.4;
      var cols = 6, rows = 10;
      for (var i = 1; i < cols; i++) {
        var xx = lx + (lw / cols) * i;
        ctx.beginPath(); ctx.moveTo(xx, ly); ctx.lineTo(xx, ly + lh); ctx.stroke();
      }
      for (var j = 1; j < rows; j++) {
        var yy = ly + (lh / rows) * j;
        ctx.beginPath(); ctx.moveTo(lx, yy); ctx.lineTo(lx + lw, yy); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(201,163,92,0.55)"; ctx.lineWidth = 1.2;
      for (var k = 0; k < cols; k++) {
        var cx2 = lx + (lw / cols) * (k + 0.5);
        ctx.beginPath(); ctx.moveTo(cx2, ly + 4); ctx.lineTo(cx2, ly + lh - 4); ctx.stroke();
      }
      var py = ly + lh + 12;
      ctx.fillStyle = "#45241a"; ctx.fillRect(lx, py, lw, h - py - 26);
      ctx.strokeStyle = "#a87c44"; ctx.lineWidth = 2.5;
      ctx.strokeRect(lx + 4, py + 4, lw - 8, h - py - 34);
      ctx.fillStyle = "#c9a35c";
      [[lx + 18, py + 18], [lx + lw - 18, py + 18], [lx + 18, h - 40], [lx + lw - 18, h - 40]].forEach(function (p) {
        ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 6.3); ctx.fill();
      });
      ctx.fillStyle = "rgba(255,196,120,0.06)";
      ctx.fillRect(0, 0, w, h * 0.6);
    }, 256, 512, 1, 1);

    var latticeWindow = canvasTexture(function (ctx, w, h) {
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "#33200f");
      g.addColorStop(1, "#1a120a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "#5e2f1f"; ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, w - 10, h - 10);
      ctx.strokeStyle = "#c9a35c"; ctx.lineWidth = 2.2;
      ctx.strokeRect(12, 12, w - 24, h - 24);
      var gg = ctx.createRadialGradient(w / 2, h / 2, 6, w / 2, h / 2, h * 0.6);
      gg.addColorStop(0, "rgba(255,196,120,0.34)");
      gg.addColorStop(1, "rgba(255,150,70,0)");
      ctx.fillStyle = gg; ctx.fillRect(12, 12, w - 24, h - 24);
      ctx.strokeStyle = "#c9a35c"; ctx.lineWidth = 2;
      var cols = 4, rows = 5;
      for (var i = 1; i < cols; i++) {
        var xx = 12 + ((w - 24) / cols) * i;
        ctx.beginPath(); ctx.moveTo(xx, 12); ctx.lineTo(xx, h - 12); ctx.stroke();
      }
      for (var j = 1; j < rows; j++) {
        var yy = 12 + ((h - 24) / rows) * j;
        ctx.beginPath(); ctx.moveTo(12, yy); ctx.lineTo(w - 12, yy); ctx.stroke();
      }
    }, 256, 256, 1, 1);

    /* 斗拱带（青绿彩画 + 金线，横向平铺） */
    var dougongBand = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#223a35"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#c9a35c";
      ctx.fillRect(0, 0, w, 5);
      ctx.fillRect(0, h - 6, w, 6);
      var n = 8, cw = w / n;
      for (var i = 0; i < n; i++) {
        var x = i * cw;
        ctx.fillStyle = "#7f2f24";
        ctx.fillRect(x + cw * 0.29, h * 0.60, cw * 0.42, h * 0.30);
        ctx.fillStyle = "#c9a35c";
        ctx.fillRect(x + cw * 0.10, h * 0.43, cw * 0.80, h * 0.075);
        ctx.fillStyle = "#3f6a5e";
        ctx.fillRect(x + cw * 0.17, h * 0.29, cw * 0.66, h * 0.09);
        ctx.fillStyle = "#c9a35c";
        ctx.fillRect(x + cw * 0.23, h * 0.18, cw * 0.54, h * 0.07);
        ctx.fillStyle = "#8f3a2a";
        ctx.fillRect(x + cw * 0.45, h * 0.10, cw * 0.10, h * 0.24);
        ctx.fillStyle = "rgba(232,206,150,0.5)";
        ctx.fillRect(x + cw * 0.33, h * 0.62, cw * 0.34, 2);
      }
    }, 512, 128, 1, 1);

    /* 餐饮灯箱菜单 */
    var menuBoard = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#f8eccd"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#a52a1c"; ctx.fillRect(0, 0, w, 66);
      ctx.fillStyle = "#fff3d2";
      ctx.font = "bold 42px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("今日菜单", w / 2, 35);
      var cols = ["#b5541f", "#7d8a2e", "#c8863a", "#6e3a22"];
      for (var i = 0; i < 4; i++) {
        var x = 16 + (i % 2) * (w / 2), y = 84 + Math.floor(i / 2) * (h / 2 - 30);
        var bw = w / 2 - 24, bh = h / 2 - 56;
        ctx.fillStyle = cols[i]; ctx.fillRect(x, y, bw, bh);
        ctx.fillStyle = "rgba(255,236,196,0.55)"; ctx.fillRect(x + 8, y + 8, bw - 16, 12);
        ctx.fillStyle = "rgba(40,24,12,0.55)";
        for (var l = 0; l < 3; l++) ctx.fillRect(x + 8, y + bh - 34 + l * 9, bw - 30, 3);
        ctx.fillStyle = "#a52a1c";
        ctx.beginPath(); ctx.arc(x + bw - 22, y + 24, 9, 0, 6.3); ctx.fill();
      }
      ctx.fillStyle = "#a52a1c"; ctx.font = "bold 22px 'Microsoft YaHei', sans-serif";
      ctx.fillText("惠福东路 · 美食花街", w / 2, h - 12);
    }, 256, 384, 1, 1);

    var wood = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4a3123"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 150; i++) {
        var y = i * 3.4;
        ctx.strokeStyle = "rgba(22, 12, 7, " + (0.15 + Math.random() * 0.18) + ")";
        ctx.lineWidth = 1 + Math.random() * 1.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y + Math.sin(i * 0.5) * 5); ctx.stroke();
      }
    }, 512, 512, 1, 1);

    var windowDark = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#1b2629"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 42) {
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(8, y + 4, w - 16, 6);
      }
      ctx.fillStyle = "rgba(180, 205, 210, 0.06)";
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    }, 256, 256, 1, 1);

    function shopfront(kind) {
      return canvasTexture(function (ctx, w, h) {
        ctx.fillStyle = "#232320"; ctx.fillRect(0, 0, w, h);
        var wall = kind === 0 ? "#4a3a2a" : kind === 1 ? "#3d413c" : "#4c4030";
        ctx.fillStyle = wall; ctx.fillRect(0, 0, w, h);
        // 顶部招牌带
        ctx.fillStyle = kind === 0 ? "#6a2318" : kind === 1 ? "#243b35" : "#5c4a22";
        ctx.fillRect(0, 0, w, 30);
        ctx.fillStyle = "rgba(255, 226, 170, 0.22)";
        ctx.fillRect(6, 22, w - 12, 3);
        // 玻璃橱窗
        var panes = 3;
        var pad = 8;
        var gap = 6;
        var pw = (w - pad * 2 - gap * (panes - 1)) / panes;
        var top = 38, bottom = h - 18;
        for (var i = 0; i < panes; i++) {
          var x = pad + i * (pw + gap);
          var grd = ctx.createLinearGradient(x, top, x, bottom);
          grd.addColorStop(0, kind === 1 ? "#5c6b62" : "#6b5536");
          grd.addColorStop(0.52, kind === 1 ? "#7f9187" : "#a37c47");
          grd.addColorStop(1, kind === 0 ? "#3a2b1c" : kind === 1 ? "#3a4a44" : "#33291a");
          ctx.fillStyle = grd;
          ctx.fillRect(x, top, pw, bottom - top);
          // 暖色内部：货架 / 灯
          ctx.fillStyle = "rgba(255, 214, 150, 0.5)";
          ctx.fillRect(x + 5, top + 8, pw - 10, 6);
          ctx.fillStyle = "rgba(40, 26, 16, 0.5)";
          for (var sh = 0; sh < 3; sh++) {
            ctx.fillRect(x + 7, top + 34 + sh * 26, pw - 14, 4);
            for (var it = 0; it < 3; it++) {
              ctx.fillStyle = "rgba(214, 166, 96, " + (0.25 + (sh % 2) * 0.15) + ")";
              ctx.fillRect(x + 10 + it * (pw - 24) / 3, top + 25 + sh * 26, (pw - 34) / 3, 9);
            }
            ctx.fillStyle = "rgba(40, 26, 16, 0.5)";
          }
          // 反光
          ctx.fillStyle = "rgba(220, 240, 236, 0.1)";
          ctx.beginPath();
          ctx.moveTo(x + 3, bottom);
          ctx.lineTo(x + pw * 0.45, top);
          ctx.lineTo(x + pw * 0.66, top);
          ctx.lineTo(x + pw * 0.2, bottom);
          ctx.closePath();
          ctx.fill();
          // 白/黑窗框
          ctx.strokeStyle = "rgba(238, 232, 214, 0.78)";
          ctx.lineWidth = 3;
          ctx.strokeRect(x + 1.5, top + 1.5, pw - 3, bottom - top - 3);
          ctx.strokeStyle = "rgba(30, 26, 20, 0.7)";
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(x + pw / 2, top); ctx.lineTo(x + pw / 2, bottom); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(x, top + (bottom - top) * 0.62); ctx.lineTo(x + pw, top + (bottom - top) * 0.62); ctx.stroke();
        }
        // 门
        ctx.fillStyle = "#1d1a15";
        ctx.fillRect(w * 0.8, 44, 34, bottom - 44);
        ctx.fillStyle = "rgba(255, 210, 150, 0.22)";
        ctx.fillRect(w * 0.81, 52, 26, (bottom - 60) * 0.5);
        ctx.strokeStyle = "rgba(230, 220, 198, 0.55)";
        ctx.lineWidth = 2;
        ctx.strokeRect(w * 0.8, 44, 34, bottom - 44);
        // 门头灯
        ctx.fillStyle = "rgba(255, 208, 140, 0.85)";
        ctx.fillRect(w * 0.8 + 8, 48, 18, 3);
        // 底部石基
        ctx.fillStyle = "#2c2a24";
        ctx.fillRect(0, h - 14, w, 14);
        // 外墙轮廓
        ctx.strokeStyle = "rgba(20, 18, 14, 0.8)";
        ctx.lineWidth = 8;
        ctx.strokeRect(4, 4, w - 8, h - 8);
        // 橱窗暖光
        ctx.fillStyle = "rgba(255, 190, 110, 0.12)";
        ctx.fillRect(0, 40, w, h - 60);
      }, 256, 256, 1, 1);
    }

    /* 古道层位：唐砖、南汉砖、宋元砖石、明清砂岩、民国石板 */
    function layerTexture(base, kind) {
      return canvasTexture(function (ctx, w, h) {
        ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
        if (kind === "tang") {
          for (var y = 0; y < h; y += 34) {
            var off = (Math.floor(y / 34) % 2) * 40;
            for (var x = -40; x < w; x += 80) {
              var v = 82 + Math.floor(Math.random() * 22);
              ctx.fillStyle = "rgb(" + (v + 10) + "," + (v - 4) + "," + (v - 16) + ")";
              ctx.fillRect(x + off + 2, y + 2, 76, 30);
            }
          }
          ctx.strokeStyle = "rgba(40,32,24,0.5)"; ctx.lineWidth = 2;
          for (var yy = 0; yy <= h; yy += 34) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
        } else if (kind === "nanhan") {
          for (var y2 = 0; y2 < h; y2 += 24) {
            var off2 = (Math.floor(y2 / 24) % 2) * 30;
            for (var x2 = -30; x2 < w; x2 += 60) {
              var v2 = 96 + Math.floor(Math.random() * 26);
              ctx.fillStyle = "rgb(" + (v2 + 8) + "," + v2 + "," + (v2 - 12) + ")";
              ctx.fillRect(x2 + off2 + 2, y2 + 2, 56, 20);
            }
          }
          noise(ctx, w, h, 900, 0.08, true);
        } else if (kind === "song") {
          for (var i = 0; i < 42; i++) {
            var cx = Math.random() * w, cy = Math.random() * h;
            var r = 10 + Math.random() * 22;
            var v3 = 120 + Math.floor(Math.random() * 30);
            ctx.fillStyle = "rgb(" + v3 + "," + (v3 - 6) + "," + (v3 - 18) + ")";
            ctx.beginPath();
            for (var a = 0; a < 7; a++) {
              var ang = a / 7 * Math.PI * 2;
              var rr = r * (0.7 + Math.random() * 0.4);
              var px = cx + Math.cos(ang) * rr, py = cy + Math.sin(ang) * rr;
              if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = "rgba(52,44,34,0.4)"; ctx.stroke();
          }
          noise(ctx, w, h, 1400, 0.09, true);
        } else if (kind === "ming") {
          for (var y3 = 0; y3 < h; y3 += 58) {
            var off3 = (Math.floor(y3 / 58) % 2) * 50;
            for (var x3 = -50; x3 < w; x3 += 100) {
              var v4 = 150 + Math.floor(Math.random() * 26);
              ctx.fillStyle = "rgb(" + (v4 + 8) + "," + (v4 - 12) + "," + (v4 - 38) + ")";
              ctx.fillRect(x3 + off3 + 2, y3 + 2, 96, 54);
              ctx.strokeStyle = "rgba(90,74,52,0.45)";
              ctx.strokeRect(x3 + off3 + 2, y3 + 2, 96, 54);
            }
          }
          noise(ctx, w, h, 1200, 0.08, true);
        } else {
          for (var y4 = 0; y4 < h; y4 += 46) {
            var off4 = (Math.floor(y4 / 46) % 2) * 60;
            for (var x4 = -60; x4 < w; x4 += 120) {
              var v5 = 132 + Math.floor(Math.random() * 18);
              ctx.fillStyle = "rgb(" + v5 + "," + (v5 - 4) + "," + (v5 - 12) + ")";
              ctx.fillRect(x4 + off4 + 2, y4 + 2, 116, 42);
            }
          }
          noise(ctx, w, h, 800, 0.06, false);
        }
        ctx.fillStyle = "rgba(38,28,18,0.16)";
        for (var k = 0; k < 40; k++) {
          ctx.fillRect(Math.random() * w, Math.random() * h, 4 + Math.random() * 30, 1 + Math.random() * 3);
        }
      }, 512, 512, 1, 1);
    }

    var layerTang = layerTexture("#6a5a48", "tang");
    var layerNanhan = layerTexture("#7b6a54", "nanhan");
    var layerSong = layerTexture("#8c7c66", "song");
    var layerMing = layerTexture("#a99473", "ming");
    var layerRepublic = layerTexture("#9a9486", "republic");

    var bark = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4e4034"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 90; i++) {
        ctx.strokeStyle = "rgba(24,18,12,0.32)";
        ctx.lineWidth = 1 + Math.random() * 3;
        ctx.beginPath(); ctx.moveTo(i * 3.3, 0); ctx.lineTo(i * 3.3 + 8, h); ctx.stroke();
      }
      for (var k = 0; k < 40; k++) {
        ctx.fillStyle = "rgba(132,120,96,0.13)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 8, 20 + Math.random() * 60);
      }
    }, 256, 512, 1, 1);

    var leaf = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#46613e"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 2100; i++) {
        var g = 84 + Math.floor(Math.random() * 62);
        ctx.fillStyle = "rgba(" + (g - 30) + "," + g + "," + (g - 34) + ",0.48)";
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 1.5 + Math.random() * 5, 0, 6.3);
        ctx.fill();
      }
      for (var dark = 0; dark < 260; dark++) {
        ctx.fillStyle = "rgba(20, 38, 22, 0.28)";
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 0, 6.3);
        ctx.fill();
      }
    }, 256, 256, 1, 1);

    var cityWindow = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#2b3336"; ctx.fillRect(0, 0, w, h);
      for (var y = 6; y < h; y += 16) {
        for (var x = 6; x < w; x += 14) {
          ctx.fillStyle = Math.random() > 0.55 ? "rgba(255, 206, 138, 0.85)" : "rgba(32, 42, 46, 0.85)";
          ctx.fillRect(x, y, 7, 8);
        }
      }
    }, 256, 256, 5, 8);

    var signsAtlas = buildSignAtlas();
    var vertAtlas = buildVerticalAtlas();

    /* LED 屏：抽象广州天际线 + 广州，8–12 fps 由主循环重绘 */
    var ledCanvas = document.createElement("canvas");
    ledCanvas.width = 512; ledCanvas.height = 256;
    var ledCtx = ledCanvas.getContext("2d");
    var ledTexture = new THREE.CanvasTexture(ledCanvas);
    ledTexture.encoding = THREE.sRGBEncoding;
    ledTexture.anisotropy = 4;
    var ledState = { phase: 0 };
    function drawLed(t, night) {
      var ctx = ledCtx, w = 512, h = 256;
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, night ? "#08203a" : "#204a60");
      g.addColorStop(0.55, night ? "#0c2a3e" : "#2d6474");
      g.addColorStop(1, night ? "#04121f" : "#18313c");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 46; i++) {
        var bx = (i * 37 + 11) % w;
        var bh = 20 + ((i * 53) % 110);
        ctx.fillStyle = "rgba(12, 30, 44, " + (0.5 + (i % 5) * 0.08) + ")";
        ctx.fillRect(bx, h - bh, 18 + (i % 3) * 6, bh);
        ctx.fillStyle = night ? "rgba(255, 214, 140, 0.75)" : "rgba(255, 226, 168, 0.5)";
        for (var wy = h - bh + 8; wy < h - 10; wy += 12) {
          for (var wx = bx + 4; wx < bx + 16 + (i % 3) * 6; wx += 9) {
            if ((wx + wy + i) % 3 !== 0) ctx.fillRect(wx, wy, 4, 5);
          }
        }
      }
      var tw = 30 + Math.sin(t * 0.7) * 4;
      ctx.fillStyle = "#0c2233";
      ctx.beginPath();
      ctx.moveTo(430, h - 40); ctx.lineTo(444, h - 40); ctx.lineTo(440, 22); ctx.lineTo(436, 22);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(452, h - 40); ctx.lineTo(462, h - 40); ctx.lineTo(459, 66); ctx.lineTo(455, 66);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = night ? "rgba(255, 214, 150, 0.9)" : "rgba(255, 230, 180, 0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(444, h - 70 + tw * 0.2); ctx.lineTo(452, h - 44); ctx.stroke();
      ctx.fillStyle = night ? "rgba(255, 240, 210, 0.95)" : "rgba(255, 244, 220, 0.75)";
      ctx.font = "bold 62px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("广州", 318, 92);
      ctx.font = "500 19px 'Microsoft YaHei', 'PingFang SC', sans-serif";
      ctx.fillStyle = "rgba(255, 240, 210, 0.62)";
      ctx.fillText("CANTON · 千年商都", 318, 122);
      var band = (t * 40) % (w + 160) - 80;
      var lg = ctx.createLinearGradient(band - 60, 0, band + 60, 0);
      lg.addColorStop(0, "rgba(120, 220, 255, 0)");
      lg.addColorStop(0.5, night ? "rgba(140, 230, 255, 0.3)" : "rgba(160, 235, 255, 0.16)");
      lg.addColorStop(1, "rgba(120, 220, 255, 0)");
      ctx.fillStyle = lg;
      ctx.fillRect(band - 60, 0, 120, h);
      ledTexture.needsUpdate = true;
    }
    drawLed(0, true);

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

    return {
      pavingLight: pavingLight,
      pavingDark: pavingDark,
      pavingArcade: pavingArcade,
      asphalt: asphalt,
      sidewalk: sidewalk,
      plaster: plaster,
      brickRed: brickRed,
      brickGrey: brickGrey,
      stone: stone,
      whiteStone: whiteStone,
      roofGrey: roofGrey,
      roofGreen: roofGreen,
      roofGold: roofGold,
      templeTile: templeTile,
      templeGoldTile: templeGoldTile,
      latticeDoor: latticeDoor,
      latticeWindow: latticeWindow,
      dougongBand: dougongBand,
      menuBoard: menuBoard,
      wood: wood,
      windowDark: windowDark,
      shopfrontA: shopfront(0),
      shopfrontB: shopfront(1),
      shopfrontC: shopfront(2),
      layerTang: layerTang,
      layerNanhan: layerNanhan,
      layerSong: layerSong,
      layerMing: layerMing,
      layerRepublic: layerRepublic,
      bark: bark,
      leaf: leaf,
      cityWindow: cityWindow,
      signsAtlas: signsAtlas,
      vertAtlas: vertAtlas,
      led: { canvas: ledCanvas, texture: ledTexture, draw: drawLed, state: ledState },
      glow: glow
    };
  }

  window.BeijingluTextures = { build: build };
})();
