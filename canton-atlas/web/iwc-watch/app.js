import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWatch } from './watch-model.js';
import { createMovement } from './movement.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const experience = $('#experience');
const viewport = $('#viewport');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => window.innerWidth <= 680;
const state = {
  explosion: 0, targetExplosion: 0, selected: null, isolated: false,
  view: 'hero', autoRotate: false, paused: false, separated: new Set(),
  filter: 'all', search: '', ready: false,
};
const categories = { case: '表壳组件', exterior: '表壳组件', dial: '表盘组件', hands: '指针组件', strap: '表带组件', movement: '机芯组件' };
const viewNames = { hero: ['经典视角', 'THE COMPLETE TIMEPIECE'], front: ['正面表盘', 'THE FACE OF TIME'], back: ['透底机芯', 'THE MECHANICAL HEART'], side: ['侧面轮廓', 'PRECISION IN PROFILE'], exploded: ['拆解探索', 'THE ANATOMY OF TIME'], isolated: ['独立部件', 'EVERY PART MATTERS'] };
let renderer, scene, camera, controls, watch, movement, assembly, parts = [], partsById;
let selectedMaterials = [], cameraTween = null, lastFrame = performance.now(), elapsed = 0;
let lastDate = new Date(), lastClockSecond = -1, toastTimer, lastPickPoint, lastHoverAt = 0;
let frameHandle, fps = 60, frameSamples = 0, frameDuration = 0, qualityAt = 0;
const activePointers = new Set();
let multiTouchGesture = false;
let savedIsolation = null, drawerFocus = null, animationStarted = false, disposed = false;
const vTarget = new THREE.Vector3(), vCenter = new THREE.Vector3();
const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();

function toast(message) {
  $('#toast').textContent = message;
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 3000);
}

function makeStudioEnvironment() {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color('#646b70');
  const room = new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: '#62696b', side: THREE.BackSide }));
  studio.add(room);
  const panel = (color, strength, width, height, position) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    studio.add(mesh);
  };
  panel('#ffffff', 5.2, 5, 10, [-5, 4, 6]);
  panel('#e5edff', 3.4, 2, 10, [7, 1, 3]);
  panel('#fff5e4', 4.5, 8, 3, [0, 8, 0]);
  panel('#ffffff', 2.8, 3, 8, [-6, 0, -5]);
  panel('#e7eaf0', 3.2, 7, 4, [3, 4, -7]);
  panel('#171e22', 1, 4, 12, [0, -1, 8]);
  panel('#11191c', 1, 12, 6, [1, -7, 0]);
  const generator = new THREE.PMREMGenerator(renderer);
  const result = generator.fromScene(studio, 0.045, 0.1, 40);
  scene.environment = result.texture;
  scene.environmentIntensity = 0.72;
  studio.traverse(object => {
    if (object.isMesh) { object.geometry.dispose(); object.material.dispose(); }
  });
  generator.dispose();
  return result;
}

function setExpanded(expanded) {
  experience.classList.toggle('expanded', expanded || state.isolated);
  resize();
}

