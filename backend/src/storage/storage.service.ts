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

  previewPath(videoId: string) {
    return `videos/${videoId}/preview.mp4`;
  }

  qualityVariantPath(videoId: string, height: number) {
    return `videos/${videoId}/quality-${height}p.mp4`;
  }

  subtitlePath(videoId: string, language: string) {
    return `videos/${videoId}/subtitles/${language}.vtt`;
  }

  channelAssetPath(channelId: string, kind: 'avatar' | 'banner', extension: string) {
    return `channels/${channelId}/${kind}.${extension}`;
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

  async savePreview(videoId: string, buffer: Buffer) {
    const storagePath = this.previewPath(videoId);
    const absolutePath = this.resolveStoragePath(storagePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storagePath,
      absolutePath,
      sizeBytes: buffer.length,
    };
  }

  async saveQualityVariant(videoId: string, height: number, buffer: Buffer) {
    const storagePath = this.qualityVariantPath(videoId, height);
    const absolutePath = this.resolveStoragePath(storagePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storagePath,
      absolutePath,
      sizeBytes: buffer.length,
    };
  }

  async saveSubtitle(videoId: string, language: string, buffer: Buffer) {
    const storagePath = this.subtitlePath(videoId, language);
    const absolutePath = this.resolveStoragePath(storagePath);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);

    return {
      storagePath,
      absolutePath,
      sizeBytes: buffer.length,
    };
  }

  async saveChannelAsset(channelId: string, kind: 'avatar' | 'banner', extension: string, buffer: Buffer) {
    const storagePath = this.channelAssetPath(channelId, kind, extension);
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
