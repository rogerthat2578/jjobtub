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
  publishedAt: new Date('2026-06-26T01:00:00.000Z'),
  createdAt: new Date('2026-06-26T01:00:00.000Z'),
  updatedAt: new Date('2026-06-26T01:00:00.000Z'),
  channel,
};

describe('Channels API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({
        channel: {
          findUnique: jest.fn().mockResolvedValue(channel),
        },
        video: {
          findMany: jest.fn().mockResolvedValue([video]),
        },
      })
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
});
