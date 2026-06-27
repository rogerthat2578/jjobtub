import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const channel = {
  id: 'channel-1',
  ownerId: 'user-1',
  name: 'Channel API',
  description: 'Channel endpoint tests',
  avatarUrl: null,
  bannerUrl: null,
  subscriberCount: 22,
  createdAt: new Date('2026-06-26T01:00:00.000Z'),
  updatedAt: new Date('2026-06-26T01:00:00.000Z'),
};

const video = {
  id: 'video-1',
  channelId: channel.id,
  title: 'Channel Video',
  description: 'Visible on channel page',
  category: '개발',
  visibility: 'PUBLIC',
  status: 'READY',
  durationSeconds: 0,
  viewCount: 0,
  likeCount: 0,
  source: 'LOCAL',
  externalUrl: null,
  externalVideoId: null,
  publishedAt: new Date('2026-06-26T01:00:00.000Z'),
  createdAt: new Date('2026-06-26T01:00:00.000Z'),
  updatedAt: new Date('2026-06-26T01:00:00.000Z'),
  channel,
};

describe('Channels API', () => {
  let app: INestApplication;
  const prisma = {
    channel: {
      findUnique: jest.fn().mockResolvedValue(channel),
      update: jest.fn().mockResolvedValue({ ...channel, subscriberCount: 23 }),
    },
    video: {
      findMany: jest.fn().mockResolvedValue([video]),
    },
    session: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-2',
        token: 'session-token',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-26T00:00:00.000Z'),
        user: {
          id: 'user-2',
          email: 'viewer@jjobtub.local',
          displayName: 'Viewer',
          avatarUrl: null,
        },
      }),
    },
    channelSubscription: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'subscription-1', channelId: 'channel-1', userId: 'user-2' }),
      delete: jest.fn().mockResolvedValue({ id: 'subscription-1', channelId: 'channel-1', userId: 'user-2' }),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.channel.findUnique.mockResolvedValue(channel);
    prisma.channel.update.mockResolvedValue({ ...channel, subscriberCount: 23 });
    prisma.video.findMany.mockResolvedValue([video]);
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-2',
      token: 'session-token',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-26T00:00:00.000Z'),
      user: {
        id: 'user-2',
        email: 'viewer@jjobtub.local',
        displayName: 'Viewer',
        avatarUrl: null,
      },
    });
    prisma.channelSubscription.findUnique.mockResolvedValue(null);
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

  it('returns channel details', async () => {
    const response = await request(app.getHttpServer()).get('/api/channels/channel-1').expect(200);

    expect(response.body).toMatchObject({
      id: 'channel-1',
      name: 'Channel API',
      description: 'Channel endpoint tests',
      subscriberCount: 22,
    });
  });

  it('returns channel videos', async () => {
    const response = await request(app.getHttpServer()).get('/api/channels/channel-1/videos').expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      title: 'Channel Video',
      channel: { id: channel.id, name: 'Channel API' },
    });
  });

  it('updates channel details for the channel owner', async () => {
    prisma.session.findUnique.mockResolvedValueOnce({
      id: 'session-owner',
      userId: 'user-1',
      token: 'owner-token',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-26T00:00:00.000Z'),
      user: {
        id: 'user-1',
        email: 'owner@jjobtub.local',
        displayName: 'Owner',
        avatarUrl: null,
      },
    });
    prisma.channel.update.mockResolvedValueOnce({
      ...channel,
      name: 'Updated Channel',
      description: 'Updated description',
      avatarUrl: 'https://example.com/avatar.png',
      bannerUrl: 'https://example.com/banner.png',
    });

    const response = await request(app.getHttpServer())
      .patch('/api/channels/channel-1')
      .set('Cookie', 'jjobtub_session=owner-token')
      .send({
        name: 'Updated Channel',
        description: 'Updated description',
        avatarUrl: 'https://example.com/avatar.png',
        bannerUrl: 'https://example.com/banner.png',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'channel-1',
      name: 'Updated Channel',
      description: 'Updated description',
      avatarUrl: 'https://example.com/avatar.png',
      bannerUrl: 'https://example.com/banner.png',
    });
    expect(prisma.channel.update).toHaveBeenCalledWith({
      where: { id: 'channel-1' },
      data: {
        name: 'Updated Channel',
        description: 'Updated description',
        avatarUrl: 'https://example.com/avatar.png',
        bannerUrl: 'https://example.com/banner.png',
      },
    });
  });

  it('rejects channel updates from non-owners', async () => {
    await request(app.getHttpServer())
      .patch('/api/channels/channel-1')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({ name: 'Nope' })
      .expect(403);
  });

  it('subscribes the logged-in user to a channel', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/channels/channel-1/subscribe')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(201);

    expect(response.body).toEqual({ subscribed: true, subscribers: 23 });
    expect(prisma.channelSubscription.create).toHaveBeenCalledWith({
      data: { channelId: 'channel-1', userId: 'user-2' },
    });
    expect(prisma.channel.update).toHaveBeenCalledWith({
      where: { id: 'channel-1' },
      data: { subscriberCount: { increment: 1 } },
      select: { subscriberCount: true },
    });
  });

  it('unsubscribes the logged-in user when already subscribed', async () => {
    prisma.channelSubscription.findUnique.mockResolvedValueOnce({
      id: 'subscription-1',
      channelId: 'channel-1',
      userId: 'user-2',
    });
    prisma.channel.update.mockResolvedValueOnce({ ...channel, subscriberCount: 21 });

    const response = await request(app.getHttpServer())
      .post('/api/channels/channel-1/subscribe')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(201);

    expect(response.body).toEqual({ subscribed: false, subscribers: 21 });
    expect(prisma.channelSubscription.delete).toHaveBeenCalledWith({
      where: { channelId_userId: { channelId: 'channel-1', userId: 'user-2' } },
    });
    expect(prisma.channel.update).toHaveBeenCalledWith({
      where: { id: 'channel-1' },
      data: { subscriberCount: { decrement: 1 } },
      select: { subscriberCount: true },
    });
  });
});
