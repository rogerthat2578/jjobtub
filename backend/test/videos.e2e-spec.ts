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
  source: 'LOCAL',
  externalUrl: null,
  externalVideoId: null,
  publishedAt: new Date('2026-06-26T00:00:00.000Z'),
  createdAt: new Date('2026-06-26T00:00:00.000Z'),
  updatedAt: new Date('2026-06-26T00:00:00.000Z'),
  channel,
};

const youtubeVideo = {
  ...video,
  id: 'youtube-video-1',
  source: 'YOUTUBE',
  externalUrl: 'https://youtu.be/Fs9w91F6CQQ',
  externalVideoId: 'Fs9w91F6CQQ',
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
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({ id: 'like-1', videoId: 'video-1', userId: 'user-1' }),
      delete: jest.fn().mockResolvedValue({ id: 'like-1', videoId: 'video-1', userId: 'user-1' }),
    },
    channelSubscription: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    videoView: {
      findMany: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({ id: 'view-1', videoId: 'video-1', userId: 'user-1' }),
    },
    channel: {
      findUnique: jest.fn().mockResolvedValue(channel),
    },
    session: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        token: 'session-token',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
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
      findFirst: jest.fn().mockResolvedValue(null),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({ id: 'file-1' }),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.video.findMany.mockResolvedValue([video]);
    prisma.video.findUnique.mockResolvedValue(video);
    prisma.video.create.mockResolvedValue({ id: 'draft-1', status: 'DRAFT' });
    prisma.video.update.mockResolvedValue({ ...video, viewCount: 8 });
    prisma.channel.findUnique.mockResolvedValue(channel);
    prisma.videoLike.findUnique.mockResolvedValue(null);
    prisma.videoLike.findMany.mockResolvedValue([]);
    prisma.channelSubscription.findMany.mockResolvedValue([]);
    prisma.channelSubscription.findUnique.mockResolvedValue(null);
    prisma.videoView.findMany.mockResolvedValue([]);
    prisma.videoFile.findMany.mockResolvedValue([{ storagePath: 'videos/video-1/original.mp4' }]);
    prisma.videoFile.findFirst.mockResolvedValue(null);
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      token: 'session-token',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-26T00:00:00.000Z'),
      user: {
        id: 'user-1',
        email: 'creator@jjobtub.local',
        displayName: 'Test Creator',
        avatarUrl: null,
      },
    });
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

  it('lists videos from subscribed channels for the logged-in user', async () => {
    prisma.channelSubscription.findMany.mockResolvedValueOnce([{ channelId: channel.id }]);

    const response = await request(app.getHttpServer())
      .get('/api/videos/subscriptions')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(prisma.video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ channelId: { in: [channel.id] } }),
      }),
    );
  });

  it('lists liked videos for the logged-in user', async () => {
    prisma.videoLike.findMany.mockResolvedValueOnce([{ video }]);

    const response = await request(app.getHttpServer())
      .get('/api/videos/library')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ id: 'video-1', title: 'First Video' });
  });

  it('lists video history for the logged-in user', async () => {
    prisma.videoView.findMany.mockResolvedValueOnce([{ video }]);

    const response = await request(app.getHttpServer())
      .get('/api/videos/history')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({ id: 'video-1', title: 'First Video' });
  });

  it('returns video details', async () => {
    const response = await request(app.getHttpServer()).get('/api/videos/video-1').expect(200);

    expect(response.body).toMatchObject({
      id: 'video-1',
      title: 'First Video',
      description: 'The first test video',
      source: 'LOCAL',
      streamUrl: '/api/videos/video-1/stream',
      channel: { id: channel.id, name: 'Test Channel' },
    });
  });

  it('uses the YouTube thumbnail URL for YouTube videos', async () => {
    prisma.video.findUnique.mockResolvedValueOnce(youtubeVideo);

    const response = await request(app.getHttpServer()).get('/api/videos/youtube-video-1').expect(200);

    expect(response.body.thumbnailUrl).toBe('https://img.youtube.com/vi/Fs9w91F6CQQ/hqdefault.jpg');
  });

  it('creates a draft video for the logged-in channel owner', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos')
      .set('Cookie', 'jjobtub_session=session-token')
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
        source: 'LOCAL',
      },
    });
  });

  it('creates a public draft video when visibility is omitted', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos')
      .set('Cookie', 'jjobtub_session=session-token')
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
        source: 'LOCAL',
      },
    });
  });

  it('creates a ready YouTube video from a watch URL', async () => {
    prisma.video.create.mockResolvedValueOnce({
      id: 'youtube-1',
      status: 'READY',
    });

    const response = await request(app.getHttpServer())
      .post('/api/videos')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({
        title: 'YouTube Import',
        description: 'Embedded from YouTube',
        category: '개발',
        channelId: channel.id,
        source: 'YOUTUBE',
        externalUrl: 'https://youtu.be/Fs9w91F6CQQ',
      })
      .expect(201);

    expect(response.body).toEqual({
      id: 'youtube-1',
      status: 'READY',
    });
    expect(prisma.video.create).toHaveBeenLastCalledWith({
      data: {
        channelId: channel.id,
        title: 'YouTube Import',
        description: 'Embedded from YouTube',
        category: '개발',
        visibility: 'PUBLIC',
        status: 'READY',
        source: 'YOUTUBE',
        externalUrl: 'https://youtu.be/Fs9w91F6CQQ',
        externalVideoId: 'Fs9w91F6CQQ',
        publishedAt: expect.any(Date),
      },
    });
  });

  it('rejects invalid YouTube URLs', async () => {
    await request(app.getHttpServer())
      .post('/api/videos')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({
        title: 'Invalid YouTube Import',
        description: 'Nope',
        category: '개발',
        channelId: channel.id,
        source: 'YOUTUBE',
        externalUrl: 'https://example.com/video',
      })
      .expect(400);
  });

  it('rejects video creation without login', async () => {
    prisma.session.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .post('/api/videos')
      .send({
        title: 'No Login',
        description: 'Draft description',
        category: '개발',
        channelId: channel.id,
      })
      .expect(401);
  });

  it('rejects video creation for another user channel', async () => {
    prisma.channel.findUnique.mockResolvedValueOnce({ ...channel, ownerId: 'other-user' });

    await request(app.getHttpServer())
      .post('/api/videos')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({
        title: 'Wrong Channel',
        description: 'Draft description',
        category: '개발',
        channelId: channel.id,
      })
      .expect(403);
  });

  it('rejects original upload without login', async () => {
    prisma.session.findUnique.mockResolvedValueOnce(null);

    await request(app.getHttpServer())
      .post('/api/videos/video-1/upload')
      .attach('file', Buffer.from('fake mp4'), { filename: 'test.mp4', contentType: 'video/mp4' })
      .expect(401);
  });

  it('rejects original upload for a non-owner', async () => {
    prisma.video.findUnique.mockResolvedValueOnce({ ...video, channel: { ...channel, ownerId: 'other-user' } });

    await request(app.getHttpServer())
      .post('/api/videos/video-1/upload')
      .set('Cookie', 'jjobtub_session=session-token')
      .attach('file', Buffer.from('fake mp4'), { filename: 'test.mp4', contentType: 'video/mp4' })
      .expect(403);
  });

  it('increments a video view count', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos/video-1/view')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(201);

    expect(response.body).toEqual({ views: 8 });
    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
    expect(prisma.videoView.upsert).toHaveBeenCalledWith({
      where: { videoId_userId: { videoId: 'video-1', userId: 'user-1' } },
      create: { videoId: 'video-1', userId: 'user-1' },
      update: { viewCount: { increment: 1 }, lastViewedAt: expect.any(Date) },
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
