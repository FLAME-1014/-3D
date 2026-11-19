import { Simulation } from '../core/Simulation';
import { FrameLoop } from '../core/FrameLoop';
import { DisplayBindings } from '../core/DisplayBindings';

export const FAULTS = [
  { id: 'resource-release', name: '物理对象释放不完整', reproduce: '受控坍塌建筑，再重置物理世界', root: '移除刚体后未同步清理 Collider 与动态对象索引' },
  { id: 'paused-tick', name: '暂停后物理仍在运行', reproduce: '预警后暂停，再推进一秒墙钟时间', root: '物理更新错误地依赖渲染帧，而未受暂停态约束' },
  { id: 'reset-water', name: '洪水重置后水位未恢复', reproduce: '设定 5 m 后重置场景并检查存储数据', root: '显示值和洪水边界状态使用了独立数据源' },
  { id: 'switch-events', name: '切换情景残留旧强迫量', reproduce: '运行台风后立即切换为地震', root: '灾害切换未清除上一情景的风速和降雨量' },
  { id: 'duplicate-loop', name: '重复启动动画循环', reproduce: '同一帧连续启动 FrameLoop 两次', root: '动画调度没有幂等启动保护' },
  { id: 'damage-display', name: '建筑损伤统计与结构分离', reproduce: '修改结构状态后比对指标与楼体状态', root: '统计和视图没有读取同一份结构状态' },
  { id: 'checkpoint-drift', name: '反复恢复检查点发生漂移', reproduce: '保存活动模拟后重复恢复同一检查点', root: '快照缺少 Rapier、水深场或结构状态' },
  { id: 'listener-leak', name: '销毁场景后监听器残留', reproduce: '绑定事件、销毁绑定器并再次派发事件', root: '销毁阶段没有解除已经注册的回调' },
] as const;

export type FaultId = (typeof FAULTS)[number]['id'];
export interface FaultResult {
  id: FaultId;
  name: string;
  reproduction: string;
  rootCause: string;
  passed: boolean;
  evidence: string;
}

export async function runFaultRegression(id: FaultId) {
  const injected = await exercise(id, true);
  const repaired = await exercise(id, false);
  return { ...repaired, injected, repaired, passed: !injected.passed && repaired.passed };
}

