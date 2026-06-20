export type EventHandler<T> = (payload: T) => void;

export class EventBus<Events extends Record<string, unknown>> {
  private readonly handlers = new Map<keyof Events, Set<EventHandler<Events[keyof Events]>>>();

  on<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): () => void {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler as EventHandler<Events[keyof Events]>);
    this.handlers.set(type, set);
    return () => this.off(type, handler);
  }

  off<K extends keyof Events>(type: K, handler: EventHandler<Events[K]>): void {
    this.handlers.get(type)?.delete(handler as EventHandler<Events[keyof Events]>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    for (const handler of this.handlers.get(type) ?? []) {
      handler(payload);
    }
  }
}
