import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    page: number = 1,
    limit: number = 20,
    filters?: { userId?: string; action?: string; from?: string; to?: string }
  ) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;
    const where: any = {};

    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = new Date(filters.from);
      if (filters.to) where.createdAt.lte = new Date(filters.to);
    }

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } }
      }),
      this.prisma.activity.count({ where })
    ]);

    return {
      data,
      meta: {
        total,
        page: p,
        perPage: l,
        totalPages: Math.ceil(total / l)
      }
    };
  }

  async findByTaskId(taskId: string, page: number = 1, limit: number = 20) {
    const p = Number(page) || 1;
    const l = Number(limit) || 20;
    const skip = (p - 1) * l;
    const where = { taskId };

    const [data, total] = await Promise.all([
      this.prisma.activity.findMany({
        where,
        skip,
        take: l,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } }
      }),
      this.prisma.activity.count({ where })
    ]);

    return {
      data,
      meta: {
        total,
        page: p,
        perPage: l,
        totalPages: Math.ceil(total / l)
      }
    };
  }
}
