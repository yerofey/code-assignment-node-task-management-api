import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export async function setupE2EApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));
  await app.init();

  const prisma = app.get<PrismaService>(PrismaService);
  return { app, prisma };
}

export async function closeApp(app: INestApplication) {
  try {
    const cacheManager = app.get<any>(CACHE_MANAGER);
    // cache-manager-redis-yet exposes the client on the store
    const client = cacheManager?.store?.client;
    if (client && typeof client.quit === 'function') {
      await client.quit();
    } else if (client && typeof client.disconnect === 'function') {
      await client.disconnect();
    }
  } catch (e) {
    // Ignore errors if cache manager is not found or structure is different
    console.warn('Failed to close Redis client:', e);
  }
  await app.close();
}

export async function cleanupDatabase(prisma: PrismaService) {
  // Order matters due to foreign key constraints
  await prisma.activity.deleteMany();
  await prisma.task.deleteMany();
  await prisma.tag.deleteMany(); // Also clean tags if any
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
}
