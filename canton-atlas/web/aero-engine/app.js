import { ENGINE_META, PARTS, FEATURES, TOUR_STEPS, PRINCIPLE_STEPS } from './engine-content.js';

const $ = (id) => document.getElementById(id);
const mobileLayout = window.matchMedia('(max-width: 760px)');
const partById = new Map(PARTS.map((part) => [part.id, part]));
const featureById = new Map(FEATURES.map((feature) => [feature.id, feature]));
const iconNames = {
  fan: 'fan',
  compressor: 'compressor',
  combustor: 'flame',
  turbine: 'turbine',
  nozzle: 'nozzle',
  accessories: 'pipe',
};
const state = {
  mode: 'explore',
  selectedPart: null,
  selectedFeature: null,
  exploded: 0,
  cutaway: true,
  labels: true,
  running: false,
  autoOrbit: false,
  tourStep: 0,
  tourPlaying: false,
  principleStep: 0,
  quality: 'auto',
};
const ui = {
  workspace: $('workspace'),
  host: $('scene-host'),
  sidebar: $('sidebar'),
  detail: $('part-detail'),
  annotations: $('annotations'),
  tooltip: $('hover-tip'),
  dialog: $('info-dialog'),
  modeButtons: [...document.querySelectorAll('[data-mode]')],
};
let viewer = null;
let sceneReady = false;
let tourTimer = null;
let toastTimer = null;
let explodeControlsOpen = false;
let lastAnchors = {};
let detailView = null;
let detailOpener = null;
const partButtons = new Map();
const annotationButtons = new Map();
const annotationConnectors = new Map();
const tourDots = [];
const principleButtons = [];
window.__AERIS_READY__ = false;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

function pressed(button, active) {
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', String(active));
}

function notify(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').classList.add('visible');
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 2500);
}

function setSidebar(open) {
  const returnFocus = mobileLayout.matches && !open && ui.sidebar.contains(document.activeElement);
  ui.sidebar.classList.toggle('open', open);
  ui.sidebar.inert = mobileLayout.matches && !open;
  $('mobile-menu').setAttribute('aria-expanded', String(open));
  $('mobile-menu').setAttribute('aria-label', open ? '收起部件导航' : '展开部件导航');
  if (returnFocus) $('mobile-menu').focus({ preventScroll: true });
  updateAnnotations();
}

function currentHighlight() {
  if (state.selectedPart) return state.selectedPart;
  if (state.mode === 'tour') return TOUR_STEPS[state.tourStep].partId;
  if (state.mode === 'principle') return PRINCIPLE_STEPS[state.principleStep].partId;
  return null;
}

function syncPartSelection() {
  const highlighted = currentHighlight();
  partButtons.forEach((button, id) => pressed(button, id === highlighted));
  annotationButtons.forEach((button, id) => pressed(button, id === highlighted));
  viewer?.setHighlight(highlighted);
  updateAnnotations();
}

function setDetailOpen(open) {
  ui.detail.hidden = !open;
  ui.workspace.dataset.detailOpen = String(open);
}

function hideDetail({ restoreCamera = true, restoreFocus = true } = {}) {
  const wasFocused = ui.detail.contains(document.activeElement);
  const opener = detailOpener;
  if (restoreCamera && detailView) viewer?.restoreView({ ...detailView, autoRotate: state.autoOrbit });
  detailView = null;
  detailOpener = null;
  state.selectedPart = null;
  state.selectedFeature = null;
  setDetailOpen(false);
  syncPartSelection();
  if (restoreFocus && wasFocused) {
    const openerAvailable = opener?.isConnected && !opener.closest('[inert]') && !opener.matches(':disabled')
      && opener.matches('button, a[href], input, select, textarea, [tabindex]') && opener.getClientRects().length;
    if (openerAvailable) opener.focus({ preventScroll: true });
    else if (mobileLayout.matches) $('mobile-menu').focus({ preventScroll: true });
    else ui.host.querySelector('canvas')?.focus({ preventScroll: true });
  }
}

