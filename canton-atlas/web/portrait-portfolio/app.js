import { DEFAULT_CONTENT } from './data.js';
import { createCharacterViewer } from './character-viewer.js';
import { createGlobe } from './globe.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const STORAGE_KEY = 'lin-portrait-portfolio.v1';
const clone = value => structuredClone(value);
const escapeHTML = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const editor = $('#editor-dialog');
const form = $('#editor-form');
const profileKeys = ['name', 'latinName', 'role', 'location', 'headline', 'intro', 'email'];
const eventKeys = ['title', 'city', 'country', 'date', 'venue', 'type', 'lat', 'lng'];
let content = clone(DEFAULT_CONTENT);
let appearance = { color: '#e7dac0', portrait: '' };
let draft;
let draftEventID;
let activeFilter = 'all';
let selectedEventID = content.events[0]?.id;
let character;
let globe;
let ready = false;
let customModelName = '';
let modelObjectURL;
let modelBusy = false;
let toastTimer;
let storageWarning = '';

function cleanText(value, limit, label, required = true) {
  if (typeof value !== 'string') throw new Error(`「${label}」需要填写文字。`);
  const text = value.trim();
  if ((required && !text) || text.length > limit) throw new Error(`请填写「${label}」，不超过 ${limit} 个字符。`);
  return text;
}
function validateContent(raw) {
  if (!raw || typeof raw !== 'object' || !raw.profile || !Array.isArray(raw.events)) throw new Error('配置需要包含 profile 和 events。');
  const profile = {};
  const limits = { name: 24, latinName: 36, role: 60, location: 60, headline: 50, intro: 240, email: 120 };
  const names = { name: '姓名', latinName: '英文名', role: '职业', location: '城市', headline: '标题', intro: '介绍', email: '邮箱' };
  for (const key of profileKeys) profile[key] = cleanText(raw.profile[key] ?? '', limits[key], names[key], key !== 'email');
  if (profile.email && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(profile.email)) throw new Error('请填写有效的联系邮箱。');
  if (raw.events.length > 40) throw new Error('最多支持 40 个演讲活动。');
  const usedIDs = new Set();
  const events = raw.events.map((event, index) => {
    if (!event || typeof event !== 'object') throw new Error(`第 ${index + 1} 个活动格式不正确。`);
    const prefix = `活动 ${index + 1}：`;
    const id = cleanText(event.id, 80, prefix + '标识');
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || usedIDs.has(id)) throw new Error('每个活动需要不重复的英文或数字标识。');
    usedIDs.add(id);
    const result = { id };
    for (const [key, label, limit] of [['title', '主题', 100], ['city', '城市', 50], ['country', '国家 / 地区', 50], ['venue', '场地', 100], ['type', '形式', 30]]) {
      result[key] = cleanText(event[key], limit, prefix + label);
    }
    const date = cleanText(event.date, 10, prefix + '日期');
    const timestamp = Date.parse(date + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date || date < '1900-01-01' || date > '2100-12-31') throw new Error(prefix + '请填写 1900–2100 年间的有效日期。');
    result.date = date;
    for (const [key, bound, label] of [['lat', 90, '纬度'], ['lng', 180, '经度']]) {
      if (event[key] === '' || event[key] === null || !['number', 'string'].includes(typeof event[key])) throw new Error(prefix + `请填写${label}。`);
      result[key] = Number(event[key]);
      if (!Number.isFinite(result[key]) || Math.abs(result[key]) > bound) throw new Error(prefix + `${label}必须在 -${bound} 到 ${bound} 之间。`);
    }
    return result;
  });
  return { profile, events, projects: clone(DEFAULT_CONTENT.projects), demo: raw.demo !== false };
}
function validateAppearance(raw = {}) {
  const color = /^#[0-9a-f]{6}$/i.test(raw.color || '') ? raw.color : '#e7dac0';
  const portrait = typeof raw.portrait === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(raw.portrait) && raw.portrait.length <= 1500000 ? raw.portrait : '';
  return { color, portrait };
}
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const state = JSON.parse(saved);
    if (state.version !== 1) throw new Error('配置版本不匹配');
    content = validateContent(state.content);
    appearance = validateAppearance(state.appearance);
  }
} catch {
  storageWarning = '保存的配置无法读取，已加载示例内容。你仍可编辑并导出备份。';
}

