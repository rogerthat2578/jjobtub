import { GoneException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import { mkdir, rm, stat, writeFile } from 'fs/promises';
import { dirname, join, normalize, resolve } from 'path';

@Injectable()
export class StorageService {
  private readonly root: string;

  constructor(config: ConfigService) {
    this.root = resolve(process.cwd(), config.get<string>('STORAGE_ROOT') ?? './storage');
  }

  originalVideoPath(videoId: string) {
    return `videos/${videoId}/original.mp4`;
  }

  thumbnailPath(videoId: string, extension: string) {
    return `videos/${videoId}/thumbnail.${extension}`;
  }

  async saveOriginalVideo(videoId: string, buffer: Buffer) {
    const storagePath = this.originalVideoPath(videoId);
    const absolutePath = this.resolveStoragePath(storagePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storagePath,
      absolutePath,
      sizeBytes: buffer.length,
    };
  }

  async saveThumbnail(videoId: string, buffer: Buffer, extension: string) {
    const storagePath = this.thumbnailPath(videoId, extension);
    const absolutePath = this.resolveStoragePath(storagePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storagePath,
      absolutePath,
      sizeBytes: buffer.length,
    };
  }

  async statFile(storagePath: string) {
    const absolutePath = this.resolveStoragePath(storagePath);

    try {
      return {
        absolutePath,
        stat: await stat(absolutePath),
      };
    } catch {
      throw new GoneException('Stored video file is missing');
    }
  }

  createReadStream(storagePath: string, range: { start: number; end: number }) {
    return createReadStream(this.resolveStoragePath(storagePath), range);
  }

  createFileReadStream(storagePath: string) {
    return createReadStream(this.resolveStoragePath(storagePath));
  }

  async deleteFile(storagePath: string) {
    await rm(this.resolveStoragePath(storagePath), { force: true });
  }

  private resolveStoragePath(storagePath: string) {
    const absolutePath = resolve(this.root, normalize(storagePath));
    if (!absolutePath.startsWith(this.root)) {
      throw new GoneException('Stored video path is invalid');
    }
    return absolutePath;
  }
}
