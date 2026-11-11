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
  var FAV_KEY = 'canton-atlas-museum-favorites';   // 与 museum.js 共用同一份藏册
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

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
    shotsSeen: {},          // id -> [镜1, 镜2, 镜3] 是否依次看过
    restoring: false,       // 由 URL/浏览器返回恢复状态时不写历史、不盖章
    shareOpen: false,       // 分享卡弹层
    reduced: motionQuery.matches,
    tier: 'H'
  };

  // ------------------------------------------------ 进度 / 无障碍
  // 页面级与镜头级各用一个 live region：连续播报时不会互相覆盖
  function announce(text, shotLevel) {
    var el = $(shotLevel ? 'shotAnnounce' : 'bookAnnounce');
    if (el) el.textContent = text;
  }
  function setInert(el, on) {
    if (!el) return;
    if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
    else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
  }
  function focusEl(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }
  // 非当前视图既不可 Tab 聚焦，也不进入读屏树（含分享弹层/展开态）
  function syncA11y() {
    var sharing = state.shareOpen;
    var inPage = state.view === 'page' && !sharing;
    var visible = {
      cover: !sharing && state.view === 'cover',
      toc: !sharing && state.view === 'toc',
      colophon: !sharing && state.view === 'colophon',
      shareModal: sharing,
      pageHeader: inPage && !state.expanded,
      pageFooter: inPage && !state.expanded,
      tools: inPage && !state.expanded,
      drawer: inPage && !state.expanded,
      expandBar: inPage && state.expanded,
      expandHotspots: inPage && state.expanded
    };
    Object.keys(visible).forEach(function (id) { setInert($(id), !visible[id]); });
  }
  // 切换视图时先解除 inert、再移焦点、最后隐藏旧层：
  // 否则焦点仍停在即将被 aria-hidden 的元素上，Chrome 会拒绝并告警。
  function clearInert() {
    ['cover', 'toc', 'colophon', 'shareModal', 'pageHeader', 'pageFooter', 'tools', 'drawer', 'expandBar', 'expandHotspots']
      .forEach(function (id) { setInert($(id), false); });
  }
  function commitA11y(preferred) { clearInert(); focusView(preferred); syncA11y(); }
  var booted = false;   // 首次深链不抢焦点，只把非当前视图设为 inert
  function focusView(preferred) {
    if (!booted) return;
    if (state.shareOpen) { focusEl($('shareClose')); return; }
    if (state.view === 'cover') { focusEl($('coverOpen')); return; }
    if (state.view === 'toc') { focusEl($('tocTitle')); return; }
    if (state.view === 'colophon') { focusEl($('cpTitle')); return; }
    if (state.expanded) { focusEl($('btnCollapse')); return; }
    focusEl($(preferred || 'pageNumber'));
  }
  function announcePage() {
    var it = entries[state.index];
    announce('第 ' + it.no + ' 页，共 ' + TOTAL + ' 页。' + it.name + '。' + (it.themeLabel || '') + '。' + (it.lead || ''));
  }

  // 五个主题各自的「本卷看完」进度（不含「全部展品」）
  function themeProgress() {
    return (catalog.themeList || []).filter(function (t) { return t.id !== 'all'; }).map(function (t) {
      var list = entries.filter(function (e) { return e.theme === t.id; });
      var done = list.filter(function (e) { return state.seen.indexOf(e.id) >= 0; }).length;
      return { id: t.id, label: t.label, total: list.length, done: done, complete: list.length > 0 && done === list.length };
    });
  }
  function isFavorite(id) { return state.favorites.indexOf(id) >= 0; }

  // 目录与尾页的角标靠 class 切换，收藏后不整块重建（保留主题筛选状态）
  function refreshMarks() {
    Array.prototype.forEach.call($('tocGroups').querySelectorAll('.toc-card'), function (card) {
      var id = card.dataset.id;
      var seen = state.seen.indexOf(id) >= 0, fav = isFavorite(id);
      card.classList.toggle('is-seen', seen);
      card.classList.toggle('is-fav', fav);
      card.setAttribute('aria-label', (catalog.byId[id] || {}).name + '，' + (seen ? '已看' : '未看') + '，' + (fav ? '已收藏' : '未收藏'));
    });
    Array.prototype.forEach.call($('cpList').querySelectorAll('.cp-item'), function (node) {
      var id = node.dataset.id;
      node.classList.toggle('is-seen', state.seen.indexOf(id) >= 0);
      node.classList.toggle('is-fav', isFavorite(id));
    });
    var fv = $('cpFav');
    if (fv) fv.textContent = String(state.favorites.length).padStart(2, '0');
    var th = $('cpThemes');
    if (th) {
      var list = themeProgress();
      th.textContent = list.filter(function (t) { return t.complete; }).length + '/' + list.length;
    }
  }
  function updateFavoriteMark() {
    var btn = $('btnFavorite');
    if (!btn) return;
    var on = isFavorite(entries[state.index].id);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? '取消收藏本件展品' : '收藏本件展品');
    btn.textContent = on ? '已收藏 ✦' : '收藏 ✦';
  }
  function toggleFavorite() {
    var id = entries[state.index].id;
    var i = state.favorites.indexOf(id);
    if (i >= 0) state.favorites.splice(i, 1);
    else state.favorites.push(id);
    writeList(FAV_KEY, state.favorites);
    updateFavoriteMark();
    refreshMarks();
    var on = isFavorite(id);
    toast(on ? '已收进藏册' : '已从藏册移出');
    announce(on ? '已收藏' : '已取消收藏');
  }

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
      stage = window.StageCore.createStage(canvas, {
        alpha: true,
        maxPixelRatio: state.tier === 'H' ? 1.75 : 1.5,
        viewScale: 1.35
      });
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
    state.expanded = false;
    state.pageState = 'loading';
    var myToken = ++pageToken;

    renderPageChrome(id);
    updateFavoriteMark();
    // 减少动态：新页先让画布透明，模型就绪后与剪影做 200ms 交叉淡化
    if (state.reduced && canvas) { canvas.style.transition = 'none'; canvas.style.opacity = '0'; }
    syncURL(opts.push === true);
    if (!state.restoring) document.querySelector('.stage').classList.remove('is-expanded');
    commitA11y();
    announcePage();

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
  /* 减少动态：不做剖切/翻页/倾斜，只让模型与剪影在 200ms 内交叉淡化 */
  function crossfadeRise() {
    var cv = canvas, fp = $('footprint');
    fp.classList.remove('is-flat');
    fp.classList.add('is-on');
    cv.style.transition = 'none';
    cv.style.opacity = '0';
    void cv.offsetWidth;
    cv.style.transition = 'opacity .2s linear';
    cv.style.opacity = '1';
    setTimeout(function () { cv.style.transition = ''; cv.style.opacity = ''; }, 220);
  }

  /* rise: 剖切平面 0→1；顺带把前沿线动画化 */
  function riseIntoView(token) {
    if (!stage) { state.pageState = 'shot'; return; }
    if (state.reduced) {
      stage.rise(1);
      crossfadeRise();
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
        $('footprint').classList.remove('is-flat');
        $('footprint').classList.add('is-on');
        setTimeout(function () {
          toast(state.expanded ? '拖动旋转 · 双指缩放' : '左右滑动翻页');
        }, 200);
      }
    });
  }

  function foldThen(next) {
    var id = entries[state.index].id;
    var myToken = ++pageToken;
    state.pageState = 'folding';
    if (!state.reduced) {
      $('footprint').classList.remove('is-on');
      $('footprint').classList.add('is-flat');   // 模型合回纸面剪影
    }
    if (!stage || state.reduced) { next(); return; }
    tween({
      ms: FOLD_MS, token: 'fold',
      onUpdate: function (v) { stage.rise(1 - v); },
      onDone: function () { if (myToken === pageToken) next(); }
    });
  }

  function fallback(id, msg) {
    state.tier = 'L';
    if (canvas) { canvas.style.transition = ''; canvas.style.opacity = ''; }
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
  function renderShot(id, n, skipURL) {
    var item = catalog.byId[id];
    var shots = item.shots || [];
    var s = shots[n];
    state.shot = n;
    var txt = $('shotText');
    txt.classList.add('is-out');
    setTimeout(function () {
      txt.textContent = s ? s.text : '';
      txt.classList.remove('is-out');
    }, state.reduced ? 0 : 150);
    if (s) announce('第 ' + (n + 1) + ' 镜，共 3 镜。' + s.text, true);

    // dots
    var dots = $('shotDots').children;
    for (var k = 0; k < dots.length; k++) {
      dots[k].className = 'shot-dot' + (k === n ? ' is-active' : (k < n ? ' is-done' : ''));
      dots[k].setAttribute('aria-label', '第 ' + (k + 1) + ' 镜' + (s ? '：' + s.text : ''));
      if (k === n) dots[k].setAttribute('aria-current', 'true');
      else dots[k].removeAttribute('aria-current');
    }

    if (s && stage) {
      // 正常态走球面插值运镜；减少动态时瞬时到位，不做相机运动
      stage.setPreset(s.preset, state.reduced);
      if (!skipURL) syncURL();
    }

    // 页面加载出的第一镜总是算看过；深链/返回直接跳到后两镜时不补看、不盖章
    if (!(state.restoring && n > 0)) noteShot(id, n);
  }

  function noteShot(id, n) {
    var rec = state.shotsSeen[id] || (state.shotsSeen[id] = [false, false, false]);
    rec[n] = true;
    if (rec[0] && rec[1] && rec[2]) markSeen(id);
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
        enterPage(target, { push: true });
        turning = false;
      });
    });
  }

  function flipSheet(dir, done) {
    var sheet = $('sheet');
    if (state.reduced) {
      // 200ms 交叉淡化：纸页淡出 → 换页 → 纸页淡入，不做 3D 翻转与倾斜
      sheet.style.transition = 'opacity .2s linear';
      sheet.style.opacity = '0';
      setTimeout(function () {
        done();
        sheet.style.opacity = '1';
        setTimeout(function () { sheet.style.transition = ''; sheet.style.opacity = ''; }, 220);
      }, 200);
      return;
    }
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

  // ------------------------------------------------ 手势
  var ptr = { down: false, x: 0, y: 0, sx: 0, sy: 0, t: 0, lock: null, id: 0, tilt: 0 };
  // 展开态：单指旋转、双指缩放（Pointer Events 统一，避免与系统缩放冲突）
  var expandPointers = new Map();
  var pinch = { dist: 0 };
  function bindPageGestures() {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('wheel', function (e) {
      if (!state.expanded || !stage) return;
      e.preventDefault();
      stage.zoom(e.deltaY > 0 ? 1.08 : 0.92);
    }, { passive: false });
  }
  function pointerDistance() {
    var a = Array.from(expandPointers.values());
    return a.length < 2 ? 0 : Math.sqrt(Math.pow(a[0].x - a[1].x, 2) + Math.pow(a[0].y - a[1].y, 2));
  }
  function onDown(e) {
    if (state.expanded) {
      expandPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (expandPointers.size === 2) pinch.dist = pointerDistance();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    ptr.down = true;
    ptr.lock = null;
    ptr.x = ptr.sx = e.clientX;
    ptr.y = ptr.sy = e.clientY;
    ptr.t = performance.now();
    ptr.id = e.pointerId;
  }
  function onMove(e) {
    if (state.expanded) {
      var prev = expandPointers.get(e.pointerId);
      if (!prev || !stage) return;
      if (expandPointers.size >= 2) {
        expandPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        var d = pointerDistance();
        if (pinch.dist > 0 && d > 0) stage.zoom(pinch.dist / d);
        pinch.dist = d;
      } else {
        stage.orbit(-(e.clientX - prev.x) * 0.006, -(e.clientY - prev.y) * 0.004);
        expandPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      }
      return;
    }
    if (!ptr.down) return;
    var dx = e.clientX - ptr.sx;
    var dy = e.clientY - ptr.sy;
    if (!ptr.lock) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) ptr.lock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      return;
    }
    if (ptr.lock === 'x') {
      if (state.reduced) return;   // 减少动态：不倾斜、不跟手
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
    if (state.expanded) {
      expandPointers.delete(e.pointerId);
      if (expandPointers.size < 2) pinch.dist = 0;
      try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    if (!ptr.down) return;
    ptr.down = false;
    if (ptr.lock === 'x') {
      var dx = e.clientX - ptr.sx;
      var dt = Math.max(1, performance.now() - ptr.t);
      var v = dx / dt;
      var w = window.innerWidth;
      var sheet = $('sheet');
      if (!state.reduced) sheet.style.transition = 'transform ' + TURN_MS + 'ms var(--ease-out)';
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
    expandPointers.clear();
    pinch.dist = 0;
    if (state.expanded) {
      stage.resetTilt();
      stage.rise(1);           // 打断中的立起动画也要保证模型完整
      buildExpandUI();
      syncURL(true);
      commitA11y();
      if (!state.restoring) toast('拖动旋转 · 双指缩放');
    } else {
      stage.setPreset('overview', true);
      renderShot(entries[state.index].id, 0, true);
      syncURL(true);
      commitA11y('btnExpand');
    }
  }

  function buildExpandUI() {
    var item = entries[state.index];
    var bar = $('expandPresets');
    var names = stage.getPresets();
    // 展开是自由展柜：给该件数据卡声明的全部语义机位，而不只三镜用到的三个
    var spot = (hsCache && hsCache.id === item.id && hsCache.spot) || window.SPOT_DATA;
    var list = ((spot && spot.presets) || []).filter(function (n) { return names[n]; });
    if (!list.length) list = Object.keys(names).slice(0, 6);
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
      var open = lv !== 'collapsed' ? 'true' : 'false';
      handle.setAttribute('aria-expanded', open);
      $('btnDrawer').setAttribute('aria-expanded', open);
    }
    setDrawerLevel = setLevel;
    setLevel('collapsed');
    handle.addEventListener('click', function () { if (!dragging) setLevel(cur === 'collapsed' ? 'half' : cur === 'half' ? 'full' : 'collapsed'); });
    handle.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault(); e.stopPropagation();
      setLevel(cur === 'collapsed' ? 'half' : cur === 'half' ? 'full' : 'collapsed');
    });
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
    $('footprint').classList.add('is-flat');
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
    var before = themeProgress();
    state.seen.push(id);
    writeList(SEEN_KEY, state.seen);
    var el = $('pageSeen');
    el.classList.add('is-on');
    // 无用户手势时调用 vibrate 会被浏览器拒绝并在控制台报错
    if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.isActive)) {
      try { navigator.vibrate(12); } catch (e) {}
    }
    var item = catalog.byId[id];
    if (item) updateSeenMark(item);
    refreshMarks();
    announce('已看完三镜，落下一枚朱印');
    // 主题完成章：恰好在这一件看完时整组集齐才提示
    var after = themeProgress();
    after.forEach(function (t, i) {
      if (t.complete && !before[i].complete && item && item.theme === t.id) {
        toast('「' + t.label + '」本卷看完，尾页已落章');
        announce('主题「' + t.label + '」本卷看完');
      }
    });
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
  function syncURL(push) {
    if (state.restoring) return;   // 恢复路由时不改写历史，也不覆盖用户原始链接
    var id = entries[state.index].id;
    var p = new URLSearchParams();
    p.set('p', id);
    if (state.expanded) p.set('open', '1');
    if (state.shot > 0 && !state.expanded) p.set('shot', String(state.shot + 1));
    if (state.view === 'toc' && !state.expanded) p.set('v', 'toc');
    if (state.view === 'cover' && !state.expanded) p.set('v', 'cover');
    if (state.view === 'colophon') p.set('v', 'end');
    var url = location.pathname + '?' + p.toString();
    history[push === true ? 'pushState' : 'replaceState'](null, '', url);
  }

  function readURL() {
    var p = new URLSearchParams(location.search);
    var v = p.get('v');
    if (v === 'end') v = 'colophon';   // 尾页 URL 与内部视图名对齐
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
  function openBookChrome() {
    $('cover').classList.add('is-out');
    document.querySelector('.stage').classList.add('is-book');
  }
  function goCover() {
    state.view = 'cover'; state.expanded = false;
    $('cover').classList.remove('is-out');
    document.querySelector('.stage').classList.remove('is-book', 'is-expanded');
    hideAll(); syncURL(true); commitA11y();
    announce('封面 · 把广州翻成立体的一页');
  }
  function goToc() {
    state.view = 'toc'; state.expanded = false;
    hideAll(); openBookChrome();
    document.querySelector('.stage').classList.remove('is-expanded');
    $('toc').classList.add('is-on'); syncURL(true); commitA11y();
    announce('剪影印谱，十八件展品，已看 ' + state.seen.length + ' 件');
  }
  function goColophon() {
    state.view = 'colophon'; state.expanded = false;
    hideAll(); openBookChrome();
    document.querySelector('.stage').classList.remove('is-expanded');
    buildColophon(); $('colophon').classList.add('is-on'); syncURL(true); commitA11y();
    var done = themeProgress().filter(function (t) { return t.complete; }).length;
    announce('尾页 · 我的印谱。已看 ' + state.seen.length + ' 件，共 ' + TOTAL + ' 件，完成 ' + done + ' 个主题');
  }
  function hideAll() { $('toc').classList.remove('is-on'); $('colophon').classList.remove('is-on'); }

  // 从 URL 或浏览器前进/返回恢复视图；恢复过程中不写历史、不盖已看章
  function applyRoute() {
    if (state.shareOpen) closeShare();   // 浏览器返回时先收起弹层
    var deep = readURL();
    state.restoring = true;
    if (deep.view === 'cover') { goCover(); state.restoring = false; return; }
    if (deep.view === 'toc') { goToc(); state.restoring = false; return; }
    if (deep.view === 'colophon') { goColophon(); state.restoring = false; return; }

    openBookChrome();
    if (state.view === 'page' && state.index === deep.index) {
      if (deep.open !== state.expanded) expand(deep.open);
      if (!deep.open && deep.shot !== state.shot) renderShot(entries[deep.index].id, deep.shot);
      state.restoring = false;
      return;
    }
    enterPage(deep.index).then(function () {
      if (deep.open) expand(true);
      else if (deep.shot) renderShot(entries[deep.index].id, deep.shot);
      state.restoring = false;
    });
  }

  // ------------------------------------------------ 封面
  function buildCover() {
    var seal = $('coverSeal');
    var demo = $('coverDemo');
    // 方案 3.1：封面当期主展品为广州塔，剪影先平躺在纸上
    var coverItem = catalog.byId['canton-tower'] || entries[0];
    demo.querySelector('.footprint-img').src = coverItem.silhouettePersp;
    demo.querySelector('.cover-model').src = coverItem.coverClean;
    var coverId = coverItem.id;
    var did = false, coverRenderer = null, coverScene = null, coverCam = null, coverBox = null, coverPlane = null;

    function demoRise() {
      if (did) return;
      did = true;
      // 减少动态：直接给静态干净封面（不创建第二个 WebGL、不跑立起动画）
      if (state.reduced) {
        demo.classList.add('is-risen', 'is-static');
        window.__COVER_RISEN__ = true;
        return;
      }
      demo.classList.add('is-rising');
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

        // 与 stage-core 同口径：-Y 法线 + constant = height，保留 y <= height，自下而上显现
        coverPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), coverBox.min.y);
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
            coverPlane.constant = coverBox.min.y + v * size.y;
            coverRenderer.render(coverScene, coverCam);
          },
          onDone: function () { demo.classList.add('is-risen'); window.__COVER_RISEN__ = true; }
        });
      }).catch(function (e) {
        window.__COVER_ERROR__ = e.message;
        demo.classList.add('is-risen');   // 失败也显示剪影，至少封面完整
      });
    }

    $('cover').addEventListener('pointerdown', demoRise, { once: true });
    seal.addEventListener('click', demoRise);
    // 打开按钮：先跑一次演示（若还没跑），再翻开到扉页 · 剪影印谱
    $('coverOpen').addEventListener('click', function () {
      demoRise();
      var wait = state.reduced ? 60 : 1150;
      setTimeout(function () {
        goToc();
      }, wait);
    });
    // 减少动态：不做立起动画，墨色剪影保持可见即可
  }

  // ------------------------------------------------ 尾页 · 我的印谱
  function buildColophon() {
    $('cpSeen').textContent = String(state.seen.length).padStart(2, '0');
    $('cpTotal').textContent = String(TOTAL);
    var themes = themeProgress();
    $('cpThemes').textContent = themes.filter(function (t) { return t.complete; }).length + '/' + themes.length;
    // 主题完成章：一组全部已看才落「完」，否则只显示进度
    $('cpThemeList').innerHTML = themes.map(function (t) {
      return '<div class="cp-theme' + (t.complete ? ' is-done' : '') + '">' +
        '<span class="cp-theme-seal" aria-hidden="true">' + (t.complete ? '完' : t.done + '/' + t.total) + '</span>' +
        '<div><b>' + escapeHtml(t.label) + '</b><small>' + (t.complete ? '本卷看完' : '已看 ' + t.done + ' / ' + t.total) + '</small></div></div>';
    }).join('');
    $('cpList').innerHTML = entries.map(function (it) {
      return '<div class="cp-item" data-id="' + it.id + '" title="' + escapeHtml(it.name) + '">' +
        '<div class="cp-sil"><img src="' + it.silhouetteOrtho + '" alt="" aria-hidden="true">' +
        '<span class="cp-stamp" aria-hidden="true">看</span><span class="cp-fav" aria-hidden="true">✦</span></div>' +
        '<small>' + escapeHtml(it.name) + '</small></div>';
    }).join('');
    refreshMarks();
  }

  // ------------------------------------------------ 分享卡（纯 Canvas 2D，零依赖）
  var shareBlob = null, shareFocusReturn = null, shareDrawing = false;

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };   // 单张缺失不让整张卡失败
      img.src = src;
    });
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function centeredImage(ctx, img, x, y, w, h) {
    if (!img) return;
    var k = Math.min(w / img.width, h / img.height);
    var dw = img.width * k, dh = img.height * k;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }
  // 展品名不截断：按格宽自动缩字号（15px → 10px）
  function fitFont(ctx, text, maxW, serif, from, to) {
    var size = from;
    while (size > to) {
      ctx.font = size + 'px ' + serif;
      if (ctx.measureText(text).width <= maxW) break;
      size -= 1;
    }
    return size;
  }
  function shareURL() {
    return location.origin + location.pathname + '?v=end';
  }

  async function drawShareCard() {
    var cv = $('shareCanvas');
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height, M = 72;
    var serif = '"Songti SC", "SimSun", "Noto Serif SC", serif';
    var sans = '"PingFang SC", "Microsoft YaHei", system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#f1ebdf';
    ctx.fillRect(0, 0, W, H);
    // 纸纹与边框
    ctx.strokeStyle = 'rgba(34,36,30,.055)'; ctx.lineWidth = 1;
    for (var y = 40; y < H; y += 26) { ctx.beginPath(); ctx.moveTo(M, y); ctx.lineTo(W - M, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(34,36,30,.22)'; ctx.lineWidth = 2;
    ctx.strokeRect(28, 28, W - 56, H - 56);
    ctx.fillStyle = '#172720'; ctx.fillRect(0, 0, W, 14);

    // 书名 + 朱印
    roundRect(ctx, M, 86, 92, 92, 6); ctx.fillStyle = '#b5432f'; ctx.fill();
    ctx.fillStyle = '#fff9ef'; ctx.font = '68px ' + serif; ctx.textAlign = 'center';
    ctx.fillText('穗', M + 46, 158);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#22241e'; ctx.font = '50px ' + serif;
    ctx.fillText('广州立体志', M + 124, 140);
    ctx.fillStyle = '#55554d'; ctx.font = '22px ' + sans;
    ctx.fillText('翻开，立起来 · 我的印谱', M + 126, 186);
    ctx.fillStyle = '#8a8478'; ctx.font = '16px ' + sans; ctx.textAlign = 'right';
    ctx.fillText('CANTON ATLAS', W - M, 140);
    ctx.fillText('18 LANDMARKS', W - M, 170);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(34,36,30,.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(M, 226); ctx.lineTo(W - M, 226); ctx.stroke();

    // 统计
    var themes = themeProgress();
    var doneThemes = themes.filter(function (t) { return t.complete; }).length;
    var stats = [
      [String(state.seen.length).padStart(2, '0') + ' / ' + TOTAL, '已看'],
      [String(state.favorites.length).padStart(2, '0'), '收藏'],
      [doneThemes + ' / ' + themes.length, '本卷看完'],
      [String(TOTAL), '件展品']
    ];
    var colW = (W - M * 2) / 4;
    stats.forEach(function (s, i) {
      var x = M + i * colW;
      ctx.fillStyle = '#b5432f'; ctx.font = '42px ' + serif;
      ctx.fillText(s[0], x, 292);
      ctx.fillStyle = '#8a8478'; ctx.font = '16px ' + sans;
      ctx.fillText(s[1], x, 324);
    });

    // 五个主题完成章
    ctx.fillStyle = '#22241e'; ctx.font = '20px ' + serif;
    ctx.fillText('本卷看完 · 五卷', M, 382);
    var chipW = 180, chipGap = 9;
    themes.forEach(function (t, i) {
      var x = M + i * (chipW + chipGap), y = 404;
      roundRect(ctx, x, y, chipW, 74, 6);
      ctx.fillStyle = t.complete ? 'rgba(181,67,47,.1)' : 'rgba(34,36,30,.045)'; ctx.fill();
      roundRect(ctx, x + 14, y + 20, 34, 34, 4);
      if (t.complete) { ctx.fillStyle = '#b5432f'; ctx.fill(); }
      else { ctx.strokeStyle = 'rgba(34,36,30,.25)'; ctx.lineWidth = 1; ctx.stroke(); }
      ctx.fillStyle = t.complete ? '#fff9ef' : '#8a8478';
      ctx.font = (t.complete ? '19px ' : '13px ') + serif; ctx.textAlign = 'center';
      ctx.fillText(t.complete ? '完' : t.done + '/' + t.total, x + 31, y + 44);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#22241e'; ctx.font = '17px ' + serif;
      ctx.fillText(t.label, x + 58, y + 34);
      ctx.fillStyle = '#8a8478'; ctx.font = '13px ' + sans;
      ctx.fillText(t.complete ? '已落朱印' : '已看 ' + t.done + ' / ' + t.total, x + 58, y + 56);
    });

    // 18 枚剪影印谱
    ctx.fillStyle = '#22241e'; ctx.font = '20px ' + serif;
    ctx.fillText('十八件 · 剪影印谱', M, 528);
    ctx.fillStyle = '#8a8478'; ctx.font = '14px ' + sans; ctx.textAlign = 'right';
    ctx.fillText('朱印 = 已看  ·  ✦ = 收藏', W - M, 528);
    ctx.textAlign = 'left';
    var imgs = await Promise.all(entries.map(function (it) { return loadImage(it.silhouetteOrtho); }));
    var cellW = (W - M * 2) / 6, cellH = 172;
    entries.forEach(function (it, i) {
      var col = i % 6, row = Math.floor(i / 6);
      var x = M + col * cellW, y = 546 + row * cellH;
      var seen = state.seen.indexOf(it.id) >= 0, fav = isFavorite(it.id);
      roundRect(ctx, x + 3, y, cellW - 6, cellH - 10, 6);
      ctx.fillStyle = seen ? '#e6ddcc' : '#ece5d8'; ctx.fill();
      ctx.globalAlpha = seen ? 1 : .28;   // 未看也保留可辨认的墨色轮廓
      centeredImage(ctx, imgs[i], x + 16, y + 10, cellW - 32, 116);
      ctx.globalAlpha = 1;
      ctx.fillStyle = seen ? '#22241e' : '#8a8478';
      fitFont(ctx, it.name, cellW - 14, serif, 15, 10);
      ctx.textAlign = 'center';
      ctx.fillText(it.name, x + cellW / 2, y + 148);
      ctx.textAlign = 'left';
      if (seen) {
        roundRect(ctx, x + cellW - 34, y + 8, 22, 22, 3);
        ctx.fillStyle = '#b5432f'; ctx.fill();
        ctx.fillStyle = '#fff9ef'; ctx.font = '14px ' + serif; ctx.textAlign = 'center';
        ctx.fillText('看', x + cellW - 23, y + 24); ctx.textAlign = 'left';
      }
      if (fav) {
        ctx.fillStyle = '#b5432f'; ctx.font = '17px ' + sans;
        ctx.fillText('✦', x + 12, y + 24);
      }
    });

    // 落款
    ctx.strokeStyle = 'rgba(34,36,30,.2)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(M, 1092); ctx.lineTo(W - M, 1092); ctx.stroke();
    ctx.fillStyle = '#22241e'; ctx.font = '23px ' + serif;
    ctx.fillText('看过的展品在这里留下印记，', M, 1150);
    ctx.fillText('只保存在这台设备上。', M, 1188);
    ctx.fillStyle = '#8a8478'; ctx.font = '15px ' + sans;
    ctx.fillText('风格化示意 · 非测绘 · 不用于导航', M, 1234);
    roundRect(ctx, W - M - 116, 1120, 116, 116, 8);
    ctx.strokeStyle = 'rgba(181,67,47,.75)'; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#b5432f'; ctx.font = '78px ' + serif; ctx.textAlign = 'center';
    ctx.fillText('穗', W - M - 58, 1210);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8a8478'; ctx.font = '15px ' + sans; ctx.textAlign = 'center';
    ctx.fillText('CANTON ATLAS · POP-UP MUSEUM', W / 2, 1330);
    var host = /(^|\.)(localhost|127\.0\.0\.1)$/i.test(location.hostname) ? '把广州，翻成立体的一页。' : shareURL();
    ctx.fillText(host, W / 2, 1362);
    ctx.textAlign = 'left';

    shareBlob = await new Promise(function (resolve) { cv.toBlob(resolve, 'image/png'); });
    return shareBlob;
  }

  function openShare() {
    if (state.shareOpen) return;
    state.shareOpen = true;
    shareFocusReturn = document.activeElement;
    shareBlob = null;
    $('shareModal').hidden = false;
    commitA11y();
    announce('正在生成分享卡');
    shareDrawing = true;
    drawShareCard().then(function (blob) {
      shareDrawing = false;
      toast(blob ? '分享卡已生成' : '分享卡生成失败，请重试');
      announce(blob ? '分享卡已生成，可保存图片或系统分享' : '分享卡生成失败');
    }).catch(function () {
      shareDrawing = false;
      toast('分享卡生成失败，请重试');
    });
  }
  function closeShare() {
    if (!state.shareOpen) return;
    state.shareOpen = false;
    $('shareModal').hidden = true;
    clearInert();
    focusEl(shareFocusReturn || $('cpShare'));
    syncA11y();
    announce('已关闭分享卡');
  }
  function saveShare() {
    if (!shareBlob) { toast(shareDrawing ? '还在绘制分享卡…' : '分享卡尚未生成'); return; }
    var url = URL.createObjectURL(shareBlob);
    var a = document.createElement('a');
    a.href = url; a.download = '广州立体志-我的印谱.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('已保存图片');
  }
  function systemShare() {
    if (!shareBlob) { toast('还在绘制分享卡…'); return; }
    var file = new File([shareBlob], '广州立体志-我的印谱.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({
        files: [file], title: '广州立体志 · 我的印谱',
        text: '我在《广州立体志》看完了 ' + state.seen.length + ' / ' + TOTAL + ' 件广州地标。'
      }).catch(function () {});   // 用户取消不算错误
    } else {
      toast('此浏览器不支持系统分享，可先保存图片');
    }
  }
  function copyShareLink() {
    var url = shareURL();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('链接已复制'); })
        .catch(function () { toast('复制失败，请手动复制地址栏链接'); });
    } else {
      toast('此浏览器不支持复制，请手动复制地址栏链接');
    }
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
        card.classList.toggle('is-seen', state.seen.indexOf(it.id) >= 0);
        card.classList.toggle('is-fav', isFavorite(it.id));
        card.innerHTML =
          '<div class="silhouette"><span class="no">' + it.no + '</span>' +
          '<span class="stamp" aria-hidden="true">看</span>' +
          '<span class="fav" aria-hidden="true">✦</span>' +
          '<img src="' + it.silhouetteOrtho + '" alt="" aria-hidden="true"></div>' +
          '<div><span class="name">' + escapeHtml(it.name) + '</span><span class="sub">' + escapeHtml(it.en || '') + '</span></div>';
        card.addEventListener('click', function () {
          hideAll();
          enterPage(hashIndex(it.id), { push: true });
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
    refreshMarks();
  }

  // ------------------------------------------------ 键盘 / 窗口
  function bindGlobal() {
    window.addEventListener('keydown', function (e) {
      // 分享弹层：Escape 关闭 + Tab 焦点陷阱
      if (state.shareOpen) {
        if (e.key === 'Escape') { e.preventDefault(); closeShare(); return; }
        if (e.key === 'Tab') {
          var f = Array.prototype.slice.call($('shareModal').querySelectorAll('button:not([disabled])'));
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); focusEl(last); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); focusEl(first); }
        }
        return;
      }
      if (e.key === 'Escape') {
        if (state.expanded) { e.preventDefault(); expand(false); }
        else if (state.view === 'page') { e.preventDefault(); goToc(); }
        else if (state.view === 'toc' || state.view === 'colophon') { e.preventDefault(); goCover(); }
        return;
      }
      // Home / End 在目录、展品页、尾页都可用，方便键盘直达两端
      if (e.key === 'Home' && state.view !== 'cover') { e.preventDefault(); goToc(); return; }
      if (e.key === 'End' && state.view !== 'cover') { e.preventDefault(); goColophon(); return; }
      if (state.view !== 'page') return;
      var onControl = e.target && e.target.closest && e.target.closest('button, a, input, select, textarea');
      switch (e.key) {
        // 方案 5：键盘 ←/→ 翻页，↑/↓ 推进镜头
        case 'ArrowLeft': case 'PageUp': e.preventDefault(); turnPage(-1); break;
        case 'ArrowRight': case 'PageDown': e.preventDefault(); turnPage(1); break;
        case 'ArrowUp': e.preventDefault(); prevShot(); break;
        case 'ArrowDown': e.preventDefault(); nextShot(); break;
        case ' ': case 'Enter':
          if (onControl) return;   // 按钮自己响应，不抢空格/回车
          e.preventDefault(); nextShot(); break;
        case 'f': case 'F': e.preventDefault(); toggleFavorite(); break;
        default: break;
      }
    });
    window.addEventListener('resize', function () { if (stage) stage.resize(); });
    window.addEventListener('pagehide', function () { if (stage) stage.dispose(); });
    window.addEventListener('popstate', applyRoute);
    // 用户中途改系统「减少动态」偏好时即时生效，无需刷新
    var onMotion = function (ev) {
      state.reduced = !!ev.matches;
      document.documentElement.classList.toggle('reduce-motion', state.reduced);
    };
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
    else if (motionQuery.addListener) motionQuery.addListener(onMotion);
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
          '<span class="page-number" id="pageNumber" tabindex="-1"></span>' +
          '<span class="page-theme" id="pageTheme"></span>' +
          '<button class="page-toc" id="pageToc" type="button">目录</button>' +
        '</header>' +

        '<footer class="page-footer" id="pageFooter">' +
          '<div class="shots">' +
            '<div class="shot-dots" id="shotDots" role="group" aria-label="三镜导览"></div>' +
            '<span class="shot-text" id="shotText"></span>' +
          '</div>' +
          '<p class="page-lead" id="pageLead"></p>' +
          '<p class="page-foot-note">风格化示意 · 非测绘 · <span id="pageSeen" class="page-seen" title="已看">看</span></p>' +
        '</footer>' +

        '<div class="tools" id="tools">' +
          '<button class="tool-btn page-only" id="btnExpand" type="button">走近看</button>' +
          '<button class="tool-btn page-only" id="btnFavorite" type="button" aria-pressed="false" aria-label="收藏本件展品">收藏 ✦</button>' +
          '<button class="tool-btn page-only" id="btnDrawer" type="button">展签 ↑</button>' +
        '</div>' +

        '<div class="hint-pill" id="hintPill"><span class="spinner"></span><span>正在搭建…</span></div>' +

        '<div class="expand-bar" id="expandBar">' +
          '<div class="eb-title"><span id="expandEdition"></span><b id="expandTitleName"></b></div>' +
          '<div class="expand-presets" id="expandPresets"></div>' +
          '<button class="eb-close" id="btnCollapse" type="button">合上 ←</button>' +
        '</div>' +
        '<div class="expand-hotspots" id="expandHotspots"></div>' +

        '<div class="book-toast" id="bookToast"></div>' +
      '</div>' +

      '<div class="paper-grain" aria-hidden="true"></div>' +
      '<p class="sr-only" id="bookAnnounce" role="status" aria-live="polite"></p>' +
      '<p class="sr-only" id="shotAnnounce" aria-live="polite"></p>' +

      '<section class="cover" id="cover">' +
        '<div class="cover-inner">' +
          '<span class="cover-seal" id="coverSeal">穗</span>' +
          '<h1 class="cover-title">把广州，<em>翻成立体的一页。</em></h1>' +
          '<p class="cover-sub">CANTON ATLAS · POP-UP MUSEUM</p>' +
          '<p class="cover-lede">十八件城市切片。从一朵纸上的墨色剪影开始，它会在你面前立起来。</p>' +
          '<div class="cover-demo" id="coverDemo"><img class="footprint-img" alt=""><img class="cover-model" alt="" aria-hidden="true"><canvas></canvas></div>' +
          '<button class="cover-open" id="coverOpen" type="button">翻开这本书</button>' +
          '<p class="cover-swipe">轻触任意处，先看它立起来</p>' +
        '</div>' +
      '</section>' +

      '<section class="toc" id="toc" aria-label="目录 · 剪影印谱">' +
        '<div class="toc-inner">' +
          '<div class="toc-head"><div><h2 id="tocTitle" tabindex="-1">剪影印谱</h2><small>十八件 · 按主题排列</small></div><button class="toc-close" id="tocClose" type="button">合上书页 →</button></div>' +
          '<div class="toc-themes" id="tocThemes"></div>' +
          '<div id="tocGroups"></div>' +
        '</div>' +
      '</section>' +

      '<aside class="drawer" id="drawer" aria-label="展签">' +
        '<div class="drawer-handle" id="drawerHandle" role="button" tabindex="0" aria-label="展签，按回车展开或收起" aria-expanded="false"><span class="drawer-grip"></span><small>展签</small></div>' +
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
          '<h2 id="cpTitle" tabindex="-1">我的印谱</h2>' +
          '<p class="cp-lede">看过的展品在这里留下印记，只保存在这台设备上。</p>' +
          '<div class="cp-stats">' +
            '<div><strong id="cpSeen">00</strong><span>已看</span></div>' +
            '<div><strong id="cpTotal">18</strong><span>共</span></div>' +
            '<div><strong id="cpFav">00</strong><span>收藏</span></div>' +
            '<div><strong id="cpThemes">0/5</strong><span>本卷看完</span></div>' +
          '</div>' +
          '<h3 class="cp-sec-title">本卷看完</h3>' +
          '<div class="cp-themes" id="cpThemeList"></div>' +
          '<h3 class="cp-sec-title">十八件 · 剪影印谱</h3>' +
          '<div class="cp-list" id="cpList"></div>' +
          '<div class="cp-actions">' +
            '<button class="primary" id="cpContinue" type="button">继续看没看过的 →</button>' +
            '<button class="share" id="cpShare" type="button">生成分享卡 ↗</button>' +
            '<button id="cpBackCover" type="button">回封面</button>' +
            '<button id="cpToc" type="button">看目录</button>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<div class="share-modal" id="shareModal" role="dialog" aria-modal="true" aria-labelledby="shareTitle" hidden>' +
        '<div class="share-backdrop" id="shareBackdrop"></div>' +
        '<div class="share-panel">' +
          '<div class="share-head"><h2 id="shareTitle" tabindex="-1">我的印谱 · 分享卡</h2><button id="shareClose" type="button" aria-label="关闭分享卡">关闭 ✕</button></div>' +
          '<div class="share-preview"><canvas id="shareCanvas" width="1080" height="1440" role="img" aria-label="印谱分享卡预览"></canvas></div>' +
          '<div class="share-actions">' +
            '<button class="primary" id="shareSave" type="button">保存图片 ↓</button>' +
            '<button id="shareSystem" type="button">系统分享 ↗</button>' +
            '<button id="shareCopy" type="button">复制链接</button>' +
          '</div>' +
          '<p class="share-note">卡片只记录当前进度，不含个人数据；印章只保存在这台设备上。</p>' +
        '</div>' +
      '</div>';

    // dynamic bits
    var dots = $('shotDots');
    dots.innerHTML = '<button class="shot-dot" type="button" data-n="0" aria-label="第 1 镜"></button><button class="shot-dot" type="button" data-n="1" aria-label="第 2 镜"></button><button class="shot-dot" type="button" data-n="2" aria-label="第 3 镜"></button>';
    Array.prototype.forEach.call(dots.children, function (b) {
      b.addEventListener('click', function (e) { e.stopPropagation(); renderShot(entries[state.index].id, Number(b.dataset.n)); });
    });
  }

  function bindChrome() {
    $('pageToc').addEventListener('click', goToc);
    $('tocClose').addEventListener('click', function () { enterPage(state.index, { push: true }); });
    $('btnExpand').addEventListener('click', function () { expand(true); });
    $('btnFavorite').addEventListener('click', toggleFavorite);
    $('btnDrawer').addEventListener('click', function () { setDrawerLevel(state.drawer === 'collapsed' ? 'half' : 'collapsed'); });
    $('btnCollapse').addEventListener('click', function () { expand(false); });
    $('cpContinue').addEventListener('click', function () {
      var nextSeen = state.seen;
      for (var i = 0; i < entries.length; i++) {
        var idx = (hashIndex(entries[0].id) + i) % entries.length;
        if (nextSeen.indexOf(entries[idx].id) < 0) { hideAll(); enterPage(idx, { push: true }); return; }
      }
      hideAll(); enterPage(0, { push: true });
    });
    $('cpBackCover').addEventListener('click', goCover);
    $('cpToc').addEventListener('click', goToc);
    $('cpShare').addEventListener('click', openShare);
    // 尾页任一枚剪影可直接翻回该页
    $('cpList').addEventListener('click', function (e) {
      var node = e.target.closest('.cp-item');
      if (!node) return;
      var i = hashIndex(node.dataset.id);
      if (i >= 0) { hideAll(); enterPage(i, { push: true }); }
    });
    $('shareClose').addEventListener('click', closeShare);
    $('shareBackdrop').addEventListener('click', closeShare);
    $('shareSave').addEventListener('click', saveShare);
    $('shareSystem').addEventListener('click', systemShare);
    $('shareCopy').addEventListener('click', copyShareLink);
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

    document.documentElement.classList.toggle('reduce-motion', state.reduced);
    applyRoute();   // 深链 / 封面 / 目录 / 尾页统一走同一套路由
    loop();
    booted = true;
    syncA11y();
    window.__BOOK__ = {
      state: state, stage: stage, enterPage: enterPage, turnPage: turnPage,
      expand: expand, nextShot: nextShot, toggleFavorite: toggleFavorite,
      themeProgress: themeProgress, openShare: openShare, closeShare: closeShare,
      goColophon: goColophon, drawShareCard: drawShareCard
    };
    window.__BOOK_READY__ = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
