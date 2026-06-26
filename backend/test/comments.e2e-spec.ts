import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const author = {
  id: 'user-1',
  email: 'comment-test@jjobtub.local',
  displayName: 'Comment Author',
  avatarUrl: null,
  createdAt: new Date('2026-06-26T02:00:00.000Z'),
  updatedAt: new Date('2026-06-26T02:00:00.000Z'),
};

const comment = {
  id: 'comment-1',
  videoId: 'video-1',
  authorId: author.id,
  parentId: null,
  body: 'Existing comment',
  likeCount: 0,
  createdAt: new Date('2026-06-26T02:00:00.000Z'),
  updatedAt: new Date('2026-06-26T02:00:00.000Z'),
  author,
  replies: [
    {
      id: 'comment-reply-1',
      videoId: 'video-1',
      authorId: author.id,
      parentId: 'comment-1',
      body: 'Existing reply',
      likeCount: 0,
      createdAt: new Date('2026-06-26T02:01:00.000Z'),
      updatedAt: new Date('2026-06-26T02:01:00.000Z'),
      author,
    },
  ],
};

describe('Comments API', () => {
  let app: INestApplication;
  const prisma = {
    video: {
      findUnique: jest.fn().mockResolvedValue({ id: 'video-1' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(author),
      findFirst: jest.fn().mockResolvedValue(author),
    },
    session: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: author.id,
        token: 'session-token',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-26T02:00:00.000Z'),
        user: author,
      }),
    },
    comment: {
      findMany: jest.fn().mockResolvedValue([comment]),
      findUnique: jest.fn().mockResolvedValue(comment),
      create: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          ...comment,
          id: 'comment-2',
          body: args.data.body,
          parentId: args.data.parentId ?? null,
          replies: [],
        }),
      ),
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

  it('lists comments for a video', async () => {
    const response = await request(app.getHttpServer()).get('/api/videos/video-1/comments').expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      id: 'comment-1',
      body: 'Existing comment',
      author: { id: author.id, displayName: 'Comment Author' },
      replies: [
        {
          id: 'comment-reply-1',
          body: 'Existing reply',
          parentId: 'comment-1',
          author: { id: author.id, displayName: 'Comment Author' },
        },
      ],
    });
  });

  it('creates a comment for a video', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos/video-1/comments')
      .send({ authorId: author.id, body: 'New comment' })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 'comment-2',
      body: 'New comment',
      author: { id: author.id, displayName: 'Comment Author' },
    });
    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: {
        videoId: 'video-1',
        authorId: author.id,
        parentId: undefined,
        body: 'New comment',
      },
      include: expect.any(Object),
    });
  });

  it('creates a comment with the logged-in author when authorId is omitted', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos/video-1/comments')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({ body: 'New comment' })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 'comment-2',
      body: 'New comment',
      author: { id: author.id, displayName: 'Comment Author' },
    });
    expect(prisma.session.findUnique).toHaveBeenCalledWith({
      where: { token: 'session-token' },
      include: { user: true },
    });
    expect(prisma.comment.create).toHaveBeenLastCalledWith({
      data: {
        videoId: 'video-1',
        authorId: author.id,
        parentId: undefined,
        body: 'New comment',
      },
      include: expect.any(Object),
    });
  });

  it('creates a reply for a parent comment', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos/video-1/comments')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({ body: 'New reply', parentId: 'comment-1' })
      .expect(201);

    expect(response.body).toMatchObject({
      id: 'comment-2',
      body: 'New reply',
      parentId: 'comment-1',
      author: { id: author.id, displayName: 'Comment Author' },
    });
    expect(prisma.comment.findUnique).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
    expect(prisma.comment.create).toHaveBeenLastCalledWith({
      data: {
        videoId: 'video-1',
        authorId: author.id,
        parentId: 'comment-1',
        body: 'New reply',
      },
      include: expect.any(Object),
    });
  });
});
