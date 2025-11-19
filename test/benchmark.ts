import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { TasksService } from '../src/tasks/tasks.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { Bench } from 'tinybench';

async function run() {
    // 1. Bootstrap NestJS Application Context (No HTTP Server)
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    const tasksService = app.get(TasksService);
    const prismaService = app.get(PrismaService);

    console.log('Setting up benchmark data...');

    // Ensure we have a project and some data
    let project = await prismaService.project.findFirst();
    if (!project) {
        project = await prismaService.project.create({ data: { name: 'Benchmark Project' } });
    }

    // Ensure we have at least 100 tasks for the read test
    const taskCount = await prismaService.task.count();
    if (taskCount < 100) {
        console.log('Seeding 100 tasks for benchmark...');
        const tasks = [];
        for (let i = 0; i < 100; i++) {
            tasks.push({
                title: `Benchmark Task ${i}`,
                projectId: project.id,
                status: 'TODO' as const,
            });
        }
        // Bulk insert would be faster but we want to use the existing schema
        await prismaService.task.createMany({ data: tasks });
    }

    // Create a user for activity logging
    let user = await prismaService.user.findFirst({ where: { email: 'bench@example.com' } });
    if (!user) {
        user = await prismaService.user.create({
            data: {
                name: 'Benchmark User',
                email: 'bench@example.com'
            }
        });
    }

    const bench = new Bench({ time: 1000 }); // Run each for 1 second

    // 2. Define Benchmarks
    bench
        .add('TasksService.findAll (with filters)', async () => {
            await tasksService.findAll({ status: 'TODO' });
        })
        .add('TasksService.create (async email)', async () => {
            await tasksService.create({
                title: 'Bench Create',
                projectId: project!.id,
                status: 'TODO',
                priority: 'MEDIUM'
            }, user!.id);
        });

    console.log('Running benchmarks...');

    await bench.run();

    console.table(bench.table());

    // Cleanup created tasks (optional, depending on env)
    // await prismaService.task.deleteMany({ where: { title: 'Bench Create' } });

    await app.close();
    process.exit(0);
}

run().catch(console.error);
