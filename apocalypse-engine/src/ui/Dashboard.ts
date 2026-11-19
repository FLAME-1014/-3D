import type { Simulation } from '../core/Simulation';
import type { RenderManager } from '../core/RenderManager';
import type { SceneManager, Layer } from '../core/SceneManager';
import type { Hazard } from '../disasters/settings';
import { HAZARDS, PARAMETERS } from '../disasters/settings';
import type { Metrics, JournalEvent } from '../analytics/MetricsCollector';
import { STATE_UI } from '../state/SimulationStateMachine';
import type { PerformanceSample } from '../utils/PerformanceMonitor';
import { icon } from './icon';
import { DisplayBindings } from '../core/DisplayBindings';

const format = (value: number, digits = 1) => new Intl.NumberFormat('en', { maximumFractionDigits: digits }).format(value);
const clock = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
const safe = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export interface UIAction {
  update(performance?: PerformanceSample): void;
  destroy(): void;
}

export class Dashboard implements UIAction {
  private readonly bindings = new DisplayBindings();
  private readonly host: HTMLElement;
  private readonly timeline: HTMLElement;
  private readonly checkpoints: HTMLElement;
  private readonly chart: HTMLCanvasElement;
  private readonly probe: HTMLElement;
  private readonly live: HTMLElement;
  private readonly unsubscribe: () => void;
  private latest: Metrics;
  private shownHazard: Hazard;
  private chartMode: 'water' | 'damage' | 'wind' | 'intensity' = 'water';
  private destroyed = false;
  private seekTimer = 0;
  private seekGeneration = 0;
  private toastTimer = 0;
  private shownSession = -1;
  private shownSettings = '';
  private draggingTimeline = false;

  constructor(
    private readonly app: HTMLElement,
    private readonly simulation: Simulation,
    private readonly view: SceneManager,
    private readonly renderer: RenderManager,
    private readonly callbacks: { screenshots(): void },
  ) {
    this.latest = simulation.metrics();
    this.shownHazard = simulation.hazard;
    app.innerHTML = this.template();
    app.querySelector('#scene')!.replaceWith(renderer.renderer.domElement);
    renderer.resize();
    this.host = app.querySelector<HTMLElement>('#ui')!;
    this.timeline = this.el('timeline');
    this.checkpoints = this.el('checkpoint-list');
    this.chart = this.el<HTMLCanvasElement>('history');
    this.probe = this.el('probe');
    this.live = this.el('live');
    this.unsubscribe = simulation.store.subscribe(metrics => {
      this.latest = metrics;
      const settingsKey = JSON.stringify(simulation.settings[simulation.hazard]);
      if (this.shownHazard !== simulation.hazard || this.shownSession !== simulation.session) {
        this.shownHazard = simulation.hazard;
        this.shownSession = simulation.session;
        this.renderParameters();
      } else if (settingsKey !== this.shownSettings) {
        this.syncParameters();
      }
      this.renderAll();
    });
    this.bind();
    this.renderParameters();
    this.renderAll();
  }

  update(performance?: PerformanceSample) {
    if (this.destroyed) return;
    if (performance) {
      this.host.dataset.fps = String(Math.round(performance.fps));
      this.host.dataset.p95 = format(performance.p95, 1);
      this.el('fps-label').textContent = `FPS ${Math.round(performance.fps)} · P95 ${format(performance.p95, 1)} MS`;
      this.el('fps-label').classList.toggle('slow', performance.fps < 27);
    }
    this.renderSnapshot();
    if (this.view.probe) this.renderProbe();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.unsubscribe();
    this.bindings.dispose();
    this.simulation.cancelReplay();
    window.clearTimeout(this.seekTimer);
    window.clearTimeout(this.toastTimer);
  }

