import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useFactory: () => (process.env.DATABASE_URL ? new PrismaService() : { enabled: false })
    },
    RedisService
  ],
  exports: [PrismaService, RedisService]
})
export class CommonModule {}
