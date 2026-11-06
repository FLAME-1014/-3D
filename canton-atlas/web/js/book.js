/* book.js — 广州立体志 · 立体书骨架
 *
 * 页面：cover → toc(印谱) → page(n) ⇄ page(n±1) → [expanded] → colophon
 * 单页状态：flat → loading → rising → shot1/2/3 → (drawer) ⇄ (expanded) → folding
 *
 * 依赖：window.THREE、window.CantonPalette、window.StageCore、window.MUSEUM_CATALOG
 * 不使用任何外部动画库；自写可中断 tween。
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  var catalog = window.MUSEUM_CATALOG;
  var entries = catalog && catalog.entries || [];
  var TOTAL = entries.length;

  var SEEN_KEY = 'canton-atlas-museum-seen';
  var FAV_KEY = 'canton-atlas-museum-favorites';

  // ------------------------------------------------ 工具
  function $(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function escapeHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function hashIndex(id) { for (var i = 0; i < entries.length; i++) if (entries[i].id === id) return i; return -1; }

  function readList(key) {
    try { var v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v.filter(Boolean) : []; }
    catch (e) { return []; }
  }
  function writeList(key, list) { try { localStorage.setItem(key, JSON.stringify(list)); } catch (e) {} }

  var state = {
    view: 'cover',          // cover | toc | page | colophon
    index: 0,               // 当前页 index
    pageState: 'flat',      // flat | loading | rising | shot | folding
    shot: 0,                // 0..2
    expanded: false,
    drawer: null,           // null | 'collapsed' | 'half' | 'full'
    seen: readList(SEEN_KEY),
    favorites: readList(FAV_KEY),
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    tier: 'H'
  };

  // ------------------------------------------------ 可中断 tween
  var tweens = [];
  function tween(cfg) {
    var t = {
      from: cfg.from, to: cfg.to,
      dur: Math.max(1, cfg.ms || 300),
      delay: cfg.delay || 0,
      onUpdate: cfg.onUpdate || function () {},
      onDone: cfg.onDone || null,
      start: performance.now() + (cfg.delay || 0),
      token: cfg.token || null,
      cancelled: false
    };
    t.id = ++tween._id;
    tweens.push(t);
    ensureTicker();
    return t.id;
  }
  tween._id = 0;
  tween.cancel = function (token) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      if (tweens[i].token === token) tweens[i].cancelled = true;
    }
  };
  function easeIn(t) { return 1 - Math.pow(1 - t, 2.2); }
  function easeOut(t) { return Math.pow(t, 3 / 4); }
  function stepTweens(now) {
    for (var i = tweens.length - 1; i >= 0; i--) {
      var t = tweens[i];
      if (t.cancelled) { tweens.splice(i, 1); continue; }
      if (now < t.start) continue;
      var k = clamp((now - t.start) / t.dur, 0, 1);
      t.onUpdate(k === 1 ? 1 : easeIn(k), k);
      if (k === 1) {
        tweens.splice(i, 1);
        if (t.onDone) t.onDone();
      }
    }
    if (tweens.length === 0) stopTicker();
  }
  var tickerId = 0;
  function ensureTicker() {
    if (tickerId) return;
    tickerId = requestAnimationFrame(function loop(now) {
      stepTweens(now);
      if (tweens.length > 0) { tickerId = requestAnimationFrame(loop); }
      else { tickerId = 0; }
    });
  }
  function stopTicker() { if (tickerId) { cancelAnimationFrame(tickerId); tickerId = 0; } }

  // ------------------------------------------------ Stage
  var canvas = null, stage = null;
  var RISE_MS = 900, FOLD_MS = 350, TURN_MS = 450;
  var riseToken = 0;

  function createStage() {
    try {
      stage = window.StageCore.createStage(canvas, { alpha: true, maxPixelRatio: state.tier === 'H' ? 1.75 : 1.5 });
      stage.resize();
    } catch (e) {
      stage = null;
      state.tier = 'L';
      document.querySelector('.stage').classList.add('tier-l');
      console.warn('[book] WebGL 不可用，降级 L 档', e.message);
    }
  }

  // ------------------------------------------------ 模型加载
  // stage-core 自己负责 import + create + presets + 剖切挂载 + dispose，
  // 这里只负责先把 spot.json 取来（buildPresets 要读 zoom / presetOverrides）。

  // ------------------------------------------------ 页内状态机
  var pageToken = 0;

  function enterPage(i, opts) {
    opts = opts || {};
    var id = entries[i].id;
    state.index = i;
    state.view = 'page';
    state.shot = 0;
    state.pageState = 'loading';
    var myToken = ++pageToken;

    renderPageChrome(id);
    syncURL();

    return loadPage(id, myToken);
  }

  async function loadPage(id, myToken) {
    showHint(true, '正在搭建…');
    var spot;
    try {
      var res = await fetch('../content/spots/' + encodeURIComponent(id) + '/spot.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('spot.json HTTP ' + res.status);
      spot = await res.json();
      window.SPOT_DATA = spot;      // stage.buildPresets 读 zoom / presetOverrides
      await stage.load(id);         // import + create + presets + 剖切挂载 + 首帧
    } catch (e) {
      if (myToken === pageToken) { showHint(false); fallback(id, e.message); }
      return;
    }
    if (myToken !== pageToken) return;
    showHint(false);

    buildHotspots(spot);

    // 立起
    state.pageState = 'rising';
    stage.rise(0);
    renderShot(id, 0);
    riseIntoView(myToken);
  }
  /* rise: 剖切平面 0→1；顺带把前沿线动画化 */
  function riseIntoView(token) {
    if (!stage) { state.pageState = 'shot'; return; }
    if (state.reduced) {
      stage.rise(1);
      state.pageState = 'shot';
      return;
    }
    setRiseLine(true);
    tween({
      ms: RISE_MS, token: 'rise',
      onUpdate: function (v) { stage.rise(v); moveRiseLine(v); },
      onDone: function () {
        if (token !== pageToken) return;
        setRiseLine(false);
        state.pageState = 'shot';
        $('footprint').classList.add('is-on');
        setTimeout(function () { toast('左右滑动翻页'); }, 200);
      }
    });
  }

  function foldThen(next) {
    var id = entries[state.index].id;
    var myToken = ++pageToken;
    state.pageState = 'folding';
    $('footprint').classList.remove('is-on');
    if (!stage || state.reduced) { next(); return; }
    tween({
      ms: FOLD_MS, token: 'fold',
      onUpdate: function (v) { stage.rise(1 - v); },
      onDone: function () { if (myToken === pageToken) next(); }
    });
  }

  function fallback(id, msg) {
    state.tier = 'L';
    document.querySelector('.stage').classList.add('tier-l');
    var flat = $('flatFigure');
    flat.querySelector('img').src = catalog.byId[id].silhouetteOrtho;
    flat.classList.remove('is-risen');
    flat.classList.add('is-flat');
    setTimeout(function () { flat.classList.add('is-risen'); }, 60);
    showHint(false);
    toast('3D 暂不可用，已用剪影展示');
    console.warn('[book] fallback', id, msg);
  }

  // ------------------------------------------------ 三镜
  function renderShot(id, n) {
    var item = catalog.byId[id];
    var shots = item.shots || [];
    var s = shots[n];
    state.shot = n;
    var txt = $('shotText');
    txt.classList.add('is-out');
    setTimeout(function () {
      txt.textContent = s ? s.text : '';
      txt.classList.remove('is-out');
    }, 150);

    // dots
    var dots = $('shotDots').children;
    for (var k = 0; k < dots.length; k++) {
      dots[k].className = 'shot-dot' + (k === n ? ' is-active' : (k < n ? ' is-done' : ''));
      dots[k].setAttribute('aria-label', '第 ' + (k + 1) + ' 镜');
    }

    if (s && stage) {
      stage.setPreset(s.preset, true);
      syncURL();
    }

    // 看过三镜 → 记已看
    if (n >= shots.length - 1) markSeen(id);
  }

  function nextShot() {
    var id = entries[state.index].id;
    var shots = catalog.byId[id].shots || [];
    if (state.shot >= shots.length - 1) {
      // 第三镜后再点 → 翻下一页
      turnPage(1);
      return;
    }
    renderShot(id, state.shot + 1);
  }
  function prevShot() {
    if (state.shot === 0) { turnPage(-1); return; }
    renderShot(entries[state.index].id, state.shot - 1);
  }

  // ------------------------------------------------ 翻页
  var turning = false;
  function turnPage(dir) {
    if (turning) return;
    if (state.view === 'colophon' && dir > 0) return;
    var target = clamp(state.index + dir, 0, TOTAL - 1);
    if (target === state.index && dir !== 0) {
      if (state.index === TOTAL - 1 && dir > 0) { goColophon(); return; }
      if (state.index === 0 && dir < 0) { goToc(); return; }
      return;
    }
    turning = true;
    tween.cancel('fold');
    foldThen(function () {
      flipSheet(dir, function () {
        enterPage(target);
        turning = false;
      });
    });
  }

  function flipSheet(dir, done) {
    var sheet = $('sheet');
    if (state.reduced) { done(); return; }
    sheet.style.transition = 'transform ' + TURN_MS + 'ms var(--ease-in)';
    sheet.style.transform = dir > 0 ? 'rotateY(-100deg)' : 'rotateY(100deg)';
    sheet.style.transformOrigin = dir > 0 ? 'left center' : 'right center';
    setTimeout(function () {
      sheet.style.transition = 'none';
      sheet.style.transform = 'rotateY(0)';
      // force reflow
      void sheet.offsetWidth;
      sheet.style.transition = '';
      done();
    }, TURN_MS);
  }

  // ------------------------------------------------ 手势（页模式）
  var ptr = { down: false, x: 0, y: 0, sx: 0, sy: 0, t: 0, lock: null, id: 0, tilt: 0 };
  function bindPageGestures() {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
  }
  function onDown(e) {
    if (state.expanded) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptr.down = true;
    ptr.lock = null;
    ptr.x = ptr.sx = e.clientX;
    ptr.y = ptr.sy = e.clientY;
    ptr.t = performance.now();
    ptr.id = e.pointerId;
  }
  function onMove(e) {
    if (!ptr.down || state.expanded) return;
    var dx = e.clientX - ptr.sx;
    var dy = e.clientY - ptr.sy;
    if (!ptr.lock) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) ptr.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      return;
    }
    if (ptr.lock === 'x') {
      // 拖到 100% 宽度 = 100deg；先把书页倾斜出来
      var w = window.innerWidth;
      var k = clamp(dx / w, -1, 1);
      var sheet = $('sheet');
      sheet.style.transition = 'none';
      sheet.style.transform = 'rotateY(' + (k * -14) + 'deg)';
      sheet.style.transformOrigin = 'left center';
      // 模型跟手
      if (stage) stage.tilt(-dx * 0.0016, 0);
      ptr.tilt = dx;
    }
  }
  function onUp(e) {
    if (!ptr.down) return;
    ptr.down = false;
    if (ptr.lock === 'x') {
      var dx = e.clientX - ptr.sx;
      var dt = Math.max(1, performance.now() - ptr.t);
      var v = dx / dt;
      var w = window.innerWidth;
      var sheet = $('sheet');
      sheet.style.transition = 'transform ' + TURN_MS + 'ms var(--ease-out)';
      if (Math.abs(dx) > w * 0.3 || Math.abs(v) > 0.5) {
        turnPage(dx < 0 ? 1 : -1);
      } else {
        sheet.style.transform = 'rotateY(0)';
        if (stage) stage.resetTilt();
      }
    } else if (!ptr.lock) {
      // tap
      handleTap(e);
    }
    ptr.lock = null;
  }
  function handleTap(e) {
    var footer = $('pageFooter');
    var r = footer.getBoundingClientRect();
    if (e.clientY >= r.top) { nextShot(); return; }
    if (state.expanded) return;
  }

  // ------------------------------------------------ 展开 / 合上
  function expand(on) {
    if (!stage) { toast('3D 暂不可用'); return; }
    state.expanded = on !== false;
    document.querySelector('.stage').classList.toggle('is-expanded', state.expanded);
    if (state.expanded) {
      buildExpandUI();
      syncURL();
    } else {
      stage.setPreset('overview', true);
      state.shot = 0;
      renderShot(entries[state.index].id, 0);
      syncURL();
    }
  }

  function buildExpandUI() {
    var item = entries[state.index];
    var spots = (catalog.byId[item.id].shots || []).map(function (s) { return s.preset; });
    var bar = $('expandPresets');
    var names = stage.getPresets();
    var list = spots.filter(function (n) { return names[n]; });
    if (!list.length) list = ['overview'];
    bar.innerHTML = list.map(function (n) {
      return '<button class="expand-preset" type="button" data-preset="' + n + '">' + escapeHtml(presetLabel(n)) + '</button>';
    }).join('');
    Array.prototype.forEach.call(bar.children, function (btn) {
      btn.addEventListener('click', function () { stage.setPreset(btn.dataset.preset); markActivePreset(); });
    });
    markActivePreset();
  }
  function presetLabel(n) {
    var map = { overview: '总览', front: '正面', detail: '细节', courtyard: '庭院', alley: '青云巷', street: '街道', arcade: '廊道', gate: '门楼', stage: '广福台', avenue: '林荫道', church: '教堂', hotel: '白天鹅', park: '公园', 'ancient-road': '古道', temple: '大佛寺', wuyang: '五羊', wall: '城墙', zhenhai: '镇海楼', canal: '河涌', bridge: '龙津桥', tower: '文塔', house: '西关大屋', opera: '大戏台', qilou: '骑楼', taotao: '陶陶居', lianxiang: '莲香楼', hall: '大殿', pagoda: '塔', tomb: '墓室', jade: '玉圭门阙', paifang: '牌坊', summit: '山顶', base: '塔基', lattice: '塔身', top: '塔顶', river: '仰视', facade: '正立面', rose: '玫瑰窗', side: '侧廊', apse: '后殿', box: '盒体', plaza: '草坡入口', pool: '水池', mouth: '玻璃口部' };
    return map[n] || n;
  }
  function markActivePreset() {
    var act = stage.getActivePreset();
    Array.prototype.forEach.call($('expandPresets').children, function (b) {
      b.classList.toggle('is-active', b.dataset.preset === act);
    });
  }

  var hsCache = null, hsEls = {};
  // 构建展开态热点浮层 + 抽屉里的观察点列表（同一份 spot.json）
  function buildHotspots(spot) {
    if (hsCache && hsCache.id === spot.id) { return; }
    hsCache = { id: spot.id, spot: spot };

    var layer = $('expandHotspots');
    layer.innerHTML = '';
    hsEls = {};
    (spot.hotspots || []).forEach(function (h) {
      var btn = document.createElement('button');
      btn.className = 'expand-hs';
      btn.type = 'button';
      btn.innerHTML = escapeHtml(h.label) + '<span class="hs-note">' + escapeHtml(h.note || '') + '</span>';
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(layer.children, function (c) { c.classList.remove('is-active'); });
        btn.classList.add('is-active');
        if (h.preset && stage.getPresets()[h.preset]) { stage.setPreset(h.preset); markActivePreset(); syncURL(); }
      });
      layer.appendChild(btn);
      hsEls[h.id] = btn;
    });

    // 抽屉里的观察点（点击 → 展开并转到该机位）
    var dh = $('drawerHotspots');
    if (dh) {
      dh.innerHTML = '<h3>观察点</h3>' + (spot.hotspots || []).map(function (h) {
        return '<button type="button" data-preset="' + escapeHtml(h.preset || '') + '">' + escapeHtml(h.label) + '</button>';
      }).join('');
      Array.prototype.forEach.call(dh.querySelectorAll('button'), function (btn) {
        btn.addEventListener('click', function () {
          setDrawerLevel('collapsed');
          expand(true);
          var pr = btn.dataset.preset;
          if (pr && stage.getPresets()[pr]) { stage.setPreset(pr); markActivePreset(); syncURL(); }
        });
      });
    }
  }
  function updateHotspotPositions() {
    if (!state.expanded || !hsCache) return;
    var spots = stage.projectHotspots();
    (hsCache.spot.hotspots || []).forEach(function (h) {
      var el = hsEls[h.id];
      if (!el) return;
      var p = spots[h.anchor];
      if (!p) { el.classList.add('is-hidden'); return; }
      el.classList.toggle('is-hidden', !p.visible);
      el.style.left = p.x + 'px';
      el.style.top = p.y + 'px';
    });
  }

  // ------------------------------------------------ 抽屉
  var setDrawerLevel = function () {};
  function bindDrawer() {
    var drawer = $('drawer');
    var handle = $('drawerHandle');
    var y0 = 0, cur = 'collapsed', dragging = false;
    function setLevel(lv) {
      cur = lv;
      drawer.classList.toggle('is-half', lv === 'half');
      drawer.classList.toggle('is-full', lv === 'full');
      state.drawer = lv;
    }
    setDrawerLevel = setLevel;
    setLevel('collapsed');
    handle.addEventListener('click', function (e) { if (!dragging) setLevel(cur === 'collapsed' ? 'half' : cur === 'half' ? 'full' : 'collapsed'); });
    handle.addEventListener('pointerdown', function (e) {
      dragging = false; y0 = e.clientY;
      handle.setPointerCapture(e.pointerId);
      drawer.style.transition = 'none';
      var moved = 0;
      function mv(ev) {
        var dy = ev.clientY - y0;
        if (Math.abs(dy) > 6) dragging = true;
        var base = cur === 'full' ? 100 : (cur === 'half' ? 54 : 6);
        var h = drawer.offsetHeight;
        var pct = clamp(base + (dy / h) * 100, 0, 84);
        drawer.style.transform = 'translateY(' + pct + '%)';
      }
      function up(ev) {
        var dy = ev.clientY - y0;
        drawer.style.transition = '';
        drawer.style.transform = '';
        if (Math.abs(dy) < 6) { setLevel(cur === 'collapsed' ? 'half' : cur === 'half' ? 'full' : 'collapsed'); }
        else if (dy < -40) setLevel(cur === 'collapsed' ? 'half' : 'full');
        else if (dy > 40) setLevel(cur === 'full' ? 'half' : 'collapsed');
        else setLevel(cur);
        handle.removeEventListener('pointermove', mv);
        handle.removeEventListener('pointerup', up);
      }
      handle.addEventListener('pointermove', mv);
      handle.addEventListener('pointerup', up);
    });
  }

  // ------------------------------------------------ 渲染页 chrome
  function renderPageChrome(id) {
    var item = catalog.byId[id];
    $('pageNumber').innerHTML = '第 <b>' + item.no + '</b> 页 / 共 ' + TOTAL + ' 页';
    $('pageTheme').textContent = item.themeLabel || '';
    $('pageLead').textContent = item.lead || '';
    $('footprint').querySelector('img').src = item.silhouettePersp;
    $('footprint').classList.remove('is-on');
    document.title = item.name + ' · 广州立体志';
    $('drawerName').textContent = item.name || '';
    $('drawerEn').textContent = item.en || '';
    $('drawerSig').textContent = item.sig || '';
    var facts = (window.__ATLAS_PLACES || []).filter(function (p) { return p.id === id; })[0];
    var fl = (facts && facts.facts) || [];
    $('drawerFacts').innerHTML = fl.map(function (f) {
      return '<div><span>' + escapeHtml(f[0]) + '</span><strong>' + escapeHtml(f[1]) + '</strong></div>';
    }).join('');
    $('drawerHighlights').innerHTML = ((facts && facts.highlights) || []).map(function (h) { return '<li>' + escapeHtml(h) + '</li>'; }).join('');
    $('expandTitleName').textContent = item.name || '';
    $('expandEdition').textContent = '展品 ' + item.no + ' / ' + TOTAL;
    updateSeenMark(item);
  }

  function updateSeenMark(item) {
    var el = $('pageSeen');
    var on = state.seen.indexOf(item.id) >= 0;
    el.classList.toggle('is-on', on);
    el.title = on ? '已看' : '未看';
  }
  function markSeen(id) {
    if (state.seen.indexOf(id) >= 0) return;
    state.seen.push(id);
    writeList(SEEN_KEY, state.seen);
    var el = $('pageSeen');
    el.classList.add('is-on');
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch (e) {} }
    var item = catalog.byId[id];
    if (item) updateSeenMark(item);
  }

  // ------------------------------------------------ 前沿线
  function setRiseLine(on) { $('riseLine').classList.toggle('is-on', !!on); }
  function moveRiseLine(v) {
    var el = $('riseLine');
    var box = stage.getModel();
    if (!box) return;
    var h = window.innerHeight * 0.62;
    el.style.top = (h - v * h * 0.5) + 'px';
  }

  // ------------------------------------------------ 提示 pill
  var hintTimer = 0;
  function showHint(on, text) {
    var el = $('hintPill');
    if (text) el.querySelector('span').textContent = text;
    el.classList.toggle('is-on', !!on);
  }

  function toast(msg) {
    var el = $('bookToast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('is-on'); }, 2200);
  }

  // ------------------------------------------------ URL
  function syncURL() {
    var id = entries[state.index].id;
    var p = new URLSearchParams();
    p.set('p', id);
    if (state.expanded) p.set('open', '1');
    if (state.shot > 0 && !state.expanded) p.set('shot', String(state.shot + 1));
    if (state.view === 'toc' && !state.expanded) p.set('v', 'toc');
    if (state.view === 'cover' && !state.expanded) p.set('v', 'cover');
    if (state.view === 'colophon') p.set('v', 'end');
    history.replaceState(null, '', location.pathname + '?' + p.toString());
  }

  function readURL() {
    var p = new URLSearchParams(location.search);
    var v = p.get('v');
    // 旧参数 ?item=xxx 兼容重定向为 ?p=xxx
    var id = p.get('p') || p.get('item');
    var i = id ? hashIndex(id) : -1;
    return {
      view: v || (i >= 0 ? 'page' : 'cover'),
      index: i >= 0 ? i : 0,
      open: p.get('open') === '1',
      shot: Math.max(0, (parseInt(p.get('shot'), 10) || 1) - 1)
    };
  }

  // ------------------------------------------------ 视图切换
  function goCover() { state.view = 'cover'; $('cover').classList.remove('is-out'); document.querySelector('.stage').classList.remove('is-book'); hideAll(); syncURL(); }
  function goToc() {
    state.view = 'toc'; hideAll(); $('toc').classList.add('is-on'); syncURL();
  }
  function goColophon() { state.view = 'colophon'; hideAll(); buildColophon(); $('colophon').classList.add('is-on'); syncURL(); }
  function hideAll() { $('toc').classList.remove('is-on'); $('colophon').classList.remove('is-on'); }

  function startBook() {
    var deep = readURL();
    document.querySelector('.stage').classList.add('is-book');
    if (deep.view === 'toc') { goToc(); }
    else if (deep.view === 'colophon') { goColophon(); }
    else { enterPage(deep.index).then(function () { if (deep.open) expand(true); else renderShot(entries[deep.index].id, deep.shot); }); }
  }

  // ------------------------------------------------ 封面
  function buildCover() {
    var seal = $('coverSeal');
    var demo = $('coverDemo');
    demo.querySelector('.footprint-img').src = entries[0].silhouettePersp;
    var coverId = entries[0].id;            // 陈家祠
    var did = false, coverRenderer = null, coverScene = null, coverCam = null, coverBox = null, coverPlane = null;

    function demoRise() {
      if (did) return;
      did = true;
      // 封面用一个轻量独立渲染器（不打扰主 stage），直接 import model.js
      Promise.all([
        fetch('../content/spots/' + encodeURIComponent(coverId) + '/spot.json', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('spot.json ' + r.status); return r.json(); }),
        import('../content/spots/' + encodeURIComponent(coverId) + '/model.js')
      ]).then(function (res) {
        var model = res[1].create();
        var cv = demo.querySelector('canvas');
        coverRenderer = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false });
        coverRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        coverRenderer.setSize(demo.clientWidth, demo.clientHeight, false);
        coverRenderer.localClippingEnabled = true;
        coverScene = new THREE.Scene();
        coverCam = new THREE.PerspectiveCamera(36, demo.clientWidth / Math.max(1, demo.clientHeight), 0.5, 4400);
        coverScene.add(new THREE.HemisphereLight(0xfff7e8, 0x8d8274, .95));
        var key = new THREE.DirectionalLight(0xfff0d0, 1.6); key.position.set(70, 120, 90); coverScene.add(key);
        var fill = new THREE.DirectionalLight(0xcfe0ff, .5); fill.position.set(-90, 55, -70); coverScene.add(fill);
        var rim = new THREE.DirectionalLight(0xffd8a8, .7); rim.position.set(0, 40, -120); coverScene.add(rim);

        coverBox = new THREE.Box3().setFromObject(model.group);
        var size = coverBox.getSize(new THREE.Vector3());
        var center = coverBox.getCenter(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        coverCam.position.set(center.x + maxDim * 0.9, center.y + maxDim * 0.65, center.z + maxDim * 1.7);
        coverCam.lookAt(center.x, center.y, center.z);

        coverPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -coverBox.min.y);
        var seen = new Set();
        model.group.traverse(function (o) {
          if (!o.material) return;
          var mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(function (mm) {
            if (!mm || seen.has(mm)) return; seen.add(mm);
            mm.clippingPlanes = [coverPlane]; mm.clipShadows = true; mm.needsUpdate = true;
          });
        });
        coverScene.add(model.group);
        coverRenderer.render(coverScene, coverCam);

        window.__COVER_READY__ = true;
        tween({
          ms: state.reduced ? 1 : 1100,
          onUpdate: function (v) {
            coverPlane.constant = -(coverBox.min.y + v * size.y);
            coverRenderer.render(coverScene, coverCam);
          },
          onDone: function () { demo.classList.add('is-risen'); window.__COVER_RISEN__ = true; }
        });
      }).catch(function (e) {
        window.__COVER_ERROR__ = e.message;
        demo.classList.add('is-risen');   // 失败也显示剪影，至少封面完整
      });
    }

    demo.addEventListener('pointerdown', demoRise, { once: true });
    seal.addEventListener('click', demoRise);
    // 打开按钮：先跑一次演示（若还没跑），然后进书
    $('coverOpen').addEventListener('click', function () {
      demoRise();
      var wait = state.reduced ? 60 : 1150;
      setTimeout(function () {
        $('cover').classList.add('is-out');
        document.querySelector('.stage').classList.add('is-book');
        startBook();
      }, wait);
    });
    if (state.reduced) { demo.classList.add('is-risen'); }
  }

  // ------------------------------------------------ 尾页
  function buildColophon() {
    var seen = state.seen.length;
    $('cpSeen').textContent = String(seen).padStart(2, '0');
    $('cpTotal').textContent = String(TOTAL);
    var themesDone = (window.MUSEUM_CATALOG.themeList || []).filter(function (t) { return t.id === 'all'; }).length;
    $('cpList').innerHTML = entries.map(function (it) {
      var done = state.seen.indexOf(it.id) >= 0;
      return '<div class="cp-item"><div class="cp-sil' + (done ? '' : ' is-blank') + '"><img src="' + it.silhouetteOrtho + '" alt="' + escapeHtml(it.name) + '"></div><small>' + escapeHtml(it.name) + '</small></div>';
    }).join('');
  }

  // ------------------------------------------------ TOC
  function buildToc() {
    var grid = $('tocGroups');
    grid.innerHTML = '';
    (window.MUSEUM_CATALOG.themeList || []).forEach(function (theme) {
      if (theme.id === 'all') return;
      var wrap = document.createElement('div');
      wrap.className = 'toc-group';
      wrap.dataset.theme = theme.id;
      var title = document.createElement('div');
      title.className = 'toc-group-title';
      title.textContent = theme.label;
      wrap.appendChild(title);
      var g = document.createElement('div');
      g.className = 'toc-grid';
      entries.forEach(function (it) {
        if (it.theme !== theme.id) return;
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'toc-card';
        card.dataset.id = it.id;
        card.dataset.theme = it.theme;
        var done = state.seen.indexOf(it.id) >= 0;
        card.innerHTML =
          '<div class="silhouette"><span class="no">' + it.no + '</span>' +
          (done ? '<span class="stamp" aria-hidden="true">看</span>' : '') +
          '<img src="' + it.silhouetteOrtho + '" alt="' + escapeHtml(it.name) + '"></div>' +
          '<div><span class="name">' + escapeHtml(it.name) + '</span><span class="sub">' + escapeHtml(it.en || '') + '</span></div>';
        card.addEventListener('click', function () {
          hideAll();
          enterPage(hashIndex(it.id));
        });
        g.appendChild(card);
      });
      wrap.appendChild(g);
      grid.appendChild(wrap);
    });
    // theme filter
    var bar = $('tocThemes');
    bar.innerHTML = (window.MUSEUM_CATALOG.themeList || []).map(function (t, i) {
      return '<button class="toc-theme' + (i === 0 ? ' is-active' : '') + '" type="button" data-theme="' + t.id + '">' + escapeHtml(t.label) + '</button>';
    }).join('');
    Array.prototype.forEach.call(bar.children, function (btn) {
      btn.addEventListener('click', function () {
        Array.prototype.forEach.call(bar.children, function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');
        var tid = btn.dataset.theme;
        Array.prototype.forEach.call(grid.querySelectorAll('.toc-group'), function (gr) {
          gr.style.display = tid === 'all' || gr.dataset.theme === tid ? '' : 'none';
        });
        Array.prototype.forEach.call(grid.querySelectorAll('.toc-card'), function (c) {
          c.classList.toggle('is-hidden', tid !== 'all' && c.dataset.theme !== tid);
        });
      });
    });
  }

  // ------------------------------------------------ 键盘 / 窗口
  function bindGlobal() {
    window.addEventListener('keydown', function (e) {
      if (state.expanded) { if (e.key === 'Escape') expand(false); return; }
      if (state.view === 'page') {
        if (e.key === 'ArrowRight') { e.preventDefault(); nextShot(); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); prevShot(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); turnPage(-1); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); turnPage(1); }
        else if (e.key === 'Escape') { goToc(); }
        else if (e.key === ' ') { e.preventDefault(); nextShot(); }
      }
    });
    window.addEventListener('resize', function () { if (stage) stage.resize(); });
    window.addEventListener('pagehide', function () { if (stage) stage.dispose(); });
    window.addEventListener('popstate', syncURL);
  }

  // ------------------------------------------------ 主循环
  function loop() {
    requestAnimationFrame(loop);
    if (!stage) return;
    if (state.expanded) { stage.render(); updateHotspotPositions(); }
    else if (state.pageState === 'rising' || state.pageState === 'shot' || state.pageState === 'folding') {
      stage.render();
    }
  }

  function tiers() {
    var mem = navigator.deviceMemory || navigator.hardwareConcurrency || 4;
    var small = Math.min(window.innerWidth, window.innerHeight) <= 760;
    if (!window.WebGLRenderingContext) state.tier = 'L';
    else if (mem <= 2) state.tier = 'M';
    state.tierNote = 'mem=' + mem + ' size=' + Math.min(window.innerWidth, window.innerHeight);
    document.querySelector('.stage').classList.toggle('tier-h', state.tier === 'H');
    document.querySelector('.stage').classList.toggle('tier-m', state.tier === 'M');
    document.querySelector('.stage').classList.toggle('tier-l', state.tier === 'L');
  }

  // ------------------------------------------------ Boot
  function buildDom() {
    document.body.innerHTML =
      '<div class="stage">' +
        '<canvas id="bookCanvas"></canvas>' +
        '<div class="sheet" id="sheet"><div class="sheet-face back"></div><div class="sheet-face front"></div></div>' +
        '<div class="footprint" id="footprint"><img alt=""></div>' +
        '<div class="flat-figure" id="flatFigure"><img alt=""></div>' +
        '<div class="rise-line" id="riseLine"></div>' +

        '<header class="page-header" id="pageHeader">' +
          '<span class="page-number" id="pageNumber"></span>' +
          '<span class="page-theme" id="pageTheme"></span>' +
          '<button class="page-toc" id="pageToc" type="button">目录</button>' +
        '</header>' +

        '<footer class="page-footer" id="pageFooter">' +
          '<div class="shots">' +
            '<div class="shot-dots" id="shotDots" role="tablist"></div>' +
            '<span class="shot-text" id="shotText"></span>' +
          '</div>' +
          '<p class="page-lead" id="pageLead"></p>' +
          '<p class="page-foot-note">风格化示意 · 非测绘 · <span id="pageSeen" class="page-seen" title="已看">看</span></p>' +
        '</footer>' +

        '<div class="tools">' +
          '<button class="tool-btn page-only" id="btnExpand" type="button">走近看</button>' +
          '<button class="tool-btn page-only" id="btnDrawer" type="button">展签 ↑</button>' +
        '</div>' +

        '<div class="hint-pill" id="hintPill"><span class="spinner"></span><span>正在搭建…</span></div>' +

        '<div class="expand-bar">' +
          '<div class="eb-title"><span id="expandEdition"></span><b id="expandTitleName"></b></div>' +
          '<div class="expand-presets" id="expandPresets"></div>' +
          '<button class="eb-close" id="btnCollapse" type="button">合上 ←</button>' +
        '</div>' +
        '<div class="expand-hotspots" id="expandHotspots"></div>' +

        '<div class="book-toast" id="bookToast"></div>' +
      '</div>' +

      '<div class="paper-grain" aria-hidden="true"></div>' +

      '<section class="cover" id="cover">' +
        '<div class="cover-inner">' +
          '<span class="cover-seal" id="coverSeal">穗</span>' +
          '<h1 class="cover-title">把广州，<em>翻成立体的一页。</em></h1>' +
          '<p class="cover-sub">CANTON ATLAS · POP-UP MUSEUM</p>' +
          '<p class="cover-lede">十八件城市切片。从一朵纸上的墨色剪影开始，它会在你面前立起来。</p>' +
          '<div class="cover-demo" id="coverDemo"><img class="footprint-img" alt=""><canvas></canvas></div>' +
          '<button class="cover-open" id="coverOpen" type="button">翻开这本书</button>' +
          '<p class="cover-swipe">轻触任意处，先看它立起来</p>' +
        '</div>' +
      '</section>' +

      '<section class="toc" id="toc" aria-label="目录 · 剪影印谱">' +
        '<div class="toc-inner">' +
          '<div class="toc-head"><div><h2>剪影印谱</h2><small>十八件 · 按主题排列</small></div><button class="toc-close" id="tocClose" type="button">合上书页 →</button></div>' +
          '<div class="toc-themes" id="tocThemes"></div>' +
          '<div id="tocGroups"></div>' +
        '</div>' +
      '</section>' +

      '<aside class="drawer" id="drawer" aria-label="展签">' +
        '<div class="drawer-handle" id="drawerHandle"><span class="drawer-grip"></span><small>展签</small></div>' +
        '<div class="drawer-body">' +
          '<h2 id="drawerName"></h2><p class="en" id="drawerEn"></p>' +
          '<p class="drawer-sig" id="drawerSig"></p>' +
          '<div class="drawer-facts" id="drawerFacts"></div>' +
          '<div class="drawer-sec"><h3>看点</h3><ol id="drawerHighlights"></ol></div>' +
          '<div class="drawer-hs" id="drawerHotspots"></div>' +
          '<p class="drawer-note">风格化单体模型，比例、细节与史实以官方资料为准；不用于导航或测绘。</p>' +
        '</div>' +
      '</aside>' +

      '<section class="colophon" id="colophon" aria-label="尾页 · 我的印谱">' +
        '<div class="colophon-inner">' +
          '<h2>我的印谱</h2>' +
          '<p class="cp-lede">看过的展品在这里留下印记，只保存在这台设备上。</p>' +
          '<div class="cp-stats"><div><strong id="cpSeen">00</strong><span>已看</span></div><div><strong id="cpTotal">18</strong><span>共</span></div></div>' +
          '<div class="cp-list" id="cpList"></div>' +
          '<div class="cp-actions">' +
            '<button class="primary" id="cpContinue" type="button">继续看没看过的 →</button>' +
            '<button id="cpBackCover" type="button">回封面</button>' +
            '<button id="cpToc" type="button">看目录</button>' +
          '</div>' +
        '</div>' +
      '</section>';

    // dynamic bits
    var dots = $('shotDots');
    dots.innerHTML = '<button class="shot-dot" type="button" role="tab" data-n="0"></button><button class="shot-dot" type="button" role="tab" data-n="1"></button><button class="shot-dot" type="button" role="tab" data-n="2"></button>';
    Array.prototype.forEach.call(dots.children, function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); renderShot(entries[state.index].id, Number(b.dataset.n)); });
    });
  }

  function bindChrome() {
    $('pageToc').addEventListener('click', goToc);
    $('tocClose').addEventListener('click', function () { enterPage(state.index); });
    $('btnExpand').addEventListener('click', function () { expand(true); });
    $('btnDrawer').addEventListener('click', function () { setDrawerLevel(state.drawer === 'collapsed' ? 'half' : 'collapsed'); });
    $('btnCollapse').addEventListener('click', function () { expand(false); });
    $('cpContinue').addEventListener('click', function () {
      var nextSeen = state.seen;
      for (var i = 0; i < entries.length; i++) {
        var idx = (hashIndex(entries[0].id) + i) % entries.length;
        if (nextSeen.indexOf(entries[idx].id) < 0) { hideAll(); enterPage(idx); return; }
      }
      hideAll(); enterPage(0);
    });
    $('cpBackCover').addEventListener('click', goCover);
    $('cpToc').addEventListener('click', goToc);
    $('pageFooter').addEventListener('click', function (e) { if (e.target.closest('.shot-dots')) return; });
  }

  function boot() {
    if (!THREE || !catalog) {
      document.body.innerHTML = '<p style="padding:40px;font-family:serif">立体书加载失败：缺少运行库。</p>';
      return;
    }
    buildDom();
    tiers();
    canvas = $('bookCanvas');
    createStage();
    buildToc();
    buildCover();
    bindDrawer();
    bindChrome();
    bindPageGestures();
    bindGlobal();
    // sheets
    $('sheet').addEventListener('pointerdown', function (e) { if (e.target === this) return; });

    var deep = readURL();
    if (deep.view === 'page' || deep.open) {
      $('cover').classList.add('is-out');
      document.querySelector('.stage').classList.add('is-book');
      enterPage(deep.index).then(function () {
        if (deep.open) expand(true);
        else if (deep.shot) renderShot(entries[deep.index].id, deep.shot);
      });
    } else {
      // 封面在前，等用户翻开
      if (deep.view === 'toc') goToc();
      else if (deep.view === 'colophon') goColophon();
    }
    loop();
    window.__BOOK__ = { state: state, enterPage: enterPage, turnPage: turnPage, expand: expand, nextShot: nextShot };
    window.__BOOK_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
