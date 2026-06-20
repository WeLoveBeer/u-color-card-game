export type RandomSource = {
  next(): number;
};

export class MathRandomSource implements RandomSource {
  next(): number {
    return Math.random();
  }
}

export class SeededRandomSource implements RandomSource {
  private value: number;

  constructor(seed: number) {
    this.value = seed || 1;
  }

  next(): number {
    // 轻量线性同余随机源，主要用于测试复现；正式安全随机后续放到应用层接入。
    this.value = (this.value * 48271) % 0x7fffffff;
    return this.value / 0x7fffffff;
  }
}

export function shuffle<T>(items: T[], random: RandomSource): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random.next() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}
