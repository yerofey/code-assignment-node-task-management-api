import { Injectable, CanActivate, ExecutionContext, BadRequestException } from '@nestjs/common';
import { validate } from 'uuid';

@Injectable()
export class UserIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userId = request.headers['x-user-id'];

    if (!userId) {
      throw new BadRequestException('x-user-id header is required');
    }

    if (!validate(userId)) {
      throw new BadRequestException('x-user-id header must be a valid UUID');
    }

    return true;
  }
}
