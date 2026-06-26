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
  passwordHash:
    'scrypt:test-salt:39b6436a81d9f2258eef8c7f0a2e04327027806dc2cbdbae6be3ae72b6207a1961c9b8048985535cbea36326279cbbfc7ad042fe2e036d51c13230dac2d0eb13',
  createdAt: new Date('2026-06-26T00:00:00.000Z'),
  updatedAt: new Date('2026-06-26T00:00:00.000Z'),
};

describe('Auth API', () => {
  let app: INestApplication;
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
    },
    session: {
      create: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: user.id,
        token: 'session-token',
        expiresAt: new Date('2026-06-27T00:00:00.000Z'),
        createdAt: new Date('2026-06-26T00:00:00.000Z'),
      }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: user.id,
        token: 'session-token',
        expiresAt: new Date('2026-06-27T00:00:00.000Z'),
        createdAt: new Date('2026-06-26T00:00:00.000Z'),
        user,
      }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
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

  it('logs in and sets a session cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: user.email, password: 'password123' })
      .expect(201);

    expect(response.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
    expect(response.headers['set-cookie']?.[0]).toContain('jjobtub_session=session-token');
    expect(prisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: user.id,
        }),
      }),
    );
  });

  it('returns the current user from the session cookie', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    });
  });

  it('logs out by clearing the session cookie', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', 'jjobtub_session=session-token')
      .expect(200);

    expect(response.body).toEqual({ ok: true });
    expect(response.headers['set-cookie']?.[0]).toContain('jjobtub_session=;');
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({ where: { token: 'session-token' } });
  });
});