  private template() {
    return `<main class="shell" id="ui">
      <header class="topbar">
        <button class="brand" data-action="fit" aria-label="返回总览"><span class="brand-emblem">A<span>+</span></span><span class="brand-lockup"><strong>APOCALYPSE<span>ENGINE</span></strong><small>DISASTER RESPONSE COMMAND CENTER</small></span></button>
        <div class="top-separator"></div><div class="session"><span class="green-pulse"></span><span>子午港 · <span class="local-only">COASTAL DISTRICT</span></span><span class="session-id">SIM&nbsp; <b>QH-${String(this.simulation.city.seed).slice(-4)}</b></span></div><div class="top-grow"></div>
        <div class="utc-chip">${icon('radio')}<span>应急频段&nbsp; <b>CH–07</b></span></div><div class="top-divider"></div><div class="top-clock"><span id="wall-clock">18:42:00</span><span>LOCAL OPS TIME</span></div><div class="top-divider"></div><button class="icon-button" data-action="fullscreen" aria-label="全屏">${icon('maximize')}</button>
      </header>
      <section class="workspace" aria-label="实时灾害数字孪生场景">
        <div class="viewport" id="viewport"><canvas id="scene" aria-label="可旋转、缩放并点击查看水深的子午港三维城市"></canvas><div class="vignette"></div><div class="hero-caption"><span class="hero-kicker"><i></i> LIVE DIGITAL TWIN <span>·</span> 固定随机种子 43107</span><h1>子午港<span>城市模型</span></h1><p>MERIDIAN BAY &nbsp;·&nbsp; COASTAL RESILIENCE TESTBED</p><div class="terrain-legend"><span><i class="key-road"></i>道路</span><span><i class="key-water"></i>模拟水域</span><span><i class="key-land"></i>数字地形</span></div></div><div class="map-readout"><span class="crosshair">⌖</span><span id="probe-coord">121° 28′ 09″ E / 31° 13′ 44″ N</span><i></i><span id="map-height">地形&nbsp; +02.4 m</span></div><button class="north-indicator" data-action="camera-map" aria-label="俯瞰城市"><span class="north-arrow">↑</span>N</button>
          <div class="status-stack"><div class="status-card" id="status-card"><div class="status-top"><span class="status-indicator"><i></i></span><div><span class="eyebrow">SYSTEM STATUS</span><b id="status-title">待命</b></div><span class="status-code" id="status-code">STANDBY</span></div><div class="status-lower"><span id="status-copy">城市模型运行正常，等待部署演练。</span><span class="status-symbol">${icon('shield-check')}</span></div></div><div class="ambient-card"><span class="sun-icon">${icon('sun')}</span><div><b id="environment-label">23 栋建筑 · 3355 地形采样</b><span>天候状态 <i id="weather-label">海雾</i></span></div><button data-action="settings" aria-label="系统配置">${icon('settings-2')}</button></div></div>
          <div class="display-controls"><div class="segmented">${(['surface', 'depth', 'drainage'] as const).map(layer => `<button data-layer="${layer}" class="${this.view.layer === layer ? 'active' : ''}">${layer === 'surface' ? '实况' : layer === 'depth' ? '水深' : '排水'}</button>`).join('')}</div><div class="camera-controls"><button data-action="zoom-out" aria-label="缩小">−</button><button class="zoom-track" data-action="fit"><span></span></button><button data-action="zoom-in" aria-label="放大">+</button></div></div><div class="scale-bar"><span></span><i>500 M</i></div><div class="fps-badge">${icon('scan-line')}<span id="fps-label">准备渲染</span><span class="fps-dot"></span></div>
        </div>
        <aside class="panel-left"><div class="panel-heading"><div><span class="eyebrow">01 / FIELD OPERATIONS</span><h2>灾害控制台</h2></div><button class="collapse-button" data-action="collapse" aria-label="收起控制台">${icon('panel-left-close')}</button></div><div class="mobile-status" id="mobile-status"></div><section class="control-section"><div class="section-label"><span>选择灾害情景</span><span class="muted-code">HAZARD TYPE</span></div><div class="hazard-grid" id="hazard-list"></div></section><section class="control-section parameters-section"><div class="section-label"><span>模拟参数</span><span class="muted-code">ENGINE LINK · SYNCED</span></div><div id="parameters"></div></section><div class="panel-spacer"></div><section class="toolbox"><div class="section-label"><span>分析工具</span><span class="muted-code">INSPECTION</span></div><div class="tool-row"><button data-layer="depth">${icon('layers-2')}<span>深度分析</span></button><button data-layer="drainage">${icon('network')}<span>排水网络</span></button><button data-action="snapshot">${icon('camera')}<span>场景截图</span></button></div></section><section class="engine-card"><div class="engine-light">${icon('activity')}</div><div><b>物理引擎在线</b><span>RAPIER 3D · 60 HZ · 固定步长</span></div><span class="engine-online" id="body-count">41 OBJ</span></section></aside>
        <aside class="panel-right"><div class="panel-heading"><div><span class="eyebrow">02 / REAL-TIME INTELLIGENCE</span><h2>实时监测</h2></div><div class="telemetry-badge"><span></span> LIVE</div></div><div class="metrics-grid" id="metrics"></div><section class="chart-section"><div class="chart-heading"><div><span class="section-label">变化趋势</span><span class="muted-code"> · LIVE DATA</span></div><button data-action="expand-chart" aria-label="放大图表">${icon('maximize-2')}</button></div><div class="chart-tabs">${(['water', 'damage', 'wind', 'intensity'] as const).map(mode => `<button data-chart="${mode}" class="${mode === this.chartMode ? 'active' : ''}">${mode === 'water' ? '水位' : mode === 'damage' ? '建筑' : mode === 'wind' ? '风速' : '强度'}</button>`).join('')}</div><canvas id="history" aria-label="实时分析曲线"></canvas><div class="chart-legend"><span id="chart-name">边界水位 / FLOOD HEAD</span><span id="chart-current">WAITING FOR DATA</span></div></section><section class="event-section"><div class="event-heading"><span class="section-label">灾害过程记录</span><span class="muted-code">SIM JOURNAL</span></div><div class="timeline-list" id="timeline"></div></section><section class="checkpoints-section"><div class="event-heading"><span class="section-label">模拟检查点</span><button data-action="checkpoint" class="save-button">${icon('bookmark-plus')} 保存当前状态</button></div><div class="checkpoint-list" id="checkpoint-list"></div></section></aside>
        <section class="bottom-dock"><div class="dock-scenario"><span class="eyebrow">CURRENT SCENARIO</span><strong id="dock-hazard">洪水 <i>·</i> FLOOD</strong></div><div class="dock-main"><div class="dock-heading"><span><i class="clock-dot"></i>SIMULATION CLOCK</span><span class="timecode"><b id="sim-clock">00:00</b><i id="subsecond">.00</i><span> / <span id="phase-time">SCENARIO READY</span></span></span><div class="range-label"><span>演练进度</span><span id="progress-copy">0.0%</span></div></div><input class="time-range" id="time-range" type="range" min="0" max="100" value="0" step=".1" aria-label="模拟过程回放时间"><div class="dock-actions"><button class="play-button" data-action="start">${icon('play')}<span>开始模拟</span></button><button class="stop-button" data-action="stop" aria-label="结束灾害并恢复">${icon('square')}</button><button class="step-button" data-action="step">${icon('step-forward')}<span>单步推进</span></button><button class="reset-button" data-action="reset">${icon('rotate-ccw')}<span>重置</span></button><div class="rate-picker"><span>模拟倍率</span><button data-rate="1" class="active">1×</button><button data-rate="2">2×</button><button data-rate="5">5×</button></div></div></div><div class="dock-phase"><span>预报时间</span><b>18:42:00</b><span id="impact-copy">等待任务部署</span></div><div class="dock-progress" id="replay-badge"></div></section><div class="probe-popover" id="probe" hidden></div>
      </section><div class="toast" id="toast" role="status" aria-live="polite"></div><div class="modal-backdrop" id="modal" hidden><section class="parameter-modal" role="dialog" aria-modal="true"><button data-action="close-modal" class="modal-close" aria-label="关闭">×</button><div class="eyebrow">SYSTEM CONFIGURATION</div><h2>系统配置</h2><div class="modal-row"><span>环境光照</span><div class="segmented">${(['dusk', 'day', 'night'] as const).map(mode => `<button data-day="${mode}" class="${mode === this.view.environment.daylight ? 'active' : ''}">${mode === 'dusk' ? '黄昏' : mode === 'day' ? '白昼' : '夜间'}</button>`).join('')}</div></div><div class="modal-row"><span>渲染质量</span><div class="segmented">${(['auto', 'high', 'medium', 'low'] as const).map(mode => `<button data-quality="${mode}" class="${mode === this.renderer.qualityMode ? 'active' : ''}">${mode === 'auto' ? '自适应' : mode === 'high' ? '高' : mode === 'medium' ? '中' : '低'}</button>`).join('')}</div></div><p>本情景使用固定随机种子，结构响应、浅水传播及刚体碰撞由本地数值模拟驱动。</p></section></div><div id="live" class="accessibility" role="status" aria-live="polite"></div><button class="reopen" data-action="reopen" hidden aria-label="展开控制台">${icon('panel-left-open')}</button></main>`;
  }

