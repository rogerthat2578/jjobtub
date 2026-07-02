import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const channel = {
  id: 'channel-1',
  ownerId: 'user-1',
  name: 'Search Channel',
  description: 'Channel for searchable videos',
  avatarUrl: null,
  bannerUrl: null,
  subscriberCount: 5,
  createdAt: new Date('2026-06-29T00:00:00.000Z'),
  updatedAt: new Date('2026-06-29T00:00:00.000Z'),
  _count: { videos: 2 },
};

const video = {
  id: 'video-1',
  channelId: channel.id,
  title: 'Frontend Tips',
  description: 'Search result highlight target',
  category: '개발',
  visibility: 'PUBLIC',
  status: 'READY',
  durationSeconds: 30,
  viewCount: 12,
  likeCount: 4,
  tags: ['frontend-dev'],
  source: 'LOCAL',
  externalUrl: null,
  externalVideoId: null,
  publishedAt: new Date('2026-06-29T00:00:00.000Z'),
  createdAt: new Date('2026-06-29T00:00:00.000Z'),
  updatedAt: new Date('2026-06-29T00:00:00.000Z'),
  channel,
};

const playlist = {
  id: 'playlist-1',
  ownerId: 'user-1',
  name: 'Frontend Playlist',
  description: 'A collection about frontend search',
  isPublic: true,
  kind: 'CUSTOM',
  createdAt: new Date('2026-06-29T00:00:00.000Z'),
  updatedAt: new Date('2026-06-29T00:00:00.000Z'),
  owner: { channels: [channel] },
  items: [{ id: 'item-1', playlistId: 'playlist-1', videoId: video.id, position: 0, createdAt: new Date('2026-06-29T00:00:00.000Z'), video }],
};

describe('Search API', () => {
  let app: INestApplication;
  const prisma = {
    video: {
      findMany: jest.fn().mockResolvedValue([video]),
      count: jest.fn().mockResolvedValue(1),
    },
    channel: {
      findMany: jest.fn().mockResolvedValue([channel]),
      count: jest.fn().mockResolvedValue(1),
    },
    playlist: {
      findMany: jest.fn().mockResolvedValue([playlist]),
      count: jest.fn().mockResolvedValue(1),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.video.findMany.mockResolvedValue([video]);
    prisma.video.count.mockResolvedValue(1);
    prisma.channel.findMany.mockResolvedValue([channel]);
    prisma.channel.count.mockResolvedValue(1);
    prisma.playlist.findMany.mockResolvedValue([playlist]);
    prisma.playlist.count.mockResolvedValue(1);
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

  it('searches videos by tag chip match and returns pagination metadata', async () => {
    const response = await request(app.getHttpServer()).get('/api/search?q=front&type=videos&page=2&limit=10').expect(200);

    expect(response.body.videos).toHaveLength(1);
    expect(response.body.pageInfo.videos).toEqual({ page: 2, limit: 10, total: 1, hasNextPage: false, hasPreviousPage: true });
    expect(prisma.video.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { tags: { hasSome: ['front'] } },
          ]),
        }),
      }),
    );
  });

  it('searches playlists by description and owner channel name', async () => {
    await request(app.getHttpServer()).get('/api/search?q=frontend&type=playlists').expect(200);

    expect(prisma.playlist.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: 'CUSTOM',
          isPublic: true,
          OR: expect.arrayContaining([
            { description: { contains: 'frontend', mode: 'insensitive' } },
            { owner: { channels: { some: { name: { contains: 'frontend', mode: 'insensitive' } } } } },
          ]),
        }),
      }),
    );
  });
});
