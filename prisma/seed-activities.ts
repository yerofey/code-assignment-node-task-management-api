import { PrismaClient } from '@prisma/client';
import { seedActivities } from './seeders/activity.seeder';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function main() {
  console.log('Starting separate activity seeding...');

  try {
    // Fetch existing users and tasks
    const users = await prisma.user.findMany();
    const tasks = await prisma.task.findMany();

    if (users.length === 0 || tasks.length === 0) {
      console.warn('Skipping activity seeding: No users or tasks found. Run "npm run seed" first.');
      return;
    }

    // Run the activity seeding logic
    await seedActivities(prisma, users, tasks);

  } catch (error) {
    console.error('Error seeding activities:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