  private renderAll() {
    this.renderState();
    this.renderSnapshot();
    this.renderTimeline();
    this.renderCheckpoints();
    this.renderProbe();
    this.renderChart();
  }

  private renderParameters() {
    const params = this.simulation.settings[this.simulation.hazard] as unknown as Record<string, number>;
    this.el('parameters').innerHTML = PARAMETERS[this.simulation.hazard].map(parameter => {
      const value = params[parameter.key];
      const percent = (value - parameter.min) / (parameter.max - parameter.min) * 100;
      return `<div class="parameter-row"><div class="parameter-heading"><label for="param-${parameter.key}">${parameter.label}</label><output id="value-${parameter.key}">${format(value, parameter.digits)} <i>${parameter.unit}</i></output></div><input class="slider" id="param-${parameter.key}" type="range" data-param="${parameter.key}" min="${parameter.min}" max="${parameter.max}" step="${parameter.step}" value="${value}" style="--range:${percent}%" aria-label="${parameter.label}"></div>`;
    }).join('');
    this.el('hazard-list').innerHTML = (['flood', 'quake', 'wind'] as const).map(type => `<button class="hazard-card ${type === this.simulation.hazard ? 'active' : ''}" data-hazard="${type}" aria-pressed="${type === this.simulation.hazard}" style="--hazard:${HAZARDS[type].tint}"><span class="hazard-icon">${icon(HAZARDS[type].icon)}</span><span class="hazard-info"><b>${HAZARDS[type].name}</b><small>${HAZARDS[type].description}</small></span><i class="select-check">${icon('check')}</i></button>`).join('');
    this.host.dataset.hazard = this.simulation.hazard;
    this.host.style.setProperty('--accent', HAZARDS[this.simulation.hazard].tint);
    this.shownSettings = JSON.stringify(this.simulation.settings[this.simulation.hazard]);
  }

