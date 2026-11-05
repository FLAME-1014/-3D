(function () {
  "use strict";

  var placeById = {};
  PLACES.forEach(function (p) { placeById[p.id] = p; });

  var state = {
    cat: "all",
    cluster: "all",
    q: "",
    activeId: null,
    tray: [],
    meta: null,
    marks: {},
    markFilter: "all",
    interests: new Set(),
    routeMode: "day",
    routeStart: "09:00",
    routePace: "normal",
    routeOnlyWishlist: false,
    routeSkipVisited: false
  };

  var STORE_TRAY = "canton-atlas-tray";
  var STORE_META = "canton-atlas-meta";
  var STORE_MARKS = "canton-atlas-marks";

  var $ = function (id) { return document.getElementById(id); };
  var listEl = $("placeList");
  var tabsEl = $("catTabs");
  var resultCountEl = $("resultCount");
  var searchEl = $("searchInput");
  var clusterEl = $("clusterSelect");
  var markersEl = $("markers");
  var mapLayer = $("mapLayer");
  var svg = $("atlas");
  var mapFrame = $("mapFrame");
  var tooltip = $("tooltip");
  var detailSheet = $("detailSheet");
  var detailContent = $("detailContent");
  var trayDrawer = $("trayDrawer");
  var backdrop = $("backdrop");
  var timelineEl = $("timeline");
  var toastEl = $("toast");
  var immersiveOverlay = $("immersiveOverlay");
  var immersiveFrame = $("immersiveFrame");
  var immersiveLoading = $("immersiveLoading");
  var immersiveClose = $("immersiveClose");
  var openImmersiveBtn = $("openImmersiveBtn");

  var zoom = 1;
  var tx = 0;
  var ty = 0;
  var lastFocused = null;
  var toastTimer = null;
  var backdropTimer = null;
  var clearArmed = false;
  var clearTimer = null;
  var markerNodes = {};

  /* ---------- 基础工具 ---------- */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function catOf(p) { return CATS[p.cat]; }
  function clusterOf(p) { return CLUSTERS[p.cluster]; }
  function markOf(id) { return state.marks[id] || null; }

  function toMin(hhmm) {
    var parts = String(hhmm).split(":");
    return Number(parts[0]) * 60 + Number(parts[1] || 0);
  }

  function toTime(min) {
    var value = Math.max(0, Math.round(min));
    var h = Math.floor(value / 60) % 24;
    var m = value % 60;
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
  }

  function humanDuration(min) {
    var h = Math.floor(min / 60);
    var m = Math.round(min % 60);
    if (h && m) return h + " 小时 " + m + " 分";
    if (h) return h + " 小时";
    return m + " 分钟";
  }

  function showToast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toastEl.classList.remove("show"); }, 2200);
  }

  function paceMultiplier(pace) {
    if (pace === "relaxed") return 1.15;
    if (pace === "tight") return 0.85;
    return 1;
  }

  function travelBetween(a, b) {
    return a.cluster === b.cluster ? 15 : 35;
  }

  function isVisible(p) {
    if (state.cat !== "all" && p.cat !== state.cat) return false;
    if (state.cluster !== "all" && p.cluster !== state.cluster) return false;
    if (state.markFilter !== "all") {
      var mark = markOf(p.id);
      if (state.markFilter === "none" && mark) return false;
      if (state.markFilter !== "none" && mark !== state.markFilter) return false;
    }
    if (state.q) {
      var hay = [p.name, p.en, p.sig, p.tip, catOf(p).name, clusterOf(p).name]
        .concat(p.tags).join(" ").toLowerCase();
      if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
    }
    return true;
  }

  function visiblePlaces() {
    return PLACES.filter(isVisible);
  }

  /* ---------- 类别 / 片区 / 图例 ---------- */

  function renderTabs() {
    var counts = { all: PLACES.length };
    Object.keys(CATS).forEach(function (key) { counts[key] = 0; });
    PLACES.forEach(function (p) { counts[p.cat] += 1; });

    var html = '<button class="tab" type="button" data-cat="all" aria-pressed="' + (state.cat === "all") + '">全部 <span class="n">' + counts.all + "</span></button>";
    Object.keys(CATS).forEach(function (key) {
      var c = CATS[key];
      html += '<button class="tab" type="button" data-cat="' + key + '" aria-pressed="' + (state.cat === key) + '" style="--c:' + c.color + '">' +
        '<span class="dot"></span>' + c.name + ' <span class="n">' + counts[key] + "</span></button>";
    });
    tabsEl.innerHTML = html;
  }

  function renderLegend() {
    var counts = {};
    PLACES.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
    var html = Object.keys(CATS).map(function (key) {
      return '<span class="legend-item"><i style="--c:' + CATS[key].color + '"></i>' + CATS[key].name + " " + counts[key] + "</span>";
    }).join("");
    html += '<span class="legend-item"><b class="legend-symbol visited">✓</b>去过</span>';
    html += '<span class="legend-item"><b class="legend-symbol wishlist">★</b>想去</span>';
    $("mapLegend").innerHTML = html;
  }

  function markCounts() {
    var counts = { visited: 0, wishlist: 0 };
    PLACES.forEach(function (p) {
      var mark = markOf(p.id);
      if (mark) counts[mark] += 1;
    });
    counts.none = PLACES.length - counts.visited - counts.wishlist;
    return counts;
  }

  function renderMarkFilters() {
    var counts = markCounts();
    var defs = [
      ["all", "全部", PLACES.length],
      ["visited", "去过", counts.visited],
      ["wishlist", "想去", counts.wishlist],
      ["none", "未标记", counts.none]
    ];
    $("markFilter").innerHTML = defs.map(function (d) {
      return '<button type="button" data-mark-filter="' + d[0] + '" aria-pressed="' + (state.markFilter === d[0]) + '">' +
        d[1] + " <b>" + d[2] + "</b></button>";
    }).join("");
    $("visitedCount").textContent = String(counts.visited);
    $("wishlistCount").textContent = String(counts.wishlist);
  }

  function renderClusterOptions() {
    Object.keys(CLUSTERS).forEach(function (key) {
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = CLUSTERS[key].name;
      clusterEl.appendChild(opt);
    });
  }

  /* ---------- 列表 ---------- */

  function renderList() {
    var places = visiblePlaces();
    if (!places.length) {
      var emptyTitle = "没有找到地点";
      var emptyHint = "换个关键词，或者清除筛选条件。";
      if (state.markFilter === "wishlist") {
        emptyTitle = "还没有标记想去的地点";
        emptyHint = "点开任意地点，用「★ 想去」做标记。";
      } else if (state.markFilter === "visited") {
        emptyTitle = "还没有标记去过的地方";
        emptyHint = "点开任意地点，用「✓ 去过」做标记。";
      }
      listEl.innerHTML = '<li class="empty-list"><strong>' + emptyTitle + "</strong>" + emptyHint + "</li>";
    } else {
      listEl.innerHTML = places.map(function (p) {
        var c = catOf(p);
        var mark = markOf(p.id);
        var markBadge = mark
          ? '<span class="mark-badge ' + mark + '">' + (mark === "visited" ? "✓ 去过" : "★ 想去") + "</span>"
          : "";
        return '<li><button class="place-item' + (state.activeId === p.id ? " is-active" : "") + '" type="button" data-id="' + p.id + '" style="--c:' + c.color + '">' +
          '<span class="place-no">' + p.no + "</span>" +
          '<span class="place-main">' +
            '<span class="place-top"><span class="place-name">' + escapeHtml(p.name) + '</span><span class="place-cluster">' + clusterOf(p).name + "</span></span>" +
            '<span class="place-sig">' + escapeHtml(p.sig) + "</span>" +
            '<span class="place-tags">' + markBadge + p.tags.slice(0, 3).map(function (t) { return '<span class="tag">' + escapeHtml(t) + "</span>"; }).join("") + "</span>" +
          "</span></button></li>";
      }).join("");
    }

    var filtered = state.cat !== "all" || state.cluster !== "all" || state.q || state.markFilter !== "all";
    resultCountEl.textContent = filtered ? places.length + " / " + PLACES.length + " 个地点" : PLACES.length + " 个地点";
  }

  /* ---------- 地图标记 ---------- */

  function buildMarkers() {
    var frag = document.createDocumentFragment();
    PLACES.forEach(function (p) {
      var c = catOf(p);
      var g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("class", "marker");
      g.setAttribute("data-id", p.id);
      g.setAttribute("data-x", p.x);
      g.setAttribute("data-y", p.y);
      g.setAttribute("transform", "translate(" + p.x + " " + p.y + ")");
      g.setAttribute("style", "--c:" + c.color);
      g.setAttribute("role", "button");
      g.setAttribute("tabindex", "0");
      g.setAttribute("aria-label", "查看 " + p.name);

      g.innerHTML =
        '<circle class="pulse" r="12"></circle>' +
        '<circle class="pin" r="11.5"></circle>' +
        '<text class="num" y="0.5">' + p.no + "</text>" +
        '<text class="name" y="26">' + escapeHtml(p.name) + "</text>" +
        '<g class="state state-visited" transform="translate(10,-10)"><circle r="7"></circle><text y="0.5">✓</text></g>' +
        '<g class="state state-wishlist" transform="translate(10,-10)"><circle r="7"></circle><text y="0.5">★</text></g>';

      g.addEventListener("click", function () { openDetail(p.id); });
      g.addEventListener("pointerenter", function (event) { showTooltip(p, event); });
      g.addEventListener("pointermove", function (event) { moveTooltip(event); });
      g.addEventListener("pointerleave", hideTooltip);
      g.addEventListener("focus", function () {
        var rect = mapFrame.getBoundingClientRect();
        showTooltip(p, { clientX: rect.left + rect.width / 2, clientY: rect.top + 40 });
      });
      g.addEventListener("blur", hideTooltip);
      g.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetail(p.id);
        }
      });

      markerNodes[p.id] = g;
      frag.appendChild(g);
    });
    markersEl.appendChild(frag);
  }

  function updateMarkerStates() {
    PLACES.forEach(function (p) {
      var node = markerNodes[p.id];
      if (!node) return;
      var mark = markOf(p.id);
      node.classList.toggle("is-active", state.activeId === p.id);
      node.classList.toggle("is-muted", !isVisible(p) && state.activeId !== p.id);
      node.classList.toggle("is-visited", mark === "visited");
      node.classList.toggle("is-wishlist", mark === "wishlist");
      node.setAttribute(
        "aria-label",
        "查看 " + p.name + (mark === "visited" ? "，已去过" : mark === "wishlist" ? "，想去" : "")
      );
    });
  }

  function updateListActive() {
    document.querySelectorAll(".place-item").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.id === state.activeId);
    });
  }

  function showTooltip(p, event) {
    tooltip.innerHTML = "<strong>" + escapeHtml(p.name) + "</strong><span>" + escapeHtml(p.sig) + "</span>";
    tooltip.classList.add("show");
    moveTooltip(event);
  }

  function moveTooltip(event) {
    var rect = mapFrame.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;
    x = Math.max(80, Math.min(rect.width - 80, x));
    tooltip.style.left = x + "px";
    tooltip.style.top = Math.max(34, y) + "px";
  }

  function hideTooltip() { tooltip.classList.remove("show"); }

  /* ---------- 地图缩放和平移 ---------- */

  function applyMapTransform() {
    mapLayer.setAttribute("transform", "translate(" + tx + " " + ty + ") scale(" + zoom + ")");
    var inv = 1 / zoom;
    PLACES.forEach(function (p) {
      var node = markerNodes[p.id];
      if (node) node.setAttribute("transform", "translate(" + p.x + " " + p.y + ") scale(" + inv + ")");
    });
  }

  function clampPan() {
    var minX = 1000 - 1000 * zoom;
    var minY = 760 - 760 * zoom;
    tx = Math.min(0, Math.max(minX, tx));
    ty = Math.min(0, Math.max(minY, ty));
  }

  function setZoomAt(px, py, nextZoom) {
    var k = Math.min(2.4, Math.max(1, nextZoom));
    if (k === zoom) return;
    tx = px - (px - tx) * (k / zoom);
    ty = py - (py - ty) * (k / zoom);
    zoom = k;
    clampPan();
    applyMapTransform();
  }

  function resetMap() {
    zoom = 1; tx = 0; ty = 0;
    applyMapTransform();
  }

  function centerOn(p) {
    zoom = 1.7;
    tx = 500 - p.x * zoom;
    ty = 380 - p.y * zoom;
    clampPan();
    applyMapTransform();
  }

  function svgPoint(event) {
    var point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) return { x: 500, y: 380 };
    var loc = point.matrixTransform(ctm.inverse());
    return { x: loc.x, y: loc.y };
  }

  var dragging = false;
  var dragStart = null;

  function bindMap() {
    svg.addEventListener("pointerdown", function (event) {
      if (event.target.closest(".marker")) return;
      dragging = true;
      dragStart = { x: event.clientX, y: event.clientY, tx: tx, ty: ty };
      svg.classList.add("dragging");
      svg.setPointerCapture(event.pointerId);
    });

    svg.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      var rect = svg.getBoundingClientRect();
      tx = dragStart.tx + (event.clientX - dragStart.x) * (1000 / rect.width);
      ty = dragStart.ty + (event.clientY - dragStart.y) * (760 / rect.height);
      clampPan();
      applyMapTransform();
    });

    function endDrag(event) {
      if (!dragging) return;
      dragging = false;
      svg.classList.remove("dragging");
      if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    }
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);

    svg.addEventListener("wheel", function (event) {
      event.preventDefault();
      var loc = svgPoint(event);
      var factor = Math.exp(-event.deltaY * 0.0016);
      setZoomAt(loc.x, loc.y, zoom * factor);
    }, { passive: false });

    $("zoomIn").addEventListener("click", function () { setZoomAt(500, 380, zoom * 1.35); });
    $("zoomOut").addEventListener("click", function () { setZoomAt(500, 380, zoom / 1.35); });
    $("zoomReset").addEventListener("click", resetMap);
  }

  /* ---------- 详情 ---------- */

  function inTray(id) { return state.tray.indexOf(id) !== -1; }

  var MODEL_VIEWS = { chenjiaci: true, yongqingfang: true, shamian: true, beijinglu: true, "yuexiu-park": true, lizhiwan: true, shangxiajiu: true, "opera-museum": true, guangxiao: true, "six-banyan": true, "memorial-hall": true, yuntai: true, "nanyue-museum": true, baiyun: true, "canton-tower": true, "sacred-heart": true, "gd-museum": true, "opera-house": true };

  function immersiveLabel(id) {
    if (MODEL_VIEWS[id]) return "进入模型";
    if (id === "sacred-heart" || id === "baiyun" || id === "yuexiu-park" || id === "zhenhai" || id === "shamian" || id === "memorial-hall" || id === "yongqingfang" || id === "canton-tower" || id === "beijinglu" || id === "opera-house" || id === "gd-museum") return "3D 近景";
    return "3D 看这里";
  }

  function renderDetail(p) {
    var cat = catOf(p);
    var cluster = clusterOf(p);
    var mark = markOf(p.id);
    detailContent.innerHTML =
      '<div class="detail-head">' +
        '<span class="detail-no">' + p.no + "</span>" +
        "<div>" +
          '<div class="chip-row"><span class="chip cat" style="--c:' + cat.color + '">' + cat.name + '</span><span class="chip">' + cluster.name + "</span></div>" +
          '<h2 id="detailTitle">' + escapeHtml(p.name) + "</h2>" +
          '<p class="detail-en">' + escapeHtml(p.en) + "</p>" +
        "</div>" +
      "</div>" +
      '<blockquote class="sig-quote">' + escapeHtml(p.sig) + "</blockquote>" +
      '<section class="detail-section mark-detail"><h3>我的标记</h3>' +
        '<div class="mark-toggle">' +
          '<button type="button" data-mark="visited" aria-pressed="' + (mark === "visited") + '">✓ 去过</button>' +
          '<button type="button" data-mark="wishlist" aria-pressed="' + (mark === "wishlist") + '">★ 想去</button>' +
        "</div>" +
        '<p class="mark-hint">标记只保存在当前浏览器，用来筛选和生成路线。</p>' +
      "</section>" +
      '<div class="facts">' + p.facts.map(function (f) {
        return '<div class="fact"><span>' + escapeHtml(f[0]) + "</span><strong>" + escapeHtml(f[1]) + "</strong></div>";
      }).join("") + "</div>" +
      '<section class="detail-section"><h3>看点</h3><ol class="highlights">' +
        p.highlights.map(function (h) { return "<li>" + escapeHtml(h) + "</li>"; }).join("") +
      "</ol></section>" +
      '<section class="detail-section"><h3>什么时候去 · 怎么安排</h3><div class="info-grid">' +
        '<div class="info-block"><span>最佳时段</span><p>' + escapeHtml(p.best) + "</p></div>" +
        '<div class="info-block"><span>怎么玩</span><p>' + escapeHtml(p.tip) + "</p></div>" +
      "</div></section>" +
      '<div class="detail-actions">' +
        '<button class="primary-btn" type="button" data-add="' + p.id + '">' + (inTray(p.id) ? "移出行程" : "加入行程") + "</button>" +
        '<button class="ghost-btn small" type="button" data-immersive="' + p.id + '">' + immersiveLabel(p.id) + '</button>' +
        '<button class="ghost-btn small" type="button" data-locate="' + p.id + '">在地图上定位</button>' +
      "</div>";
  }

  function syncDetailMarks(id) {
    if (!id) return;
    detailContent.querySelectorAll("[data-mark]").forEach(function (btn) {
      btn.setAttribute("aria-pressed", String(markOf(id) === btn.dataset.mark));
    });
  }

  function setMark(id, mark) {
    if (state.marks[id] === mark) delete state.marks[id];
    else state.marks[id] = mark;
    saveState();
    renderMarkFilters();
    renderList();
    updateMarkerStates();
    syncDetailMarks(id);
    showToast(
      state.marks[id] === "visited" ? "已标记去过" :
      state.marks[id] === "wishlist" ? "已加入想去" : "已取消标记"
    );
  }

  function openDetail(id) {
    var p = placeById[id];
    if (!p) return;
    var trayWasOpen = trayDrawer.classList.contains("open");
    if (trayWasOpen) {
      lastFocused = document.querySelector('.place-item[data-id="' + id + '"]') || null;
      closeSheet(trayDrawer);
    } else {
      lastFocused = document.activeElement;
    }
    state.activeId = id;
    renderDetail(p);
    updateMarkerStates();
    updateListActive();
    openSheet(detailSheet);
    var closeBtn = $("closeDetail");
    if (closeBtn) closeBtn.focus();
  }

  function closeDetail(skipFocus) {
    if (!detailSheet.classList.contains("open")) return;
    closeSheet(detailSheet);
    state.activeId = null;
    updateMarkerStates();
    updateListActive();
    if (!skipFocus && lastFocused && lastFocused.focus) lastFocused.focus();
  }

  function locate(id) {
    var p = placeById[id];
    if (!p) return;
    closeDetail(true);
    state.activeId = id;
    updateMarkerStates();
    updateListActive();
    centerOn(p);
    mapFrame.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast("已在地图上定位 " + p.name);
  }

  /* ---------- 3D 沉浸模式 ---------- */

  var IMMERSIVE_MAP = {
    "canton-tower": "tower",
    "chenjiaci": "chenjiaci",
    "shamian": "shamian",
    "yongqingfang": "yongqingfang",
    "beijinglu": "beijinglu",
    "baiyun": "baiyun",
    "party-pier": "partypier",
    "huacheng": "skyline",
    "river-cruise": "river",
    "opera-house": "operahouse"
  };

  function openImmersive(placeId) {
    var target = placeId ? IMMERSIVE_MAP[placeId] : null;
    closeAllSheets();
    var url = placeId === "chenjiaci"
      ? "spot.html?id=chenjiaci&embed=1&from=atlas"
      : placeId === "yongqingfang"
      ? "spot.html?id=yongqingfang&embed=1&from=atlas"
      : placeId === "shamian"
      ? "spot.html?id=shamian&embed=1&from=atlas"
      : placeId === "beijinglu"
      ? "spot.html?id=beijinglu&embed=1&from=atlas"
      : placeId === "yuexiu-park"
      ? "spot.html?id=yuexiu-park&embed=1&from=atlas"
      : placeId === "lizhiwan"
      ? "spot.html?id=lizhiwan&embed=1&from=atlas"
      : placeId === "shangxiajiu"
      ? "spot.html?id=shangxiajiu&embed=1&from=atlas"
      : placeId === "opera-museum"
      ? "spot.html?id=opera-museum&embed=1&from=atlas"
      : placeId === "guangxiao"
      ? "spot.html?id=guangxiao&embed=1&from=atlas"
      : placeId === "six-banyan"
      ? "spot.html?id=six-banyan&embed=1&from=atlas"
      : placeId === "memorial-hall"
      ? "spot.html?id=memorial-hall&embed=1&from=atlas"
      : placeId === "yuntai"
      ? "spot.html?id=yuntai&embed=1&from=atlas"
      : placeId === "nanyue-museum"
      ? "spot.html?id=nanyue-museum&embed=1&from=atlas"
      : placeId === "baiyun"
      ? "spot.html?id=baiyun&embed=1&from=atlas"
      : placeId === "canton-tower"
      ? "spot.html?id=canton-tower&embed=1&from=atlas"
      : placeId === "sacred-heart"
      ? "spot.html?id=sacred-heart&embed=1&from=atlas"
      : placeId === "yuexiu-park"
      ? "immersive/yuexiu.html?embed=1&from=atlas&view=rams"
      : placeId === "zhenhai"
      ? "immersive/yuexiu.html?embed=1&from=atlas&view=tower"
      : placeId === "shamian"
      ? "immersive/shamian.html?embed=1&from=atlas"
      : placeId === "yongqingfang"
      ? "immersive/yongqingfang.html?embed=1&from=atlas"
      : placeId === "beijinglu"
      ? "immersive/beijinglu.html?embed=1&from=atlas&view=ancient"
      : placeId === "opera-house"
      ? "spot.html?id=opera-house&embed=1&from=atlas"
      : placeId === "gd-museum"
      ? "spot.html?id=gd-museum&embed=1&from=atlas"
      : "immersive/index.html?embed=1";
    if (target && placeId !== "chenjiaci" && placeId !== "nanyue-museum" && placeId !== "sacred-heart" && placeId !== "baiyun" && placeId !== "yuexiu-park" && placeId !== "zhenhai" && placeId !== "shamian" && placeId !== "yongqingfang" && placeId !== "canton-tower" && placeId !== "beijinglu" && placeId !== "opera-house" && placeId !== "gd-museum") {
      url += "&spot=" + encodeURIComponent(target) + "&jump=1";
    }
    immersiveLoading.hidden = false;
    immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
    immersiveFrame.src = url;
    immersiveOverlay.hidden = false;
    document.body.classList.add("lock");
    immersiveClose.focus();
  }

  function openChenDetail() {
    var url = "immersive/chen.html?embed=1&from=city";
    immersiveLoading.hidden = false;
    immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
    immersiveFrame.src = url;
    immersiveOverlay.hidden = false;
    document.body.classList.add("lock");
  }

  function openSacredDetail() {
    var url = "spot.html?id=sacred-heart&embed=1&from=city";
    immersiveLoading.hidden = false;
    immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
    immersiveFrame.src = url;
    immersiveOverlay.hidden = false;
    document.body.classList.add("lock");
  }

  function openBaiyunDetail() {
    var url = "spot.html?id=baiyun&embed=1&from=city";
    immersiveLoading.hidden = false;
    immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
    immersiveFrame.src = url;
    immersiveOverlay.hidden = false;
    document.body.classList.add("lock");
  }

  function openShamianDetail() {
    var url = "immersive/shamian.html?embed=1&from=city";
    immersiveLoading.hidden = false;
    immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
    immersiveFrame.src = url;
    immersiveOverlay.hidden = false;
    document.body.classList.add("lock");
  }

  function openYongqingfangDetail() {
    var url = "immersive/yongqingfang.html?embed=1&from=city";
    immersiveLoading.hidden = false;
    immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
    immersiveFrame.src = url;
    immersiveOverlay.hidden = false;
    document.body.classList.add("lock");
  }

  function openCantonTowerDetail() {
    var url = "spot.html?id=canton-tower&embed=1&from=city";
    immersiveLoading.hidden = false;
    immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
    immersiveFrame.src = url;
    immersiveOverlay.hidden = false;
    document.body.classList.add("lock");
  }

  function openBeijingluDetail() {
    var url = "immersive/beijinglu.html?embed=1&from=city&view=ancient";
    immersiveLoading.hidden = false;
    immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
    immersiveFrame.src = url;
    immersiveOverlay.hidden = false;
    document.body.classList.add("lock");
  }

  function openOperaDetail() {
    var url = "spot.html?id=opera-house&embed=1&from=city";
    immersiveLoading.hidden = false;
    immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
    immersiveFrame.src = url;
    immersiveOverlay.hidden = false;
    document.body.classList.add("lock");
  }

  window.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data.type === "canton-open-chen") {
      openChenDetail();
    } else if (data.type === "canton-open-sacred") {
      openSacredDetail();
    } else if (data.type === "canton-open-baiyun") {
      openBaiyunDetail();
    } else if (data.type === "canton-open-shamian") {
      openShamianDetail();
    } else if (data.type === "canton-open-yongqingfang") {
      openYongqingfangDetail();
    } else if (data.type === "canton-open-tower") {
      openCantonTowerDetail();
    } else if (data.type === "canton-open-beijinglu") {
      openBeijingluDetail();
    } else if (data.type === "canton-open-opera") {
      openOperaDetail();
    } else if (data.type === "canton-open-city") {
      var url = data.spot
        ? "immersive/index.html?embed=1&spot=" + encodeURIComponent(data.spot) + "&jump=1"
        : "immersive/index.html?embed=1";
      immersiveLoading.hidden = false;
      immersiveFrame.onload = function () { immersiveLoading.hidden = true; };
      immersiveFrame.src = url;
      immersiveOverlay.hidden = false;
      document.body.classList.add("lock");
    } else if (data.type === "canton-close-immersive") {
      closeImmersive();
    } else if (data.type === "canton-mark-visited" && data.id && placeById[data.id]) {
      if (state.marks[data.id] !== "visited") setMark(data.id, "visited");
    }
  });

  function closeImmersive() {
    if (immersiveOverlay.hidden) return;
    immersiveOverlay.hidden = true;
    immersiveFrame.src = "about:blank";
    immersiveLoading.hidden = true;
    document.body.classList.remove("lock");
    openImmersiveBtn.focus();
  }

  /* ---------- 行程 ---------- */

  function saveState() {
    try {
      localStorage.setItem(STORE_TRAY, JSON.stringify(state.tray));
      localStorage.setItem(STORE_META, JSON.stringify(state.meta));
      localStorage.setItem(STORE_MARKS, JSON.stringify(state.marks));
    } catch (error) { /* 本地存储不可用时忽略 */ }
  }

  function loadState() {
    try {
      var rawTray = JSON.parse(localStorage.getItem(STORE_TRAY) || "[]");
      if (Array.isArray(rawTray)) {
        state.tray = rawTray.filter(function (id) { return !!placeById[id]; });
      }
      var rawMeta = JSON.parse(localStorage.getItem(STORE_META) || "null");
      if (rawMeta && typeof rawMeta.start === "string") state.meta = rawMeta;
      var rawMarks = JSON.parse(localStorage.getItem(STORE_MARKS) || "{}");
      if (rawMarks && typeof rawMarks === "object") {
        Object.keys(rawMarks).forEach(function (id) {
          var mark = rawMarks[id];
          if (placeById[id] && (mark === "visited" || mark === "wishlist")) state.marks[id] = mark;
        });
      }
    } catch (error) { state.tray = []; state.meta = null; state.marks = {}; }
  }

  function updateTrayCount() {
    $("trayCount").textContent = String(state.tray.length);
  }

  function addToTray(id) {
    if (inTray(id)) {
      state.tray = state.tray.filter(function (item) { return item !== id; });
      showToast("已移出行程");
    } else {
      state.tray.push(id);
      if (!state.meta) state.meta = { name: "手动行程", start: "09:00", pace: "normal" };
      showToast("已加入行程");
    }
    updateTrayCount();
    saveState();
    renderTimeline();
    var addBtn = detailContent.querySelector("[data-add]");
    if (addBtn && addBtn.dataset.add === id) {
      addBtn.textContent = inTray(id) ? "移出行程" : "加入行程";
    }
  }

  function buildTimeline(ids, start, pace) {
    var mult = paceMultiplier(pace);
    var t = toMin(start);
    var stops = [];
    ids.forEach(function (id, index) {
      var p = placeById[id];
      if (!p) return;
      var prev = index > 0 ? placeById[ids[index - 1]] : null;
      var travel = prev ? travelBetween(prev, p) : 0;
      t += travel;
      var dur = Math.round(p.dur * mult);
      stops.push({ p: p, travel: travel, arrive: t, leave: t + dur, dur: dur });
      t += dur;
    });
    return { stops: stops, start: toMin(start), end: t, total: t - toMin(start) };
  }

  function renderTimeline() {
    updateTrayCount();
    var meta = state.meta || { name: "手动行程", start: "09:00", pace: "normal" };
    var plan = buildTimeline(state.tray, meta.start, meta.pace);

    if (!state.tray.length) {
      timelineEl.innerHTML = '<div class="timeline-empty"><strong>行程还是空的</strong>在左侧点开任意地点，加入行程；也可以直接用上面的预设或生成一条路线。</div>';
      $("itinMeta").textContent = "还没有安排";
      $("copyBtn").disabled = true;
      $("reorderBtn").disabled = true;
      $("clearBtn").disabled = true;
      $("clearBtn").textContent = "清空";
      return;
    }

    timelineEl.innerHTML = plan.stops.map(function (stop, index) {
      var travelLabel = index > 0
        ? (stop.travel === 15 ? "步行 / 地铁约 15 分钟（估算）" : "过江或跨片区约 35 分钟（估算）")
        : "起点";
      return '<div class="stop">' +
        '<div class="stop-time">' + toTime(stop.arrive) + "<br>" + toTime(stop.leave) + "</div>" +
        '<div class="stop-body">' +
          '<p class="stop-travel">' + travelLabel + "</p>" +
          '<article class="stop-card" data-open="' + stop.p.id + '">' +
            "<h4>" + stop.p.no + " · " + escapeHtml(stop.p.name) + "</h4>" +
            "<p>" + catOf(stop.p).name + " · 停留 " + stop.dur + " 分钟</p>" +
            '<button class="stop-remove" type="button" data-remove="' + stop.p.id + '" aria-label="移出 ' + escapeHtml(stop.p.name) + '">×</button>' +
          "</article>" +
        "</div>" +
      "</div>";
    }).join("");

    $("itinMeta").textContent = plan.stops.length + " 站 · " + toTime(plan.start) + "–" + toTime(plan.end) + " · " + humanDuration(plan.total);
    $("copyBtn").disabled = false;
    $("reorderBtn").disabled = state.tray.length < 2;
    $("clearBtn").disabled = false;
  }

  function removeFromTray(id) {
    state.tray = state.tray.filter(function (item) { return item !== id; });
    saveState();
    renderTimeline();
    showToast("已移出行程");
  }

  function reorderTray() {
    if (state.tray.length < 2) return;
    var remaining = state.tray.map(function (id) { return placeById[id]; });
    var ordered = [remaining.shift()];
    while (remaining.length) {
      var current = ordered[ordered.length - 1];
      var bestIndex = 0;
      var bestScore = Infinity;
      remaining.forEach(function (p, index) {
        var dx = p.x - current.x;
        var dy = p.y - current.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var score = dist + (p.cluster === current.cluster ? 0 : 60);
        if (score < bestScore) { bestScore = score; bestIndex = index; }
      });
      ordered.push(remaining.splice(bestIndex, 1)[0]);
    }
    state.tray = ordered.map(function (p) { return p.id; });
    saveState();
    renderTimeline();
    showToast("已按片区就近整理");
  }

  function generateRoute() {
    var mode = state.routeMode;
    var pace = state.routePace;
    var start = state.routeStart;
    var startMin = toMin(start);
    var budget = mode === "day" ? 540 : 270;
    var maxStops = mode === "day" ? 8 : 4;
    var minStops = mode === "half" ? 3 : 5;
    var mult = paceMultiplier(pace);
    var interests = Array.from(state.interests);
    var onlyWishlist = state.routeOnlyWishlist;
    var skipVisited = state.routeSkipVisited;

    function allowed(p) {
      var mark = markOf(p.id);
      if (onlyWishlist && mark !== "wishlist") return false;
      if (skipVisited && mark === "visited") return false;
      return true;
    }

    var pool = PLACES.filter(function (p) {
      return (!interests.length || interests.indexOf(p.cat) !== -1) && allowed(p);
    });
    if (!pool.length) {
      showToast(onlyWishlist ? "还没有标记想去的地点" : "没有符合条件的地点，放宽兴趣或打卡偏好");
      return;
    }

    var anchors;
    if (!interests.length) {
      var curated;
      if (mode === "day") {
        curated = ["chenjiaci", "yongqingfang", "shamian", "beijinglu", "canton-tower"];
      } else if (startMin >= 16 * 60) {
        curated = ["huacheng", "canton-tower", "party-pier"];
      } else if (startMin < 12 * 60) {
        curated = ["chenjiaci", "yongqingfang", "morning-tea"];
      } else {
        curated = ["chenjiaci", "yongqingfang", "shamian"];
      }
      anchors = curated.map(function (id) { return placeById[id]; }).filter(function (p) { return p && allowed(p); });
    } else {
      anchors = PLACES.filter(function (p) {
        return p.must && interests.indexOf(p.cat) !== -1 && allowed(p);
      }).slice(0, mode === "day" ? 4 : 2);
    }

    var route = [];
    var used = {};
    var elapsed = 0;
    var cur = { x: 300, y: 380 };

    function canAdd(p) {
      var prev = route.length ? route[route.length - 1] : null;
      var travel = prev ? travelBetween(prev, p) : 0;
      var dur = Math.round(p.dur * mult);
      if (!route.length) return true;
      if (elapsed + travel + dur > budget && route.length >= minStops) return false;
      return true;
    }

    function add(p) {
      var prev = route.length ? route[route.length - 1] : null;
      var travel = prev ? travelBetween(prev, p) : 0;
      var dur = Math.round(p.dur * mult);
      route.push(p);
      used[p.id] = true;
      elapsed += travel + dur;
      cur = p;
    }

    anchors.forEach(function (p) {
      if (!p || used[p.id]) return;
      if (!canAdd(p)) return;
      add(p);
    });

    while (route.length < maxStops) {
      var prev = route.length ? route[route.length - 1] : null;
      var best = null;
      var bestScore = Infinity;

      pool.forEach(function (p) {
        if (used[p.id]) return;
        var travel = prev ? travelBetween(prev, p) : 0;
        var dur = Math.round(p.dur * mult);
        if (elapsed + travel + dur > budget && route.length >= minStops) return;

        var dx = p.x - cur.x;
        var dy = p.y - cur.y;
        var dist = Math.sqrt(dx * dx + dy * dy);
        var slotPenalty = 0;
        if (p.slot === "night" && startMin < 12 * 60) slotPenalty = 320;
        if (p.slot === "morning" && startMin >= 16 * 60) slotPenalty = 320;
        var score = dist + (prev && prev.cluster !== p.cluster ? 55 : 0) + slotPenalty - (p.must ? 26 : 0);
        if (score < bestScore) { bestScore = score; best = p; }
      });

      if (!best) break;
      add(best);
    }

    if (route.length < 2) {
      showToast("这个组合排不出路线，换个兴趣试试");
      return;
    }

    state.tray = route.map(function (p) { return p.id; });
    state.meta = {
      name: (mode === "day" ? "一日" : "半日") + "路线",
      start: start,
      pace: pace
    };
    saveState();
    renderTimeline();
    showToast("已生成 " + route.length + " 站路线");
    timelineEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function applyPreset(preset) {
    state.tray = preset.ids.filter(function (id) { return !!placeById[id]; });
    state.meta = { name: preset.name, start: preset.start, pace: "normal" };
    state.routeMode = preset.mode || "day";
    state.routeStart = preset.start;
    state.routePace = "normal";
    $("routeMode").value = state.routeMode;
    $("routeStart").value = state.routeStart;
    $("routePace").value = state.routePace;
    saveState();
    renderTimeline();
    showToast("已载入「" + preset.name + "」");
    timelineEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function buildItineraryText() {
    var meta = state.meta || { name: "手动行程", start: "09:00", pace: "normal" };
    var plan = buildTimeline(state.tray, meta.start, meta.pace);
    var lines = ["广州城市图鉴 · " + meta.name];
    plan.stops.forEach(function (stop) {
      lines.push(toTime(stop.arrive) + "–" + toTime(stop.leave) + "  " + stop.p.name + "（" + catOf(stop.p).name + "，约 " + stop.dur + " 分钟）");
    });
    lines.push("总计 " + toTime(plan.start) + "–" + toTime(plan.end) + "，约 " + humanDuration(plan.total));
    lines.push("时间为估算；地图为示意，不用于导航。");
    return lines.join("\n");
  }

  function copyItinerary() {
    var text = buildItineraryText();
    function fallback() {
      var area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try { document.execCommand("copy"); showToast("行程已复制"); }
      catch (error) { showToast("复制失败，请手动选择文本"); }
      document.body.removeChild(area);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showToast("行程已复制"); }, fallback);
    } else {
      fallback();
    }
  }

  function clearTray() {
    if (!state.tray.length) return;
    if (!clearArmed) {
      clearArmed = true;
      $("clearBtn").textContent = "再点一次清空";
      clearTimer = window.setTimeout(function () {
        clearArmed = false;
        $("clearBtn").textContent = "清空";
      }, 2600);
      return;
    }
    window.clearTimeout(clearTimer);
    clearArmed = false;
    state.tray = [];
    state.meta = null;
    saveState();
    renderTimeline();
    $("clearBtn").textContent = "清空";
    showToast("行程已清空");
  }

  /* ---------- 抽屉 / 遮罩 ---------- */

  function openSheet(sheet) {
    window.clearTimeout(backdropTimer);
    if (sheet !== detailSheet && detailSheet.classList.contains("open")) {
      detailSheet.classList.remove("open");
      detailSheet.setAttribute("aria-hidden", "true");
      state.activeId = null;
      updateMarkerStates();
      updateListActive();
    }
    if (sheet !== trayDrawer && trayDrawer.classList.contains("open")) {
      trayDrawer.classList.remove("open");
      trayDrawer.setAttribute("aria-hidden", "true");
    }
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
    backdrop.hidden = false;
    void backdrop.offsetWidth;
    backdrop.classList.add("show");
    document.body.classList.add("lock");
  }

  function scheduleBackdropHide() {
    window.clearTimeout(backdropTimer);
    backdropTimer = window.setTimeout(function () {
      if (!detailSheet.classList.contains("open") && !trayDrawer.classList.contains("open")) {
        backdrop.hidden = true;
      }
    }, 220);
  }

  function closeSheet(sheet) {
    sheet.classList.remove("open");
    sheet.setAttribute("aria-hidden", "true");
    if (!detailSheet.classList.contains("open") && !trayDrawer.classList.contains("open")) {
      backdrop.classList.remove("show");
      document.body.classList.remove("lock");
      scheduleBackdropHide();
    }
  }

  function closeAllSheets() {
    var any = false;
    [detailSheet, trayDrawer].forEach(function (sheet) {
      if (sheet.classList.contains("open")) {
        sheet.classList.remove("open");
        sheet.setAttribute("aria-hidden", "true");
        any = true;
      }
    });
    if (any) {
      backdrop.classList.remove("show");
      document.body.classList.remove("lock");
      scheduleBackdropHide();
      state.activeId = null;
      updateMarkerStates();
      updateListActive();
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    }
  }

  function openTray(scrollToTimeline) {
    lastFocused = document.activeElement;
    renderTimeline();
    openSheet(trayDrawer);
    if (scrollToTimeline) {
      window.setTimeout(function () {
        timelineEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    }
    $("closeTray").focus();
  }

  /* ---------- 事件绑定 ---------- */

  function bindEvents() {
    tabsEl.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-cat]");
      if (!btn) return;
      state.cat = btn.dataset.cat;
      renderTabs();
      renderList();
      updateMarkerStates();
    });

    listEl.addEventListener("click", function (event) {
      var btn = event.target.closest("[data-id]");
      if (!btn) return;
      openDetail(btn.dataset.id);
    });

    searchEl.addEventListener("input", function (event) {
      state.q = event.target.value.trim();
      renderList();
      updateMarkerStates();
    });

    clusterEl.addEventListener("change", function (event) {
      state.cluster = event.target.value;
      renderList();
      updateMarkerStates();
    });

    $("markFilter").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-mark-filter]");
      if (!btn) return;
      state.markFilter = btn.dataset.markFilter;
      renderMarkFilters();
      renderList();
      updateMarkerStates();
    });

    $("clearFilters").addEventListener("click", function () {
      state.cat = "all";
      state.cluster = "all";
      state.q = "";
      state.markFilter = "all";
      searchEl.value = "";
      clusterEl.value = "all";
      renderTabs();
      renderMarkFilters();
      renderList();
      updateMarkerStates();
    });

    $("closeDetail").addEventListener("click", function () { closeDetail(); });
    $("closeTray").addEventListener("click", function () {
      closeSheet(trayDrawer);
      if (lastFocused && lastFocused.focus) lastFocused.focus();
    });
    backdrop.addEventListener("click", closeAllSheets);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (immersiveOverlay && !immersiveOverlay.hidden) {
          closeImmersive();
          return;
        }
        closeAllSheets();
      }
    });

    detailContent.addEventListener("click", function (event) {
      var markBtn = event.target.closest("[data-mark]");
      if (markBtn && state.activeId) {
        setMark(state.activeId, markBtn.dataset.mark);
        return;
      }
      var addBtn = event.target.closest("[data-add]");
      if (addBtn) { addToTray(addBtn.dataset.add); return; }
      var threeDBtn = event.target.closest("[data-immersive]");
      if (threeDBtn) { openImmersive(threeDBtn.dataset.immersive); return; }
      var locateBtn = event.target.closest("[data-locate]");
      if (locateBtn) locate(locateBtn.dataset.locate);
    });

    $("openPlannerBtn").addEventListener("click", function () {
      openTray(false);
      window.setTimeout(function () { $("generateBtn").focus(); }, 200);
    });
    $("openTrayBtn").addEventListener("click", function () { openTray(true); });
    openImmersiveBtn.addEventListener("click", function () { openImmersive(null); });
    immersiveClose.addEventListener("click", closeImmersive);

    $("generateBtn").addEventListener("click", generateRoute);
    $("copyBtn").addEventListener("click", copyItinerary);
    $("reorderBtn").addEventListener("click", reorderTray);
    $("clearBtn").addEventListener("click", clearTray);

    $("routeMode").addEventListener("change", function (event) { state.routeMode = event.target.value; });
    $("routeStart").addEventListener("change", function (event) {
      state.routeStart = event.target.value;
      if (event.target.value === "17:30" && state.routeMode === "day") {
        state.routeMode = "half";
        $("routeMode").value = "half";
      }
    });
    $("routePace").addEventListener("change", function (event) { state.routePace = event.target.value; });

    $("routePrefs").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-pref]");
      if (!btn) return;
      if (btn.dataset.pref === "onlyWishlist") {
        state.routeOnlyWishlist = !state.routeOnlyWishlist;
        btn.setAttribute("aria-pressed", String(state.routeOnlyWishlist));
      } else if (btn.dataset.pref === "skipVisited") {
        state.routeSkipVisited = !state.routeSkipVisited;
        btn.setAttribute("aria-pressed", String(state.routeSkipVisited));
      }
    });

    timelineEl.addEventListener("click", function (event) {
      var removeBtn = event.target.closest("[data-remove]");
      if (removeBtn) {
        event.stopPropagation();
        removeFromTray(removeBtn.dataset.remove);
        return;
      }
      var openBtn = event.target.closest("[data-open]");
      if (openBtn) openDetail(openBtn.dataset.open);
    });
  }

  function renderPresets() {
    $("presetRow").innerHTML = PRESETS.map(function (preset) {
      return '<button class="preset-btn" type="button" data-preset="' + preset.id + '">' +
        "<strong>" + escapeHtml(preset.name) + "</strong><span>" + escapeHtml(preset.desc) + "</span></button>";
    }).join("");

    $("presetRow").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-preset]");
      if (!btn) return;
      var preset = PRESETS.find(function (item) { return item.id === btn.dataset.preset; });
      if (preset) applyPreset(preset);
    });
  }

  function renderInterests() {
    var counts = {};
    PLACES.forEach(function (p) { counts[p.cat] = (counts[p.cat] || 0) + 1; });
    $("interestRow").innerHTML = Object.keys(CATS).map(function (key) {
      return '<button class="interest-chip" type="button" data-interest="' + key + '" aria-pressed="' + state.interests.has(key) + '" style="--c:' + CATS[key].color + '">' +
        "<i></i>" + CATS[key].name + " " + counts[key] + "</button>";
    }).join("");
  }

  function bindInterests() {
    $("interestRow").addEventListener("click", function (event) {
      var btn = event.target.closest("[data-interest]");
      if (!btn) return;
      var key = btn.dataset.interest;
      if (state.interests.has(key)) state.interests.delete(key);
      else state.interests.add(key);
      btn.setAttribute("aria-pressed", String(state.interests.has(key)));
    });
  }

  /* ---------- 初始化 ---------- */

  function handleHash() {
    if (location.hash === "#immersive") {
      openImmersive(null);
      return;
    }
    var placeMatch = /^#place=([a-z0-9-]+)$/.exec(location.hash);
    if (placeMatch && placeById[placeMatch[1]]) {
      openDetail(placeMatch[1]);
      return;
    }
    if (location.hash === "#route") {
      openTray(false);
      return;
    }
    var presetMatch = /^#preset=([a-z0-9-]+)$/.exec(location.hash);
    if (presetMatch) {
      var preset = PRESETS.find(function (item) { return item.id === presetMatch[1]; });
      if (preset) {
        applyPreset(preset);
        openTray(true);
      }
    }
  }

  function init() {
    $("statPlaces").textContent = String(PLACES.length);
    $("statClusters").textContent = String(Object.keys(CLUSTERS).length);
    $("statCats").textContent = String(Object.keys(CATS).length);

    renderTabs();
    renderLegend();
    renderClusterOptions();
    buildMarkers();
    bindMap();
    renderPresets();
    renderInterests();
    bindInterests();
    bindEvents();

    loadState();
    updateTrayCount();
    renderMarkFilters();
    renderList();
    updateMarkerStates();
    renderTimeline();
    applyMapTransform();
    handleHash();
    window.addEventListener("hashchange", handleHash);
    var bootParams = new URLSearchParams(window.location.search);
    if (bootParams.get("immersive") === "1" || location.hash === "#immersive") {
      var deepId = bootParams.get("spot");
      openImmersive(deepId && placeById[deepId] ? deepId : null);
    }
  }

  init();
})();