function selectPart(id, featureId = null) {
  const part = partById.get(id);
  if (!part) {
    hideDetail();
    return;
  }
  if (ui.detail.hidden) detailOpener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  stopTour();
  setSidebar(false);
  ui.tooltip.hidden = true;
  state.selectedPart = part.id;
  const candidate = featureById.get(featureId);
  const feature = candidate?.partId === id ? candidate : null;
  state.selectedFeature = feature?.id ?? null;
  const content = feature || part;
  $('detail-index').textContent = `${feature ? 'KEY DETAIL' : 'COMPONENT'} / ${part.index}`;
  $('detail-english').textContent = content.english;
  $('detail-title').textContent = content.name;
  $('detail-description').textContent = content.description;
  $('detail-principle').textContent = content.principle;
  $('detail-material').textContent = content.material;
  $('detail-stats').hidden = Boolean(feature);
  $('detail-stats').replaceChildren(
    ...(feature ? [] : part.stats.slice(0, 2)).map((stat) => {
      const wrapper = element('div', 'detail-stat');
      const value = element('strong', '', stat.value);
      if (stat.unit) value.append(element('small', '', stat.unit));
      wrapper.append(element('span', '', stat.label), value);
      return wrapper;
    }),
  );
  $('detail-back').hidden = !feature;
  $('detail-back').textContent = `← 返回${part.name}`;
  $('detail-back').setAttribute('aria-label', `返回所属系统：${part.name}`);
  const featureList = $('detail-features');
  const relatedFeatures = FEATURES.filter((item) => item.partId === part.id || item.relatedPartIds?.includes(part.id));
  featureList.hidden = Boolean(feature) || relatedFeatures.length === 0;
  featureList.replaceChildren(element('span', 'feature-list-label', '深入关键零件'));
  relatedFeatures.forEach((item) => {
    const button = element('button', 'feature-button');
    button.type = 'button';
    button.dataset.feature = item.id;
    button.setAttribute('aria-label', `深入查看${item.name}`);
    button.append(element('span', '', item.name), icon('arrow'));
    button.addEventListener('click', () => selectPart(item.partId, item.id));
    featureList.append(button);
  });
  setDetailOpen(true);
  ui.detail.scrollTop = 0;
  syncPartSelection();
  $('detail-title').setAttribute('tabindex', '-1');
  $('detail-title').focus({ preventScroll: true });
}

function buildParts() {
  PARTS.forEach((part) => {
    const button = element('button', 'part-button');
    button.type = 'button';
    button.dataset.part = part.id;
    button.setAttribute('aria-label', `查看${part.name}`);
    button.setAttribute('aria-pressed', 'false');
    const image = element('span', 'part-icon');
    image.append(icon(iconNames[part.id]));
    const text = element('span');
    text.append(
      element('span', 'part-name', part.name),
      element('span', 'part-english', part.english),
    );
    button.append(image, text, element('span', 'part-index', part.index));
    button.addEventListener('click', () => selectPart(part.id));
    $('parts-list').append(button);
    partButtons.set(part.id, button);
  });
}

function buildAnnotations() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('annotation-connectors');
  svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' });
  ui.annotations.append(svg);
  PARTS.forEach(({ id, name, english }) => {
    const button = element('button', 'model-annotation');
    button.type = 'button';
    button.dataset.part = id;
    button.setAttribute('aria-label', `查看${name}的结构与原理`);
    button.setAttribute('aria-pressed', 'false');
    button.style.transform = 'none';
    button.hidden = true;
    const card = element('span', 'annotation-card');
    const text = element('span');
    text.append(element('strong', '', name), element('small', '', english));
    card.append(text, icon('arrow'));
    button.append(card);
    button.addEventListener('click', () => selectPart(id, state.selectedPart === id ? state.selectedFeature : null));
    button.addEventListener('pointerenter', () => viewer?.setHighlight(id));
    button.addEventListener('pointerleave', () => viewer?.setHighlight(currentHighlight()));
    button.addEventListener('focus', () => viewer?.setHighlight(id));
    button.addEventListener('blur', () => viewer?.setHighlight(currentHighlight()));
    ui.annotations.append(button);
    annotationButtons.set(id, button);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('stroke', '#c2e9ac');
    line.setAttribute('stroke-width', '1');
    line.setAttribute('opacity', '0.55');
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '3');
    dot.setAttribute('fill', '#c2e9ac');
    dot.setAttribute('stroke', '#e5f1dc');
    dot.setAttribute('stroke-width', '1');
    group.append(line, dot);
    svg.append(group);
    annotationConnectors.set(id, { group, line, dot });
  });
}

