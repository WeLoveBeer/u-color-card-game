import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  readonly enabled = Boolean(process.env.DATABASE_URL);

  constructor() {
    super({ adapter: new PrismaPg(env.databaseUrl) });
  }

  async onModuleInit(): Promise<void> {
    if (this.enabled) {
      await this.$connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.enabled) {
      await this.$disconnect();
    }
  }
}
