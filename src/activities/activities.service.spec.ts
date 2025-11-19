import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesService } from './activities.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  activity: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('ActivitiesService', () => {
  let service: ActivitiesService;
  let prisma: typeof mockPrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitiesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
    prisma = module.get(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated activities', async () => {
      const mockActivities = [{ id: '1', action: 'created' }];
      const mockCount = 1;

      prisma.activity.findMany.mockResolvedValue(mockActivities);
      prisma.activity.count.mockResolvedValue(mockCount);

      const result = await service.findAll(1, 10);

      expect(result).toEqual({
        data: mockActivities,
        meta: {
          total: mockCount,
          page: 1,
          perPage: 10,
          totalPages: 1,
        },
      });
      expect(prisma.activity.findMany).toHaveBeenCalled();
      expect(prisma.activity.count).toHaveBeenCalled();
    });

    it('should apply filters', async () => {
        const mockActivities = [];
        const mockCount = 0;
  
        prisma.activity.findMany.mockResolvedValue(mockActivities);
        prisma.activity.count.mockResolvedValue(mockCount);
  
        await service.findAll(1, 10, { userId: 'user1', action: 'create' });
  
        expect(prisma.activity.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({
                userId: 'user1',
                action: 'create'
            })
        }));
    });
  });

  describe('findByTaskId', () => {
    it('should return activities for a task', async () => {
      const mockActivities = [{ id: '1', taskId: 'task1', action: 'updated' }];
      const mockCount = 1;

      prisma.activity.findMany.mockResolvedValue(mockActivities);
      prisma.activity.count.mockResolvedValue(mockCount);

      const result = await service.findByTaskId('task1', 1, 10);

      expect(result).toEqual({
        data: mockActivities,
        meta: {
          total: mockCount,
          page: 1,
          perPage: 10,
          totalPages: 1,
        },
      });
      expect(prisma.activity.findMany).toHaveBeenCalledWith(expect.objectContaining({
          where: { taskId: 'task1' }
      }));
    });
  });
});