function updateAnnotations(anchors = lastAnchors) {
  lastAnchors = anchors || {};
  ui.annotations.hidden = !state.labels || !sceneReady || (mobileLayout.matches && ui.sidebar.classList.contains('open'));
  if (ui.annotations.hidden) return;
  const width = ui.host.clientWidth;
  const height = ui.host.clientHeight;
  const hostBounds = ui.host.getBoundingClientRect();
  const obstacles = [...ui.workspace.querySelectorAll(
    '.stage-heading, .stage-meta, .view-switch, #explode-control, #part-detail, #principle-panel, .viewer-toolbar, .orbit-button, .model-caption, .quality-control',
  )].flatMap((node) => {
    if (!node.getClientRects().length || getComputedStyle(node).visibility === 'hidden') return [];
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return [];
    return [{ x: rect.left - hostBounds.left - 9, y: rect.top - hostBounds.top - 9, width: rect.width + 18, height: rect.height + 18 }];
  });
  const collides = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const focusedLabel = document.activeElement instanceof Element
    ? document.activeElement.closest('.model-annotation')?.dataset.part
    : null;
  const priority = focusedLabel || currentHighlight();
  const initialOrder = ['fan', 'combustor', 'compressor', 'turbine', 'nozzle', 'accessories'];
  const order = priority ? [priority, ...initialOrder.filter((id) => id !== priority)] : initialOrder;
  const limit = state.mode === 'explore' ? 3 : priority ? 1 : 2;
  const placed = [];
  const visibleLabels = new Set();
  for (const id of order) {
    if (placed.length >= limit) break;
    const button = annotationButtons.get(id);
    const explicit = id === priority;
    const feature = state.selectedPart === id ? featureById.get(state.selectedFeature) : null;
    const anchor = lastAnchors[feature?.id] || lastAnchors[id];
    const visible = anchor?.visible && Number.isFinite(anchor.x) && Number.isFinite(anchor.y);
    if (!visible || (anchor.occluded && !explicit)) continue;
    if (anchor.x < 0 || anchor.x > width || anchor.y < 0 || anchor.y > height) continue;
    const part = partById.get(id);
    const compactEnglish = { fan: 'FAN & INLET', compressor: 'COMPRESSOR', combustor: 'COMBUSTOR', turbine: 'TURBINE', nozzle: 'EXHAUST', accessories: 'ACCESSORIES' };
    const label = feature?.name || part.name;
    button.querySelector('strong').textContent = label;
    button.querySelector('small').textContent = anchor.occluded ? '内部位置 · INTERNAL' : feature?.english || compactEnglish[id];
    button.setAttribute('aria-label', `查看${label}的结构与原理${anchor.occluded ? '，当前位于其他结构后方' : ''}`);
    button.dataset.occluded = String(Boolean(anchor.occluded));
    button.hidden = false;
    const w = button.offsetWidth;
    const h = button.offsetHeight;
    const x = anchor.x;
    const y = anchor.y;
    const candidates = [
      { x: x + 27, y: y - h / 2 },
      { x: x - w - 27, y: y - h / 2 },
      { x: x - w / 2, y: y - h - 30 },
      { x: x - w / 2, y: y + 30 },
      { x: x + 24, y: y - h - 25 },
      { x: x - w - 24, y: y - h - 25 },
      { x: x + 24, y: y + 25 },
      { x: x - w - 24, y: y + 25 },
    ];
    if (explicit) {
      // A focused label may move farther away, but keeps its real projected
      // anchor and a leader; ordinary labels are suppressed if space is tight.
      for (const row of [0.34, 0.48, 0.62, 0.76]) {
        for (const column of [16, width / 2 - w / 2, width - w - 16]) {
          candidates.push({ x: column, y: height * row });
        }
      }
    }
    const position = candidates
      .map((candidate) => ({ ...candidate, width: w, height: h }))
      .filter((candidate) => candidate.x >= 12 && candidate.y >= 12 && candidate.x + w <= width - 12 && candidate.y + h <= height - 12)
      .filter((candidate) => !obstacles.some((obstacle) => collides(candidate, obstacle)) && !placed.some((other) => collides(candidate, other)))
      .sort((a, b) => Math.hypot(a.x + w / 2 - x, a.y + h / 2 - y) - Math.hypot(b.x + w / 2 - x, b.y + h / 2 - y))[0];
    if (!position) {
      button.hidden = true;
      continue;
    }
    button.style.left = `${Math.round(position.x)}px`;
    button.style.top = `${Math.round(position.y)}px`;
    visibleLabels.add(id);
    placed.push({ x: position.x - 8, y: position.y - 8, width: w + 16, height: h + 16 });
    const { group, line, dot } = annotationConnectors.get(id);
    group.style.display = '';
    line.setAttribute('x1', String(x));
    line.setAttribute('y1', String(y));
    line.setAttribute('x2', String(Math.max(position.x, Math.min(position.x + w, x))));
    line.setAttribute('y2', String(Math.max(position.y, Math.min(position.y + h, y))));
    line.setAttribute('stroke-dasharray', anchor.occluded ? '3 4' : 'none');
    dot.setAttribute('cx', String(x));
    dot.setAttribute('cy', String(y));
  }
  annotationButtons.forEach((button, id) => {
    const visible = visibleLabels.has(id);
    button.hidden = !visible;
    annotationConnectors.get(id).group.style.display = visible ? '' : 'none';
  });
}

