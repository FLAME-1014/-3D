/* 广州塔近景 · 程序化纹理（无外部贴图） */
(function () {
  "use strict";

  var seed = 20261031;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

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

  function noise(ctx, w, h, n, alpha) {
    for (var i = 0; i < n; i++) {
      var g = Math.floor(rnd() * 70);
      ctx.fillStyle = "rgba(" + g + "," + g + "," + (g + 4) + "," + (alpha * (0.35 + rnd() * 0.65)).toFixed(3) + ")";
      ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.4, 1 + rnd() * 1.4);
    }
  }

  function build(renderer) {
    var steel = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#d9dde0";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 90; i++) {
        ctx.strokeStyle = "rgba(120,134,142," + (0.025 + rnd() * 0.06).toFixed(3) + ")";
        ctx.lineWidth = 0.6 + rnd();
        var x = rnd() * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (rnd() - 0.5) * 3, h);
        ctx.stroke();
      }
      noise(ctx, w, h, 700, 0.09);
    }, 256, 256, 2, 2);

    var steelDark = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#9aa4aa";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 500, 0.12);
    }, 128, 128, 2, 2);

    var glassGrid = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#6f96a8";
      ctx.fillRect(0, 0, w, h);
      var g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(210,232,238,0.18)");
      g.addColorStop(0.5, "rgba(70,110,128,0.18)");
      g.addColorStop(1, "rgba(220,238,242,0.12)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(228,241,245,0.4)";
      ctx.lineWidth = 2;
      for (var x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y < h; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.strokeStyle = "rgba(228,241,245,0.22)";
      ctx.lineWidth = 1.2;
      for (var d = -h; d < w; d += 96) { ctx.beginPath(); ctx.moveTo(d, 0); ctx.lineTo(d + h, h); ctx.stroke(); }
    }, 512, 512, 4, 8);

    var granite = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#c9c5bc";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 3800, 0.14);
      ctx.strokeStyle = "rgba(120,116,108,0.35)";
      ctx.lineWidth = 1.4;
      for (var x = 0; x <= w; x += 128) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y <= h; y += 128) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }, 512, 512, 6, 6);

    var ripplePaving = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#cfcac0";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 2600, 0.1);
      ctx.strokeStyle = "rgba(178,172,160,0.55)";
      for (var i = 1; i <= 5; i++) {
        ctx.lineWidth = i === 3 ? 2.4 : 1.2;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, 30 + i * 42, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.strokeStyle = "rgba(120,116,108,0.28)";
      ctx.lineWidth = 1;
      for (var d = -h; d < w; d += 170) {
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, Math.abs(d) + 16, 0, Math.PI * 2);
        ctx.stroke();
      }
    }, 512, 512, 1, 1);

    var concrete = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#9e9e98";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 1600, 0.16);
      for (var i = 0; i < 24; i++) {
        ctx.fillStyle = "rgba(80,84,80," + (0.03 + rnd() * 0.06).toFixed(3) + ")";
        ctx.fillRect(rnd() * w, 0, 2 + rnd() * 9, h);
      }
    }, 256, 256, 3, 3);

    var water = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#1e3a46";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 420; i++) {
        ctx.strokeStyle = "rgba(180,214,220," + (0.02 + rnd() * 0.07).toFixed(3) + ")";
        ctx.lineWidth = 0.6 + rnd() * 1.4;
        var y = rnd() * h;
        var x = rnd() * w;
        var len = 12 + rnd() * 90;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + len * 0.5, y + (rnd() - 0.5) * 5, x + len, y);
        ctx.stroke();
      }
    }, 512, 512, 6, 6);

    var leaf = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#4f6b47";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 800; i++) {
        var g = 90 + Math.floor(rnd() * 70);
        ctx.fillStyle = "rgba(" + Math.floor(g * 0.62) + "," + g + "," + Math.floor(g * 0.5) + "," + (0.2 + rnd() * 0.5).toFixed(2) + ")";
        ctx.beginPath();
        ctx.arc(rnd() * w, rnd() * h, 1 + rnd() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }, 128, 128, 2, 2);

    var trunk = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#6b5642";
      ctx.fillRect(0, 0, w, h);
      for (var i = 0; i < 60; i++) {
        ctx.strokeStyle = "rgba(46,36,26," + (0.12 + rnd() * 0.22).toFixed(2) + ")";
        ctx.lineWidth = 0.8 + rnd() * 2;
        var x = rnd() * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (rnd() - 0.5) * 8, h);
        ctx.stroke();
      }
    }, 128, 128, 2, 2);

    var grass = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#5a7047";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(255,255,255,0.035)";
      for (var sx = 0; sx < w; sx += 64) ctx.fillRect(sx, 0, 32, h);
      for (var i = 0; i < 3200; i++) {
        var g = 74 + Math.floor(rnd() * 66);
        ctx.fillStyle = "rgba(" + Math.floor(g * 0.56) + "," + g + "," + Math.floor(g * 0.46) + "," + (0.12 + rnd() * 0.36).toFixed(2) + ")";
        ctx.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 3, 1 + rnd() * 2);
      }
    }, 256, 256, 10, 10);

    var cityWindow = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#3a4650";
      ctx.fillRect(0, 0, w, h);
      for (var y = 7; y < h - 6; y += 15) {
        for (var x = 6; x < w - 6; x += 12) {
          var lit = rnd();
          if (lit > 0.64) {
            ctx.fillStyle = lit > 0.88 ? "rgba(255,218,165," + (0.4 + rnd() * 0.5).toFixed(2) + ")"
              : "rgba(192,219,255," + (0.22 + rnd() * 0.42).toFixed(2) + ")";
            ctx.fillRect(x, y, 4, 5);
          } else {
            ctx.fillStyle = "rgba(52,66,78,0.5)";
            ctx.fillRect(x, y, 4, 5);
          }
        }
        if ((y / 15) % 4 === 0) {
          ctx.fillStyle = "rgba(30,40,48,0.5)";
          ctx.fillRect(0, y + 6, w, 2);
        }
      }
      ctx.fillStyle = "rgba(116,130,138,0.18)";
      for (var bx = 0; bx < w; bx += 64) ctx.fillRect(bx, 0, 2, h);
    }, 512, 512, 1.6, 1.6);

    var cityLit = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#04070b";
      ctx.fillRect(0, 0, w, h);
      for (var y = 6; y < h - 6; y += 12) {
        for (var x = 5; x < w - 5; x += 10) {
          var r = rnd();
          if (r > 0.3) {
            ctx.fillStyle = r > 0.82 ? "rgba(255,214,150," + (0.6 + rnd() * 0.4).toFixed(2) + ")"
              : r > 0.55 ? "rgba(255,238,206," + (0.35 + rnd() * 0.45).toFixed(2) + ")"
                : "rgba(178,208,255," + (0.28 + rnd() * 0.42).toFixed(2) + ")";
            ctx.fillRect(x, y, 5, 6);
          }
        }
      }
    }, 512, 512, 2.2, 2.2);

    var aviation = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#f2f2f2";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#d9483b";
      for (var y = 0; y < h; y += 32) ctx.fillRect(0, y, w, 15);
    }, 128, 128, 1, 2);

    var glow = (function () {
      var c = document.createElement("canvas");
      c.width = c.height = 128;
      var ctx = c.getContext("2d");
      var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.3, "rgba(255,255,255,0.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      var t = new THREE.CanvasTexture(c);
      t.encoding = THREE.sRGBEncoding;
      return t;
    })();

    var cabin = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#e2553f";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#f2f2ee";
      ctx.fillRect(0, h * 0.36, w, h * 0.18);
      ctx.fillStyle = "#2f5f8a";
      ctx.fillRect(0, h * 0.58, w, h * 0.08);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      for (var x = 0; x < w; x += 32) ctx.fillRect(x, 0, 2, h);
    }, 128, 128, 1, 1);

    var plazaStone = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#bfbcb4";
      ctx.fillRect(0, 0, w, h);
      noise(ctx, w, h, 2400, 0.12);
      ctx.strokeStyle = "rgba(106,104,98,0.3)";
      ctx.lineWidth = 1.2;
      for (var x = 0; x < w; x += 64) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y < h; y += 64) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    }, 256, 256, 10, 10);

    var urban = canvasTexture(function (ctx, w, h) {
      ctx.fillStyle = "#333d3a";
      ctx.fillRect(0, 0, w, h);
      var cell = 64;
      for (var y = 0; y < h; y += cell) {
        for (var x = 0; x < w; x += cell) {
          var inset = 22 + rnd() * 12;
          var shade = 0.72 + rnd() * 0.35;
          var g = Math.floor(58 * shade);
          ctx.fillStyle = "rgb(" + g + "," + Math.floor(g * 1.08) + "," + Math.floor(g * 1.04) + ")";
          ctx.fillRect(x + 5, y + 5, cell - 10, cell - 10);
          ctx.fillStyle = "rgba(150,160,156,0.18)";
          if (rnd() > 0.45) ctx.fillRect(x + 8, y + 8, (cell - 16) * (0.3 + rnd() * 0.5), (cell - 16) * (0.2 + rnd() * 0.4));
          ctx.fillStyle = "rgba(18,24,24,0.35)";
          if (rnd() > 0.6) ctx.fillRect(x + inset, y + inset, 6 + rnd() * 10, 6 + rnd() * 10);
        }
      }
      ctx.strokeStyle = "rgba(160,170,166,0.22)";
      ctx.lineWidth = 2;
      for (var sx = 0; sx < w; sx += cell) {
        ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx, h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, sx); ctx.lineTo(w, sx); ctx.stroke();
      }
    }, 512, 512, 70, 70);

    if (renderer && renderer.capabilities) {
      var maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy ? renderer.capabilities.getMaxAnisotropy() : 4);
      [steel, steelDark, glassGrid, granite, ripplePaving, concrete, water, leaf, trunk, cityWindow, cityLit, aviation, cabin, plazaStone, grass, urban].forEach(function (t) {
        t.anisotropy = maxAniso;
      });
    }

    return {
      steel: steel,
      steelDark: steelDark,
      glassGrid: glassGrid,
      granite: granite,
      ripplePaving: ripplePaving,
      concrete: concrete,
      water: water,
      leaf: leaf,
      trunk: trunk,
      cityWindow: cityWindow,
      cityLit: cityLit,
      aviation: aviation,
      cabin: cabin,
      plazaStone: plazaStone,
      grass: grass,
      urban: urban,
      glow: glow
    };
  }

  window.CantonTowerTextures = { build: build };
})();
