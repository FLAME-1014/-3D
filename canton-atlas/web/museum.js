(function () {
  "use strict";
  var catalog = window.MUSEUM_CATALOG;
  if (!catalog) return;

  var seenKey = "canton-atlas-museum-seen";
  var favoriteKey = "canton-atlas-museum-favorites";
  var state = { theme: "all", query: "", savedOnly: false, current: null, routeOwned: false, readyId: null, detailsRequested: false, previousFocus: null, restoreScrollY: 0, previousScrollRestoration: "auto", previousScrollBehavior: "", originId: null, seen: read(seenKey), favorites: read(favoriteKey) };
  var grid = document.getElementById("exhibitGrid");
  var tabs = document.getElementById("themeTabs");
  var search = document.getElementById("searchInput");
  var empty = document.getElementById("emptyState");
  var viewer = document.getElementById("viewer");
  var frame = document.getElementById("viewerFrame");
  var poster = document.getElementById("viewerPoster");
  var posterImage = document.getElementById("viewerPosterImage");
  var viewerError = document.getElementById("viewerError");
  var toastEl = document.getElementById("toast");
  var baseTitle = document.title;
  var toastTimer = 0;
  var openTimer = 0;

  function read(key) {
    try { var value = JSON.parse(localStorage.getItem(key) || "[]"); return Array.isArray(value) ? value.filter(Boolean) : []; }
    catch (error) { return []; }
  }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) {} }
  function has(list, id) { return list.indexOf(id) >= 0; }
  function toggle(list, id) { return has(list, id) ? list.filter(function (item) { return item !== id; }) : list.concat(id); }
  function escapeHtml(value) { return String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function toast(message) { toastEl.textContent = message; toastEl.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove("show"); }, 2200); }
  function visible() {
    var q = state.query.trim().toLowerCase();
    return catalog.entries.filter(function (item) {
      if (state.theme !== "all" && item.theme !== state.theme) return false;
      if (state.savedOnly && !has(state.favorites, item.id)) return false;
      if (q && (item.name + " " + item.en + " " + item.lead + " " + item.themeLabel).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }
  function renderTabs() {
    tabs.innerHTML = catalog.themeList.map(function (theme) {
      return '<button class="theme-tab" type="button" data-theme="' + theme.id + '" aria-pressed="' + (state.theme === theme.id) + '">' + escapeHtml(theme.label) + '</button>';
    }).join("");
  }
  function renderChapters() {
    var featured = catalog.themeList.filter(function (theme) { return theme.id !== "all"; });
    document.getElementById("chapterCards").innerHTML = featured.map(function (theme) {
      var members = catalog.entries.filter(function (item) { return item.theme === theme.id; });
      var cover = members[0];
      return '<button class="chapter-card" type="button" data-chapter="' + theme.id + '"><img src="' + cover.cover + '" alt="" loading="lazy"><span class="chapter-card-count">ROOM 0' + (featured.indexOf(theme) + 1) + ' · ' + members.length + ' 件展品</span><span class="chapter-card-copy"><strong>' + escapeHtml(theme.label) + '</strong><small>以一条观看线索，重新发现广州。</small></span></button>';
    }).join("");
  }
  function renderGrid() {
    var items = visible();
    document.getElementById("resultCount").textContent = String(items.length);
    empty.hidden = items.length > 0;
    grid.innerHTML = items.map(function (item) {
      var isSeen = has(state.seen, item.id);
      var isFavorite = has(state.favorites, item.id);
      return '<article class="exhibit-card" tabindex="0" role="button" data-open="' + item.id + '" aria-label="打开 ' + escapeHtml(item.name) + ' 展品">' +
        '<div class="exhibit-visual"><img src="' + item.cover + '" alt="' + escapeHtml(item.name) + '风格化 3D 模型预览" loading="lazy"><span class="exhibit-number">MODEL ' + item.no + '</span>' + (isSeen ? '<span class="exhibit-seen is-seen" aria-label="已观展">✓</span>' : "") + (isFavorite ? '<span class="exhibit-favorite is-favorite" aria-label="已收藏">✦</span>' : "") + '</div>' +
        '<div class="exhibit-meta"><span class="room-label">' + escapeHtml(item.themeLabel) + '</span><span>' + escapeHtml(item.en) + '</span></div>' +
        '<h3 class="exhibit-title">' + escapeHtml(item.name) + '</h3><p class="exhibit-teaser">' + escapeHtml(item.lead) + '</p><span class="exhibit-enter">进入展柜 <span aria-hidden="true">↗</span></span></article>';
    }).join("");
  }
  function renderCabinet() {
    var count = state.seen.length;
    document.getElementById("cabinetCount").textContent = String(state.favorites.length);
    document.getElementById("seenCount").textContent = String(count).padStart(2, "0");
    document.getElementById("cabinetProgress").style.width = (count / catalog.entries.length * 100) + "%";
    document.getElementById("cabinetHint").textContent = count ? (count === catalog.entries.length ? "你已经看完了这一版广州模型收藏。" : "每打开一件展品，藏册就多一枚印记。") : "打开一件展品，开始你的城市收藏。";
    document.getElementById("showSaved").textContent = state.savedOnly ? "显示全部展品  →" : "只看我收藏的（" + state.favorites.length + "）  →";
  }
  function markSeen(id) { if (!has(state.seen, id)) { state.seen = state.seen.concat(id); write(seenKey, state.seen); renderGrid(); renderCabinet(); } }
  function updateUrl(id, replace) { var url = new URL(location.href); if (id) url.searchParams.set("item", id); else url.searchParams.delete("item"); history[replace ? "replaceState" : "pushState"]({ item: id || null }, "", url); }
  function setViewerFavorite() {
    var button = document.getElementById("viewerFavorite");
    var active = state.current && has(state.favorites, state.current.id);
    button.setAttribute("aria-pressed", String(active)); button.textContent = active ? "✓ 已收藏" : "＋ 收藏";
  }
  function requestDetails() {
    state.detailsRequested = true;
    if (state.current && frame.contentWindow && state.readyId === state.current.id) {
      frame.contentWindow.postMessage({ type: "canton-museum-open-details", id: state.current.id }, location.origin);
    }
  }
  function openViewer(id, historyMode) {
    var item = catalog.byId[id]; if (!item) return;
    if (viewer.hidden) {
      state.previousFocus = document.activeElement;
      state.restoreScrollY = window.scrollY;
      state.previousScrollRestoration = history.scrollRestoration;
      state.previousScrollBehavior = document.documentElement.style.scrollBehavior;
      state.originId = id;
      history.scrollRestoration = "manual";
      document.documentElement.style.scrollBehavior = "auto";
      document.body.style.top = -state.restoreScrollY + "px";
    }
    state.current = item; state.readyId = null; state.detailsRequested = false;
    document.title = item.name + " · 广州立体志";
    if (historyMode === "push") { updateUrl(id, false); state.routeOwned = true; }
    else if (historyMode === "replace") updateUrl(id, true);
    document.getElementById("viewerName").textContent = item.name;
    document.getElementById("viewerEdition").textContent = "展品 " + item.no + " / " + catalog.entries.length;
    document.getElementById("viewerLead").textContent = item.lead;
    posterImage.src = item.cover; posterImage.alt = item.name + "预览"; poster.hidden = false; viewerError.hidden = true;
    frame.onload = function () { clearTimeout(openTimer); if (state.readyId !== id) openTimer = setTimeout(function () { poster.hidden = true; viewerError.hidden = false; }, 20000); };
    frame.onerror = function () { clearTimeout(openTimer); poster.hidden = true; viewerError.hidden = false; };
    frame.src = "spot.html?id=" + encodeURIComponent(id) + "&embed=1&from=museum";
    viewer.hidden = false; document.body.classList.add("viewer-open"); setViewerFavorite();
    document.getElementById("viewerClose").focus();
  }
  function closeViewer(update) {
    if (viewer.hidden) return;
    clearTimeout(openTimer); frame.src = "about:blank"; viewer.hidden = true; document.body.classList.remove("viewer-open"); document.body.style.top = ""; state.current = null; document.title = baseTitle;
    window.scrollTo(0, state.restoreScrollY);
    if (update !== false) updateUrl(null, true); renderGrid();
    var focusTarget = state.previousFocus;
    if (!focusTarget || !focusTarget.isConnected) focusTarget = state.originId ? grid.querySelector('[data-open="' + state.originId + '"]') : null;
    if (focusTarget && typeof focusTarget.focus === "function") focusTarget.focus({ preventScroll: true });
    document.documentElement.style.scrollBehavior = state.previousScrollBehavior;
    history.scrollRestoration = state.previousScrollRestoration;
    state.previousFocus = null; state.originId = null;
  }
  function closeFromUi() {
    if (state.routeOwned) { state.routeOwned = false; history.back(); closeViewer(false); }
    else { closeViewer(true); }
  }
  function navigate(delta) {
    if (!state.current) return;
    var index = catalog.entries.indexOf(state.current); var next = catalog.entries[(index + delta + catalog.entries.length) % catalog.entries.length];
    openViewer(next.id, "replace");
  }
  function shareCurrent() {
    var item = state.current; if (!item) return;
    var url = location.href;
    if (navigator.share) navigator.share({ title: item.name + " · 广州立体志", text: item.lead, url: url }).catch(function () {});
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast("展品链接已复制"); }).catch(function () { toast("请复制浏览器地址分享"); });
    else toast("请复制浏览器地址分享");
  }
  function bind() {
    tabs.addEventListener("click", function (event) { var button = event.target.closest("[data-theme]"); if (!button) return; state.theme = button.dataset.theme; state.savedOnly = false; renderTabs(); renderGrid(); });
    document.getElementById("chapterCards").addEventListener("click", function (event) { var button = event.target.closest("[data-chapter]"); if (!button) return; state.theme = button.dataset.chapter; state.savedOnly = false; state.query = ""; search.value = ""; renderTabs(); renderGrid(); document.getElementById("collection").scrollIntoView({ behavior: "smooth" }); });
    grid.addEventListener("click", function (event) { var card = event.target.closest("[data-open]"); if (card) openViewer(card.dataset.open, "push"); });
    grid.addEventListener("keydown", function (event) { var card = event.target.closest("[data-open]"); if (card && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); openViewer(card.dataset.open, "push"); } });
    search.addEventListener("input", function () { state.query = search.value; renderGrid(); });
    document.getElementById("cabinetButton").addEventListener("click", function () { document.getElementById("cabinet").scrollIntoView({ behavior: "smooth" }); });
    document.getElementById("showSaved").addEventListener("click", function () { state.savedOnly = !state.savedOnly; state.theme = "all"; renderTabs(); renderGrid(); renderCabinet(); document.getElementById("collection").scrollIntoView({ behavior: "smooth" }); });
    document.getElementById("shareCabinet").addEventListener("click", function () { var text = "我在广州立体志看了 " + state.seen.length + " 件城市模型。"; if (navigator.share) navigator.share({ title: "我的广州立体志藏册", text: text, url: location.href }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(text + " " + location.href).then(function () { toast("藏册信息已复制"); }); else toast(text); });
    document.querySelectorAll(".hero [data-open]").forEach(function (button) { button.addEventListener("click", function () { openViewer(button.dataset.open, "push"); }); });
    document.getElementById("viewerClose").addEventListener("click", closeFromUi);
    document.getElementById("viewerPrev").addEventListener("click", function () { navigate(-1); });
    document.getElementById("viewerNext").addEventListener("click", function () { navigate(1); });
    document.getElementById("viewerShare").addEventListener("click", shareCurrent);
    document.getElementById("viewerFavorite").addEventListener("click", function () { if (!state.current) return; state.favorites = toggle(state.favorites, state.current.id); write(favoriteKey, state.favorites); setViewerFavorite(); renderCabinet(); toast(has(state.favorites, state.current.id) ? "已收进藏册" : "已从藏册移出"); });
    document.getElementById("viewerRetry").addEventListener("click", function () { if (state.current) openViewer(state.current.id, false); });
    document.getElementById("viewerDetails").addEventListener("click", function () {
      requestDetails();
    });
    window.addEventListener("message", function (event) {
      if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
      var data = event.data || {};
      if (data.type === "canton-close-immersive") closeFromUi();
      else if (data.type === "canton-museum-ready" && state.current && data.id === state.current.id) { state.readyId = data.id; clearTimeout(openTimer); poster.hidden = true; viewerError.hidden = true; markSeen(data.id); if (state.detailsRequested) requestDetails(); }
      else if (data.type === "canton-museum-error" && state.current && data.id === state.current.id) { clearTimeout(openTimer); poster.hidden = true; viewerError.hidden = false; }
    });
    window.addEventListener("popstate", function () { var id = new URL(location.href).searchParams.get("item"); if (id && catalog.byId[id]) { state.routeOwned = false; openViewer(id, false); } else { state.routeOwned = false; closeViewer(false); } });
    window.addEventListener("keydown", function (event) { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); search.focus(); } if (event.key === "Escape" && !viewer.hidden) closeFromUi(); });
  }
  renderTabs(); renderChapters(); renderGrid(); renderCabinet(); bind();
  var initial = new URL(location.href).searchParams.get("item"); if (initial && catalog.byId[initial]) openViewer(initial, false);
}());
