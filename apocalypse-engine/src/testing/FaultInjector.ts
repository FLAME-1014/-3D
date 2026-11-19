import './fault-lab.css';
import { FAULTS, runFaultRegression } from './FaultRegressions';
import type { FaultId } from './FaultRegressions';

export { FAULTS, runFaultRegression } from './FaultRegressions';
export type { FaultId, FaultResult } from './FaultRegressions';

export class FaultInjector {
  private readonly root: HTMLElement;

  constructor(private readonly app: HTMLElement) {
    this.root = document.createElement('section');
    this.root.className = 'fault-lab';
    this.root.setAttribute('aria-label', '故障注入与修复验证');
    this.app.querySelector('#ui')?.append(this.root);
  }

  mount() {
    this.root.innerHTML = `<div class="fault-head"><span>DEV / FAULT INJECTION</span><b>8 个隔离回归 · 每项直接运行真实引擎</b><button type="button" aria-label="关闭故障注入台">×</button></div><div class="fault-grid">${FAULTS.map((fault, index) => `<button type="button" class="fault-run" data-fault="${fault.id}"><span>0${index + 1}</span>${fault.name}<i>运行回归</i></button>`).join('')}</div><div class="fault-result" aria-live="polite">逐项执行隔离复现与修复回归</div>`;
    this.root.addEventListener('click', this.click);
  }

  dispose() {
    this.root.removeEventListener('click', this.click);
    this.root.remove();
  }

  private click = (event: Event) => {
    const action = (event.target as Element).closest<HTMLElement>('[data-fault],.fault-head button');
    if (!action) return;
    if (action.matches('.fault-head button')) { this.dispose(); return; }
    const id = action.dataset.fault as FaultId;
    const button = action as HTMLButtonElement;
    button.disabled = true;
    button.querySelector('i')!.textContent = '正在运行…';
    void runFaultRegression(id).then(outcome => {
      button.classList.toggle('verified', outcome.passed);
      button.classList.toggle('failed', !outcome.passed);
      button.querySelector('i')!.textContent = outcome.passed ? '回归通过' : '回归失败';
      const output = this.root.querySelector<HTMLElement>('.fault-result');
      if (output) output.textContent = outcome.passed
        ? `注入时断言失败：${outcome.injected.evidence}。关闭注入后通过：${outcome.repaired.evidence}。根因：${outcome.rootCause}`
        : `${outcome.name}失败：${outcome.evidence}`;
    }).catch(error => {
      button.classList.add('failed');
      button.querySelector('i')!.textContent = '运行异常';
      const output = this.root.querySelector<HTMLElement>('.fault-result');
      if (output) output.textContent = `${button.textContent}：${error instanceof Error ? error.message : String(error)}`;
    }).finally(() => { button.disabled = false; });
  };
}
