export class DisplayBindings {
  private cleanup = new Set<() => void>();

  listen(target: EventTarget, type: string, listener: EventListener) {
    target.addEventListener(type, listener);
    this.cleanup.add(() => target.removeEventListener(type, listener));
  }

  add(cleanup: () => void) { this.cleanup.add(cleanup); }

  dispose() {
    for (const cleanup of this.cleanup) cleanup();
    this.cleanup.clear();
  }
}