  private syncParameters() {
    const values: Record<string, number> = this.simulation.settings[this.simulation.hazard];
    for (const parameter of PARAMETERS[this.simulation.hazard]) {
      const input = this.el<HTMLInputElement>(`param-${parameter.key}`);
      const value = values[parameter.key];
      input.value = String(value);
      input.style.setProperty('--range', `${(value - parameter.min) / (parameter.max - parameter.min) * 100}%`);
      this.el(`value-${parameter.key}`).innerHTML = `${format(value, parameter.digits)} <i>${parameter.unit}</i>`;
    }
    this.shownSettings = JSON.stringify(values);
  }

  private renderState() {
    const state = STATE_UI[this.simulation.machine.state];
    this.host.dataset.state = state.tone;
    this.el('status-card').dataset.state = state.tone;
    this.el('status-title').textContent = state.title;
    this.el('status-code').textContent = state.short;
    const copy: Record<string, string> = {
      INITIALIZING: '正在创建城市模型与物理计算世界。',
      NORMAL: '城市模型运行正常，等待部署演练。',
      WARNING: `${HAZARDS[this.simulation.hazard].name}参数已部署，预警即将生效。`,
      DISASTER_ACTIVE: `${HAZARDS[this.simulation.hazard].name}正在演进，实时响应已同步。`,
      CRITICAL: '受灾指标达到警戒阈值，持续监测中。',
      RECOVERY: '灾害过程结束，城市仍在动态恢复。',
      PAUSED: '已冻结物理计算与模拟时间。',
      COMPLETED: '模拟周期结束，可检查结果或开始新一轮。',
    };
    this.el('status-copy').textContent = copy[this.simulation.machine.state];
    this.el('dock-hazard').innerHTML = `${HAZARDS[this.simulation.hazard].name} <i>·</i> ${HAZARDS[this.simulation.hazard].english}`;
    const play = this.host.querySelector<HTMLButtonElement>('.play-button')!;
    const paused = this.simulation.machine.state === 'PAUSED';
    const running = !paused && this.simulation.machine.isTicking();
    play.dataset.action = paused ? 'resume' : running ? 'pause' : 'start';
    play.innerHTML = `${icon(running ? 'pause' : 'play')}<span>${paused ? '继续模拟' : running ? '暂停模拟' : this.simulation.machine.state === 'COMPLETED' ? '再次演练' : '开始模拟'}</span>`;
    this.el<HTMLButtonElement>('ui', '[data-action="step"]').disabled = !this.simulation.machine.allows('step');
    this.el<HTMLButtonElement>('ui', '[data-action="stop"]').disabled = !this.simulation.machine.allows('stop');
    this.el('phase-time').textContent = this.simulation.machine.phase === 'WARNING' ? `IMPACT IN ${this.simulation.remainingWarning.toFixed(1)} S` : state.short;
    this.el('impact-copy').textContent = this.simulation.machine.phase === 'WARNING' ? `预警 · ${this.simulation.remainingWarning.toFixed(1)} s 后触发` : state.title;
    this.el('replay-badge').textContent = this.simulation.replaying ? '正在确定性回放' : this.simulation.machine.state === 'PAUSED' ? '模拟计算已冻结' : running ? '实时演算中 · 60 Hz' : '';
    this.el('mobile-status').innerHTML = `<span class="mobile-state ${state.tone}">${state.short}</span><button data-action="${paused ? 'resume' : running ? 'pause' : 'start'}">${paused ? '继续' : running ? '暂停' : '开始演练'}</button>`;
    this.host.querySelectorAll('[data-rate]').forEach(button => button.classList.toggle('active', Number(button.getAttribute('data-rate')) === this.simulation.clock.rate));
    this.live.textContent = `${HAZARDS[this.simulation.hazard].name} · ${state.title} · 演练 ${clock(this.latest.time)}`;
  }

