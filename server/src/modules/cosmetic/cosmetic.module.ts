import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CosmeticController } from './cosmetic.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [CosmeticController]
})
export class CosmeticModule {}
