import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const user = {
  id: 'user-1',
  email: 'creator@jjobtub.local',
  displayName: 'Test Creator',
  avatarUrl: null,
};

const channel = {
  id: 'channel-1',
  ownerId: user.id,
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

const likedPlaylist = {
  id: 'playlist-liked',
  ownerId: user.id,
  name: '좋아요 표시한 재생 목록',
  kind: 'LIKED',
  createdAt: new Date('2026-06-26T00:00:00.000Z'),
  updatedAt: new Date('2026-06-26T00:00:00.000Z'),
  items: [{ id: 'item-1', videoId: video.id, playlistId: 'playlist-liked', position: 0, createdAt: new Date('2026-06-26T00:00:00.000Z'), video }],
};

const customPlaylist = {
  id: 'playlist-custom',
  ownerId: user.id,
  name: '운동 영상',
  kind: 'CUSTOM',
  createdAt: new Date('2026-06-27T00:00:00.000Z'),
  updatedAt: new Date('2026-06-27T00:00:00.000Z'),
  items: [],
};

describe('Playlists API', () => {
  let app: INestApplication;
  const prisma = {
    playlist: {
      findMany: jest.fn().mockResolvedValue([likedPlaylist, customPlaylist]),
      findFirst: jest.fn().mockResolvedValue(likedPlaylist),
      findUnique: jest.fn().mockResolvedValue(customPlaylist),
      create: jest.fn().mockResolvedValue(customPlaylist),
    },
    playlistItem: {
      count: jest.fn().mockResolvedValue(1),
      findMany: jest.fn().mockResolvedValue([
        { id: 'item-1', playlistId: customPlaylist.id, videoId: 'video-1', position: 0 },
        { id: 'item-2', playlistId: customPlaylist.id, videoId: 'video-2', position: 1 },
      ]),
      upsert: jest.fn().mockResolvedValue({ id: 'item-2', playlistId: customPlaylist.id, videoId: video.id }),
      delete: jest.fn().mockResolvedValue({ id: 'item-2', playlistId: customPlaylist.id, videoId: video.id }),
      update: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn((operations) => Promise.all(operations)),
    video: {
      findUnique: jest.fn().mockResolvedValue(video),
    },
    session: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: user.id,
        token: 'session-token',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-26T00:00:00.000Z'),
        user,
      }),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.playlist.findMany.mockResolvedValue([likedPlaylist, customPlaylist]);
    prisma.playlist.findFirst.mockResolvedValue(likedPlaylist);
    prisma.playlist.findUnique.mockResolvedValue(customPlaylist);
    prisma.playlist.create.mockResolvedValue(customPlaylist);
    prisma.playlistItem.count.mockResolvedValue(1);
    prisma.playlistItem.findMany.mockResolvedValue([
      { id: 'item-1', playlistId: customPlaylist.id, videoId: 'video-1', position: 0 },
      { id: 'item-2', playlistId: customPlaylist.id, videoId: 'video-2', position: 1 },
    ]);
    prisma.playlistItem.upsert.mockResolvedValue({ id: 'item-2', playlistId: customPlaylist.id, videoId: video.id });
    prisma.playlistItem.delete.mockResolvedValue({ id: 'item-2', playlistId: customPlaylist.id, videoId: video.id });
    prisma.playlistItem.update.mockResolvedValue({});
    prisma.$transaction.mockImplementation((operations) => Promise.all(operations));
    prisma.video.findUnique.mockResolvedValue(video);
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: user.id,
      token: 'session-token',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-26T00:00:00.000Z'),
      user,
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

  it('lists the current user playlists for the save dialog', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/playlists')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toMatchObject({
      id: 'playlist-liked',
      name: '좋아요 표시한 재생 목록',
      kind: 'LIKED',
      videoCount: 1,
    });
  });

  it('creates a custom playlist from the save dialog', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/playlists')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({ name: '운동 영상' })
      .expect(201);

    expect(response.body).toMatchObject({ id: 'playlist-custom', name: '운동 영상', kind: 'CUSTOM' });
    expect(prisma.playlist.create).toHaveBeenCalledWith({
      data: { ownerId: user.id, name: '운동 영상', kind: 'CUSTOM' },
      include: { items: true },
    });
  });

  it('saves a video to a selected playlist', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/playlists/playlist-custom/items')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({ videoId: video.id })
      .expect(201);

    expect(response.body).toEqual({ saved: true });
    expect(prisma.playlistItem.upsert).toHaveBeenCalledWith({
      where: { playlistId_videoId: { playlistId: customPlaylist.id, videoId: video.id } },
      create: { playlistId: customPlaylist.id, videoId: video.id, position: 1 },
      update: {},
    });
  });

  it('removes a video from a selected playlist', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/playlists/playlist-custom/items/video-1')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body).toEqual({ saved: false });
    expect(prisma.playlistItem.delete).toHaveBeenCalledWith({
      where: { playlistId_videoId: { playlistId: customPlaylist.id, videoId: video.id } },
    });
  });

  it('reorders videos in a playlist by saving item positions', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/playlists/playlist-custom/items/reorder')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({ videoIds: ['video-2', 'video-1'] })
      .expect(200);

    expect(response.body).toEqual({ saved: true });
    expect(prisma.playlistItem.findMany).toHaveBeenCalledWith({
      where: { playlistId: customPlaylist.id },
      select: { videoId: true },
    });
    expect(prisma.playlistItem.update).toHaveBeenNthCalledWith(1, {
      where: { playlistId_videoId: { playlistId: customPlaylist.id, videoId: 'video-2' } },
      data: { position: 0 },
    });
    expect(prisma.playlistItem.update).toHaveBeenNthCalledWith(2, {
      where: { playlistId_videoId: { playlistId: customPlaylist.id, videoId: 'video-1' } },
      data: { position: 1 },
    });
  });
});
