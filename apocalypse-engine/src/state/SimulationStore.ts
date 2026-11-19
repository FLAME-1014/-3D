export class SimulationStore<Value> {
  private listeners = new Set<(value: Value) => void>();

  constructor(private value: Value) {}

  get() { return this.value; }
  publish(value: Value) {
    this.value = value;
    for (const listener of this.listeners) listener(value);
  }

  subscribe(listener: (value: Value) => void) {
    this.listeners.add(listener);
    listener(this.value);
    return () => { this.listeners.delete(listener); };
  }

  dispose() { this.listeners.clear(); }
}
