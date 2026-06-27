import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Video file upload and streaming API', () => {
  let app: INestApplication;
  let storageRoot: string;

  const prisma = {
    video: {
      findUnique: jest.fn().mockResolvedValue({ id: 'video-1', source: 'LOCAL' }),
      update: jest.fn().mockResolvedValue({ id: 'video-1', status: 'READY' }),
    },
    videoFile: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({
        id: 'file-1',
        videoId: 'video-1',
        kind: 'ORIGINAL',
        storagePath: 'videos/video-1/original.mp4',
        mimeType: 'video/mp4',
        sizeBytes: BigInt(6),
      }),
      findFirst: jest.fn().mockResolvedValue({
        id: 'file-1',
        videoId: 'video-1',
        kind: 'ORIGINAL',
        storagePath: 'videos/video-1/original.mp4',
        mimeType: 'video/mp4',
        sizeBytes: BigInt(6),
      }),
    },
  };

  beforeAll(async () => {
    storageRoot = await mkdtemp(join(tmpdir(), 'jjobtub-storage-'));

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideProvider(ConfigService)
      .useValue({
        get: (key: string) => {
          if (key === 'STORAGE_ROOT') {
            return storageRoot;
          }
          if (key === 'MAX_UPLOAD_BYTES') {
            return 1024 * 1024;
          }
          return undefined;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await rm(storageRoot, { recursive: true, force: true });
  });

  it('uploads an original MP4 file and marks the video ready', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos/video-1/upload')
      .attach('file', Buffer.from('abcdef'), {
        filename: 'sample.mp4',
        contentType: 'video/mp4',
      })
      .expect(201);

    expect(response.body).toEqual({
      videoId: 'video-1',
      status: 'READY',
      file: {
        kind: 'ORIGINAL',
        mimeType: 'video/mp4',
        sizeBytes: 6,
      },
    });

    await expect(readFile(join(storageRoot, 'videos', 'video-1', 'original.mp4'), 'utf8')).resolves.toBe('abcdef');
    expect(prisma.videoFile.deleteMany).toHaveBeenCalledWith({
      where: { videoId: 'video-1', kind: 'ORIGINAL' },
    });
    expect(prisma.video.update).toHaveBeenCalledWith({
      where: { id: 'video-1' },
      data: { status: 'READY' },
    });
  });

  it('streams a byte range from the original MP4 file', async () => {
    await mkdir(join(storageRoot, 'videos', 'video-1'), { recursive: true });
    await writeFile(join(storageRoot, 'videos', 'video-1', 'original.mp4'), Buffer.from('abcdef'));

    const response = await request(app.getHttpServer())
      .get('/api/videos/video-1/stream')
      .set('Range', 'bytes=1-3')
      .expect(206);

    expect(response.headers['accept-ranges']).toBe('bytes');
    expect(response.headers['content-range']).toBe('bytes 1-3/6');
    expect(response.headers['content-length']).toBe('3');
    expect(response.headers['content-type']).toContain('video/mp4');
    expect(response.body.toString()).toBe('bcd');
  });
});
