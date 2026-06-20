import { Module } from '@nestjs/common';
import { CommonModule } from '../../common/common.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CosmeticController } from './cosmetic.controller.js';

@Module({
  imports: [CommonModule, AuthModule],
  controllers: [CosmeticController]
})
export class CosmeticModule {}
