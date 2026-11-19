export type Phase = 'INITIALIZING' | 'NORMAL' | 'WARNING' | 'DISASTER_ACTIVE' | 'CRITICAL' | 'RECOVERY' | 'COMPLETED';
export type SimulationState = Phase | 'PAUSED';
export type Transition = 'READY' | 'ARM' | 'IMPACT' | 'ESCALATE' | 'END' | 'SETTLED' | 'REBASE' | 'PAUSE' | 'RESUME';
export type Action = 'start' | 'pause' | 'resume' | 'step' | 'stop' | 'reset' | 'configure' | 'save' | 'restore';
export interface StateStamp { phase: Phase; paused: boolean }

const flow: Partial<Record<Phase, Partial<Record<Transition, Phase>>>> = {
  INITIALIZING: { READY: 'NORMAL' },
  NORMAL: { ARM: 'WARNING' },
  WARNING: { IMPACT: 'DISASTER_ACTIVE', END: 'RECOVERY' },
  DISASTER_ACTIVE: { ESCALATE: 'CRITICAL', END: 'RECOVERY' },
  CRITICAL: { END: 'RECOVERY' },
  RECOVERY: { SETTLED: 'COMPLETED' },
};

const timing: Phase[] = ['WARNING', 'DISASTER_ACTIVE', 'CRITICAL', 'RECOVERY'];

export const STATE_UI: Record<SimulationState, { title: string; short: string; tone: string }> = {
  INITIALIZING: { title: '正在初始化', short: 'BOOTING', tone: 'normal' },
  NORMAL: { title: '待命', short: 'STANDBY', tone: 'normal' },
  WARNING: { title: '灾害预警', short: 'WARNING', tone: 'warning' },
  DISASTER_ACTIVE: { title: '运行中', short: 'LIVE SIM', tone: 'warning' },
  CRITICAL: { title: '危险', short: 'CRITICAL', tone: 'critical' },
  RECOVERY: { title: '恢复中', short: 'RECOVERY', tone: 'normal' },
  PAUSED: { title: '已暂停', short: 'PAUSED', tone: 'warning' },
  COMPLETED: { title: '已完成', short: 'COMPLETE', tone: 'normal' },
};

export class SimulationStateMachine {
  private underlying: Phase = 'INITIALIZING';
  private paused = false;

  get phase() { return this.underlying; }
  get state(): SimulationState { return this.paused ? 'PAUSED' : this.phase; }

  allows(action: Action) {
    if (this.phase === 'INITIALIZING') return false;
    switch (action) {
      case 'start': return this.phase === 'NORMAL' || this.phase === 'COMPLETED';
      case 'pause': return !this.paused && timing.includes(this.phase);
      case 'resume':
      case 'step': return this.paused;
      case 'stop': return this.phase === 'WARNING' || this.phase === 'DISASTER_ACTIVE' || this.phase === 'CRITICAL';
      case 'configure':
      case 'reset':
      case 'save':
      case 'restore': return true;
    }
  }

  send(event: Transition) {
    if (event === 'PAUSE' && this.allows('pause')) { this.paused = true; return true; }
    if (event === 'RESUME' && this.allows('resume')) { this.paused = false; return true; }
    if (event === 'REBASE' && this.allows('reset')) {
      this.underlying = 'NORMAL';
      this.paused = false;
      return true;
    }
    const next = flow[this.phase]?.[event];
    if (!next) return false;
    this.underlying = next;
    this.paused = false;
    return true;
  }

  isTicking() { return timing.includes(this.phase); }
  checkpoint(): StateStamp { return { phase: this.phase, paused: this.paused }; }

  restore(saved: StateStamp) {
    if (!this.allows('restore') || !Object.hasOwn(STATE_UI, saved.phase) || saved.phase === 'INITIALIZING' ||
      (saved.paused && !timing.includes(saved.phase))) return false;
    this.underlying = saved.phase;
    this.paused = saved.paused;
    return true;
  }
}
