import { Controller, Delete, Get, Param, Patch, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listNotifications(@Req() request: Request) {
    return this.notificationsService.listNotifications(request);
  }

  @Get('stream')
  streamNotifications(@Req() request: Request, @Res() response: Response) {
    return this.notificationsService.streamNotifications(request, response);
  }

  @Patch('read-all')
  markAllAsRead(@Req() request: Request) {
    return this.notificationsService.markAllAsRead(request);
  }

  @Delete()
  deleteAll(@Req() request: Request) {
    return this.notificationsService.deleteAll(request);
  }

  @Delete(':id')
  deleteNotification(@Param('id') id: string, @Req() request: Request) {
    return this.notificationsService.deleteNotification(id, request);
  }

  @Patch(':id/read')
  markAsRead(@Param('id') id: string, @Req() request: Request) {
    return this.notificationsService.markAsRead(id, request);
  }
}