function resize() {
  if (!renderer) return;
  const { width, height } = viewport.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function cameraTo(position, target = [0, 0, 0], duration = 1150) {
  cameraTween = {
    start: performance.now(),
    duration: reducedMotion ? 1 : duration,
    from: camera.position.clone(),
    to: new THREE.Vector3(...position),
    targetFrom: controls.target.clone(),
    targetTo: new THREE.Vector3(...target),
  };
}

function presetPosition(view) {
  const narrow = mobile();
  if (view === 'exploded') return narrow ? [31.5, 14.0, -20.5] : [23.5, 9.0, -15.8];
  if (view === 'front') return narrow ? [0, 0, 23.5] : [0, 0, 21.8];
  if (view === 'back') return narrow ? [-2.6, 2.0, -23.0] : [-3.0, 3.5, -20.0];
  if (view === 'side') return narrow ? [24.5, 6.0, 5.5] : [22.0, 5.5, 4.5];
  return narrow ? [5.5, 5.5, 21.8] : [5.8, 5.7, 18.8];
}

function updateCaption(view) {
  const names = viewNames[view] || viewNames.hero;
  $('#view-caption').textContent = names[0];
  $('#view-caption-en').textContent = names[1];
  $('.caption-number').textContent = view === 'back' ? '02' : view === 'exploded' ? '03' : view === 'isolated' ? '04' : '01';
}

function selectView(view, notify = false) {
  if (state.isolated) exitIsolation(false);
  state.view = view;
  state.autoRotate = false;
  controls.autoRotate = false;
  $('#auto-rotate').setAttribute('aria-pressed', 'false');
  $$('.view-button').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const target = state.targetExplosion > 0.05 ? [0, 0, -0.8] : [0, 0.15, 0];
  cameraTo(presetPosition(view), target);
  updateCaption(view);
  const back = view === 'back';
  $('#nav-watch').classList.toggle('active', !back);
  $('#nav-movement').classList.toggle('active', back);
  $('#nav-watch').removeAttribute('aria-current');
  $('#nav-movement').removeAttribute('aria-current');
  $(back ? '#nav-movement' : '#nav-watch').setAttribute('aria-current', 'page');
  if (notify) toast(`已切换至${viewNames[view]?.[0] || '拆解视角'}`);
}

function syncExplosionControls() {
  const amount = Math.round(state.targetExplosion * 100);
  $('#explosion').value = amount;
  $('#explosion').style.setProperty('--progress', `${amount}%`);
  $('#explosion-value').innerHTML = `${amount}<span>%</span>`;
  const exploded = amount > 0;
  $('#assembled-button').classList.toggle('active', !exploded);
  $('#assembled-button').setAttribute('aria-pressed', String(!exploded));
  $('#exploded-button').classList.toggle('active', exploded);
  $('#exploded-button').setAttribute('aria-pressed', String(exploded));
}

function setExplosion(value, changeView = true) {
  if (state.isolated) exitIsolation(false);
  const wasExploded = state.targetExplosion > 0;
  state.targetExplosion = THREE.MathUtils.clamp(value, 0, 1);
  syncExplosionControls();
  setExpanded(state.targetExplosion > 0);
  if (changeView && state.targetExplosion > 0 && !wasExploded) selectView('exploded');
  if (changeView && state.targetExplosion === 0) selectView('hero');
  if (state.targetExplosion > 0) updateCaption('exploded');
}

function restoreHighlight() {
  for (const { mesh, original, cloned } of selectedMaterials) {
    mesh.material = original;
    for (const material of cloned) material.dispose();
  }
  selectedMaterials = [];
}

function highlight(part) {
  restoreHighlight();
  if (!part || state.isolated) return;
  part.object.traverse(mesh => {
    if (!mesh.isMesh || mesh.userData.isGlass) return;
    const original = mesh.material;
    const cloned = (Array.isArray(original) ? original : [original]).map(material => {
      const copy = material.clone();
      if (copy.emissive) { copy.emissive.set('#b39968'); copy.emissiveIntensity = 0.11; }
      return copy;
    });
    mesh.material = Array.isArray(original) ? cloned : cloned[0];
    selectedMaterials.push({ mesh, original, cloned });
  });
}

function updatePartCard(part) {
  $('#part-card').hidden = !part;
  if (!part) return;
  $('#part-index').textContent = `COMPONENT / ${String(parts.indexOf(part) + 1).padStart(3, '0')}`;
  $('#part-category').textContent = categories[part.category] || '精密部件';
  $('#part-name').textContent = part.name;
  $('#part-name-en').textContent = part.nameEn;
  $('#part-description').textContent = part.description;
  $('#part-material').textContent = part.material;
  $('#part-dimensions').textContent = part.dimensions || '';
  $('#part-dimension-row').hidden = !part.dimensions;
  $('#isolate-part').innerHTML = `<svg><use href="#icon-eye"/></svg>${state.isolated ? '返回整表' : '单独查看'}`;
  $('#separate-part').setAttribute('aria-pressed', String(state.separated.has(part.id)));
  $('#separate-part span').textContent = state.separated.has(part.id) ? '归位部件' : '分离部件';
  $('#separate-part').disabled = state.isolated;
}

function selectPart(id) {
  const part = partsById.get(id);
  if (!part) return;
  if (state.isolated && state.selected !== id) exitIsolation(false);
  state.selected = id;
  state.autoRotate = false;
  controls.autoRotate = false;
  $('#auto-rotate').setAttribute('aria-pressed', 'false');
  highlight(part);
  updatePartCard(part);
  $$('.part-row').forEach(row => row.classList.toggle('active', row.dataset.part === id));
}

function clearSelection() {
  if (state.isolated) exitIsolation();
  state.selected = null;
  restoreHighlight();
  $('#part-card').hidden = true;
}

function isolatePart() {
  if (state.isolated) { exitIsolation(); return; }
  const part = partsById.get(state.selected);
  if (!part) return;
  savedIsolation = { position: camera.position.clone(), target: controls.target.clone(), minDistance: controls.minDistance, maxDistance: controls.maxDistance };
  state.isolated = true;
  restoreHighlight();
  parts.forEach(item => { item.object.visible = item === part; });
  experience.classList.add('isolated');
  setExpanded(true);
  $('#return-button').hidden = false;
  assembly.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(part.object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 0.07);
  const vertical = Math.max(size.y, size.x / camera.aspect, size.z);
  const distance = Math.max(vertical / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * 1.7, radius * 2, 0.23);
  controls.minDistance = Math.max(radius * 0.6, 0.08);
  controls.maxDistance = Math.max(distance * 4, 5);
  const rear = part.category === 'movement' || /caseback|rear-sapphire/.test(part.id);
  const direction = new THREE.Vector3(rear ? -0.2 : 0.24, 0.15, rear ? -1 : 1).normalize();
  cameraTo(center.clone().addScaledVector(direction, distance).toArray(), center.toArray());
  updateCaption('isolated');
  updatePartCard(part);
}

function exitIsolation(restoreCamera = true) {
  if (!state.isolated) return;
  state.isolated = false;
  parts.forEach(part => { part.object.visible = true; });
  experience.classList.remove('isolated');
  $('#return-button').hidden = true;
  controls.minDistance = savedIsolation?.minDistance || 3.5;
  controls.maxDistance = savedIsolation?.maxDistance || 38;
  setExpanded(state.targetExplosion > 0);
  if (restoreCamera && savedIsolation) cameraTo(savedIsolation.position.toArray(), savedIsolation.target.toArray());
  updateCaption(state.targetExplosion > 0 ? 'exploded' : state.view);
  const part = partsById.get(state.selected);
  highlight(part);
  updatePartCard(part);
  savedIsolation = null;
}

function separatePart() {
  const part = partsById.get(state.selected);
  if (!part || state.isolated) return;
  if (state.separated.has(part.id)) {
    state.separated.delete(part.id);
    toast(`${part.name}已归位`);
  } else {
    state.separated.add(part.id);
    toast(`${part.name}已分离，可拖动旋转查看`);
  }
  updatePartCard(part);
}

function resetAll() {
  exitIsolation(false);
  clearSelection();
  state.separated.clear();
  setExplosion(0, false);
  selectView('hero');
  controls.minDistance = 3.5;
  controls.maxDistance = 38;
  toast('已恢复完整装配与经典视角');
}

function filteredParts() {
  const query = state.search.trim().toLowerCase();
  return parts.filter(part => {
    const category = part.category === 'case' ? 'exterior' : part.category === 'hands' ? 'dial' : part.category;
    return (state.filter === 'all' || state.filter === category) &&
      (!query || `${part.name} ${part.nameEn} ${part.material} ${part.id}`.toLowerCase().includes(query));
  });
}

function renderParts() {
  const list = $('#parts-list');
  list.replaceChildren();
  const filtered = filteredParts();
  $('#drawer-count').textContent = filtered.length;
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'no-results';
    empty.textContent = '暂未找到匹配的部件，试试其他名称或材质。';
    list.append(empty);
    return;
  }
  for (const part of filtered) {
    const row = document.createElement('button');
    row.className = `part-row${state.selected === part.id ? ' active' : ''}`;
    row.dataset.part = part.id;
    const icon = part.category === 'movement' ? 'gear' : part.category === 'hands' || part.category === 'dial' ? 'watch' : 'layers';
    row.innerHTML = `<span class="part-row-number">${String(parts.indexOf(part) + 1).padStart(2, '0')}</span><span class="part-row-icon"><svg><use href="#icon-${icon}"/></svg></span><span class="part-row-copy"><strong></strong><small></small></span><svg><use href="#icon-chevron"/></svg>`;
    row.querySelector('strong').textContent = part.name;
    row.querySelector('small').textContent = part.nameEn;
    row.addEventListener('click', () => {
      closeDrawer();
      if (part.category === 'movement' && state.targetExplosion < 0.4) setExplosion(0.75);
      selectPart(part.id);
      $('#isolate-part').focus({ preventScroll: true });
    });
    list.append(row);
  }
}

