import type { WsServerMessage } from '@shared/index.js';

export class GameAnimationOrchestrator {
  private readonly queue: WsServerMessage[] = [];

  enqueue(message: WsServerMessage): void {
    this.queue.push(message);
  }

  next(): WsServerMessage | undefined {
    return this.queue.shift();
  }

  size(): number {
    return this.queue.length;
  }
}