  private renderSnapshot() {
    const { latest, simulation } = this;
    this.el('metrics').innerHTML = `<article class="metric-card hero-metric"><div class="metric-top"><span>${icon('waves')}实时水位</span><span class="metric-tag">RIVER GATE</span></div><div class="metric-value"><strong>${format(latest.water, 2)}</strong><span>m</span><i>↗ + ${format(Math.max(0, latest.water - .65), 2)} m</i></div><div class="metric-meta"><span>子午闸 · 水位传感器</span><span>${latest.water > 2 ? '警戒水位上升' : '平水位'}</span></div><div class="water-meter"><i style="width:${Math.min(100, latest.water / 8 * 100)}%"></i></div></article>
      <article class="metric-card"><div class="metric-top"><span>${icon('building-2')}受影响建筑</span><span class="metric-tag">STRUCTURES</span></div><div class="metric-value"><strong>${String(latest.affected).padStart(2, '0')}</strong><span>/ ${simulation.city.buildings.length}</span></div><div class="mini-bars">${Array.from({ length: 15 }, (_, index) => `<i class="${index >= latest.affected * 15 / simulation.city.buildings.length ? 'quiet' : ''}" style="--bar:${20 + ((index * 17 + latest.affected * 9) % 72)}%"></i>`).join('')}</div></article>
      <article class="metric-card"><div class="metric-top"><span>${icon('triangle-alert')}结构损伤</span><span class="metric-tag">DAMAGE</span></div><div class="metric-value"><strong>${String(latest.damaged).padStart(2, '0')}</strong><span>栋受损</span></div><div class="metric-subline"><i class="damage-dot"></i><span>${latest.collapsed} 栋完全损毁</span></div></article>
      <article class="metric-card wind-metric"><div class="metric-top"><span>${icon(simulation.hazard === 'quake' ? 'activity' : 'wind')} ${simulation.hazard === 'quake' ? '地表峰值位移' : '阵风风速'}</span><span class="metric-tag">${simulation.hazard === 'quake' ? 'PGD' : 'M/S'}</span></div><div class="metric-value"><strong>${format(simulation.hazard === 'quake' ? simulation.quake.envelope * simulation.settings.quake.displacement : latest.wind, 1)}</strong><span>${simulation.hazard === 'quake' ? 'm' : 'm/s'}</span></div><div class="wind-visual"><span>${icon('compass')}</span><span>${simulation.hazard === 'wind' ? `风向 ${format(simulation.settings.wind.direction, 0)}°` : simulation.hazard === 'quake' ? '地基响应' : '沿海径流'}</span></div></article>`;
    this.el('sim-clock').textContent = clock(latest.time);
    this.el('subsecond').textContent = `.${Math.floor(latest.time % 1 * 100).toString().padStart(2, '0')}`;
    const progress = Math.min(100, latest.time / this.duration() * 100);
    this.el('progress-copy').textContent = `${format(progress, 1)}%`;
    if (!this.draggingTimeline) this.el<HTMLInputElement>('time-range').value = String(progress);
    this.el<HTMLElement>('ui', '.time-range').style.setProperty('--progress', `${progress}%`);
    this.el('environment-label').textContent = `${simulation.city.buildings.length} 栋建筑 · ${simulation.city.terrain.heights.length} 地形采样`;
    this.el('weather-label').textContent = latest.wind > 20 ? '强风' : simulation.rain > 20 ? '暴雨' : '海雾';
    this.el('body-count').textContent = `${latest.objects} OBJ`;
    const now = new Date();
    this.el('wall-clock').textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  }