function openDrawer() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  drawerFocus = document.activeElement;
  $('#drawer-backdrop').hidden = false;
  $('#components-drawer').hidden = false;
  document.body.style.overflow = 'hidden';
  renderParts();
  $('#part-search').focus();
}

function closeDrawer() {
  $('#drawer-backdrop').hidden = true;
  $('#components-drawer').hidden = true;
  document.body.style.overflow = '';
  drawerFocus?.focus({ preventScroll: true });
}

function showDialog(kind) {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  $('#info-dialog').setAttribute('aria-label', kind === 'help' ? '操作指南' : kind === 'craft' ? '工艺档案' : '关于此模型');
  let markup;
  if (kind === 'help') {
    $('#dialog-kicker').textContent = 'A MOMENT TO EXPLORE';
    markup = `<h2>从指尖，走近时间。</h2><p>这是一枚可以自由探索的三维腕表。每一枚零件都可以被选中、分离，再重新归位。</p><ul class="guide-list">
      <li><svg><use href="#icon-orbit"/></svg><span><strong>环绕观察</strong><small>鼠标左键拖动或单指滑动；右键拖动或双指滑动平移。</small></span></li>
      <li><svg><use href="#icon-plus"/></svg><span><strong>靠近细节</strong><small>滚动滚轮或双指捏合缩放，也可使用视图下方的 ± 按钮。</small></span></li>
      <li><svg><use href="#icon-layers"/></svg><span><strong>层层拆解</strong><small>拖动拆解进度条，或点击「拆解探索」展开全部部件。</small></span></li>
      <li><svg><use href="#icon-eye"/></svg><span><strong>逐件欣赏</strong><small>点击模型或打开零件图鉴，再选择「单独查看」或「分离部件」。</small></span></li>
      <li><svg><use href="#icon-reset"/></svg><span><strong>随时归位</strong><small>按 R 恢复完整装配；按 Esc 关闭面板或退出独立部件视图。</small></span></li>
      <li><svg><use href="#icon-watch"/></svg><span><strong>真实走时</strong><small>时分针与 6 点位小秒针按本地时间连续扫动。摆轮以 4 Hz 示意运转。</small></span></li></ul>
      <div class="dialog-rule"></div><p class="notes-subtle">键盘：将焦点移入三维视图后，用方向键平移，+ / − 缩放，1–4 切换视角，E 切换拆解，R 复位。减少动态效果偏好会关闭自动镜头过渡。</p>`;
  } else if (kind === 'craft') {
    $('#dialog-kicker').textContent = 'THE ART OF ENGINEERING';
    markup = `<h2>精于毫厘，成于匠心。</h2><p>以葡萄牙系列自动腕表 40 为视觉参考，在真实空间里观察材质、比例与机械之间的关系。</p><div class="craft-columns">
      <article class="craft-feature"><span>01 / SAPPHIRE</span><h3>通透，亦有深度。</h3><p>蓝宝石表镜以 1.77 折射率模拟光线传播。拱形边缘、物理透射与摄影棚反射共同呈现玻璃的厚度。</p></article>
      <article class="craft-feature"><span>02 / STEEL</span><h3>两种光泽，一体成形。</h3><p>抛光表圈、缎面拉丝侧壁、倒角与细密螺纹，赋予金属各不相同的反射层次。</p></article>
      <article class="craft-feature"><span>03 / MOVEMENT</span><h3>井然有序的微小世界。</h3><p>真实几何齿形、镂空摆陀、珍珠纹主夹板与红宝石轴承，各自建模。游丝与摆轮以 4 Hz 往复运动。</p></article>
      <article class="craft-feature"><span>04 / LEATHER</span><h3>柔软，亦有分寸。</h3><p>午夜蓝鳄鱼纹表带以曲面建模，搭配微表面凹凸、独立缝线、卷边接口与精钢针扣。</p></article></div>
      <div class="dialog-settings"><button id="craft-sapphire"><svg><use href="#icon-eye"/></svg>查看蓝宝石表镜</button><button id="craft-movement"><svg><use href="#icon-gear"/></svg>探索机芯</button></div>`;
  } else {
    $('#dialog-kicker').textContent = 'ABOUT THIS STUDY';
    markup = `<h2>时间的构造。</h2><p>独立开发的 Three.js 交互研究作品。外观参考 IWC 葡萄牙系列自动腕表 40（IW358303），机芯采用以 82200 型自动机芯为灵感的机械布局。</p>
      <div class="notes-grid"><div><small>参考表壳尺寸</small><strong>40.4 mm × 12.3 mm</strong></div><div><small>实际可独立选择组件</small><strong>${parts.length} 个</strong></div><div><small>参考机芯频率</small><strong>4 Hz · 28,800 次 / 小时</strong></div><div><small>蓝宝石折射率模拟</small><strong>IOR 1.77 · 物理透射</strong></div></div>
      <p>外部尺寸、三针走时与材质光学参数按参考规格构建。内部轮系、桥板形状、部件数量和传动动画属于可视化重构，并非原厂 CAD；不能用于加工、维修或判断真实机械公差。60 小时为参考腕表动力储存规格，页面走时由设备时钟驱动。</p>
      <p class="notes-subtle">IWC、SCHAFFHAUSEN 及相关型号名称归其权利人所有。本作品为非官方技术与设计研究，未与品牌关联。全部模型与表面纹理由程序生成，运行时不请求外部素材。</p>
      <div class="dialog-settings"><button id="quality-button"><svg><use href="#icon-sun"/></svg>画质：${renderer.getPixelRatio() > 1 ? '精细' : '流畅'} · 点击切换</button><button id="pause-button"><svg><use href="#icon-${state.paused ? 'play' : 'pause'}"/></svg>${state.paused ? '恢复实时走时' : '暂停观察'}</button></div>`;
  }
  $('#dialog-content').innerHTML = markup;
  $('#info-dialog').showModal();
  $('#craft-sapphire')?.addEventListener('click', () => {
    $('#info-dialog').close();
    selectPart('front-sapphire');
    isolatePart();
  });
  $('#craft-movement')?.addEventListener('click', () => {
    $('#info-dialog').close();
    setExplosion(1);
  });
  $('#quality-button')?.addEventListener('click', event => {
    const ratio = renderer.getPixelRatio() > 1 ? 0.85 : Math.min(window.devicePixelRatio || 1, 1.75);
    renderer.setPixelRatio(ratio === 1 ? 1.5 : ratio);
    qualityAt = Infinity;
    resize();
    $('#quality-label').textContent = renderer.getPixelRatio() > 1 ? '精细渲染' : '流畅渲染';
    event.currentTarget.innerHTML = `<svg><use href="#icon-sun"/></svg>画质：${renderer.getPixelRatio() > 1 ? '精细' : '流畅'} · 点击切换`;
  });
  $('#pause-button')?.addEventListener('click', event => {
    state.paused = !state.paused;
    $('#clock-label').textContent = state.paused ? '观察暂停' : '本地时间 · 实时运转';
    event.currentTarget.innerHTML = `<svg><use href="#icon-${state.paused ? 'play' : 'pause'}"/></svg>${state.paused ? '恢复实时走时' : '暂停观察'}`;
    toast(state.paused ? '走时与机芯已暂停，恢复后将同步本地时间' : '已恢复实时走时');
  });
}

