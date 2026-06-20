import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../app.module.js';

async function login(baseUrl: string, code: string) {
  const response = await request(baseUrl).post('/api/auth/wechat-login').send({ code }).expect(201);
  return {
    token: response.body.data.token as string,
    userId: response.body.data.user.id as string
  };
}

describe('奖励与排行榜接口流程', () => {
  let app: INestApplication;
  let baseUrl: string;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  it('登录用户领取每日金币后会更新个人金币和排行榜', async () => {
    const me = await login(baseUrl, 'economy-me');
    await login(baseUrl, 'economy-other');

    const reward = await request(baseUrl)
      .post('/api/rewards/ad')
      .set('Authorization', `Bearer ${me.token}`)
      .send({ rewardType: 'daily_coin' })
      .expect(201);
    expect(reward.body.data).toMatchObject({
      rewardType: 'daily_coin',
      coinDelta: 100,
      currentCoin: 1100,
      todayClaimed: 1,
      todayLimit: 1
    });

    await request(baseUrl)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${me.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.coin).toBe(1100);
      });

    await request(baseUrl)
      .get('/api/leaderboards/coins?limit=1')
      .set('Authorization', `Bearer ${me.token}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.items).toHaveLength(1);
        expect(response.body.data.items[0].userId).toBe(me.userId);
        expect(response.body.data.me.userId).toBe(me.userId);
        expect(response.body.data.me.coin).toBe(1100);
      });
  });

  it('未登录不能领取广告奖励', async () => {
    await request(baseUrl)
      .post('/api/rewards/ad')
      .send({ rewardType: 'daily_coin' })
      .expect(201)
      .expect((response) => {
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('UNAUTHORIZED');
      });
  });
});
