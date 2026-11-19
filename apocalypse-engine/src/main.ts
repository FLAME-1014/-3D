import './styles/tokens.css';
import './styles/layout.css';
import './styles/responsive.css';
import { Engine } from './core/Engine';

const app = document.querySelector<HTMLElement>('#app')!;

function showError(error: unknown) {
  console.error('APOCALYPSE ENGINE initialization failed:', error);
  app.innerHTML = `<main class="boot-error"><div class="boot-mark">A+</div><span class="eyebrow">APOCALYPSE ENGINE / INITIALIZATION ERROR</span><h1>无法初始化实时模拟场景</h1><p>${escapeMessage(error)}</p><button onclick="location.reload()">重新尝试</button><small>请使用支持 WebGL 2 的桌面浏览器，并启用硬件图形加速。</small></main>`;
}

function escapeMessage(error: unknown) {
  const text = error instanceof Error ? error.message : String(error);
  return text.slice(0, 360).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

async function boot() {
  if (!('WebGL2RenderingContext' in window)) throw new Error('当前浏览器不支持 WebGL 2');
  const engine = await Engine.create(app);
  if (!engine) return;
  if (import.meta.env.DEV) {
    Object.defineProperty(window, '__APOCALYPSE_TEST__', {
      configurable: true,
      value: {
        engine,
        simulation: engine.simulation,
        snapshot: () => ({
          status: engine.simulation.machine.state,
          phase: engine.simulation.machine.phase,
          hazard: engine.simulation.hazard,
          time: engine.simulation.clock.time,
          water: engine.simulation.flood.head,
          damage: engine.simulation.metrics().damaged,
          affected: engine.simulation.metrics().affected,
          destroyed: engine.simulation.metrics().collapsed,
          physics: engine.simulation.physics.count,
          colliders: engine.simulation.physics.colliders,
          geometries: engine.renderer.renderer.info.memory.geometries,
          textures: engine.renderer.renderer.info.memory.textures,
          drawCalls: engine.renderer.renderer.info.render.calls,
          testPixel: engine.renderer.testPixel,
          fps: engine.renderer.performance.sample.fps,
          p95: engine.renderer.performance.sample.p95,
          heap: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
          frames: engine.renderer.performance.sample.frames,
          checkpoints: engine.simulation.checkpoints(),
        }),
        dispose: () => engine.dispose(),
        instances: () => engine.renderer.renderer.info.render.calls,
      },
    });
  }
}

void boot().catch(showError);