function pick(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(assembly, true).filter(hit => {
    let ancestor = hit.object;
    while (ancestor) { if (!ancestor.visible) return false; ancestor = ancestor.parent; }
    return !!hit.object.userData.partId;
  });
  // The optical cover should not prevent selecting the hands and dial below it.
  const hit = hits.find(item => !item.object.userData.isGlass) || hits[0];
  return hit?.object.userData.partId || null;
}

function bindEvents() {
  $('#retry-button').addEventListener('click', () => location.reload());
  $('#discover-button').addEventListener('click', () => { setExplosion(1); toast('拖动可环绕查看，点击任意部件深入探索'); });
  $('#assembled-button').addEventListener('click', () => { state.separated.clear(); clearSelection(); setExplosion(0); });
  $('#exploded-button').addEventListener('click', () => setExplosion(1));
  $('#explosion').addEventListener('input', event => setExplosion(Number(event.target.value) / 100));
  $$('.view-button').forEach(button => button.addEventListener('click', () => selectView(button.dataset.view, true)));
  $('#nav-watch').addEventListener('click', () => { resetAll(); experience.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' }); });
  $('#nav-movement').addEventListener('click', () => {
    clearSelection();
    setExplosion(0, false);
    selectView('back');
    experience.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth', block: 'start' });
  });
  $('#nav-craft').addEventListener('click', () => showDialog('craft'));
  $('#help-button').addEventListener('click', () => showDialog('help'));
  $('#model-notes').addEventListener('click', () => showDialog('notes'));
  $('#close-dialog').addEventListener('click', () => $('#info-dialog').close());
  $('#info-dialog').addEventListener('click', event => {
    const rect = $('#info-dialog').getBoundingClientRect();
    if (event.target === $('#info-dialog') && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) $('#info-dialog').close();
  });
  $('#components-button').addEventListener('click', openDrawer);
  $('#close-components').addEventListener('click', closeDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  $('#part-search').addEventListener('input', event => { state.search = event.target.value; renderParts(); });
  $$('.part-filters button').forEach(button => button.addEventListener('click', () => {
    state.filter = button.dataset.filter;
    $$('.part-filters button').forEach(item => {
      item.classList.toggle('active', item === button);
      item.setAttribute('aria-pressed', String(item === button));
    });
    renderParts();
  }));
  $('#close-part').addEventListener('click', clearSelection);
  $('#isolate-part').addEventListener('click', isolatePart);
  $('#separate-part').addEventListener('click', separatePart);
  $('#return-button').addEventListener('click', () => exitIsolation());
  $('#reset-view').addEventListener('click', resetAll);
  $('#auto-rotate').addEventListener('click', () => {
    cameraTween = null;
    state.autoRotate = !state.autoRotate;
    controls.autoRotate = state.autoRotate;
    $('#auto-rotate').setAttribute('aria-pressed', String(state.autoRotate));
    toast(state.autoRotate ? '自动环绕已开启，再次点击可停止' : '自动环绕已停止');
  });
  const zoom = factor => {
    cameraTween = null;
    const offset = camera.position.clone().sub(controls.target);
    offset.setLength(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance));
    cameraTo(controls.target.clone().add(offset).toArray(), controls.target.toArray(), 350);
  };
  $('#zoom-in').addEventListener('click', () => zoom(0.82));
  $('#zoom-out').addEventListener('click', () => zoom(1.22));
  $('#fullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (experience.requestFullscreen) await experience.requestFullscreen();
      else toast('此浏览器不支持全屏，可横屏观看');
    } catch { toast('全屏未开启，仍可在当前窗口继续探索'); }
  });
  document.addEventListener('fullscreenchange', resize);
  renderer.domElement.addEventListener('pointerdown', event => {
    activePointers.add(event.pointerId);
    if (activePointers.size > 1) multiTouchGesture = true;
    lastPickPoint = { x: event.clientX, y: event.clientY, at: performance.now(), button: event.button };
  });
  renderer.domElement.addEventListener('pointerup', event => {
    activePointers.delete(event.pointerId);
    if (multiTouchGesture) {
      if (activePointers.size === 0) multiTouchGesture = false;
      lastPickPoint = null;
      return;
    }
    if (!lastPickPoint || lastPickPoint.button !== 0) return;
    if (Math.hypot(event.clientX - lastPickPoint.x, event.clientY - lastPickPoint.y) < 5 && performance.now() - lastPickPoint.at < 500) {
      const id = pick(event.clientX, event.clientY);
      if (id) selectPart(id);
      else if (!state.isolated) clearSelection();
    }
    lastPickPoint = null;
  });
  renderer.domElement.addEventListener('pointercancel', event => {
    activePointers.delete(event.pointerId);
    if (!activePointers.size) multiTouchGesture = false;
    lastPickPoint = null;
  });
  renderer.domElement.addEventListener('pointermove', event => {
    if (event.buttons || performance.now() - lastHoverAt < 90) return;
    lastHoverAt = performance.now();
    renderer.domElement.style.cursor = pick(event.clientX, event.clientY) ? 'pointer' : 'grab';
  });
  controls.addEventListener('start', () => { cameraTween = null; });
  document.addEventListener('keydown', event => {
    const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if (!$('#components-drawer').hidden) {
      if (event.key === 'Escape') { closeDrawer(); event.preventDefault(); }
      if (event.key === 'Tab') {
        const focusable = [...$('#components-drawer').querySelectorAll('button,input')].filter(node => !node.disabled);
        const first = focusable[0], last = focusable.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
      return;
    }
    if ($('#info-dialog').open || editing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      if (state.isolated) exitIsolation(); else clearSelection();
      return;
    }
    if (event.key.toLowerCase() === 'r') resetAll();
    else if (event.key.toLowerCase() === 'e') setExplosion(state.targetExplosion > 0 ? 0 : 1);
    else if ('1234'.includes(event.key)) selectView(['hero', 'front', 'back', 'side'][Number(event.key) - 1]);
    else if (event.key === '+' || event.key === '=') zoom(0.82);
    else if (event.key === '-') zoom(1.22);
  });
  controls.listenToKeyEvents(viewport);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frameHandle); animationStarted = false; }
    else if (!animationStarted && !disposed) { lastFrame = performance.now(); animationStarted = true; frameHandle = requestAnimationFrame(frame); }
  });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    cancelAnimationFrame(frameHandle);
    animationStarted = false;
    toast('图形上下文暂时中断，正在等待浏览器恢复');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => location.reload());
  new ResizeObserver(resize).observe(viewport);
  window.addEventListener('resize', resize);
}

