/// <reference types="vite/client" />

interface Window {
  __APOCALYPSE_TEST__?: {
    engine: import('./src/core/Engine').Engine;
    simulation: import('./src/core/Simulation').Simulation;
    snapshot(): Record<string, unknown> & { frames: number; fps: number; p95: number; heap: number | null };
    dispose(): void;
    instances(): number;
  };
}
