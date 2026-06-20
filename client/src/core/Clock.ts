export class Clock {
  now(): number {
    return Date.now();
  }

  remaining(deadline: number): number {
    return Math.max(0, deadline - this.now());
  }
}
