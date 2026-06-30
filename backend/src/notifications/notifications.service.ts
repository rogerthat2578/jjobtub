import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { NotificationType } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

type NotificationStreamListener = () => void;

@Injectable()
export class NotificationsService {
  private readonly streamListeners = new Map<string, Set<NotificationStreamListener>>();

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

  async streamNotifications(request: Request, response: Response) {
    const user = await this.requireCurrentUser(request);

    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');
    response.flushHeaders?.();

    const sendEvent = (reason: string) => {
      response.write(`event: notifications\n`);
      response.write(`data: ${JSON.stringify({ reason, at: new Date().toISOString() })}\n\n`);
    };
    const listener = () => sendEvent('changed');
    this.addStreamListener(user.id, listener);
    sendEvent('connected');
    const heartbeatId = setInterval(() => response.write(`: ping\n\n`), 25000);

    request.on('close', () => {
      clearInterval(heartbeatId);
      this.removeStreamListener(user.id, listener);
      response.end();
    });
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
    this.emitNotificationsChanged(user.id);

    return { ok: true };
  }

  async markAllAsRead(request: Pick<Request, 'headers'>) {
    const user = await this.requireCurrentUser(request);
    await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    this.emitNotificationsChanged(user.id);

    return { ok: true };
  }

  async deleteNotification(id: string, request: Pick<Request, 'headers'>) {
    const user = await this.requireCurrentUser(request);
    const notification = await this.prisma.notification.findUnique({ where: { id } });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.userId !== user.id) {
      throw new ForbiddenException('Only the notification owner can delete this notification');
    }

    await this.prisma.notification.delete({ where: { id } });
    this.emitNotificationsChanged(user.id);
    return { ok: true };
  }

  async deleteAll(request: Pick<Request, 'headers'>) {
    const user = await this.requireCurrentUser(request);
    await this.prisma.notification.deleteMany({ where: { userId: user.id } });
    this.emitNotificationsChanged(user.id);
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

    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        message: input.message,
        linkUrl: input.linkUrl,
      },
    });
    this.emitNotificationsChanged(input.userId);
    return notification;
  }

  private addStreamListener(userId: string, listener: NotificationStreamListener) {
    const listeners = this.streamListeners.get(userId) ?? new Set<NotificationStreamListener>();
    listeners.add(listener);
    this.streamListeners.set(userId, listeners);
  }

  private removeStreamListener(userId: string, listener: NotificationStreamListener) {
    const listeners = this.streamListeners.get(userId);
    if (!listeners) {
      return;
    }
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.streamListeners.delete(userId);
    }
  }

  private emitNotificationsChanged(userId: string) {
    this.streamListeners.get(userId)?.forEach((listener) => listener());
  }

  private async requireCurrentUser(request: Pick<Request, 'headers'>) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }
    return user;
  }
}
