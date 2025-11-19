import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { setupE2EApp, cleanupDatabase, closeApp } from './test-utils';

describe('Activities (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let userId1: string;
  let userId2: string;

  beforeAll(async () => {
    const setup = await setupE2EApp();
    app = setup.app;
    prisma = setup.prisma;

    await cleanupDatabase(prisma);

    // Setup data
    const user1 = await prisma.user.create({
      data: { email: `test1-${Date.now()}@example.com`, name: 'User One' },
    });
    userId1 = user1.id;

    const user2 = await prisma.user.create({
      data: { email: `test2-${Date.now()}@example.com`, name: 'User Two' },
    });
    userId2 = user2.id;

    const project = await prisma.project.create({
      data: { name: 'Test Project' },
    });
    projectId = project.id;
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
    await closeApp(app);
  });

  describe('Activity Logging', () => {
    it('should log activity when a task is created', async () => {
      const taskData = {
        title: 'Task 1',
        projectId: projectId,
        status: 'TODO',
      };

      const createResponse = await request(app.getHttpServer())
        .post('/tasks')
        .set('x-user-id', userId1)
        .send(taskData)
        .expect(201);

      const taskId = createResponse.body.id;

      const activitiesResponse = await request(app.getHttpServer())
        .get('/activities')
        .expect(200);

      const activities = activitiesResponse.body.data;
      const activity = activities.find(a => a.taskId === taskId && a.action === 'created');

      expect(activity).toBeDefined();
      expect(activity.userId).toBe(userId1);
      expect(activity.taskTitle).toBe(taskData.title);
    });

    it('should log activity when a task is updated', async () => {
      const task = await prisma.task.create({
        data: { title: 'Task 2', projectId },
      });

      const updateData = { status: 'IN_PROGRESS' };

      await request(app.getHttpServer())
        .put(`/tasks/${task.id}`)
        .set('x-user-id', userId2)
        .send(updateData)
        .expect(200);

      const response = await request(app.getHttpServer())
        .get(`/tasks/${task.id}/activities`)
        .expect(200);

      const activity = response.body.data.find(a => a.action === 'updated');
      expect(activity).toBeDefined();
      expect(activity.userId).toBe(userId2);
      expect(activity.changes).toHaveProperty('status');
      expect(activity.changes['status'].new).toBe('IN_PROGRESS');
    });
  });

  describe('GET /activities (Filtering & Pagination)', () => {
    beforeAll(async () => {
      // Ensure we have enough data for pagination
      const task = await prisma.task.create({ data: { title: 'Pagination Task', projectId } });

      // Create 3 update activities by user1
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .put(`/tasks/${task.id}`)
          .set('x-user-id', userId1)
          .send({ priority: 'HIGH' });
      }
    });

    it('should filter by userId', async () => {
      const response = await request(app.getHttpServer())
        .get(`/activities?userId=${userId1}`)
        .expect(200);

      const activities = response.body.data;
      expect(activities.length).toBeGreaterThan(0);
      activities.forEach(a => expect(a.userId).toBe(userId1));
    });

    it('should filter by action', async () => {
      const response = await request(app.getHttpServer())
        .get(`/activities?action=updated`)
        .expect(200);

      const activities = response.body.data;
      expect(activities.length).toBeGreaterThan(0);
      activities.forEach(a => expect(a.action).toBe('updated'));
    });

    it('should paginate results', async () => {
      const limit = 2;
      const response = await request(app.getHttpServer())
        .get(`/activities?limit=${limit}&page=1`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(limit);
      expect(response.body.meta.perPage).toBe(limit);
      expect(response.body.meta.page).toBe(1);
    });

    it('should filter by date range', async () => {
      // All activities are recent.
      const now = new Date();
      const future = new Date(now.getTime() + 1000000);
      const past = new Date(now.getTime() - 1000000);

      // Should find nothing in future
      await request(app.getHttpServer())
        .get(`/activities?from=${future.toISOString()}`)
        .expect(200)
        .then(res => {
          expect(res.body.data).toEqual([]);
        });

      // Should find everything from past to now
      await request(app.getHttpServer())
        .get(`/activities?from=${past.toISOString()}`)
        .expect(200)
        .then(res => {
          expect(res.body.data.length).toBeGreaterThan(0);
        });
    });
  });

  describe('GET /tasks/:id/activities', () => {
    it('should paginate task activities', async () => {
      const task = await prisma.task.create({ data: { title: 'Task Activity Pagination', projectId } });
      // Create 3 updates
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .put(`/tasks/${task.id}`)
          .set('x-user-id', userId1)
          .send({ status: 'DONE' });
      }

      const limit = 2;
      const response = await request(app.getHttpServer())
        .get(`/tasks/${task.id}/activities?limit=${limit}&page=1`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(limit);
      expect(response.body.meta.perPage).toBe(limit);
    });
  });
});
