import { useMemo } from 'react';
import { Activity, ArrowUpRight, CheckCircle2, Gauge, Radio, ScanLine } from 'lucide-react';
import { getStampingState, stampingPartId, STAMPING_CYCLE } from '../core/production';
import { rangeProgress } from '../core/clock';
import { getWeldingState, weldingCarId, WELDING_CYCLE } from '../welding/logic';
import type { Station } from '../scene/types';
import './dashboard.css';

export interface DashboardProps {
  shop: 'stamping' | 'welding';
  stations: Station[];
  time: number;
  activeStation: number;
  onStation: (index: number) => void;
}

interface StationDatum { id: string; progress: number; status: string; running: boolean; complete: boolean }
interface ProductionEvent { at: number; title: string; detail: string; type: string }

const numberFormat = new Intl.NumberFormat('zh-CN');
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
const safeTime = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;

function productionClock(time: number): string {
  const seconds = Math.floor(safeTime(time)) + 8 * 3600;
  return [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
}

function stationData(shop: DashboardProps['shop'], stations: Station[], time: number): StationDatum[] {
  if (shop === 'welding') {
    const state = getWeldingState(time);
    return stations.map((_, index) => {
      const pose = state.stations[index];
      if (!pose) return { id: '—', progress: 0, status: '等待数据', running: false, complete: false };
      const status = !pose.occupied ? '空载回落' : state.transfer.active ? '同步转运' : pose.stageComplete ? '工序完成' : pose.working ? ['SPR 铆接', '侧围上件', '主拼焊接', '补焊作业', '激光钎焊', '门盖装配', '几何扫描', '举升出线'][index]! : '定位准备';
      return { id: pose.occupied ? pose.carId : '空载等待', progress: pose.progress, status, running: pose.working || state.transfer.active, complete: pose.stageComplete };
    });
  }
  const state = getStampingState(time);
  return stations.map(station => {
    const press = state.presses.find(pose => pose.x === station.x);
    if (press) return { id: state.parts[press.index]!.id, progress: state.progress, status: press.phase, running: press.phase !== '待机', complete: press.phase === '待机' };
    if (station.id === 'COIL') return { id: `COIL-${String(Math.floor(time / 96) + 1).padStart(4, '0')}`, progress: state.coil.progress, status: state.coil.stage, running: state.coil.carrying, complete: false };
    if (station.id === 'PACK') return { id: state.parts[5]!.id, progress: state.rack.exchanging ? state.rack.exchangeProgress : state.rack.filled / state.rack.capacity, status: state.rack.exchanging ? 'AGV 换框' : '双线装框', running: true, complete: false };
    if (station.id === 'DISPATCH') return { id: state.rack.completedRacks.at(-1)?.id || '等待满框', progress: state.rack.shippedCount ? 1 : 0, status: state.rack.shippedCount ? '满框待发' : '库位待命', running: false, complete: !!state.rack.shippedCount };
    if (station.id === 'BLANK') return { id: stampingPartId(1002 + state.cycle), progress: rangeProgress(state.cycleTime, 1.65, 3.75), status: '开卷 · 落料', running: true, complete: false };
    return { id: stampingPartId(1001 + state.cycle), progress: rangeProgress(state.cycleTime, 0.15, 2.6), status: '清洗 · 对中', running: true, complete: false };
  });
}

function recentEvents(shop: DashboardProps['shop'], time: number): ProductionEvent[] {
  const cycleSeconds = shop === 'welding' ? WELDING_CYCLE : STAMPING_CYCLE;
  const cycle = Math.floor(time / cycleSeconds);
  const events: ProductionEvent[] = [];
  for (let batch = Math.max(0, cycle - 2); batch <= cycle; batch++) {
    const definitions = shop === 'welding' ? [
      { at: 0, title: '滑橇同步转运', detail: weldingCarId(1000 + batch), type: '输送' },
      { at: 25, title: '主拼夹具完成闭合', detail: `FR-30 · ${weldingCarId(998 + batch)}`, type: '工艺' },
      { at: 26, title: '主拼与补焊窗口开启', detail: '8 个演示焊点同步作业', type: '连接' },
      { at: 42, title: '载车滑橇完成高位交接', detail: weldingCarId(993 + batch), type: '输送' },
      { at: 58, title: '顶盖边缘钎焊完成', detail: `RL-50 · ${weldingCarId(996 + batch)}`, type: '工艺' },
      { at: 63, title: '四门两盖装配完成', detail: `CL-60 · ${weldingCarId(995 + batch)}`, type: '装配' },
    ] : [
      { at: 0.8, title: '横杆送料到位', detail: '四台压机完成同步交接', type: '输送' },
      { at: 2.05, title: '拉延进入保压', detail: '滑块行程 1.35 m', type: '成形' },
      { at: 3.3, title: '四序压机完成回程', detail: 'OP10 — OP40 模具开放', type: '工艺' },
      { at: 3.99, title: '侧围外板完成线尾检查', detail: getStampingState(batch * cycleSeconds + 3.99).parts[5]!.id, type: '质量' },
    ];
    definitions.forEach(event => { const at = batch * cycleSeconds + event.at; if (at <= time) events.push({ ...event, at }); });
  }
  if (shop === 'stamping') {
    const batch = Math.floor(time / 480);
    if (batch > 0) {
      events.push({ at: batch * 480, title: '满料架进入 AGV 换框', detail: '120 件 / 批 · 42 s 换框', type: '物流' });
      if (time >= batch * 480 + 42) events.push({ at: batch * 480 + 42, title: '空料架到位，缓存顺序回装', detail: '零件编号连续保留', type: '物流' });
    }
  }
  return events.sort((a, b) => b.at - a.at).slice(0, 6);
}

function PanelTitle({ number, title, subtitle }: { number: string; title: string; subtitle?: string }) {
  return <div className="dashboard-panel-title"><span>{number}</span><h2>{title}</h2>{subtitle && <small>{subtitle}</small>}</div>;
}

function CycleTrend({ cycle, target }: { cycle: number; target: number }) {
  const spread = target > 10 ? 2 : 0.12;
  const values = Array.from({ length: 22 }, (_, index) => target + spread * (0.55 * Math.sin((cycle - 21 + index) * 0.73) + 0.18 * Math.cos((cycle - 21 + index) * 1.61)));
  const points = values.map((value, index) => `${28 + index * 10.2},${44 - (value - target) / spread * 24}`).join(' ');
  return <div className="dashboard-trend-chart"><svg viewBox="0 0 268 100" role="img" aria-label={`节拍趋势，目标 ${target} 秒`}>
    <defs><linearGradient id="dashboard-trend-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e6c64c" stopOpacity=".26"/><stop offset="100%" stopColor="#e6c64c" stopOpacity="0"/></linearGradient></defs>
    {[20, 44, 68].map(y => <line key={y} x1="28" x2="255" y1={y} y2={y} className="dashboard-chart-grid"/>)}
    <text x="0" y="23">{(target + spread).toFixed(target < 10 ? 1 : 0)}</text><text x="0" y="47">{target.toFixed(target < 10 ? 1 : 0)}</text><text x="0" y="71">{(target - spread).toFixed(target < 10 ? 1 : 0)}</text>
    <polygon points={`28,79 ${points} 242.2,79`} fill="url(#dashboard-trend-fill)"/>
    <line x1="28" x2="255" y1="44" y2="44" className="dashboard-chart-target"/>
    <polyline points={points} fill="none" stroke="#e6c64c" strokeWidth="1.7" strokeLinejoin="round"/>
    <circle cx="242.2" cy={44 - (values.at(-1)! - target) / spread * 24} r="2.7" fill="#fff1b2"/>
    <text x="28" y="96">前 21 个节拍</text><text x="231" y="96">当前</text>
  </svg><div className="dashboard-chart-caption"><span><i/>实际节拍</span><span>目标 {target.toFixed(1)} s</span></div></div>;
}

function OEERing({ availability, performance, quality }: { availability: number; performance: number; quality: number }) {
  const oee = availability * performance * quality;
  const length = Math.PI * 88;
  return <div className="dashboard-oee-content"><div className="dashboard-oee-ring"><svg viewBox="0 0 116 116" role="img" aria-label={`设备综合效率 ${percent(oee)}`}>
    <circle cx="58" cy="58" r="51" className="dashboard-oee-outer"/>
    <circle cx="58" cy="58" r="44" fill="none" stroke="#6b726b" strokeOpacity=".35" strokeWidth="8"/>
    <circle cx="58" cy="58" r="44" fill="none" stroke="#e4c452" strokeWidth="8" strokeDasharray={`${length * oee} ${length}`} transform="rotate(-90 58 58)"/>
  </svg><div><strong>{(oee * 100).toFixed(1)}<small>%</small></strong><span>OEE</span></div></div>
    <div className="dashboard-oee-factors">{[['开动率', availability], ['性能率', performance], ['合格率', quality]].map(([label, value]) => <div key={String(label)}><span>{label}</span><b>{percent(Number(value))}</b><i><em style={{ width: percent(Number(value)) }}/></i></div>)}</div>
  </div>;
}

function QualityChart({ cycle, shop }: { cycle: number; shop: DashboardProps['shop'] }) {
  const labels = shop === 'welding' ? ['A 柱', 'B 柱', '顶框', '顶盖', '门槛', '尾门'] : ['外形', '门洞', '轮罩', '孔位', '翻边', '面差'];
  const values = labels.map((_, index) => 0.29 * Math.sin(cycle * 0.47 + index * 1.53) + 0.06 * Math.cos(index * 0.72));
  return <div className="dashboard-quality-chart"><svg viewBox="0 0 268 99" role="img" aria-label="六个代表测点的演示质量偏差，单位毫米">
    {[20, 49, 78].map(y => <line key={y} x1="25" x2="262" y1={y} y2={y} className="dashboard-chart-grid"/>)}
    <text x="0" y="23">+.5</text><text x="9" y="52">0</text><text x="0" y="81">−.5</text>
    {values.map((value, index) => { const height = Math.abs(value) * 58, x = 36 + index * 38; return <g key={labels[index]}><rect x={x} y={value >= 0 ? 49 - height : 49} width="16" height={height} rx="1" fill={value >= 0 ? '#e4c452' : '#bcc8be'}/><text x={x + 8} y={value >= 0 ? 44 - height : 60 + height} textAnchor="middle">{value > 0 ? '+' : ''}{value.toFixed(2)}</text><text x={x + 8} y="96" textAnchor="middle">{labels[index]}</text></g>; })}
  </svg></div>;
}

export function Dashboard({ shop, stations, time, activeStation, onStation }: DashboardProps) {
  const seconds = safeTime(time);
  const data = useMemo(() => stationData(shop, stations, seconds), [shop, stations, seconds]);
  const events = useMemo(() => recentEvents(shop, seconds), [shop, seconds]);
  const cycleSeconds = shop === 'welding' ? WELDING_CYCLE : STAMPING_CYCLE;
  const cycle = Math.floor(seconds / cycleSeconds);
  const welding = shop === 'welding' ? getWeldingState(seconds) : null;
  const stamping = shop === 'stamping' ? getStampingState(seconds) : null;
  const completed = welding?.completed ?? stamping!.completed;
  const wip = welding ? welding.stations.filter(station => station.occupied).length + welding.outbound.length : stamping!.parts.length + 2 + stamping!.rack.bufferCount;
  const quality = (shop === 'welding' ? 0.992 : 0.987) + 0.0006 * Math.sin(cycle * 0.19);
  const kpis = [
    { label: '今日产量', en: 'DAILY OUTPUT', value: numberFormat.format((shop === 'welding' ? 856 : 11852) + completed), unit: '件', icon: <Activity size={17}/>, note: '按生产时钟演示累计' },
    { label: '在制数量', en: 'WORK IN PROGRESS', value: String(wip).padStart(2, '0'), unit: '件', icon: <Radio size={17}/>, note: shop === 'welding' ? '含高位桥载车滑橇' : '含换框缓冲零件' },
    { label: '生产节拍', en: 'CYCLE TIME', value: cycleSeconds.toFixed(1), unit: 's', icon: <Gauge size={17}/>, note: shop === 'welding' ? '8 个工位同步输送' : '四序冲压同步运行' },
    { label: '一次合格率', en: 'FIRST PASS YIELD', value: (quality * 100).toFixed(1), unit: '%', icon: <CheckCircle2 size={17}/>, note: '代表测点演示结果' },
  ];
  return <div className="dashboard-overlay" data-testid="production-dashboard">
    <div className="dashboard-kpis">{kpis.map(kpi => <section className="dashboard-kpi" key={kpi.label}><div className="dashboard-kpi-label">{kpi.icon}<span>{kpi.label}<small>{kpi.en}</small></span><ArrowUpRight size={13}/></div><div className="dashboard-kpi-value">{kpi.value}<span>{kpi.unit}</span></div><small className="dashboard-kpi-note">{kpi.note}</small></section>)}<span className="dashboard-demo-mark">● 演示数据</span></div>

    <div className="dashboard-column dashboard-left-column">
      <section className="dashboard-panel dashboard-status-panel"><PanelTitle number="01" title="工位运行状态" subtitle={`${stations.length} STATIONS`}/><div className="dashboard-status-list">{stations.map((station, index) => <button className={`dashboard-status-row ${activeStation === index ? 'is-selected' : ''}`} key={station.id} onClick={() => onStation(index)} aria-pressed={activeStation === index} title={`${station.name} · ${data[index]!.id}`}><span className={`dashboard-state-dot ${data[index]!.running ? 'is-running' : data[index]!.complete ? 'is-complete' : ''}`}/><span className="dashboard-status-name"><b>{station.id}</b><span>{station.name}</span></span><span className="dashboard-status-state">{data[index]!.status}</span></button>)}</div><div className="dashboard-panel-foot"><span>工位在线 <b>{stations.length}/{stations.length}</b></span><span>统一节拍联动</span></div></section>
      <section className="dashboard-panel dashboard-trend-panel"><PanelTitle number="02" title="节拍趋势" subtitle="CYCLE / s"/><CycleTrend cycle={cycle} target={cycleSeconds}/></section>
    </div>

    <div className="dashboard-column dashboard-right-column">
      <section className="dashboard-panel dashboard-oee-panel"><PanelTitle number="03" title="设备综合效率" subtitle="OEE"/><OEERing availability={shop === 'welding' ? 0.962 : 0.97} performance={shop === 'welding' ? 0.917 : 0.946} quality={quality}/></section>
      <section className="dashboard-panel dashboard-quality-panel"><PanelTitle number="04" title="质量偏差" subtitle="mm / ±0.50"/><QualityChart cycle={cycle} shop={shop}/></section>
      <section className="dashboard-panel dashboard-events-panel"><PanelTitle number="05" title="生产事件" subtitle="EVENT LOG"/><div className="dashboard-events-list">{events.length ? events.map(event => <div className="dashboard-event" key={`${event.at}-${event.title}`}><time>{productionClock(event.at)}</time><div><b>{event.title}</b><small>{event.detail}</small></div><span>{event.type}</span></div>) : <div className="dashboard-event-empty"><ScanLine size={18}/><span>等待第一个生产事件</span></div>}</div></section>
    </div>

    <section className="dashboard-flow-panel"><div className="dashboard-flow-heading"><span>工艺流 <small>PROCESS FLOW</small></span><span>第 {String(cycle + 1).padStart(4, '0')} 节拍 <i/> {productionClock(seconds)}</span></div><div className="dashboard-flow-nodes">{stations.map((station, index) => <button key={station.id} className={`dashboard-flow-node ${activeStation === index ? 'is-selected' : ''} ${data[index]!.complete ? 'is-complete' : ''}`} onClick={() => onStation(index)} aria-pressed={activeStation === index} title={`${station.id} · ${station.name} · ${data[index]!.id}`}><span className="dashboard-flow-diamond"><span>{String(index + 1).padStart(2, '0')}</span></span><span className="dashboard-flow-text"><strong>{station.name}</strong><code>{data[index]!.id}</code><i><em style={{ width: percent(data[index]!.progress) }}/></i></span></button>)}</div></section>

    {shop === 'welding' && <div className="dashboard-world-labels">{stations.map((station, index) => <button key={station.id} className="dashboard-world-label" data-world-label={index} onClick={() => onStation(index)} style={{ display: 'none' }} title={`${station.name} · ${data[index]!.id}`}><span><b>{station.id}</b>{station.name}</span><code>{data[index]!.id}</code><i><em style={{ width: percent(data[index]!.progress) }}/></i></button>)}</div>}
  </div>;
}
