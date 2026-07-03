import { ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { NotificationType } from '@prisma/client';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';

type NotificationStreamListener = () => void;
type NotificationFilter = NotificationType | 'unread' | 'read' | 'all';

const DEFAULT_NOTIFICATION_LIMIT = 30;
const MAX_NOTIFICATION_LIMIT = 50;
const NOTIFICATION_ARCHIVE_POLICY = {
  retentionDays: null,
  deletion: 'manual',
  maxPageSize: MAX_NOTIFICATION_LIMIT,
};

@Injectable()
export class NotificationsService {
  private readonly streamListeners = new Map<string, Set<NotificationStreamListener>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listNotifications(
    request: Pick<Request, 'headers'>,
    options: { page?: string; limit?: string; filter?: string } = {},
  ) {
    const user = await this.requireCurrentUser(request);
    const page = normalizePositiveInt(options.page, 1);
    const limit = Math.min(normalizePositiveInt(options.limit, DEFAULT_NOTIFICATION_LIMIT), MAX_NOTIFICATION_LIMIT);
    const filter = normalizeNotificationFilter(options.filter);
    const where = {
      userId: user.id,
      ...(filter === 'unread' ? { readAt: null } : {}),
      ...(filter === 'read' ? { readAt: { not: null } } : {}),
      ...(isNotificationType(filter) ? { type: filter } : {}),
    };
    const notifications = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const totalCount = await this.prisma.notification.count({ where });
    const unreadCount = await this.prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));

    return {
      unreadCount,
      totalCount,
      pageInfo: {
        page,
        limit,
        totalPages,
        hasPreviousPage: page > 1,
        hasNextPage: page < totalPages,
      },
      archivePolicy: NOTIFICATION_ARCHIVE_POLICY,
      items: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        message: normalizeNotificationMessage(notification.type, notification.message),
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
        message: normalizeNotificationMessage(input.type, input.message),
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

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function normalizeNotificationFilter(value: string | undefined): NotificationFilter {
  if (value === 'unread' || value === 'read') {
    return value;
  }
  if (isNotificationType(value)) {
    return value;
  }
  return 'all';
}

function isNotificationType(value: string | undefined): value is NotificationType {
  return value === 'COMMENT' || value === 'REPLY' || value === 'COMMENT_LIKE' || value === 'VIDEO_LIKE' || value === 'SUBSCRIPTION' || value === 'PLAYLIST';
}

function normalizeNotificationMessage(type: NotificationType, message: string) {
  if (!hasMojibake(message)) {
    return message;
  }

  const actorName = message.split('?')[0]?.trim();
  if (actorName && type === 'COMMENT') return `${actorName}님이 내 영상에 댓글을 남겼습니다.`;
  if (actorName && type === 'REPLY') return `${actorName}님이 내 댓글에 답글을 남겼습니다.`;
  if (actorName && type === 'COMMENT_LIKE') return `${actorName}님이 내 댓글을 좋아합니다.`;
  if (actorName && type === 'VIDEO_LIKE') return `${actorName}님이 내 영상을 좋아합니다.`;
  if (actorName && type === 'SUBSCRIPTION') return `${actorName}님이 내 채널을 구독했습니다.`;

  if (type === 'PLAYLIST') {
    const quotedParts = Array.from(message.matchAll(/"([^"]+)"/g)).map((match) => match[1]);
    if (quotedParts.length >= 2) return `"${quotedParts[0]}" 영상을 "${quotedParts[1]}" 재생목록에 저장했습니다.`;
    if (quotedParts.length === 1 && message.includes('먯꽌')) return `"${quotedParts[0]}" 재생목록에서 영상을 제거했습니다.`;
    if (quotedParts.length === 1) return `"${quotedParts[0]}" 재생목록을 만들었습니다.`;
  }

  return notificationTypeFallbackMessage(type);
}

function hasMojibake(message: string) {
  return /[?]|\uFFFD|醫|援|梨|곸|볤|듦|깮|뚮|젣|섏|덈|쒖/.test(message);
}

function notificationTypeFallbackMessage(type: NotificationType) {
  if (type === 'COMMENT') return '내 영상에 새 댓글이 등록되었습니다.';
  if (type === 'REPLY') return '내 댓글에 새 답글이 등록되었습니다.';
  if (type === 'COMMENT_LIKE') return '내 댓글에 좋아요가 추가되었습니다.';
  if (type === 'VIDEO_LIKE') return '내 영상에 좋아요가 추가되었습니다.';
  if (type === 'SUBSCRIPTION') return '내 채널에 새 구독자가 추가되었습니다.';
  if (type === 'PLAYLIST') return '재생목록 활동이 업데이트되었습니다.';
  return '새 알림이 있습니다.';
}
