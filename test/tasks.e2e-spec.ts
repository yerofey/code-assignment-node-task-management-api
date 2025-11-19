import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';
import { setupE2EApp, cleanupDatabase, closeApp } from './test-utils';

describe('TasksController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let projectId: string;
  let userId: string;

  beforeAll(async () => {
    const setup = await setupE2EApp();
    app = setup.app;
    prisma = setup.prisma;

    await cleanupDatabase(prisma);

    // Setup shared data
    const project = await prisma.project.create({ data: { name: 'E2E Project' } });
    projectId = project.id;

    const user = await prisma.user.create({ data: { email: 'e2e-user@example.com', name: 'E2E User' } });
    userId = user.id;
  });

  afterAll(async () => {
    await cleanupDatabase(prisma);
    await closeApp(app);
  });

  describe('GET /tasks', () => {
    it('should return an empty list initially (paginated structure)', async () => {
      const response = await request(app.getHttpServer())
        .get('/tasks')
        .expect(200);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.total).toBe(0);
    });

    it('should return tasks with filters', async () => {
      // Create tasks
      await prisma.task.create({
        data: { title: 'Task 1', status: 'TODO', projectId },
      });
      await prisma.task.create({
        data: { title: 'Task 2', status: 'IN_PROGRESS', projectId },
      });

      const response = await request(app.getHttpServer())
        .get('/tasks?status=TODO')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].title).toBe('Task 1');
    });

    it('should filter by priority', async () => {
      await prisma.task.create({
        data: { title: 'High Priority', priority: 'HIGH', projectId },
      });

      const response = await request(app.getHttpServer())
        .get('/tasks?priority=HIGH')
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      const task = response.body.data.find(t => t.title === 'High Priority');
      expect(task).toBeDefined();
      expect(task.priority).toBe('HIGH');
    });

    it('should paginate results', async () => {
      // We have at least 3 tasks now.
      const limit = 2;
      const response = await request(app.getHttpServer())
        .get(`/tasks?limit=${limit}&page=1`)
        .expect(200);

      expect(response.body.data.length).toBeLessThanOrEqual(limit);
      expect(response.body.meta.perPage).toBe(limit);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.total).toBeGreaterThanOrEqual(3);
    });

    it('should return error for invalid page param', async () => {
      await request(app.getHttpServer())
        .get('/tasks?page=invalid')
        .expect(400);
    });
  });

  describe('POST /tasks', () => {
    it('should fail without x-user-id header', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .send({ title: 'New Task', projectId })
        .expect(400);
    });

    it('should create a task with valid header', async () => {
      const response = await request(app.getHttpServer())
        .post('/tasks')
        .set('x-user-id', userId)
        .send({ title: 'New Task', projectId, status: 'TODO' })
        .expect(201);

      expect(response.body.title).toBe('New Task');
      expect(response.body.projectId).toBe(projectId);
    });

    it('should fail validation when title is missing', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .set('x-user-id', userId)
        .send({ projectId })
        .expect(400);
    });
  });

  describe('GET /tasks/:id', () => {
    it('should return 404 for non-existent task', async () => {
      await request(app.getHttpServer())
        .get(`/tasks/${uuidv4()}`)
        .expect(404);
    });

    it('should return a task by id', async () => {
      const task = await prisma.task.create({
        data: { title: 'Find Me', projectId },
      });

      const response = await request(app.getHttpServer())
        .get(`/tasks/${task.id}`)
        .expect(200);

      expect(response.body.id).toBe(task.id);
      expect(response.body.title).toBe('Find Me');
    });
  });

  describe('PUT /tasks/:id', () => {
    it('should update a task', async () => {
      const task = await prisma.task.create({
        data: { title: 'Update Me', projectId, status: 'TODO' },
      });

      const response = await request(app.getHttpServer())
        .put(`/tasks/${task.id}`)
        .set('x-user-id', userId)
        .send({ status: 'COMPLETED' })
        .expect(200);

      expect(response.body.status).toBe('COMPLETED');
    });

    it('should return 404 for updating non-existent task', async () => {
      await request(app.getHttpServer())
        .put(`/tasks/${uuidv4()}`)
        .set('x-user-id', userId)
        .send({ status: 'COMPLETED' })
        .expect(404);
    });
  });

  describe('DELETE /tasks/:id', () => {
    it('should delete a task', async () => {
      const task = await prisma.task.create({
        data: { title: 'Delete Me', projectId },
      });

      await request(app.getHttpServer())
        .delete(`/tasks/${task.id}`)
        .set('x-user-id', userId)
        .expect(200);

      const check = await prisma.task.findUnique({ where: { id: task.id } });
      expect(check).toBeNull();
    });
  });
});