  private renderTimeline() {
    const events = [...this.simulation.journal.events].reverse().slice(0, 14);
    this.timeline.innerHTML = events.length ? events.map(event => {
      const symbols: Record<JournalEvent['kind'], string> = { system: 'circle-check', state: 'arrow-up-right', impact: 'zap', damage: 'triangle-alert', collapse: 'triangle-alert', water: 'waves', checkpoint: 'bookmark-check' };
      return `<div class="timeline-event ${event.kind}"><time>${clock(event.time)}</time><i>${icon(symbols[event.kind])}</i><span>${safe(event.label)}</span></div>`;
    }).join('') : `<div class="empty-state">${icon('clock-3')}<span>启动灾害模拟后<br>过程记录将在此呈现</span></div>`;
  }

  private renderCheckpoints() {
    this.checkpoints.innerHTML = this.simulation.checkpoints().map(item => `<div class="checkpoint-row"><span>${icon('bookmark')}<b>CP-${String(item.id).padStart(2, '0')}</b> · ${HAZARDS[item.hazard].name}</span><time>${clock(item.time)}</time><button data-restore="${item.id}">恢复</button></div>`).join('') || '<div class="checkpoint-empty">尚无检查点</div>';
  }

  private renderProbe() {
    const point = this.view.probe;
    if (!point) { this.probe.hidden = true; return; }
    this.probe.hidden = false;
    const depth = this.simulation.flood.depth(point.x, point.z);
    const building = point.building ? this.simulation.city.buildings.find(item => item.id === point.building) : undefined;
    const state = building ? this.simulation.structures.get(building.id) : undefined;
    const projected = this.renderer.project(point);
    this.probe.style.left = `${Math.max(8, projected.x)}px`;
    this.probe.style.top = `${Math.max(50, projected.y)}px`;
    this.probe.innerHTML = `<div class="probe-head"><b>${building ? safe(building.name) : `探测点 ${format(point.x, 0)} / ${format(point.z, 0)}`}</b><button data-action="clear-probe" aria-label="关闭">×</button></div><div>地形高程 <b>${format(point.y, 2)} m</b></div><div>模拟水深 <b class="${depth > .18 ? 'wet' : ''}">${format(depth, 3)} m</b></div>${state ? `<div>建筑状态 <b>${state.condition} · ${format(state.damage * 100, 0)}%</b></div>` : ''}`;
  }

