export interface RoomLock {
  withLock<T>(roomId: string, task: () => Promise<T>): Promise<T>;
}

export class InMemoryRoomLock implements RoomLock {
  private readonly queues = new Map<string, Promise<unknown>>();

  async withLock<T>(roomId: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(roomId) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.queues.set(roomId, previous.then(() => current));

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.queues.get(roomId) === current) {
        this.queues.delete(roomId);
      }
    }
  }
}
