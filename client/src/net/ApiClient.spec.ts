import { describe, expect, it } from 'vitest';
import { ApiClient } from './ApiClient.js';

describe('ApiClient', () => {
  it('会请求任务和牌背接口', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return { json: async () => ({ success: true, data: {} }) } as Response;
    }) as typeof fetch;
    const api = new ApiClient('https://api.example.test', fetcher);
    api.setToken('token-1');

    await api.getTasks();
    await api.claimTaskReward({ taskId: 'daily_ai_game' });
    await api.getCardBacks();
    await api.selectCardBack({ cardBackId: 'default' });

    expect(calls.map((call) => call.url)).toEqual([
      'https://api.example.test/tasks',
      'https://api.example.test/tasks/claim',
      'https://api.example.test/cosmetics/card-backs',
      'https://api.example.test/cosmetics/card-backs/select'
    ]);
    expect(calls[1]?.init?.method).toBe('POST');
    expect(calls[3]?.init?.headers).toMatchObject({ Authorization: 'Bearer token-1' });
  });
});