  private renderChart() {
    const rect = this.chart.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const scale = Math.min(devicePixelRatio || 1, 1.5);
    this.chart.width = Math.round(rect.width * scale);
    this.chart.height = Math.round(rect.height * scale);
    const context = this.chart.getContext('2d');
    if (!context) return;
    const values = this.simulation.journal.samples.slice(-100).map(sample => this.chartMode === 'water' ? sample.water : this.chartMode === 'damage' ? sample.damaged : this.chartMode === 'wind' ? sample.wind : sample.intensity);
    context.clearRect(0, 0, this.chart.width, this.chart.height);
    context.strokeStyle = 'rgba(219,224,215,.08)';
    for (let row = 1; row < 4; row++) { context.beginPath(); context.moveTo(8, this.chart.height * row / 4); context.lineTo(this.chart.width - 8, this.chart.height * row / 4); context.stroke(); }
    this.el('chart-name').textContent = this.chartMode === 'water' ? '边界水位 / FLOOD HEAD' : this.chartMode === 'damage' ? '受损建筑 / AFFECTED STRUCTURES' : this.chartMode === 'wind' ? '阵风风速 / SURFACE WIND' : '情景强度 / HAZARD INTENSITY';
    this.el('chart-current').textContent = values.length ? `${format(values.at(-1)!, this.chartMode === 'damage' ? 0 : 2)} ${this.chartMode === 'water' ? 'M' : this.chartMode === 'wind' ? 'M/S' : ''}` : 'WAITING FOR DATA';
    if (!values.length) return;
    const peak = this.chartMode === 'damage' ? 23 : this.chartMode === 'water' ? Math.max(2, this.simulation.settings.flood.initial + 6) : this.chartMode === 'wind' ? Math.max(60, this.simulation.settings.wind.speed * 1.6) : 10;
    const left = 8, innerWidth = this.chart.width - 16, innerHeight = this.chart.height - 30;
    context.beginPath();
    values.forEach((value, index) => {
      const x = left + innerWidth * (values.length === 1 ? .5 : index / (values.length - 1));
      const y = 13 + innerHeight * (1 - Math.min(1, value / peak));
      if (!index) context.moveTo(x, y); else context.lineTo(x, y);
    });
    context.strokeStyle = getComputedStyle(this.host).getPropertyValue('--accent') || '#d7ac76';
    context.lineWidth = 1.6 * scale;
    context.stroke();
  }

  private duration() { return this.simulation.duration; }

  private bind() {
    this.bindings.listen(this.app, 'click', event => this.click(event as MouseEvent));
    this.bindings.listen(this.app, 'input', event => this.input(event as Event));
    this.bindings.listen(this.app, 'change', event => {
      if ((event.target as HTMLElement)?.id === 'time-range') this.draggingTimeline = false;
    });
    this.bindings.listen(this.app, 'pointerdown', event => {
      if ((event.target as HTMLElement)?.id === 'time-range') this.draggingTimeline = true;
    });
    this.bindings.listen(this.app, 'pointercancel', () => { this.draggingTimeline = false; });
    this.bindings.listen(this.app, 'pointerup', event => this.pointerUp(event as PointerEvent));
    this.bindings.listen(window, 'resize', () => this.renderChart());
  }

