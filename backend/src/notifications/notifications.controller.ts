import { Controller, Get, Param, Patch, Req } from '@nestjs/common';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listNotifications(@Req() request: Request) {
    return this.notificationsService.listNotifications(request);
  }

  @Patch('read-all')
  markAllAsRead(@Req() request: Request) {
    return this.notificationsService.markAllAsRead(request);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() request: Request) {
    return this.notificationsService.markAsRead(id, request);
  }
}
