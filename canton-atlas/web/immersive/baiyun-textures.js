/* 白云山 · 摩星岭近景 · 程序化纹理
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
    return t;
  }

  function makeTextTexture(text, w, h, color, bg) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var ctx = c.getContext("2d");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.font = "bold " + Math.floor(h * 0.56) + "px 'Songti SC', 'SimSun', 'STSong', serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    if (text.length <= 4) {
      ctx.fillText(text, w / 2, h / 2 + h * 0.02);
    } else {
      var per = Math.max(1, Math.ceil(text.length / 2));
      var size = Math.min(w * 0.82, h * 0.36);
      ctx.font = "bold " + Math.floor(size) + "px 'Songti SC', 'SimSun', 'STSong', serif";
      ctx.fillText(text.slice(0, per), w / 2, h / 2 - size * 0.58);
      ctx.fillText(text.slice(per), w / 2, h / 2 + size * 0.58);
    }
    var t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
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
    return t;
  }

  function build(renderer) {
    var stone = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b7b3a7"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 42) {
        var off = (Math.floor(y / 42) % 2) * 46;
        for (var x = -46; x < w; x += 92) {
          var v = 166 + Math.floor(Math.random() * 26);
          ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 13) + ")";
          ctx.fillRect(x + off + 1, y + 1, 90, 40);
        }
      }
      ctx.strokeStyle = "rgba(78, 74, 66, 0.42)"; ctx.lineWidth = 2;
      for (var yy = 0; yy <= h; yy += 42) {
        ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke();
      }
    }, 512, 512, 2, 2);

    var stoneLight = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#d5d1c5"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 1800; i++) {
        var v = 195 + Math.floor(Math.random() * 40);
        ctx.fillStyle = "rgba(" + v + "," + (v - 3) + "," + (v - 12) + ",0.5)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
      ctx.strokeStyle = "rgba(90, 86, 76, 0.2)"; ctx.lineWidth = 1;
      for (var x = 0; x < w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y < h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }, 512, 512, 3, 3);

    var grass = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4b5f3d"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 7000; i++) {
        var g = 70 + Math.floor(Math.random() * 62);
        ctx.fillStyle = "rgba(" + (g - 26) + "," + g + "," + (g - 34) + ",0.48)";
        ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 2, 2);
      }
      for (var k = 0; k < 60; k++) {
        var x = Math.random() * w, y = Math.random() * h;
        var grad = ctx.createRadialGradient(x, y, 0, x, y, 30 + Math.random() * 50);
        grad.addColorStop(0, "rgba(92, 108, 66, 0.22)");
        grad.addColorStop(1, "rgba(92, 108, 66, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(x - 80, y - 80, 160, 160);
      }
    }, 512, 512, 22, 22);

    var rock = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#8d887b"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 3200; i++) {
        var v = 94 + Math.floor(Math.random() * 76);
        ctx.fillStyle = "rgba(" + v + "," + (v - 3) + "," + (v - 11) + ",0.55)";
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 8, 0, 6.3);
        ctx.fill();
      }
      for (var s = 0; s < 26; s++) {
        ctx.strokeStyle = "rgba(60, 58, 50, 0.28)";
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.beginPath();
        var x = Math.random() * w, y = Math.random() * h;
        ctx.moveTo(x, y);
        ctx.lineTo(x + 40 + Math.random() * 90, y + (Math.random() - 0.5) * 50);
        ctx.stroke();
      }
    }, 512, 512, 3, 3);

    var paving = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b1aa9c"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 64) {
        for (var x = 0; x < w; x += 64) {
          var v = 168 + Math.floor(Math.random() * 22);
          ctx.fillStyle = "rgb(" + v + "," + (v - 4) + "," + (v - 12) + ")";
          ctx.fillRect(x + 2, y + 2, 60, 60);
        }
      }
      ctx.strokeStyle = "rgba(64, 60, 52, 0.32)"; ctx.lineWidth = 3;
      for (var gx = 0; gx <= w; gx += 64) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
      for (var gy = 0; gy <= h; gy += 64) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }
    }, 512, 512, 6, 6);

    var wood = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#6b4a31"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 180; i++) {
        ctx.strokeStyle = "rgba(38, 25, 15, 0.32)";
        ctx.beginPath();
        ctx.moveTo(0, i * 3);
        ctx.lineTo(w, i * 3 + Math.sin(i * 0.7) * 7);
        ctx.stroke();
      }
    }, 512, 512, 2, 3);

    var tile = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#b4772f"; ctx.fillRect(0, 0, w, h);
      for (var y = 0; y < h; y += 22) {
        for (var x = 0; x < w; x += 30) {
          var v = 170 + Math.floor(Math.random() * 46);
          ctx.fillStyle = "rgb(" + v + "," + Math.floor(v * 0.68) + "," + Math.floor(v * 0.32) + ")";
          ctx.fillRect(x, y, 28, 19);
          ctx.fillStyle = "rgba(255, 224, 160, 0.2)";
          ctx.fillRect(x + 2, y + 2, 24, 4);
        }
      }
      ctx.strokeStyle = "rgba(100, 60, 20, 0.4)"; ctx.lineWidth = 2;
      for (var yy = 0; yy <= h; yy += 22) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(w, yy); ctx.stroke(); }
    }, 512, 512, 4, 3);

    var leaf = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#2d4a2c"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 1600; i++) {
        var g = 58 + Math.floor(Math.random() * 62);
        ctx.fillStyle = "rgba(" + (g - 24) + "," + g + "," + (g - 30) + ",0.48)";
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 2 + Math.random() * 5, 0, 6.3);
        ctx.fill();
      }
    }, 512, 512, 2, 2);

    var trunk = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4a3828"; ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 90; i++) {
        ctx.strokeStyle = "rgba(24, 16, 10, 0.4)";
        ctx.beginPath();
        ctx.moveTo(i * 5.7, 0);
        ctx.lineTo(i * 5.7 + 9, h);
        ctx.stroke();
      }
    }, 256, 512, 2, 3);

    var cityWindow = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#1b2228"; ctx.fillRect(0, 0, w, h);
      for (var y = 5; y < h; y += 13) {
        for (var x = 5; x < w; x += 11) {
          ctx.fillStyle = Math.random() > 0.4 ? "rgba(255, 208, 140, 0.9)" : "rgba(32, 40, 46, 0.9)";
          ctx.fillRect(x, y, 6, 6);
        }
      }
    }, 256, 256, 8, 14);

    var cloud = canvasTexture(function (ctx, w, h) {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < 18; i++) {
        var x = 40 + Math.random() * (w - 80);
        var y = 60 + Math.random() * (h - 120);
        var r = 40 + Math.random() * 80;
        var grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, "rgba(246, 250, 252, 0.9)");
        grad.addColorStop(0.45, "rgba(238, 244, 247, 0.5)");
        grad.addColorStop(1, "rgba(238, 244, 247, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
      }
    }, 512, 256, 1, 1);
    cloud.wrapS = cloud.wrapT = THREE.ClampToEdgeWrapping;

    return {
      stone: stone,
      stoneLight: stoneLight,
      grass: grass,
      rock: rock,
      paving: paving,
      wood: wood,
      tile: tile,
      leaf: leaf,
      trunk: trunk,
      cityWindow: cityWindow,
      cloud: cloud
    };
  }

  window.BaiyunTextures = { build: build, makeTextTexture: makeTextTexture, makeVerticalTextTexture: makeVerticalTextTexture, makeTextTextureTransparent: makeTextTextureTransparent };
})();
