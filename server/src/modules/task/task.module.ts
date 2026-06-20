import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TaskController } from './task.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [TaskController]
})
export class TaskModule {}
