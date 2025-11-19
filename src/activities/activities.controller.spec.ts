import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';

describe('ActivitiesController', () => {
  let controller: ActivitiesController;
  let service: ActivitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        {
          provide: ActivitiesService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({
              data: [],
              meta: { total: 0, page: 1, perPage: 20, totalPages: 0 },
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<ActivitiesController>(ActivitiesController);
    service = module.get<ActivitiesService>(ActivitiesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with correct parameters', async () => {
      await controller.findAll(1, 20, 'user1', 'create', '2023-01-01', '2023-01-02');
      expect(service.findAll).toHaveBeenCalledWith(1, 20, {
        userId: 'user1',
        action: 'create',
        from: '2023-01-01',
        to: '2023-01-02',
      });
    });

    it('should use default parameters', async () => {
      await controller.findAll();
      expect(service.findAll).toHaveBeenCalledWith(1, 20, {
        userId: undefined,
        action: undefined,
        from: undefined,
        to: undefined,
      });
    });
  });
});
