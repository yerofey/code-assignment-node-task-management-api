import { PrismaClient, User, Task } from '@prisma/client';

export async function seedActivities(prisma: PrismaClient, users: User[], tasks: Task[]) {
  console.log('Seeding activities...');

  if (users.length === 0 || tasks.length === 0) {
    console.warn('Cannot seed activities: No users or tasks available.');
    return;
  }

  const activitiesData = [];

  // Create some 'task created' activities
  for (let i = 0; i < Math.min(tasks.length, 20); i++) {
    const task = tasks[i];
    const user = users[Math.floor(Math.random() * users.length)];
    activitiesData.push({
      action: 'created',
      changes: {
        title: { old: null, new: task.title },
        description: { old: null, new: task.description },
        status: { old: null, new: task.status },
        priority: { old: null, new: task.priority },
      },
      taskId: task.id,
      taskTitle: task.title,
      userId: user.id,
    });
  }

  // Create some 'task updated' activities
  for (let i = 0; i < Math.min(tasks.length, 30); i++) {
    const task = tasks[i];
    const user = users[Math.floor(Math.random() * users.length)];

    const randomField = Math.random();
    let changes: any = {};
    if (randomField < 0.33) {
      changes = { status: { old: task.status, new: 'COMPLETED' } };
    } else if (randomField < 0.66) {
      changes = { priority: { old: task.priority, new: 'URGENT' } };
    } else {
      changes = { assignee: { old: task.assigneeId, new: users[0].id } };
    }

    activitiesData.push({
      action: 'updated',
      changes: changes,
      taskId: task.id,
      taskTitle: task.title,
      userId: user.id,
    });
  }

  // Create activities for each entry
  await Promise.all(
    activitiesData.map((data) =>
      prisma.activity.create({ data })
    )
  );

  console.log(`Seeded ${activitiesData.length} activities.`);
}
