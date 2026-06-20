import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';
import { TaskService } from './task.service.js';

async function login(baseUrl: string, code: string) {
  const response = await request(baseUrl).post('/api/auth/wechat-login').send({ code }).expect(201);
  return {
    token: response.body.data.token as string,
    userId: response.body.data.user.id as string
  };
}

describe('任务与牌背接口流程', () => {
  let app: INestApplication;
  let baseUrl: string;
  let tasks: TaskService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    tasks = moduleRef.get(TaskService);
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  it('任务领取会更新金币并参与排行榜', async () => {
    const user = await login(baseUrl, 'task-user');

    await request(baseUrl)
      .get('/api/tasks')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items.find((item: { id: string }) => item.id === 'daily_ai_game')).toMatchObject({
          coinReward: 50,
          progress: 0,
          status: 'todo'
        });
      });

    tasks.recordGameOver(user.userId, [
      { playerId: user.userId, rank: 1, remainCardCount: 0, score: 0 },
      { playerId: 'ai_1', rank: 2, remainCardCount: 2, score: 20 }
    ]);

    await request(baseUrl)
      .post('/api/tasks/claim')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ taskId: 'daily_ai_game' })
      .expect(201)
      .expect((response) => {
        expect(response.body.data).toMatchObject({
          taskId: 'daily_ai_game',
          coinDelta: 50,
          currentCoin: 1050,
          status: 'claimed'
        });
      });

    await request(baseUrl)
      .get('/api/leaderboards/coins')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.me.userId).toBe(user.userId);
        expect(response.body.data.me.coin).toBe(1050);
      });
  });

  it('牌背接口会返回拥有关系并拒绝选择未拥有牌背', async () => {
    const user = await login(baseUrl, 'cosmetic-user');

    await request(baseUrl)
      .get('/api/cosmetics/card-backs')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.selectedCardBackId).toBe('default');
        expect(response.body.data.items.map((item: { id: string }) => item.id)).toEqual(['default', 'u_blue_trial']);
      });

    await request(baseUrl)
      .post('/api/cosmetics/card-backs/select')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ cardBackId: 'u_blue_trial' })
      .expect(201)
      .expect((response) => {
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('INVALID_PARAMS');
      });

    await request(baseUrl)
      .post('/api/cosmetics/card-backs/select')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ cardBackId: 'default' })
      .expect(201)
      .expect((response) => {
        expect(response.body.data.selectedCardBackId).toBe('default');
        expect(response.body.data.items.find((item: { id: string }) => item.id === 'default').selected).toBe(true);
      });
  });
});
