import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UserController } from './user.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [UserController]
})
export class UserModule {}
