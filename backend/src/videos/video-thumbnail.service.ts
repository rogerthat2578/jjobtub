import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'child_process';
import { existsSync } from 'fs';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { StorageService } from '../storage/storage.service';

const execFileAsync = promisify(execFile);

@Injectable()
export class VideoThumbnailService {
  constructor(
    private readonly config: ConfigService,
    private readonly storage: StorageService,
  ) {}

  async extractFromVideo(videoId: string, inputPath: string) {
    const workDir = await mkdtemp(join(tmpdir(), 'jjobtub-thumb-'));
    const outputPath = join(workDir, 'thumbnail.jpg');

    try {
      await execFileAsync(this.resolveFfmpegPath(), [
        '-y',
        '-ss',
        '00:00:00.1',
        '-i',
        inputPath,
        '-frames:v',
        '1',
        '-q:v',
        '3',
        outputPath,
      ]);

      const buffer = await readFile(outputPath);
      const savedFile = await this.storage.saveThumbnail(videoId, buffer, 'jpg');

      return {
        storagePath: savedFile.storagePath,
        sizeBytes: savedFile.sizeBytes,
        mimeType: 'image/jpeg',
      };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  async createPreviewFromVideo(videoId: string, inputPath: string) {
    const workDir = await mkdtemp(join(tmpdir(), 'jjobtub-preview-'));
    const outputPath = join(workDir, 'preview.mp4');

    try {
      await execFileAsync(this.resolveFfmpegPath(), [
        '-y',
        '-i',
        inputPath,
        '-t',
        '5',
        '-vf',
        'scale=480:-2',
        '-an',
        '-movflags',
        'faststart',
        '-preset',
        'veryfast',
        outputPath,
      ]);

      const buffer = await readFile(outputPath);
      const savedFile = await this.storage.savePreview(videoId, buffer);

      return {
        storagePath: savedFile.storagePath,
        sizeBytes: savedFile.sizeBytes,
        mimeType: 'video/mp4',
      };
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }

  private resolveFfmpegPath() {
    const configuredPath = this.config.get<string>('FFMPEG_PATH');
    if (configuredPath) {
      return configuredPath;
    }

    const localToolPath = 'C:\\dev\\tools\\ffmpeg\\ffmpeg.exe';
    if (existsSync(localToolPath)) {
      return localToolPath;
    }

    return 'ffmpeg';
  }
}
