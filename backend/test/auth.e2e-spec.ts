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
  let prisma: any;

  beforeAll(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        create: jest.fn().mockResolvedValue({
          ...user,
          id: 'new-user-1',
          email: 'new@jjobtub.local',
          displayName: 'New Creator',
        }),
      },
      channel: {
        create: jest.fn().mockResolvedValue({
          id: 'new-channel-1',
          ownerId: 'new-user-1',
          name: 'New Creator',
          description: '',
        }),
      },
      session: {
        create: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: user.id,
          token: 'session-token',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-06-26T00:00:00.000Z'),
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          userId: user.id,
          token: 'session-token',
          expiresAt: new Date('2099-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-06-26T00:00:00.000Z'),
          user,
        }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction = jest.fn(async (callback: any) => callback(prisma));

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

  it('registers a user, creates a default channel, and sets a session cookie', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    prisma.session.create.mockResolvedValueOnce({
      id: 'session-2',
      userId: 'new-user-1',
      token: 'new-session-token',
      expiresAt: new Date('2099-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-06-26T00:00:00.000Z'),
    });

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: 'new@jjobtub.local',
        password: 'new-password123',
        displayName: 'New Creator',
      })
      .expect(201);

    expect(response.body.user).toMatchObject({
      id: 'new-user-1',
      email: 'new@jjobtub.local',
      displayName: 'New Creator',
      channelId: 'new-channel-1',
    });
    expect(response.headers['set-cookie']?.[0]).toContain('jjobtub_session=new-session-token');
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new@jjobtub.local',
        displayName: 'New Creator',
        passwordHash: expect.stringMatching(/^scrypt:/),
      }),
    });
    expect(prisma.channel.create).toHaveBeenCalledWith({
      data: {
        ownerId: 'new-user-1',
        name: 'New Creator',
        description: '',
      },
    });
  });

  it('rejects registration when email already exists', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: user.email,
        password: 'password123',
        displayName: 'Duplicate Creator',
      })
      .expect(409);
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
