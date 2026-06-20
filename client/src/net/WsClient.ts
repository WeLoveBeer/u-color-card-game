import type { WsClientMessage, WsServerMessage } from '@shared/index.js';

export type SocketLike = {
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: unknown) => void) | null;
};

export type SocketFactory = (url: string) => SocketLike;

export class WsClient {
  private socket: SocketLike | null = null;
  private seq = 1;
  private readonly listeners = new Set<(message: WsServerMessage) => void>();
  private lastToken: string | null = null;

  constructor(private readonly wsBase: string, private readonly socketFactory: SocketFactory) {}

  connect(token: string): void {
    this.lastToken = token;
    this.socket = this.socketFactory(`${this.wsBase}?token=${encodeURIComponent(token)}`);
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as WsServerMessage;
      for (const listener of this.listeners) {
        listener(message);
      }
    };
  }

  reconnect(roomId?: string, lastSeq?: number): number | null {
    if (!this.lastToken) {
      return null;
    }
    if (!this.socket) {
      this.connect(this.lastToken);
    }
    return this.send({ type: 'reconnect', data: { roomId, lastSeq } });
  }

  onMessage(listener: (message: WsServerMessage) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send<T extends Omit<WsClientMessage, 'seq'>>(message: T): number {
    const seq = this.seq++;
    this.socket?.send(JSON.stringify({ ...message, seq }));
    return seq;
  }

  close(): void {
    this.socket?.close();
    this.socket = null;
  }
}