function updateParts(delta) {
  state.explosion = THREE.MathUtils.damp(state.explosion, state.targetExplosion, reducedMotion ? 100 : 5.5, delta);
  if (Math.abs(state.explosion - state.targetExplosion) < 0.0005) state.explosion = state.targetExplosion;
  for (const part of parts) {
    // Freeze only translation in isolation. Selecting a tiny screw while the
    // explosion is still easing must not move it out of its fitted camera.
    if (state.isolated && part.id === state.selected) continue;
    vTarget.copy(part.basePosition).addScaledVector(part.explode, state.explosion);
    if (state.separated.has(part.id)) {
      const direction = part.explode.lengthSq() > 0.1 ? part.explode.clone().normalize() : new THREE.Vector3(1, 0.3, 0.6).normalize();
      vTarget.addScaledVector(direction, 2.3);
    }
    part.object.position.lerp(vTarget, 1 - Math.exp(-delta * (reducedMotion ? 100 : 9)));
  }
}

function frame(now) {
  if (disposed) return;
  const rawDelta = (now - lastFrame) / 1000;
  const delta = Math.min(Math.max(rawDelta, 0.001), 0.075);
  lastFrame = now;
  if (!state.paused) {
    elapsed += delta;
    lastDate = new Date();
    watch.tick(lastDate, elapsed);
    movement.tick(elapsed);
  }
  const second = Math.floor(lastDate.getTime() / 1000);
  if (second !== lastClockSecond) {
    $('#live-time').textContent = lastDate.toLocaleTimeString('zh-CN', { hour12: false });
    $('#live-time').dateTime = lastDate.toISOString();
    lastClockSecond = second;
  }
  updateParts(delta);
  if (cameraTween) {
    const t = Math.min(1, (now - cameraTween.start) / cameraTween.duration);
    const smooth = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    camera.position.lerpVectors(cameraTween.from, cameraTween.to, smooth);
    controls.target.lerpVectors(cameraTween.targetFrom, cameraTween.targetTo, smooth);
    if (t === 1) cameraTween = null;
  }
  controls.update(delta);
  renderer.render(scene, camera);
  frameDuration += Math.min(rawDelta, 0.2);
  frameSamples++;
  if (frameSamples >= 90) {
    fps = Math.round(frameSamples / frameDuration);
    if (now > 10000 && now - qualityAt > 12000 && fps < 27 && renderer.getPixelRatio() > 0.85) {
      renderer.setPixelRatio(Math.max(0.85, renderer.getPixelRatio() - 0.25));
      $('#quality-label').textContent = '自适应渲染';
      resize();
      qualityAt = now;
    }
    frameSamples = 0;
    frameDuration = 0;
  }
  frameHandle = requestAnimationFrame(frame);
}