function handleHover(id, event, featureId = null) {
  const part = partById.get(id);
  if (!part || !event || ui.dialog.open || !sceneReady) {
    ui.tooltip.hidden = true;
    viewer?.setHighlight(currentHighlight());
    return;
  }
  viewer?.setHighlight(part.id);
  const feature = featureById.get(featureId);
  ui.tooltip.textContent = feature?.partId === id ? `${feature.name} · 点击查看结构与原理` : `${part.name} · ${part.subtitle}`;
  ui.tooltip.hidden = false;
  const x = Math.max(12, Math.min(window.innerWidth - ui.tooltip.offsetWidth - 12, event.clientX + 16));
  const y = Math.max(12, Math.min(window.innerHeight - ui.tooltip.offsetHeight - 12, event.clientY + 16));
  ui.tooltip.style.left = `${x}px`;
  ui.tooltip.style.top = `${y}px`;
}

function syncExplodedControl(amount, showControls = amount > 0) {
  state.exploded = Math.max(0, Math.min(1, Number(amount) || 0));
  explodeControlsOpen = showControls;
  const percentage = Math.round(state.exploded * 100);
  $('explode-range').value = String(percentage);
  $('explode-range').setAttribute('aria-valuetext', `${percentage}% 拆解`);
  $('explode-output').textContent = `${percentage}%`;
  $('explode-control').hidden = !explodeControlsOpen;
  pressed($('assembled-view'), state.exploded === 0);
  pressed($('exploded-view'), state.exploded > 0);
}

function setExploded(amount, showControls = amount > 0) {
  syncExplodedControl(amount, showControls);
  viewer?.setExplode(state.exploded);
}

function setCutaway(enabled) {
  state.cutaway = Boolean(enabled);
  viewer?.setCutaway(state.cutaway);
  pressed($('toggle-cutaway'), state.cutaway);
}

function setLabels(enabled) {
  state.labels = Boolean(enabled);
  pressed($('toggle-labels'), state.labels);
  updateAnnotations();
}

function setAutoOrbit(enabled) {
  state.autoOrbit = Boolean(enabled);
  viewer?.setAutoRotate(state.autoOrbit);
  pressed($('auto-orbit'), state.autoOrbit);
}

function setRunning(enabled) {
  state.running = Boolean(enabled);
  viewer?.setRunning(state.running);
  const button = $('toggle-running');
  button.querySelector('use').setAttribute('href', state.running ? '#i-pause' : '#i-play');
  button.querySelector('span').textContent = state.running ? '暂停运行' : '继续运行';
  button.setAttribute('aria-label', state.running ? '暂停发动机与气流动画' : '继续发动机与气流动画');
  button.setAttribute('aria-pressed', String(state.running));
}

function setExperience(title, description, section) {
  $('experience-title').textContent = title;
  $('experience-description').textContent = description;
  $('experience-description').title = description;
  const number = document.querySelector('.section-number');
  number.replaceChildren(document.createTextNode(section), element('span', '', '/ 03'));
  $('toggle-experience-details').hidden = state.mode === 'explore';
  $('toggle-experience-details').setAttribute('aria-label', `阅读完整说明：${title}`);
}

function setStageTitle(title, subtitle) {
  $('stage-title').replaceChildren(document.createTextNode(title), element('span', '', '。'));
  $('stage-subtitle').textContent = subtitle;
}

function updateTourControls() {
  $('tour-counter').textContent = `${String(state.tourStep + 1).padStart(2, '0')} / ${String(TOUR_STEPS.length).padStart(2, '0')}`;
  $('tour-prev').disabled = state.tourStep === 0;
  $('tour-next').disabled = state.tourStep === TOUR_STEPS.length - 1;
  tourDots.forEach((button, index) => {
    pressed(button, index === state.tourStep);
    if (index === state.tourStep) button.setAttribute('aria-current', 'step');
    else button.removeAttribute('aria-current');
  });
  const play = $('tour-play');
  play.querySelector('use').setAttribute('href', state.tourPlaying ? '#i-pause' : '#i-play');
  play.setAttribute('aria-pressed', String(state.tourPlaying));
  play.setAttribute('aria-label', state.tourPlaying ? '暂停自动拆解' : state.tourStep === TOUR_STEPS.length - 1 ? '重新播放拆解之旅' : '自动播放拆解');
  play.title = state.tourPlaying ? '暂停 · 每 6 秒进入下一步' : '自动播放 · 每步 6 秒';
}

function stopTour() {
  clearTimeout(tourTimer);
  tourTimer = null;
  state.tourPlaying = false;
  updateTourControls();
}

function setTourStep(index, keepPlaying = false) {
  if (!keepPlaying) stopTour();
  state.tourStep = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
  const step = TOUR_STEPS[state.tourStep];
  hideDetail({ restoreCamera: false, restoreFocus: false });
  ui.tooltip.hidden = true;
  syncExplodedControl(step.explode);
  setCutaway(step.cutaway);
  viewer?.setTourStep(state.tourStep);
  syncPartSelection();
  setExperience(step.title, step.description, '03');
  if (state.tourStep === TOUR_STEPS.length - 1) stopTour();
  updateTourControls();
}

