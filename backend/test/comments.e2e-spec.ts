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
      update: jest.fn().mockImplementation((args) =>
        Promise.resolve({
          ...comment,
          body: args.data.body ?? comment.body,
          likeCount:
            args.data.likeCount?.increment !== undefined
              ? comment.likeCount + args.data.likeCount.increment
              : args.data.likeCount?.decrement !== undefined
                ? comment.likeCount - args.data.likeCount.decrement
                : comment.likeCount,
          replies: [],
        }),
      ),
      delete: jest.fn().mockResolvedValue(comment),
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
    commentLike: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'comment-like-1', commentId: comment.id, userId: author.id }),
      delete: jest.fn().mockResolvedValue({ id: 'comment-like-1', commentId: comment.id, userId: author.id }),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.video.findUnique.mockResolvedValue({ id: 'video-1' });
    prisma.user.findUnique.mockResolvedValue(author);
    prisma.user.findFirst.mockResolvedValue(author);
    prisma.session.findUnique.mockResolvedValue({
      id: 'session-1',
      userId: author.id,
      token: 'session-token',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-26T02:00:00.000Z'),
      user: author,
    });
    prisma.comment.findMany.mockResolvedValue([comment]);
    prisma.comment.findUnique.mockResolvedValue(comment);
    prisma.commentLike.findMany.mockResolvedValue([]);
    prisma.commentLike.findUnique.mockResolvedValue(null);
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
    expect(prisma.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { token: 'session-token' },
        include: expect.objectContaining({ user: expect.anything() }),
      }),
    );
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

  it('marks comments liked by the current user', async () => {
    prisma.commentLike.findMany.mockResolvedValue([{ commentId: 'comment-reply-1' }]);

    const response = await request(app.getHttpServer())
      .get('/api/videos/video-1/comments')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body.items[0].likedByMe).toBe(false);
    expect(response.body.items[0].replies[0].likedByMe).toBe(true);
    expect(prisma.commentLike.findMany).toHaveBeenCalledWith({
      where: { userId: author.id, commentId: { in: ['comment-1', 'comment-reply-1'] } },
      select: { commentId: true },
    });
  });

  it('updates a comment written by the logged-in author', async () => {
    const response = await request(app.getHttpServer())
      .patch('/api/comments/comment-1')
      .set('Cookie', 'jjobtub_session=session-token')
      .send({ body: 'Updated comment' })
      .expect(200);

    expect(response.body).toMatchObject({
      id: 'comment-1',
      body: 'Updated comment',
      author: { id: author.id, displayName: 'Comment Author' },
    });
    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: 'comment-1' },
      data: { body: 'Updated comment' },
      include: expect.any(Object),
    });
  });

  it('deletes a comment written by the logged-in author', async () => {
    const response = await request(app.getHttpServer())
      .delete('/api/comments/comment-1')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body).toEqual({ ok: true });
    expect(prisma.comment.delete).toHaveBeenCalledWith({ where: { id: 'comment-1' } });
  });

  it('toggles a comment like on', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/comments/comment-1/like')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(201);

    expect(response.body).toEqual({ liked: true, likes: 1 });
    expect(prisma.commentLike.create).toHaveBeenCalledWith({
      data: { commentId: 'comment-1', userId: author.id },
    });
  });

  it('toggles a comment like off', async () => {
    prisma.commentLike.findUnique.mockResolvedValue({ id: 'comment-like-1', commentId: comment.id, userId: author.id });
    prisma.comment.update.mockResolvedValueOnce({ ...comment, likeCount: 0, replies: [] });

    const response = await request(app.getHttpServer())
      .post('/api/comments/comment-1/like')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(201);

    expect(response.body).toEqual({ liked: false, likes: 0 });
    expect(prisma.commentLike.delete).toHaveBeenCalledWith({
      where: { commentId_userId: { commentId: 'comment-1', userId: author.id } },
    });
  });
});
