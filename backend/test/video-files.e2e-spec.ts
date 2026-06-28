import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { execFileSync } from 'child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Video file upload and streaming API', () => {
  let app: INestApplication;
  let storageRoot: string;
  let sampleMp4: Buffer;

  const prisma = {
    video: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'video-1',
        source: 'LOCAL',
        channel: { id: 'channel-1', ownerId: 'user-1' },
      }),
      update: jest.fn().mockResolvedValue({ id: 'video-1', status: 'READY' }),
    },
    session: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        token: 'session-token',
        expiresAt: new Date('2099-01-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-26T00:00:00.000Z'),
        user: {
          id: 'user-1',
          email: 'creator@jjobtub.local',
          displayName: 'Creator',
          avatarUrl: null,
        },
      }),
    },
    videoFile: {
      findMany: jest.fn().mockResolvedValue([]),
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
    sampleMp4 = createTinyMp4(storageRoot);

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
      .set('Cookie', 'jjobtub_session=session-token')
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

  it('extracts a thumbnail from an uploaded MP4 file', async () => {
    await request(app.getHttpServer())
      .post('/api/videos/video-1/upload')
      .set('Cookie', 'jjobtub_session=session-token')
      .attach('file', sampleMp4, {
        filename: 'sample.mp4',
        contentType: 'video/mp4',
      })
      .expect(201);

    expect(prisma.videoFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        videoId: 'video-1',
        kind: 'THUMBNAIL',
        mimeType: 'image/jpeg',
        storagePath: 'videos/video-1/thumbnail.jpg',
      }),
    });
    expect(existsSync(join(storageRoot, 'videos', 'video-1', 'thumbnail.jpg'))).toBe(true);
  });

  it('creates a preview clip from an uploaded MP4 file', async () => {
    await request(app.getHttpServer())
      .post('/api/videos/video-1/upload')
      .set('Cookie', 'jjobtub_session=session-token')
      .attach('file', sampleMp4, {
        filename: 'sample.mp4',
        contentType: 'video/mp4',
      })
      .expect(201);

    expect(prisma.videoFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        videoId: 'video-1',
        kind: 'PREVIEW',
        mimeType: 'video/mp4',
        storagePath: 'videos/video-1/preview.mp4',
      }),
    });
    expect(existsSync(join(storageRoot, 'videos', 'video-1', 'preview.mp4'))).toBe(true);
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

  it('streams a requested quality variant when it exists', async () => {
    prisma.videoFile.findFirst.mockResolvedValueOnce({
      id: 'file-720',
      videoId: 'video-1',
      kind: 'HLS_VARIANT',
      storagePath: 'videos/video-1/quality-720p.mp4',
      mimeType: 'video/mp4',
      sizeBytes: BigInt(6),
      height: 720,
    });
    await mkdir(join(storageRoot, 'videos', 'video-1'), { recursive: true });
    await writeFile(join(storageRoot, 'videos', 'video-1', 'quality-720p.mp4'), Buffer.from('ghijkl'));

    const response = await request(app.getHttpServer())
      .get('/api/videos/video-1/stream?quality=720')
      .set('Range', 'bytes=1-3')
      .expect(206);

    expect(response.headers['content-range']).toBe('bytes 1-3/6');
    expect(response.body.toString()).toBe('hij');
    expect(prisma.videoFile.findFirst).toHaveBeenCalledWith({
      where: { videoId: 'video-1', kind: 'HLS_VARIANT', height: 720 },
    });
  });

  it('streams a byte range from the preview MP4 file', async () => {
    prisma.videoFile.findFirst.mockResolvedValueOnce({
      id: 'file-preview',
      videoId: 'video-1',
      kind: 'PREVIEW',
      storagePath: 'videos/video-1/preview.mp4',
      mimeType: 'video/mp4',
      sizeBytes: BigInt(6),
    });
    await mkdir(join(storageRoot, 'videos', 'video-1'), { recursive: true });
    await writeFile(join(storageRoot, 'videos', 'video-1', 'preview.mp4'), Buffer.from('abcdef'));

    const response = await request(app.getHttpServer())
      .get('/api/videos/video-1/preview')
      .set('Range', 'bytes=1-3')
      .expect(206);

    expect(response.headers['accept-ranges']).toBe('bytes');
    expect(response.headers['content-range']).toBe('bytes 1-3/6');
    expect(response.headers['content-length']).toBe('3');
    expect(response.headers['content-type']).toContain('video/mp4');
    expect(response.body.toString()).toBe('bcd');
  });
});

function createTinyMp4(storageRoot: string) {
  const ffmpegPath = process.env.FFMPEG_PATH || 'C:\\dev\\tools\\ffmpeg\\ffmpeg.exe';
  const outputPath = join(storageRoot, 'tiny.mp4');
  execFileSync(
    ffmpegPath,
    ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=160x90:d=0.2', '-pix_fmt', 'yuv420p', outputPath],
    { stdio: 'ignore' },
  );

  return require('fs').readFileSync(outputPath) as Buffer;
}
