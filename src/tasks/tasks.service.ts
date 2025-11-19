import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { Task, Prisma } from '@prisma/client';
import { getSimpleChanges, getDateChange, getArrayChange } from '../common/utils/diff.util';

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private readonly logger: Logger = new Logger(TasksService.name),
  ) { }

  async findAll(filterDto: TaskFilterDto) {
    const { status, priority, assigneeId, projectId, dueDateFrom, dueDateTo, page = 1, limit = 20 } = filterDto;
    const where: Prisma.TaskWhereInput = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (assigneeId) where.assigneeId = assigneeId;
    if (projectId) where.projectId = projectId;

    if (dueDateFrom || dueDateTo) {
      where.dueDate = {};
      if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom);
      if (dueDateTo) where.dueDate.lte = new Date(dueDateTo);
    }

    const skip = (page - 1) * limit;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: {
          assignee: true,
          project: true,
          tags: true,
        },
        skip,
        take: limit,
      }),
      this.prisma.task.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        perPage: limit,
        totalPages: Math.ceil(total / limit),
      }
    };
  }

  async findOne(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        assignee: true,
        project: true,
        tags: true,
      },
    });

    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }

    return task;
  }

  async create(createTaskDto: CreateTaskDto, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.create({
        data: {
          title: createTaskDto.title,
          description: createTaskDto.description,
          status: createTaskDto.status,
          priority: createTaskDto.priority,
          dueDate: createTaskDto.dueDate,
          project: { connect: { id: createTaskDto.projectId } },
          assignee: createTaskDto.assigneeId
            ? { connect: { id: createTaskDto.assigneeId } }
            : undefined,
          tags: createTaskDto.tagIds
            ? { connect: createTaskDto.tagIds.map(id => ({ id })) }
            : undefined,
        },
        include: {
          assignee: true,
          project: true,
          tags: true,
        },
      });

      if (userId) {
        const changes = {};
        Object.keys(createTaskDto).forEach(key => {
          if (key !== 'tagIds' && createTaskDto[key] !== undefined) {
            changes[key] = { old: null, new: createTaskDto[key] };
          }
        });

        await tx.activity.create({
          data: {
            action: 'created',
            taskId: task.id,
            taskTitle: task.title,
            userId,
            changes: changes,
          }
        });
      }
      return task;
    });

    if (result.assignee) {
      // Fire and forget - do not await
      this.emailService.sendTaskAssignmentNotification(
        result.assignee.email,
        result.title
      ).catch(e => this.logger.error('Error sending email:', e, TasksService.name));
    }

    return result;
  }

  async update(id: string, updateTaskDto: UpdateTaskDto, userId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const existingTask = await tx.task.findUnique({
        where: { id },
        include: {
          assignee: true,
          project: true,
          tags: true,
        },
      });

      if (!existingTask) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      const task = await tx.task.update({
        where: { id },
        data: {
          title: updateTaskDto.title,
          description: updateTaskDto.description,
          status: updateTaskDto.status,
          priority: updateTaskDto.priority,
          dueDate: updateTaskDto.dueDate,
          assignee: updateTaskDto.assigneeId !== undefined
            ? updateTaskDto.assigneeId
              ? { connect: { id: updateTaskDto.assigneeId } }
              : { disconnect: true }
            : undefined,
          tags: updateTaskDto.tagIds
            ? { set: updateTaskDto.tagIds.map(id => ({ id })) }
            : undefined,
        },
        include: {
          assignee: true,
          project: true,
          tags: true,
        },
      });

      if (userId) {
        const changes = {
          ...getSimpleChanges(existingTask, updateTaskDto, ['title', 'description', 'status', 'priority', 'assigneeId']),
          ...getDateChange(existingTask.dueDate, updateTaskDto.dueDate),
          ...(updateTaskDto.tagIds ? getArrayChange(existingTask.tags.map(t => t.id), updateTaskDto.tagIds, 'tags') : {}),
        };

        if (Object.keys(changes).length > 0) {
          await tx.activity.create({
            data: {
              action: 'updated',
              taskId: task.id,
              taskTitle: task.title,
              userId,
              changes,
            }
          });
        }
      }
      return { task, existingTask };
    });

    const { task, existingTask } = result;

    if (updateTaskDto.assigneeId && updateTaskDto.assigneeId !== existingTask.assigneeId) {
      if (task.assignee) {
        this.emailService.sendTaskAssignmentNotification(
          task.assignee.email,
          task.title
        ).catch(e => this.logger.error('Error sending email:', e, TasksService.name));
      }
    }

    return task;
  }

  async remove(id: string, userId: string) {
    await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id } });

      if (!task) {
        throw new NotFoundException(`Task with ID ${id} not found`);
      }

      await tx.task.delete({
        where: { id },
      });

      if (userId) {
        await tx.activity.create({
          data: {
            action: 'deleted',
            // taskId will be nullified because of SetNull on delete, 
            // or we can pass it and it gets nullified.
            // However, let's store it. 
            taskId: null,
            taskTitle: task.title,
            userId,
            changes: {},
          }
        });
      }
    });

    return { message: 'Task deleted successfully' };
  }
}
