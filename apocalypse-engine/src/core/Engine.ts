import type { Hazard } from '../disasters/settings';
import { SceneManager } from './SceneManager';
import { RenderManager } from './RenderManager';
import { Simulation } from './Simulation';
import { FrameLoop } from './FrameLoop';
import { DisplayBindings } from './DisplayBindings';
import { Dashboard } from '../ui/Dashboard';

export class Engine {
  readonly bindings = new DisplayBindings();
  readonly simulation: Simulation;
  readonly scene: SceneManager;
  readonly renderer: RenderManager;
  readonly dashboard: Dashboard;
  private readonly loop: FrameLoop;
  private disposed = false;
  private lastDashboard = 0;
  private lastSession = -1;

  private constructor(private readonly app: HTMLElement, simulation: Simulation) {
    this.simulation = simulation;
    this.scene = new SceneManager(simulation);
    const canvas = document.createElement('canvas');
    canvas.id = 'scene';
    canvas.setAttribute('aria-label', '可旋转、缩放并点击查看水深的子午港三维城市');
    app.append(canvas);
    try {
      this.renderer = new RenderManager(canvas, this.scene);
    } catch (error) {
      this.scene.dispose();
      simulation.dispose();
      throw error;
    }
    this.dashboard = new Dashboard(app, simulation, this.scene, this.renderer, {
      screenshots: () => this.screenshot(),
    });
    this.loop = new FrameLoop({
      request: callback => requestAnimationFrame(callback),
      cancel: id => cancelAnimationFrame(id),
    }, (delta, now) => this.frame(delta, now));
    if (new URLSearchParams(location.search).get('faults') === '1' && import.meta.env.DEV) {
      void import('../testing/FaultInjector').then(({ FaultInjector }) => {
        if (!this.disposed) {
          const laboratory = new FaultInjector(app);
          laboratory.mount();
          this.bindings.add(() => laboratory.dispose());
        }
      });
    }
    const leave = () => this.dispose();
    this.bindings.listen(window, 'pagehide', leave);
    this.bindings.listen(window, 'beforeunload', leave);
    this.bindings.listen(document, 'visibilitychange', () => {
      if (document.hidden) this.loop.stop();
      else if (!this.disposed) this.loop.start();
    });
    this.bindings.listen(canvas, 'webglcontextlost', event => {
      event.preventDefault();
      this.simulation.pause();
      this.fatal('GPU 渲染设备已重置，请刷新后重新启动。');
    });
    this.bindings.listen(canvas, 'webglcontextrestored', () => this.locationReload());
    this.loop.start();
  }

  static async create(app: HTMLElement, seed?: number) {
    const simulation = await Simulation.create(seed);
    if (!app.isConnected) { simulation.dispose(); return null; }
    return new Engine(app, simulation);
  }

  get frameLoopRunning() { return this.loop.isRunning; }
  get disposedState() { return this.disposed; }

  start() { if (!this.disposed) this.loop.start(); }
  stop() { this.loop.stop(); }

  private frame(delta: number, now: number) {
    if (this.disposed) return;
    if (this.lastSession !== this.simulation.session) {
      this.lastSession = this.simulation.session;
      this.renderer.performance.reset();
      this.renderer.invalidateShadows();
    }
    this.simulation.advance(delta);
    this.scene.sync();
    this.renderer.render(delta, now);
    const monitor = this.renderer.performance.sample;
    if (now - this.lastDashboard >= 0.8 && monitor.frames > 0) {
      this.lastDashboard = now;
      this.dashboard.update(monitor);
    }
  }

  selectHazard(hazard: Hazard) {
    this.simulation.select(hazard);
    this.renderer.invalidateShadows();
  }

  private screenshot() {
    this.renderer.render(0, performance.now() / 1000);
    const anchor = document.createElement('a');
    const url = this.renderer.renderer.domElement.toDataURL('image/png');
    anchor.download = `apocalypse-engine-${this.simulation.hazard}-${this.simulation.clock.ticks}.png`;
    anchor.href = url;
    anchor.click();
  }

  private fatal(message: string) {
    if (this.disposed) return;
    let overlay = this.app.querySelector<HTMLElement>('.fatal-error');
    if (!overlay) {
      overlay = document.createElement('section');
      overlay.className = 'fatal-error';
      overlay.setAttribute('role', 'alert');
      this.app.append(overlay);
    }
    overlay.textContent = message;
  }

  private locationReload() { location.reload(); }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loop.stop();
    this.bindings.dispose();
    this.dashboard.destroy();
    this.renderer.dispose();
    this.simulation.dispose();
  }
}