function showToast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('visible'), 4200);
}
function persist(nextContent = content, nextAppearance = appearance) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, content: nextContent, appearance: nextAppearance }));
}
function download(url, filename) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}
function renderProfile() {
  $$('[data-profile]').forEach(node => { node.textContent = content.profile[node.dataset.profile]; });
  document.title = `${content.profile.name} — ${content.profile.headline.replace(/\n/g, '')}`;
  $('#site-demo').textContent = content.demo ? '示例作品集 / 2026' : `${content.profile.latinName} / 2026`;
  $('#events-demo').textContent = content.demo ? '演讲路线 · 示例数据' : '演讲与分享路线';
}
function renderProjects() {
  $('#project-grid').innerHTML = content.projects.map((project, index) => `
    <a class="project-card" href="${escapeHTML(project.url)}" aria-label="${escapeHTML(project.title)}：${escapeHTML(project.description)}">
      <div class="project-visual"><img src="${escapeHTML(project.image)}" alt="${escapeHTML(project.description)}" width="1000" height="850" loading="lazy"><span class="project-index">0${index + 1} / EXPLORATION</span><span class="project-open" aria-hidden="true">↗</span></div>
      <div class="project-info"><div class="project-title-row"><h3>${escapeHTML(project.title)}</h3><span>${escapeHTML(project.year)}</span></div><p class="project-category">${escapeHTML(project.category)}</p></div>
    </a>`).join('');
}
function filteredEvents() {
  return content.events.filter(event => activeFilter === 'all' || event.date.slice(0, 4) === activeFilter).sort((a, b) => b.date.localeCompare(a.date));
}
function renderFilters() {
  const years = [...new Set(content.events.map(event => event.date.slice(0, 4)))].sort().reverse();
  if (activeFilter !== 'all' && !years.includes(activeFilter)) activeFilter = 'all';
  $('#event-filters').innerHTML = ['all', ...years].map(year => `<button type="button" data-year="${year}" aria-pressed="${year === activeFilter}">${year === 'all' ? '全部' : year}</button>`).join('');
}
function renderEvents() {
  const events = filteredEvents();
  $('#events-count').textContent = String(events.length).padStart(2, '0');
  const list = $('#events-list');
  list.innerHTML = events.length ? events.map(event => `
    <button type="button" class="event-item" data-event="${escapeHTML(event.id)}" aria-pressed="${event.id === selectedEventID}" aria-label="${escapeHTML(event.city)}，${escapeHTML(event.title)}，${event.date}">
      <span class="event-date"><strong>${event.date.slice(5).replace('-', '.')}</strong>${event.date.slice(0, 4)}</span>
      <span class="event-content"><strong>${escapeHTML(event.city)}</strong><small>${escapeHTML(event.type)}</small><span>${escapeHTML(event.title)}</span></span>
      <span class="event-arrow" aria-hidden="true">↗</span>
    </button>`).join('') : '<p class="empty-events">新的分享，还在路上。<br>在「编辑作品集」中，添加你的第一站。</p>';
  const selected = content.events.find(event => event.id === selectedEventID);
  if (selected) {
    $('#selected-stop').innerHTML = `<span class="stop-symbol" aria-hidden="true">⌖</span><div class="stop-detail"><div><strong>${escapeHTML(selected.city)} · ${escapeHTML(selected.country)}</strong><p>${escapeHTML(selected.venue)}</p></div><span>${escapeHTML(selected.date.replaceAll('-', '.'))}</span></div>`;
    $('#globe-coordinates').textContent = `${Math.abs(selected.lat).toFixed(2)}° ${selected.lat >= 0 ? 'N' : 'S'} / ${Math.abs(selected.lng).toFixed(2)}° ${selected.lng >= 0 ? 'E' : 'W'}`;
  } else {
    $('#selected-stop').innerHTML = '<span class="stop-symbol" aria-hidden="true">⌖</span><div class="stop-detail"><p>下一次相遇，等待你来标记。</p></div>';
    $('#globe-coordinates').textContent = 'A WORLD OF POSSIBILITIES';
  }
}
function selectEvent(id, { focus = false } = {}) {
  if (!filteredEvents().some(event => event.id === id)) return;
  selectedEventID = id;
  globe?.select(id);
  renderEvents();
  if (focus) $(`[data-event="${id}"]`)?.focus({ preventScroll: true });
}
function refreshEvents() {
  renderFilters();
  const events = filteredEvents();
  if (!events.some(event => event.id === selectedEventID)) selectedEventID = events[0]?.id ?? null;
  globe?.setEvents(events);
  if (selectedEventID) globe?.select(selectedEventID);
  renderEvents();
}
$('#events-list').addEventListener('click', event => {
  const button = event.target.closest('[data-event]');
  if (button) selectEvent(button.dataset.event, { focus: true });
});
$('#event-filters').addEventListener('click', event => {
  const button = event.target.closest('[data-year]');
  if (!button) return;
  activeFilter = button.dataset.year;
  refreshEvents();
  $(`[data-year="${activeFilter}"]`)?.focus({ preventScroll: true });
});

