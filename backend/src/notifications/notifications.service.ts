import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { NotificationType } from '@prisma/client';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listNotifications(request: Pick<Request, 'headers'>) {
    const user = await this.requireCurrentUser(request);
    const notifications = await this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    const unreadCount = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });

    return {
      unreadCount,
      items: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        message: notification.message,
        linkUrl: notification.linkUrl,
        readAt: notification.readAt?.toISOString() ?? null,
        createdAt: notification.createdAt.toISOString(),
      })),
    };
  }

  async markAsRead(id: string, request: Pick<Request, 'headers'>) {
    const user = await this.requireCurrentUser(request);
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== user.id) {
      throw new ForbiddenException('Only the notification owner can update this notification');
    }

    await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    return { ok: true };
  }

  async markAllAsRead(request: Pick<Request, 'headers'>) {
    const user = await this.requireCurrentUser(request);
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return { ok: true };
  }

  async createNotification(input: {
    userId: string;
    actorId?: string;
    type: NotificationType;
    message: string;
    linkUrl?: string;
  }) {
    if (!input.userId || input.userId === input.actorId) {
      return null;
    }

    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        linkUrl: input.linkUrl,
      },
    });
  }

  private async requireCurrentUser(request: Pick<Request, 'headers'>) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }
    return user;
  }
}