function scheduleTour() {
  clearTimeout(tourTimer);
  if (!state.tourPlaying || state.mode !== 'tour' || document.hidden) return;
  tourTimer = setTimeout(() => {
    if (!state.tourPlaying || state.mode !== 'tour' || document.hidden) return;
    setTourStep(state.tourStep + 1, true);
    if (state.tourPlaying) scheduleTour();
  }, 6000);
}

function toggleTour() {
  if (state.tourPlaying) {
    stopTour();
    return;
  }
  if (state.mode !== 'tour') setMode('tour');
  if (state.tourStep === TOUR_STEPS.length - 1) setTourStep(0);
  hideDetail();
  state.tourPlaying = true;
  syncPartSelection();
  updateTourControls();
  scheduleTour();
}

function setPrincipleStep(index) {
  state.principleStep = Math.max(0, Math.min(PRINCIPLE_STEPS.length - 1, index));
  const step = PRINCIPLE_STEPS[state.principleStep];
  hideDetail({ restoreCamera: false, restoreFocus: false });
  $('principle-description').replaceChildren(
    document.createTextNode(step.description),
    element('span', 'principle-trend', `定性趋势：${step.trend}`),
  );
  principleButtons.forEach((button, i) => pressed(button, i === state.principleStep));
  setExperience(`气流与能量 · ${step.title}`, step.energy, '02');
  viewer?.setPrincipleStage(step.id);
  syncPartSelection();
}

function setMode(mode) {
  if (!['explore', 'principle', 'tour'].includes(mode)) return;
  stopTour();
  hideDetail({ restoreCamera: false, restoreFocus: false });
  viewer?.setPrincipleStage(null);
  state.mode = mode;
  ui.tooltip.hidden = true;
  ui.workspace.dataset.mode = mode;
  document.body.dataset.mode = mode;
  ui.modeButtons.forEach((button) => pressed(button, button.dataset.mode === mode));
  $('principle-panel').hidden = mode !== 'principle';
  $('tour-controls').hidden = mode !== 'tour';
  $('toggle-running').hidden = mode !== 'principle';
  $('start-tour').hidden = mode !== 'explore';
  setSidebar(false);
  setAutoOrbit(false);
  viewer?.setAirflow(mode === 'principle');
  setRunning(mode === 'principle');
  if (mode === 'principle') {
    setStageTitle('看见，每一次能量转换', '沿着气流的方向，理解飞行背后的动力循环。');
    setExperience('一口空气，如何推动一架飞机', '点击上方阶段，追踪气流与能量的变化。', '02');
    setExploded(0, false);
    setCutaway(true);
    setPrincipleStep(0);
  } else if (mode === 'tour') {
    setStageTitle('层层展开，精密之美', '七个步骤，读懂一台航空发动机的构造。');
    setTourStep(0);
  } else {
    setStageTitle('动力，源自精密', '穿透表象，探索航空发动机的非凡构造。');
    setExperience('从整体，到每一个细节', '自由探索，或开启一场有引导的拆解之旅。', '01');
    setExploded(0, false);
    setCutaway(true);
    viewer?.setCameraPreset('overview');
    syncPartSelection();
  }
}

function buildSteps() {
  TOUR_STEPS.forEach((step, index) => {
    const button = element('button');
    button.type = 'button';
    button.setAttribute('aria-label', `第 ${index + 1} 步：${step.title}`);
    button.title = step.title;
    button.addEventListener('click', () => setTourStep(index));
    $('tour-dots').append(button);
    tourDots.push(button);
  });
  PRINCIPLE_STEPS.forEach((step, index) => {
    const button = element('button', 'principle-step');
    button.type = 'button';
    button.style.setProperty('--step-color', step.color);
    button.setAttribute('aria-label', `${step.title}：${step.description}`);
    const text = element('div');
    text.append(element('strong', '', step.title), element('small', '', step.english));
    button.append(element('span', '', String(index + 1).padStart(2, '0')), text);
    button.addEventListener('click', () => setPrincipleStep(index));
    $('principle-steps').append(button);
    principleButtons.push(button);
  });
}