function updateAssetUI() {
  const portrait = $('#portrait-reference');
  portrait.hidden = !appearance.portrait;
  if (appearance.portrait) portrait.src = appearance.portrait;
  else portrait.removeAttribute('src');
  $$('[data-color]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === appearance.color)));
  $('#custom-model-name').textContent = customModelName ? `当前：${customModelName}` : '当前：原创示例角色';
  $('#download-current-model').href = modelObjectURL || './assets/character.glb';
  $('#download-current-model').download = customModelName || 'character.glb';
  $('#character-demo').textContent = customModelName ? '自定义三维角色' : '原创示例角色 · 等待你的肖像';
  $('#character-host').setAttribute('aria-label', customModelName ? '可拖动旋转的自定义三维角色' : '可拖动旋转的原创示例三维角色');
}
function chooseTab(name, focus = false) {
  if (name !== 'events') stashEvent();
  $$('.editor-tabs [data-tab]').forEach(button => {
    const selected = button.dataset.tab === name;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    $(`#panel-${button.dataset.tab}`).hidden = !selected;
    if (selected && focus) button.focus();
  });
  $('#save-description').textContent = name === 'assets' ? '素材操作即时生效；配置导出已保存的内容。' : '资料与路线在点击保存后生效。';
  $('.editor-body').scrollTop = 0;
}
function openEditor(tab = 'profile') {
  draft = clone(content);
  draftEventID = draft.events[0]?.id ?? null;
  for (const key of profileKeys) form.elements.namedItem(key).value = draft.profile[key];
  $('#form-message').textContent = '';
  renderEventEditor();
  updateAssetUI();
  chooseTab(tab);
  if (!editor.open) editor.showModal();
}
$$('[data-open-editor]').forEach(button => button.addEventListener('click', () => openEditor()));
$('#close-editor').addEventListener('click', () => editor.close());
editor.addEventListener('click', event => {
  if (event.target !== editor) return;
  const rect = editor.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) editor.close();
});
$$('[data-tab]').forEach(button => button.addEventListener('click', () => chooseTab(button.dataset.tab)));
$('.editor-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = $$('[data-tab]');
  const index = tabs.indexOf(document.activeElement);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  chooseTab(tabs[next].dataset.tab, true);
});
function stashEvent() {
  if (!draft || !draftEventID) return;
  const item = draft.events.find(event => event.id === draftEventID);
  if (!item) return;
  for (const key of eventKeys) item[key] = $(`#event-${key}`).value;
}
function renderEventEditor() {
  $('#edit-event-select').innerHTML = draft.events.map(event => `<option value="${escapeHTML(event.id)}">${escapeHTML(event.city || '未命名城市')} · ${escapeHTML(event.date || '待定日期')}</option>`).join('');
  $('#edit-event-select').value = draftEventID || '';
  $('#edit-event-select').disabled = !draft.events.length;
  const item = draft.events.find(event => event.id === draftEventID);
  $('#event-edit-fields').hidden = !item;
  $('#empty-editor-events').hidden = Boolean(item);
  if (item) {
    const typeSelect = $('#event-type');
    $$('#event-type option[data-custom]').forEach(option => option.remove());
    if (![...typeSelect.options].some(option => option.value === item.type)) {
      const option = new Option(item.type, item.type);
      option.dataset.custom = 'true';
      typeSelect.add(option);
    }
    for (const key of eventKeys) $(`#event-${key}`).value = item[key];
  }
}
$('#edit-event-select').addEventListener('change', event => {
  const nextID = event.target.value;
  stashEvent();
  draftEventID = nextID;
  renderEventEditor();
});
$('#add-event').addEventListener('click', () => {
  stashEvent();
  if (draft.events.length >= 40) { $('#form-message').textContent = '最多支持 40 个活动。'; return; }
  const item = { id: `event-${crypto.randomUUID()}`, title: '新的分享', city: '广州', country: '中国', date: new Date().toISOString().slice(0, 10), type: '主题演讲', venue: '填写活动名称', lat: 23.1291, lng: 113.2644 };
  draft.events.push(item);
  draftEventID = item.id;
  renderEventEditor();
  $('#event-title').focus();
  $('#event-title').select();
});
$('#delete-event').addEventListener('click', () => {
  draft.events = draft.events.filter(event => event.id !== draftEventID);
  draftEventID = draft.events[0]?.id ?? null;
  renderEventEditor();
});
form.noValidate = true;
form.addEventListener('submit', event => {
  event.preventDefault();
  stashEvent();
  try {
    const profile = Object.fromEntries(profileKeys.map(key => [key, form.elements.namedItem(key).value]));
    const next = validateContent({ ...draft, profile });
    persist(next);
    content = next;
    renderProfile();
    refreshEvents();
    editor.close();
    showToast('更改已保存到此浏览器。');
  } catch (error) {
    $('#form-message').textContent = error.name === 'QuotaExceededError' ? '本机存储空间不足。请导出备份后释放空间再保存。' : error.message;
    $('#form-message').scrollIntoView({ block: 'nearest' });
  }
});

function openModelDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('portrait-portfolio-assets', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('素材存储被其他窗口占用。'));
  });
}
async function modelStorage(operation, value) {
  const database = await openModelDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction('assets', operation === 'get' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('assets');
      const request = operation === 'get' ? store.get('character') : operation === 'put' ? store.put(value, 'character') : store.delete('character');
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error('素材保存已取消。'));
    });
  } finally { database.close(); }
}
async function validateGLB(file) {
  if (!file.name.toLowerCase().endsWith('.glb')) throw new Error('请选择 .glb 模型文件。');
  if (file.size > 20 * 1024 * 1024) throw new Error('模型超过 20 MB，请先在 Blender 中精简。');
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength < 20) throw new Error('文件不是有效的 GLB 模型。');
  const header = new DataView(bytes);
  if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== bytes.byteLength || header.getUint32(16, true) !== 0x4e4f534a) throw new Error('文件不是完整的 glTF 2.0 GLB 模型。');
  const jsonLength = header.getUint32(12, true);
  if (jsonLength > bytes.byteLength - 20) throw new Error('模型文件已损坏。');
  let json;
  try { json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength))); }
  catch { throw new Error('模型文件中的数据无法读取。'); }
  const resources = [...(json.buffers || []), ...(json.images || [])];
  if (resources.some(resource => resource.uri && !/^data:/i.test(resource.uri))) throw new Error('请从 Blender 导出自包含 GLB，图片和材质不能引用外部文件。');
  return bytes;
}
$('#model-upload').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file || modelBusy) return;
  modelBusy = true;
  event.target.disabled = true;
  let url;
  try {
    await validateGLB(file);
    url = URL.createObjectURL(file);
    $('#form-message').textContent = '正在载入模型…';
    await character.loadModel(url);
    if (modelObjectURL) URL.revokeObjectURL(modelObjectURL);
    modelObjectURL = url;
    customModelName = file.name;
    updateAssetUI();
    try {
      await modelStorage('put', { name: file.name, blob: file });
      $('#form-message').textContent = '模型已替换并保存在本机。';
      showToast('新的数字分身，已就位。');
    } catch {
      $('#form-message').textContent = '模型已载入，但本机存储不可用；刷新后将恢复上次模型。';
    }
  } catch (error) {
    if (url && url !== modelObjectURL) URL.revokeObjectURL(url);
    $('#form-message').textContent = error.message;
  } finally { modelBusy = false; event.target.disabled = false; event.target.value = ''; }
});
$('#restore-model').addEventListener('click', async () => {
  if (modelBusy) return;
  modelBusy = true;
  try {
    await character.loadModel();
    if (modelObjectURL) URL.revokeObjectURL(modelObjectURL);
    modelObjectURL = undefined;
    customModelName = '';
    updateAssetUI();
    try {
      await modelStorage('delete');
      $('#form-message').textContent = '已恢复原创示例角色。';
    } catch {
      $('#form-message').textContent = '当前已恢复示例角色，但本机记录无法更新；刷新后可能载入此前保存的模型。';
    }
  } catch (error) { $('#form-message').textContent = `恢复未完成：${error.message}`; }
  finally { modelBusy = false; }
});
$('#portrait-upload').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  let image;
  try {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片。');
    if (file.size > 8 * 1024 * 1024) throw new Error('肖像图片请控制在 8 MB 以内。');
    image = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 600 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#f5f3ec';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const next = { ...appearance, portrait: canvas.toDataURL('image/jpeg', 0.88) };
    persist(content, next);
    appearance = next;
    updateAssetUI();
    $('#form-message').textContent = '肖像参考已保存。接下来可据此在 Blender 中制作或精修角色。';
  } catch (error) { $('#form-message').textContent = error.name === 'InvalidStateError' ? '无法解码这张图片，请换一张有效照片。' : error.message; }
  finally { image?.close(); event.target.value = ''; }
});
$$('[data-color]').forEach(button => button.addEventListener('click', () => {
  try {
    const next = { ...appearance, color: button.dataset.color };
    persist(content, next);
    appearance = next;
    character.setColor(appearance.color);
    updateAssetUI();
    $('#form-message').textContent = '外套配色已保存。';
  } catch { $('#form-message').textContent = '本机存储不可用，未保存配色。'; }
}));
$('#export-content').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: 1, content, appearance }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  download(url, 'portfolio-content.json');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  $('#form-message').textContent = '已导出保存的资料、活动、参考图与配色。GLB 模型请单独备份。';
});
$('#import-content').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 3 * 1024 * 1024) throw new Error('配置文件不能超过 3 MB。');
    let state;
    try { state = JSON.parse(await file.text()); } catch { throw new Error('JSON 格式不正确，原有内容已保留。'); }
    if (state.version !== 1) throw new Error('此配置版本不受支持，请导入本作品集导出的 JSON。');
    const next = validateContent(state.content);
    const nextAppearance = validateAppearance(state.appearance);
    persist(next, nextAppearance);
    content = next;
    appearance = nextAppearance;
    character.setColor(appearance.color);
    renderProfile();
    refreshEvents();
    openEditor('assets');
    $('#form-message').textContent = '配置已导入并保存在本机。';
    showToast('作品集内容已更新。');
  } catch (error) { $('#form-message').textContent = error.message; }
  finally { event.target.value = ''; }
});

