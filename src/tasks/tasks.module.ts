import { Module, Logger } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { EmailModule } from '../email/email.module';
import { ActivitiesModule } from '../activities/activities.module';

@Module({
  imports: [EmailModule, ActivitiesModule],
  controllers: [TasksController],
  providers: [TasksService, Logger],
})
export class TasksModule { }
