import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const user = {
  id: 'user-1',
  email: 'notify@jjobtub.local',
  displayName: 'Notify User',
  avatarUrl: null,
};

const notification = {
  id: 'notification-1',
  userId: user.id,
  type: 'COMMENT',
  message: '댓글이 달렸습니다.',
  linkUrl: '/watch/video-1?comment=comment-1',
  readAt: null,
  createdAt: new Date('2026-06-29T00:00:00.000Z'),
};

describe('Notifications API', () => {
  let app: INestApplication;
  const prisma = {
    session: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: user.id,
        token: 'session-token',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-29T00:00:00.000Z'),
        user,
      }),
    },
    notification: {
      findMany: jest.fn().mockResolvedValue([notification]),
      findUnique: jest.fn().mockResolvedValue(notification),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue({ ...notification, readAt: new Date('2026-06-29T01:00:00.000Z') }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      delete: jest.fn().mockResolvedValue(notification),
      deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
      create: jest.fn().mockResolvedValue(notification),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: user.id,
      token: 'session-token',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-29T00:00:00.000Z'),
      user,
    });
    prisma.notification.findMany.mockResolvedValue([notification]);
    prisma.notification.findUnique.mockResolvedValue(notification);
    prisma.notification.count.mockResolvedValue(1);
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists notifications with unread count', async () => {
    const response = await request(app.getHttpServer()).get('/api/notifications').set('Cookie', 'jjobtub_session=session-token').expect(200);

    expect(response.body.unreadCount).toBe(1);
    expect(response.body.items[0]).toMatchObject({
      id: 'notification-1',
      linkUrl: '/watch/video-1?comment=comment-1',
      readAt: null,
    });
  });

  it('deletes a single notification owned by the current user', async () => {
    await request(app.getHttpServer())
      .delete('/api/notifications/notification-1')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(prisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'notification-1' } });
  });

  it('deletes all notifications for the current user', async () => {
    await request(app.getHttpServer()).delete('/api/notifications').set('Cookie', 'jjobtub_session=session-token').expect(200);

    expect(prisma.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: user.id } });
  });
});