$('#character-rotate').addEventListener('click', () => {
  if (motionPreference.matches) { showToast('已尊重系统的减少动态效果设置，可手动拖动查看。'); return; }
  const next = !character.getState().autoRotate;
  character.setAutoRotate(next);
  $('#character-rotate').setAttribute('aria-pressed', String(next));
  $('#character-rotate').setAttribute('aria-label', next ? '暂停角色自动旋转' : '开启角色自动旋转');
});
$('#character-wireframe').addEventListener('click', () => {
  const next = !character.getState().wireframe;
  character.setWireframe(next);
  $('#character-wireframe').setAttribute('aria-pressed', String(next));
  $('#character-wireframe').setAttribute('aria-label', next ? '隐藏角色线框' : '显示角色线框');
});
$('#character-reset').addEventListener('click', () => character.reset());
$('#character-capture').addEventListener('click', () => {
  const image = character.capture();
  if (image) { download(image, 'digital-self.png'); showToast('当前视图已保存为透明 PNG。'); }
});
function syncGlobeButton() {
  const state = globe?.getState();
  const button = $('#globe-rotate');
  const rotating = Boolean(state?.rotating && state?.mode === 'webgl');
  button.disabled = state?.mode === 'map';
  button.setAttribute('aria-pressed', String(rotating));
  button.innerHTML = rotating ? '暂停旋转 <span aria-hidden="true">Ⅱ</span>' : '自动旋转 <span aria-hidden="true">↻</span>';
}
$('#globe-rotate').addEventListener('click', () => {
  if (motionPreference.matches) { showToast('已尊重系统的减少动态效果设置，可手动拖动地球。'); return; }
  globe.setRotating(!globe.getState().rotating);
  syncGlobeButton();
});
function contact() {
  if (content.profile.email) location.href = `mailto:${encodeURIComponent(content.profile.email)}`;
  else {
    openEditor('profile');
    form.elements.namedItem('email').focus();
    showToast('添加联系邮箱，即可启用合作邀请。');
  }
}
$('#contact-button').addEventListener('click', contact);
$('#invite-speaking').addEventListener('click', contact);

