import { Controller, Get, Post, Put, Delete, Param, Body, Query, Headers, UseInterceptors, UseGuards } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { TasksService } from './tasks.service';
import { ActivitiesService } from '../activities/activities.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { UserIdGuard } from '../common/guards/user-id.guard';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly activitiesService: ActivitiesService
  ) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(10000) // 10 seconds cache
  findAll(@Query() filterDto: TaskFilterDto) {
    return this.tasksService.findAll(filterDto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Get(':id/activities')
  getActivities(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20
  ) {
    return this.activitiesService.findByTaskId(id, page, limit);
  }

  @Post()
  @UseGuards(UserIdGuard)
  create(@Body() createTaskDto: CreateTaskDto, @Headers('x-user-id') userId: string) {
    return this.tasksService.create(createTaskDto, userId);
  }

  @Put(':id')
  @UseGuards(UserIdGuard)
  update(@Param('id') id: string, @Body() updateTaskDto: UpdateTaskDto, @Headers('x-user-id') userId: string) {
    return this.tasksService.update(id, updateTaskDto, userId);
  }

  @Delete(':id')
  @UseGuards(UserIdGuard)
  remove(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    return this.tasksService.remove(id, userId);
  }
}
