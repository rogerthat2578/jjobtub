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
    },
    channel: {
      findUnique: jest.fn().mockResolvedValue(channel),
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
});