async function initialize() {
  renderProfile();
  renderProjects();
  refreshEvents();
  updateAssetUI();
  character = createCharacterViewer({
    container: $('#character-host'),
    reducedMotion: motionPreference.matches,
    onStatus: ({ mode, message }) => {
      $('#model-loading').hidden = mode !== 'loading';
      $('#model-hint').textContent = mode === 'webgl' ? '↔ 拖动，换个角度认识我' : message;
      $$('.model-tools button').forEach(button => { button.disabled = mode !== 'webgl'; });
    },
  });
  character.setColor(appearance.color);
  globe = createGlobe({
    container: $('#globe-host'),
    events: filteredEvents(),
    onSelect: id => selectEvent(id),
    reducedMotion: motionPreference.matches,
  });
  if (selectedEventID) globe.select(selectedEventID);
  new MutationObserver(syncGlobeButton).observe($('#globe-host'), { childList: true });
  syncGlobeButton();
  if (character.getState().mode !== 'poster') {
    let savedModel;
    try { savedModel = await modelStorage('get'); } catch { /* Default assets remain fully usable without IndexedDB. */ }
    try {
      if (savedModel?.blob instanceof Blob) {
        modelObjectURL = URL.createObjectURL(savedModel.blob);
        await character.loadModel(modelObjectURL);
        customModelName = savedModel.name || '自定义角色.glb';
        updateAssetUI();
      } else await character.loadModel();
    } catch {
      if (modelObjectURL) {
        URL.revokeObjectURL(modelObjectURL);
        modelObjectURL = undefined;
        try { await character.loadModel(); } catch { /* Viewer reports its poster fallback. */ }
        showToast('本机模型无法加载，已恢复示例角色。');
      }
    }
  }
  ready = true;
  window.__PORTFOLIO_READY__ = true;
  if (storageWarning) showToast(storageWarning);
}
motionPreference.addEventListener('change', () => {
  character?.setReducedMotion(motionPreference.matches);
  $('#character-rotate').setAttribute('aria-pressed', 'false');
  $('#character-rotate').setAttribute('aria-label', '开启角色自动旋转');
  globe?.dispose();
  globe = createGlobe({ container: $('#globe-host'), events: filteredEvents(), onSelect: id => selectEvent(id), reducedMotion: motionPreference.matches });
  if (selectedEventID) globe.select(selectedEventID);
  syncGlobeButton();
});
window.portfolioDiagnostics = () => ({
  ready,
  content: clone(content),
  character: character?.getState(),
  globe: globe?.getState(),
  filter: activeFilter,
  selectedEvent: selectedEventID,
  customModelName,
});
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  character?.dispose();
  globe?.dispose();
  if (modelObjectURL) URL.revokeObjectURL(modelObjectURL);
});
initialize().catch(error => {
  $('#model-loading').hidden = true;
  showToast('三维展示暂时不可用，作品与编辑功能仍可使用。');
  console.error('Portfolio initialization failed:', error);
});