function showDialog(type) {
  stopTour();
  ui.tooltip.hidden = true;
  const content = $('dialog-content');
  content.replaceChildren();
  $('dialog-done').replaceChildren(document.createTextNode('继续探索'), icon('arrow'));
  $('toggle-experience-details').setAttribute('aria-expanded', String(type === 'experience'));
  if (type === 'experience') {
    if (state.mode === 'tour') {
      const step = TOUR_STEPS[state.tourStep];
      $('dialog-kicker').textContent = `DISASSEMBLY / ${String(state.tourStep + 1).padStart(2, '0')}`;
      content.append(
        element('h2', '', step.title),
        element('p', '', step.description),
        element('p', 'dialog-note', '每一步仅移动当前拆出的组件，前面的组件保持展开，后续组件保持装配。使用“上一步”可反向装回；拆解顺序、间隙和路径是教学示意。'),
      );
    } else if (state.mode === 'principle') {
      const step = PRINCIPLE_STEPS[state.principleStep];
      $('dialog-kicker').textContent = `ENERGY FLOW / ${step.english}`;
      content.append(
        element('h2', '', step.title),
        element('p', '', step.description),
        element('p', '', `压力与温度的定性趋势：${step.trend}`),
        element('p', '', step.energy),
        element('p', '', '动力传递示意中，青色表示低压轴连接风扇与低压压气机，紫色表示高压轴连接高压压气机。两套轴系同轴布置、独立旋转。'),
        element('p', 'dialog-note', '气流颜色、粒子速度与双轴转速用于说明能量流向和系统关系，不是实测温度、压力或转速，也不构成性能仿真。'),
      );
    } else {
      $('dialog-kicker').textContent = 'EXPLORE EVERY DETAIL';
      content.append(
        element('h2', '', '从整体，到关键零件'),
        element('p', '', '点击模型、标注或左侧系统列表查看部件说明，再通过“深入关键零件”了解代表性叶片、转子、喷嘴、同轴轴系、尾锥与滑油管。'),
        element('p', '', '爆炸视图可以连续调整各系统的展开距离；分步拆解则逐个移出组件。查看详情不会中断原理演示，临时聚焦后关闭详情可返回原观察位置。'),
        element('p', 'dialog-note', ENGINE_META.note),
      );
    }
  } else if (type === 'specs') {
    $('dialog-kicker').textContent = 'ENGINE TECHNICAL FILE';
    content.append(
      element('h2', '', ENGINE_META.model),
      element('p', '', `${ENGINE_META.name} · ${ENGINE_META.category}`),
    );
    const grid = element('dl', 'spec-grid');
    ENGINE_META.specs.forEach((stat) => {
      const cell = element('div');
      const value = element('dd', '', stat.value);
      if (stat.unit) value.append(document.createTextNode(' '), element('small', '', stat.unit));
      cell.append(element('dt', '', stat.label), value);
      grid.append(cell);
    });
    content.append(
      grid,
      element('p', '', ENGINE_META.specificationNote),
      element('p', 'dialog-note', ENGINE_META.note),
    );
  } else if (type === 'help') {
    $('dialog-kicker').textContent = 'YOUR EXPLORATION GUIDE';
    content.append(element('h2', '', '自由探索，从这里开始'));
    content.append(element('p', '', '拖动模型旋转视角，点击部件或左侧列表查看说明。部件卡片内可深入关键零件；查看详情保留当前原理阶段与动画。点“聚焦此部件”临时近看，关闭详情返回聚焦前的观察位置。'));
    content.append(element('p', '', '爆炸视图的滑块控制整体展开；分步拆解逐件移出组件，“上一步”反向装回。虚线标注表示重点结构位于外壳后方，开启剖面可看清内部。画质可选自动、清晰或流畅。'));
    const grid = element('div', 'help-grid');
    [
      ['旋转视角', '鼠标拖动 / 单指拖动'],
      ['缩放 / 平移', '滚轮 / 双指手势'],
      ['重置视角', 'R'],
      ['切换剖面', 'C'],
      ['显示 / 隐藏标注', 'L'],
      ['全屏体验', 'F'],
      ['拆解上一步 / 下一步', '← / →'],
      ['播放 / 暂停当前演示', 'Space'],
      ['关闭说明 / 导航', 'Esc'],
    ].forEach(([label, key]) => grid.append(element('span', '', label), element('kbd', '', key)));
    content.append(grid, element('p', 'dialog-note', '分步拆解的自动播放需手动开启，每一步停留 6 秒。切换页面或隐藏标签页后会停止自动播放。键盘焦点位于输入框或弹窗中时，不触发场景快捷键。'));
  } else {
    $('dialog-kicker').textContent = 'ABOUT AERIS ENGINE LAB';
    content.append(
      element('h2', '', '让复杂，变得直观。'),
      element('p', '', 'AERIS 航空动力实验室是一座可以自由探索的数字展台。通过 Three.js 实时三维、分步骤拆解与气流演示，将航空发动机的精密结构和工作原理连接起来。'),
      element('p', '', '在结构探索中认识部件，在原理实验室中追踪能量，在拆解之旅中理解整体。金属表面、叶片与管路均为实时渲染，拖动即可从任意角度观察。'),
      element('p', 'dialog-note', ENGINE_META.note),
    );
  }
  if (!ui.dialog.open) ui.dialog.showModal();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else notify('当前浏览器未提供全屏功能，可使用浏览器的全屏模式。');
  } catch {
    notify('暂时无法进入全屏，请检查浏览器的全屏权限。');
  }
}