function exposeDiagnostics() {
  window.watchDiagnostics = () => {
    assembly.updateMatrixWorld(true);
    const rect = viewport.getBoundingClientRect();
    let meshCount = 0;
    let triangleCount = 0;
    assembly.traverse(node => {
      if (!node.isMesh) return;
      meshCount++;
      triangleCount += (node.geometry.index?.count || node.geometry.attributes.position.count) / 3;
    });
    return {
      ready: state.ready, partCount: parts.length, meshCount, triangleCount,
      drawCalls: renderer.info.render.calls, pixelRatio: renderer.getPixelRatio(), fps,
      camera: camera.position.toArray(), target: controls.target.toArray(),
      state: { explosion: state.explosion, targetExplosion: state.targetExplosion, selected: state.selected, isolated: state.isolated, view: state.view, autoRotate: state.autoRotate, paused: state.paused, separated: [...state.separated] },
      clock: { timestamp: lastDate.getTime(), hour: watch.hands.hour.rotation.z, minute: watch.hands.minute.rotation.z, second: watch.hands.second.rotation.z },
      sapphire: { ior: watch.materials.sapphire.ior, transmission: watch.materials.sapphire.transmission },
      parts: parts.map(part => {
        new THREE.Box3().setFromObject(part.object).getCenter(vCenter);
        vCenter.project(camera);
        return {
          id: part.id, name: part.name, category: part.category,
          position: part.object.position.toArray(), base: part.basePosition.toArray(),
          explode: part.explode.toArray(), visible: part.object.visible,
          screen: [rect.left + (vCenter.x + 1) / 2 * rect.width, rect.top + (1 - vCenter.y) / 2 * rect.height],
        };
      }),
    };
  };
}

