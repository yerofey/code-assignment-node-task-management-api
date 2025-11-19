import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { PrismaModule } from './prisma/prisma.module';
import { TasksModule } from './tasks/tasks.module';
import { ProjectsModule } from './projects/projects.module';
import { UsersModule } from './users/users.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from './health/health.module';
import { ActivitiesModule } from './activities/activities.module';
import { redisStore } from 'cache-manager-redis-yet';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('REDIS_HOST');
        const port = configService.get<string>('REDIS_PORT');
        const url = configService.get<string>('REDIS_URL');

        console.log(`Redis Config: Host=${host}, Port=${port}, URL=${url}`);

        // Prioritize explicit host/port if available, otherwise fallback to URL
        if (host && port) {
           return {
            store: await redisStore({
              socket: {
                host,
                port: parseInt(port),
              },
              pingInterval: 5 * 1000,
            })
          };
        }

        return {
          store: await redisStore({
            url: url ?? '',
            socket: {
              tls: url?.startsWith('rediss://') ? true : false,
              rejectUnauthorized: false,
            },
            pingInterval: 5 * 1000,
          })
        }
      },
    }),
    PrismaModule,
    TasksModule,
    ProjectsModule,
    UsersModule,
    EmailModule,
    HealthModule,
    ActivitiesModule,
  ],
})
export class AppModule {}