function resetCamera() {
  detailView = null;
  setAutoOrbit(false);
  viewer?.resetCamera();
  notify(sceneReady ? '已恢复默认视角' : '3D 展台尚未就绪，可继续浏览部件资料。');
}

function bindControls() {
  ui.modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $('start-tour').addEventListener('click', () => setMode('tour'));
  $('close-detail').addEventListener('click', hideDetail);
  $('detail-back').addEventListener('click', () => {
    if (state.selectedPart) selectPart(state.selectedPart);
  });
  $('focus-part').addEventListener('click', () => {
    if (state.selectedPart && viewer) {
      if (!detailView) detailView = viewer.captureView();
      viewer.focusPart(state.selectedFeature || state.selectedPart);
    }
    if (!sceneReady) notify('3D 展台暂时无法启动，部件说明仍可查看。');
  });
  $('assembled-view').addEventListener('click', () => {
    if (state.mode === 'tour') setMode('explore');
    stopTour();
    setExploded(0, false);
  });
  $('exploded-view').addEventListener('click', () => {
    if (state.mode !== 'explore') setMode('explore');
    stopTour();
    setExploded(1, true);
  });
  $('explode-range').addEventListener('input', (event) => {
    const amount = Number(event.target.value) / 100;
    if (state.mode === 'tour') setMode('explore');
    stopTour();
    setExploded(amount, true);
  });
  $('toggle-cutaway').addEventListener('click', () => {
    stopTour();
    setCutaway(!state.cutaway);
  });
  $('toggle-labels').addEventListener('click', () => setLabels(!state.labels));
  $('auto-orbit').addEventListener('click', () => setAutoOrbit(!state.autoOrbit));
  $('reset-camera').addEventListener('click', resetCamera);
  $('zoom-in').addEventListener('click', () => viewer?.zoom(0.82));
  $('zoom-out').addEventListener('click', () => viewer?.zoom(1.22));
  $('toggle-fullscreen').addEventListener('click', toggleFullscreen);
  $('toggle-running').addEventListener('click', () => setRunning(!state.running));
  $('tour-prev').addEventListener('click', () => setTourStep(state.tourStep - 1));
  $('tour-next').addEventListener('click', () => setTourStep(state.tourStep + 1));
  $('tour-play').addEventListener('click', toggleTour);
  $('mobile-menu').addEventListener('click', () => setSidebar(!ui.sidebar.classList.contains('open')));
  mobileLayout.addEventListener('change', () => setSidebar(ui.sidebar.classList.contains('open')));
  $('open-about').addEventListener('click', () => showDialog('about'));
  $('open-help').addEventListener('click', () => showDialog('help'));
  $('mobile-help').addEventListener('click', () => {
    setSidebar(false);
    showDialog('help');
  });
  $('open-specs').addEventListener('click', () => showDialog('specs'));
  $('quality-select').setAttribute('aria-label', '三维画质');
  $('quality-select').addEventListener('change', (event) => {
    state.quality = ['auto', 'high', 'low'].includes(event.target.value) ? event.target.value : 'auto';
    viewer?.setQuality(state.quality);
    notify({ auto: '已启用自动画质，按帧耗时调整显示精度', high: '已切换到清晰画质', low: '已切换到流畅画质' }[state.quality]);
  });
  $('toggle-experience-details').setAttribute('aria-haspopup', 'dialog');
  $('toggle-experience-details').setAttribute('aria-controls', 'info-dialog');
  $('toggle-experience-details').setAttribute('aria-expanded', 'false');
  $('toggle-experience-details').addEventListener('click', () => showDialog('experience'));
  $('close-dialog').addEventListener('click', () => ui.dialog.close());
  $('dialog-done').addEventListener('click', () => ui.dialog.close());
  $('retry-scene').addEventListener('click', () => window.location.reload());
  ui.dialog.addEventListener('close', () => $('toggle-experience-details').setAttribute('aria-expanded', 'false'));
  ui.dialog.addEventListener('click', (event) => {
    if (event.target !== ui.dialog) return;
    const rect = ui.dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) ui.dialog.close();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!ui.sidebar.contains(event.target) && !$('mobile-menu').contains(event.target)) setSidebar(false);
  });
  ui.host.addEventListener('pointerleave', () => handleHover(null));
  document.addEventListener('fullscreenchange', () => {
    const fullscreen = Boolean(document.fullscreenElement);
    pressed($('toggle-fullscreen'), fullscreen);
    $('toggle-fullscreen').setAttribute('aria-label', fullscreen ? '退出全屏' : '进入全屏');
    $('toggle-fullscreen').title = fullscreen ? '退出全屏 · F' : '全屏 · F';
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    stopTour();
    ui.tooltip.hidden = true;
    if (state.running) setRunning(false);
    setAutoOrbit(false);
  });
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.repeat || ui.dialog.open) return;
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      hideDetail();
      setSidebar(false);
      ui.tooltip.hidden = true;
    } else if (key === 'r') {
      resetCamera();
    } else if (key === 'c') {
      stopTour();
      setCutaway(!state.cutaway);
    } else if (key === 'l') {
      setLabels(!state.labels);
    } else if (key === 'f') {
      void toggleFullscreen();
    } else if (state.mode === 'tour' && (key === 'arrowleft' || key === 'arrowright')) {
      event.preventDefault();
      setTourStep(state.tourStep + (key === 'arrowright' ? 1 : -1));
    } else if (key === ' ' && !(target instanceof Element && target.closest('button, a, [role="button"]'))) {
      if (state.mode === 'tour') {
        event.preventDefault();
        toggleTour();
      } else if (state.mode === 'principle') {
        event.preventDefault();
        setRunning(!state.running);
      }
    }
  });
  window.addEventListener('pagehide', (event) => {
    stopTour();
    clearTimeout(toastTimer);
    if (!event.persisted) viewer?.dispose();
  });
  window.addEventListener('resize', () => updateAnnotations());
}

