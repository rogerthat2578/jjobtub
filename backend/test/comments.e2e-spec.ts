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
  body: 'Existing comment',
  likeCount: 0,
  createdAt: new Date('2026-06-26T02:00:00.000Z'),
  updatedAt: new Date('2026-06-26T02:00:00.000Z'),
  author,
};

describe('Comments API', () => {
  let app: INestApplication;
  const prisma = {
    video: {
      findUnique: jest.fn().mockResolvedValue({ id: 'video-1' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(author),
    },
    comment: {
      findMany: jest.fn().mockResolvedValue([comment]),
      create: jest.fn().mockResolvedValue({
        ...comment,
        id: 'comment-2',
        body: 'New comment',
      }),
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
        body: 'New comment',
      },
      include: { author: true },
    });
  });
});