async function exercise(id: FaultId, inject: boolean): Promise<FaultResult> {
  if (!FAULTS.some(item => item.id === id)) throw new Error(`Unknown fault regression: ${id}`);
  if (id === 'duplicate-loop') {
    let nextId = 0;
    let requests = 0;
    const callbacks = new Map<number, FrameRequestCallback>();
    const scheduler = {
      request: (callback: FrameRequestCallback) => { requests++; const handle = ++nextId; callbacks.set(handle, callback); return handle; },
      cancel: (handle: number) => { callbacks.delete(handle); },
    };
    const loop = new FrameLoop(scheduler, () => {});
    const duplicate = inject ? new FrameLoop(scheduler, () => {}) : loop;
    loop.start();
    duplicate.start();
    const pendingAfterStart = callbacks.size;
    const startPasses = requests === 1 && callbacks.size === 1;
    loop.stop();
    const stopped = callbacks.size === 0 && !loop.isRunning;
    loop.start();
    const stale = callbacks.get(nextId)!;
    loop.stop();
    stale(10);
    const passed = startPasses && stopped && !loop.isRunning && requests === 2 && callbacks.size === 0;
    duplicate.stop();
    return result(id, passed, `重复开始后的待处理 RAF 数：${pendingAfterStart}；总调度次数：${requests}`);
  }
  if (id === 'listener-leak') {
    const bindings = new DisplayBindings();
    const target = new EventTarget();
    let received = 0;
    bindings.listen(target, 'probe', () => received++);
    target.dispatchEvent(new Event('probe'));
    if (!inject) { bindings.dispose(); bindings.dispose(); }
    target.dispatchEvent(new Event('probe'));
    bindings.dispose();
    return result(id, received === 1, `dispose 前后总回调次数为 ${received}`);
  }

  const simulation = await Simulation.create();
  try {
    if (id === 'resource-release') {
      const building = simulation.city.buildings[0];
      simulation.physics.collapse(building, 0, 0.7, -0.3);
      const collapsedBodies = simulation.physics.count;
      const dynamics = simulation.physics.dynamics.size;
      if (inject) simulation.physics.structures.clear();
      else simulation.physics.reset();
      const passed = simulation.physics.structures.has(building.id) &&
        simulation.physics.count === 41 && simulation.physics.colliders === 44 &&
        simulation.physics.dynamics.size === 16 && dynamics === 24 && collapsedBodies === 48;
      return result(id, passed, `崩塌后 ${collapsedBodies} 个刚体 / ${dynamics} 个动态物体；重建后 ${simulation.physics.count} 个刚体 / ${simulation.physics.colliders} 个碰撞体`);
    }
    if (id === 'paused-tick') {
      simulation.start();
      simulation.advance(0.24);
      simulation.pause();
      const time = simulation.clock.time;
      const steps = simulation.physics.steps;
      if (inject) simulation.canAdvance = () => true;
      simulation.advance(1);
      const frozen = simulation.clock.time === time && simulation.physics.steps === steps;
      const singleStep = simulation.stepOnce() && simulation.physics.steps === steps + 1 &&
        Math.abs(simulation.clock.time - time - 1 / 60) < 1e-8;
      return result(id, frozen && singleStep, `暂停前 ${steps} 步；输入墙钟一秒并执行一次单步后 ${simulation.physics.steps} 步`);
    }
    if (id === 'reset-water') {
      simulation.configure('initial', 5);
      const changed = simulation.metrics().water;
      if (inject) simulation.store.publish = () => {};
      simulation.reset();
      const metrics = simulation.metrics().water;
      const store = simulation.store.get().water;
      const passed = changed === 5 && metrics === simulation.settings.flood.initial &&
        metrics === simulation.flood.head && store === metrics;
      return result(id, passed, `重置后模型 ${metrics.toFixed(2)} m，监测订阅源 ${store.toFixed(2)} m`);
    }
    if (id === 'switch-events') {
      simulation.select('wind');
      simulation.start();
      for (let step = 0; step < 12; step++) simulation.advance(0.24);
      const hadWind = simulation.rain > 0 && simulation.wind.speed > 0;
      const obsoleteCallback = ((previous) => () => { simulation.wind = previous; })(simulation.wind);
      simulation.select('quake');
      if (inject) obsoleteCallback();
      const passed = hadWind && simulation.wind.speed === 0 && simulation.rain === 0 &&
        simulation.hazard === 'quake' && simulation.quake.envelope === 0;
      return result(id, passed, `台风影响后切换为地震；风速 ${simulation.wind.speed.toFixed(2)} m/s，残留降雨 ${simulation.rain} mm/h`);
    }
    if (id === 'damage-display') {
      const building = simulation.city.buildings[0];
      const staleMetrics = simulation.metrics();
      if (inject) simulation.metrics = () => staleMetrics;
      const state = simulation.structures.get(building.id)!;
      state.condition = 'damaged';
      state.damage = 0.47;
      const metrics = simulation.metrics();
      return result(id, metrics.damaged === 1 && metrics.affected >= 1 &&
        state.condition === 'damaged' && state.damage === 0.47,
      `建筑 ${building.id} 状态 ${state.condition} / ${Math.round(state.damage * 100)}%；同源统计受损 ${metrics.damaged} 栋`);
    }
    if (id === 'checkpoint-drift') {
      simulation.start();
      for (let step = 0; step < 3; step++) simulation.advance(0.24);
      const checkpoint = simulation.save();
      if (checkpoint === null) return result(id, false, '运行状态下无法保存检查点');
      const capture = () => ({
        time: simulation.clock.time,
        phase: simulation.machine.phase,
        bodies: simulation.physics.count,
        colliders: simulation.physics.colliders,
        head: simulation.flood.head,
        depths: Array.from(simulation.flood.depths),
        damage: simulation.structures.get(simulation.city.buildings[0].id)!.damage,
        dynamics: Array.from(simulation.physics.dynamics.values(), item => {
          const point = simulation.physics.body(item).translation();
          return [item.id, point.x, point.y, point.z];
        }),
      });
      const expected = capture();
      if (inject) simulation.physics.restore = () => {};
      simulation.advance(0.24);
      simulation.restore(checkpoint);
      const first = capture();
      simulation.advance(0.24);
      simulation.restore(checkpoint);
      const second = capture();
      const passed = JSON.stringify(expected) === JSON.stringify(first) &&
        JSON.stringify(expected) === JSON.stringify(second);
      const verticalError = Math.max(...expected.dynamics.map((item, index) => Math.abs(item[2] - second.dynamics[index][2])));
      return result(id, passed, `两次恢复后：${first.bodies} 刚体、${first.depths.length} 水深单元；最大刚体高度偏差 ${verticalError.toFixed(6)} m`);
    }
    return result(id, false, `未执行回归：${id}`);
  } finally {
    simulation.dispose();
  }
}

function result(id: FaultId, passed: boolean, evidence: string): FaultResult {
  const fault = FAULTS.find(item => item.id === id)!;
  return { id, name: fault.name, reproduction: fault.reproduce, rootCause: fault.root, passed, evidence };
}