async function init() {
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false });
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 1.25), mobile() ? 1.5 : 1.75));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.13;
    renderer.transmissionResolutionScale = 1.2;
    viewport.prepend(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(28, 1, 0.015, 150);
    camera.position.set(...presetPosition('hero'));
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.65;
    controls.panSpeed = 0.55;
    controls.minDistance = 3.5;
    controls.maxDistance = 38;
    controls.autoRotateSpeed = 0.65;
    controls.target.set(0, 0.15, 0);
    controls.maxPolarAngle = Math.PI - 0.02;
    controls.minPolarAngle = 0.02;
    const environment = makeStudioEnvironment();
    scene.add(new THREE.HemisphereLight('#ecf1f6', '#596468', 1.2));
    const light = (color, intensity, position) => {
      const source = new THREE.DirectionalLight(color, intensity);
      source.position.set(...position);
      scene.add(source);
    };
    light('#ffffff', 2.3, [-4, 7, 7]);
    light('#c8dcff', 1.4, [6, 0, 3]);
    light('#ffedcf', 1.7, [-4, 1, -5]);
    light('#ffffff', 2.1, [2, 6, -7]);
    // Yield once so the loading indicator is painted before procedural geometry builds.
    await new Promise(resolve => requestAnimationFrame(resolve));
    watch = createWatch();
    movement = createMovement();
    // Three.js uses a minimum roughness for stable specular highlights.
    // Applying that same floor to polished sapphire blurs the fine dial:
    // use the actual surface roughness for transmission, keeping Fresnel,
    // refraction, material thickness and the specular anti-aliasing intact.
    watch.materials.sapphire.onBeforeCompile = shader => {
      const transmission = THREE.ShaderChunk.transmission_fragment.replace(
        'n, v, material.roughness,', 'n, v, roughnessFactor,',
      );
      shader.fragmentShader = shader.fragmentShader.replace('#include <transmission_fragment>', transmission);
    };
    watch.materials.sapphire.customProgramCacheKey = () => 'polished-sapphire-transmission-v1';
    assembly = new THREE.Group();
    assembly.rotation.z = -0.22;
    assembly.add(watch.root, movement.root);
    scene.add(assembly);
    parts = [...watch.parts, ...movement.parts];
    partsById = new Map(parts.map(part => [part.id, part]));
    if (partsById.size !== parts.length) throw new Error('Component ids must be unique.');
    for (const part of parts) {
      part.basePosition ||= part.object.position.clone();
      part.explode ||= new THREE.Vector3();
      part.object.userData.partId = part.id;
      // Larger service-view gaps expose the wheel train instead of stacking
      // it behind opaque plates. The assembled geometry is never scaled.
      if (part.category === 'movement') {
        part.explode.x *= 2.35;
        part.explode.y *= 2.35;
        part.explode.z = part.explode.z * 2.0 - 1.3;
      } else {
        part.explode.z *= 2.15;
        if (part.category === 'strap') {
          part.explode.x += part.id.includes('upper') ? -0.5 : 0.5;
          part.explode.y *= 0.65;
        }
        if (/^caseback|^rear-sapphire/.test(part.id)) {
          part.explode.z = part.id.includes('screw') ? -7.5 : part.id.includes('gasket') ? -5.8 : part.id.includes('sapphire') ? -6.9 : -6.3;
        }
      }
    }
    $('#part-count').textContent = `${parts.length} PARTS`;
    $('#drawer-count').textContent = parts.length;
    bindEvents();
    resize();
    renderer.render(scene, camera);
    state.ready = true;
    $('#loading').classList.add('hide');
    setTimeout(() => { $('#loading').hidden = true; }, 600);
    exposeDiagnostics();
    animationStarted = true;
    lastFrame = performance.now();
    frameHandle = requestAnimationFrame(frame);
    window.dispatchEvent(new CustomEvent('watch-ready'));
    window.addEventListener('pagehide', event => {
      if (event.persisted) return;
      disposed = true;
      cancelAnimationFrame(frameHandle);
      controls.dispose();
      restoreHighlight();
      const geometries = new Set(), materials = new Set(), textures = new Set();
      assembly.traverse(node => {
        if (!node.isMesh) return;
        geometries.add(node.geometry);
        (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => materials.add(material));
      });
      for (const material of materials) {
        for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        material.dispose();
      }
      for (const geometry of geometries) geometry.dispose();
      for (const texture of textures) texture.dispose();
      environment.dispose();
      renderer.dispose();
    });
  } catch (error) {
    console.error('Watch initialization failed:', error);
    $('#loading').hidden = true;
    $('#webgl-error').hidden = false;
    $('#retry-button').addEventListener('click', () => location.reload());
  }
}

init();
