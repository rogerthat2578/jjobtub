import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const channel = {
  id: 'channel-1',
  ownerId: 'user-1',
  name: 'Test Channel',
  description: 'Testing channel',
  avatarUrl: null,
  bannerUrl: null,
  subscriberCount: 10,
  createdAt: new Date('2026-06-26T00:00:00.000Z'),
  updatedAt: new Date('2026-06-26T00:00:00.000Z'),
};

const video = {
  id: 'video-1',
  channelId: channel.id,
  title: 'First Video',
  description: 'The first test video',
  category: '개발',
  visibility: 'PUBLIC',
  status: 'READY',
  durationSeconds: 123,
  viewCount: 7,
  likeCount: 3,
  publishedAt: new Date('2026-06-26T00:00:00.000Z'),
  createdAt: new Date('2026-06-26T00:00:00.000Z'),
  updatedAt: new Date('2026-06-26T00:00:00.000Z'),
  channel,
};

describe('Videos API', () => {
  let app: INestApplication;
  const prisma = {
    video: {
      findMany: jest.fn().mockResolvedValue([video]),
      findUnique: jest.fn().mockResolvedValue(video),
      create: jest.fn().mockResolvedValue({ id: 'draft-1', status: 'DRAFT' }),
      update: jest.fn().mockResolvedValue({ ...video, viewCount: 8 }),
      delete: jest.fn().mockResolvedValue(video),
    },
    videoLike: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'like-1', videoId: 'video-1', userId: 'user-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'like-1', videoId: 'video-1', userId: 'user-1' }),
    },
    channel: {
      findUnique: jest.fn().mockResolvedValue(channel),
    },
    session: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        token: 'session-token',
        expiresAt: new Date('2026-06-27T00:00:00.000Z'),
        createdAt: new Date('2026-06-26T00:00:00.000Z'),
        user: {
          id: 'user-1',
          email: 'creator@jjobtub.local',
          displayName: 'Test Creator',
          avatarUrl: null,
        },
      }),
    },
    videoFile: {
      findMany: jest.fn().mockResolvedValue([{ storagePath: 'videos/video-1/original.mp4' }]),
    },
  };

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

  it('lists videos', async () => {
    const response = await request(app.getHttpServer()).get('/api/videos').expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: 'video-1',
      title: 'First Video',
      category: '개발',
      views: 7,
      channel: { id: channel.id, name: 'Test Channel' },
    });
    expect(response.body.items[0].thumbnailUrl).toBe('/api/videos/video-1/thumbnail');
    expect(response.body.nextCursor).toBeNull();
  });

  it('returns video details', async () => {
    const response = await request(app.getHttpServer()).get('/api/videos/video-1').expect(200);

    expect(response.body).toMatchObject({
      id: 'video-1',
      title: 'First Video',
      description: 'The first test video',
      streamUrl: '/api/videos/video-1/stream',
      channel: { id: channel.id, name: 'Test Channel' },
    });
  });

  it('creates a draft video', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos')
      .send({
        title: 'New Draft',
        description: 'Draft description',
        category: '음악',
        channelId: channel.id,
        visibility: 'PUBLIC',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: 'draft-1',
      status: 'DRAFT',
    });
    expect(prisma.video.create).toHaveBeenCalledWith({
      data: {
        channelId: channel.id,
        title: 'New Draft',
        description: 'Draft description',
        category: '음악',
        visibility: 'PUBLIC',
        status: 'DRAFT',
      },
    });
  });

  it('creates a public draft video when visibility is omitted', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos')
      .send({
        title: 'Default Public Draft',
        description: 'Draft description',
        category: '개발',
        channelId: channel.id,
      })
      .expect(201);

    expect(response.body).toEqual({
      id: 'draft-1',
      status: 'DRAFT',
    });
    expect(prisma.video.create).toHaveBeenLastCalledWith({
      data: {
        channelId: channel.id,
        title: 'Default Public Draft',
        description: 'Draft description',
        category: '개발',
        visibility: 'PUBLIC',
        status: 'DRAFT',
      },
    });
  });

  it('increments a video view count', async () => {
    const response = await request(app.getHttpServer()).post('/api/videos/video-1/view').expect(201);

    expect(response.body).toEqual({ views: 8 });
    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
  });

  it('updates video metadata for the channel owner', async () => {
    prisma.video.update.mockResolvedValueOnce({
      ...video,
      title: 'Updated Video',
      description: 'Updated description',
      category: '음악',
    });

    const response = await request(app.getHttpServer())
      .patch('/api/videos/video-1')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({
        title: 'Updated Video',
        description: 'Updated description',
        category: '음악',
        visibility: 'PUBLIC',
      })
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'video-1',
      title: 'Updated Video',
      description: 'Updated description',
      category: '음악',
    });
    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      data: {
        title: 'Updated Video',
        description: 'Updated description',
        category: '음악',
        visibility: 'PUBLIC',
      },
      include: { channel: true },
    });
  });

  it('deletes a video for the channel owner', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/videos/video-1')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body).toEqual({ ok: true });
    expect(prisma.video.delete).toHaveBeenCalledWith({ where: { id: 'video-1' } });
  });

  it('likes a video for the logged-in user', async () => {
    prisma.video.update.mockResolvedValueOnce({ ...video, likeCount: 4 });

    const response = await request(app.getHttpServer())
      .post('/api/videos/video-1/like')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(201);

    expect(response.body).toEqual({ liked: true, likes: 4 });
    expect(prisma.videoLike.create).toHaveBeenCalledWith({
      data: { videoId: 'video-1', userId: 'user-1' },
    });
    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
  });

  it('unlikes a video when the logged-in user already liked it', async () => {
    prisma.videoLike.findUnique.mockResolvedValueOnce({ id: 'like-1', videoId: 'video-1', userId: 'user-1' });
    prisma.video.update.mockResolvedValueOnce({ ...video, likeCount: 2 });

    const response = await request(app.getHttpServer())
      .post('/api/videos/video-1/like')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(201);

    expect(response.body).toEqual({ liked: false, likes: 2 });
    expect(prisma.videoLike.delete).toHaveBeenCalledWith({
      where: { videoId_userId: { videoId: 'video-1', userId: 'user-1' } },
    });
    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    });
  });
});