  private click(event: MouseEvent) {
    const target = (event.target as Element).closest<HTMLElement>('[data-action],[data-hazard],[data-layer],[data-rate],[data-chart],[data-restore],[data-day],[data-quality]');
    if (!target) return;
    if (target.dataset.hazard) { this.simulation.select(target.dataset.hazard as Hazard); this.toast(`${HAZARDS[target.dataset.hazard as Hazard].name}情景已载入`); return; }
    if (target.dataset.layer) { this.view.layer = target.dataset.layer as Layer; this.view.sync(); this.host.querySelectorAll('[data-layer]').forEach(item => item.classList.toggle('active', item.getAttribute('data-layer') === this.view.layer)); return; }
    if (target.dataset.rate) { this.simulation.speed(Number(target.dataset.rate) as 1 | 2 | 5); this.host.querySelectorAll('[data-rate]').forEach(item => item.classList.toggle('active', item === target)); return; }
    if (target.dataset.chart) { this.chartMode = target.dataset.chart as typeof this.chartMode; this.host.querySelectorAll('[data-chart]').forEach(item => item.classList.toggle('active', item === target)); this.renderChart(); return; }
    if (target.dataset.restore) { if (this.simulation.restore(Number(target.dataset.restore))) this.toast('检查点已恢复'); return; }
    if (target.dataset.day) { this.view.environment.daylight = target.dataset.day as typeof this.view.environment.daylight; return; }
    if (target.dataset.quality) { this.renderer.setQuality(target.dataset.quality as typeof this.renderer.qualityMode); return; }
    switch (target.dataset.action) {
      case 'start': this.simulation.start(); break;
      case 'pause': this.simulation.pause(); break;
      case 'resume': this.simulation.resume(); break;
      case 'step': this.simulation.stepOnce(); break;
      case 'stop': this.simulation.stop(); break;
      case 'reset': this.simulation.reset(); this.toast('场景已复位'); break;
      case 'checkpoint': if (this.simulation.save()) this.toast('完整模拟状态已保存'); break;
      case 'snapshot': this.callbacks.screenshots(); break;
      case 'camera-map': this.renderer.setCamera('map'); break;
      case 'zoom-in': this.renderer.zoom(true); break;
      case 'zoom-out': this.renderer.zoom(false); break;
      case 'fit': this.renderer.setCamera('overview'); break;
      case 'fullscreen': if (document.fullscreenElement) void document.exitFullscreen(); else void this.host.requestFullscreen(); break;
      case 'settings': this.el('modal').hidden = false; break;
      case 'close-modal': this.el('modal').hidden = true; break;
      case 'clear-probe': this.view.setProbe(undefined); break;
      case 'collapse': this.host.classList.add('left-collapsed'); this.el('reopen').hidden = false; break;
      case 'reopen': this.host.classList.remove('left-collapsed'); this.el('reopen').hidden = true; break;
      case 'expand-chart': this.host.classList.toggle('chart-expanded'); this.renderChart(); break;
    }
  }

  private input(event: Event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.param) {
      const parameter = PARAMETERS[this.simulation.hazard].find(item => item.key === input.dataset.param);
      if (!parameter) return;
      const value = Number(input.value);
      input.style.setProperty('--range', `${(value - parameter.min) / (parameter.max - parameter.min) * 100}%`);
      this.el(`value-${parameter.key}`).innerHTML = `${format(value, parameter.digits)} <i>${parameter.unit}</i>`;
      this.simulation.configure(parameter.key, value);
      return;
    }
    if (input.id === 'time-range') {
      const fraction = Number(input.value) / 100;
      const generation = ++this.seekGeneration;
      window.clearTimeout(this.seekTimer);
      this.simulation.cancelReplay();
      if (this.simulation.machine.allows('pause')) this.simulation.pause();
      this.seekTimer = window.setTimeout(() => {
        if (generation !== this.seekGeneration) return;
        void this.simulation.seek(fraction, progress => {
          if (generation === this.seekGeneration) this.el('replay-badge').textContent = `确定性回放 · ${format(progress * 100, 0)}%`;
        }).then(success => {
          if (generation === this.seekGeneration) {
            this.draggingTimeline = false;
            if (success) {
              this.syncParameters();
              this.renderAll();
            } else this.toast('先开始一次演练，再拖动时间轴回放');
          }
        }).catch(error => this.toast(`回放失败：${String(error)}`));
      }, 70);
    }
  }

  private pointerUp(event: PointerEvent) {
    if (this.draggingTimeline) return;
    if (!(event.target instanceof HTMLCanvasElement) || event.target.id !== 'scene') return;
    const rect = event.target.getBoundingClientRect();
    const hit = this.view.pick((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1, this.renderer.camera);
    if (hit) this.toast(`水深探针已定位 · ${format(this.simulation.flood.depth(hit.x, hit.z), 3)} m`);
  }

  private toast(message: string) {
    const node = this.el('toast');
    node.textContent = message;
    node.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => node.classList.remove('visible'), 2600);
  }

  private el<T extends HTMLElement = HTMLElement>(id: string, selector?: string): T {
    const scope = id === 'ui' ? this.host : this.app;
    return scope.querySelector<T>(selector ?? `#${CSS.escape(id)}`)!;
  }
}