function setSceneStatus(message, failed = false) {
  const status = document.querySelector('.live-status');
  const dot = element('i');
  if (failed) dot.style.background = '#e7b186';
  status.replaceChildren(dot, document.createTextNode(` ${message}`));
  const pill = document.querySelector('.live-pill');
  pill.replaceChildren(element('i'), document.createTextNode(failed ? '3D OFFLINE' : 'LIVE 3D'));
}

function showSceneError(message) {
  sceneReady = false;
  stopTour();
  setRunning(false);
  setAutoOrbit(false);
  $('loading-screen').hidden = true;
  $('scene-error').hidden = false;
  $('scene-error-message').textContent = message;
  ui.annotations.hidden = true;
  ui.tooltip.hidden = true;
  setSceneStatus('3D 暂不可用 · 资料可浏览', true);
  window.__AERIS_READY__ = true;
}

async function initializeViewer() {
  try {
    const { createEngineViewer } = await import('./engine-viewer.js');
    viewer = createEngineViewer(ui.host, {
      onSelect: selectPart,
      onHover: handleHover,
      onFrame: ({ anchors }) => updateAnnotations(anchors),
      onContextLost: () => showSceneError('三维图形上下文已中断。请重新加载展台；部件说明、技术档案与拆解步骤仍可浏览。'),
    });
    viewer.setQuality(state.quality);
    if (state.mode !== 'tour') viewer.setExplode(state.exploded);
    viewer.setCutaway(state.cutaway);
    viewer.setRunning(state.running);
    viewer.setAirflow(state.mode === 'principle');
    viewer.setAutoRotate(state.autoOrbit);
    if (state.mode === 'tour') viewer.setTourStep(state.tourStep);
    if (state.mode === 'principle') viewer.setPrincipleStage(PRINCIPLE_STEPS[state.principleStep].id);
    syncPartSelection();
    sceneReady = true;
    $('loading-screen').hidden = true;
    $('scene-error').hidden = true;
    setSceneStatus('交互体验已就绪');
    updateAnnotations();
    window.__AERIS_READY__ = true;
  } catch (error) {
    console.error('AERIS: 3D viewer initialization failed.', error);
    try { viewer?.dispose(); } catch { /* The content interface remains usable. */ }
    viewer = null;
    showSceneError('请使用支持 WebGL 2 的浏览器并开启硬件加速，或重新加载页面。部件资料、工作原理与拆解说明仍可查看。');
  }
}

window.aerisDiagnostics = () => ({
  mode: state.mode,
  selectedPart: state.selectedPart,
  selectedFeature: state.selectedFeature,
  detailOpen: !ui.detail.hidden,
  exploded: state.exploded,
  cutaway: state.cutaway,
  labels: state.labels,
  running: state.running,
  tourStep: state.tourStep,
  tourPlaying: state.tourPlaying,
  principleStep: state.principleStep,
  quality: state.quality,
  sceneReady,
  viewer: viewer?.getDiagnostics() ?? null,
});

buildParts();
buildAnnotations();
buildSteps();
bindControls();
setMode('explore');
setLabels(true);
setSceneStatus('正在准备 3D 展台');
void initializeViewer();
