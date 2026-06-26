import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { ReadStream } from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StreamingService } from '../storage/streaming.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { toVideoDetail, toVideoListItem } from './video-response';

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly streaming: StreamingService,
  ) {}

  async listVideos(query: { q?: string; category?: string; channelId?: string; limit?: number }) {
    const limit = Number.isFinite(query.limit) ? Math.min(Math.max(query.limit ?? 24, 1), 50) : 24;
    const videos = await this.prisma.video.findMany({
      where: {
        status: VideoStatus.READY,
        visibility: 'PUBLIC',
        category: query.category,
        channelId: query.channelId,
        title: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
      },
      include: { channel: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return {
      items: videos.map(toVideoListItem),
      nextCursor: null,
    };
  }

  async getVideo(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: { channel: true },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return toVideoDetail(video);
  }

  async createVideo(dto: CreateVideoDto) {
    const channel = await this.prisma.channel.findUnique({ where: { id: dto.channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const video = await this.prisma.video.create({
      data: {
        channelId: dto.channelId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        visibility: dto.visibility,
        status: 'DRAFT',
      },
    });

    return {
      id: video.id,
      status: video.status,
    };
  }

  async uploadOriginal(id: string, file: { buffer?: Buffer; mimetype?: string; originalname?: string; size?: number }) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    if (!file?.buffer) {
      throw new BadRequestException('MP4 file is required');
    }
    if (file.mimetype !== 'video/mp4' || !file.originalname?.toLowerCase().endsWith('.mp4')) {
      throw new BadRequestException('Only MP4 files are supported');
    }

    const savedFile = await this.storage.saveOriginalVideo(id, file.buffer);
    await this.prisma.videoFile.deleteMany({
      where: { videoId: id, kind: 'ORIGINAL' },
    });
    await this.prisma.videoFile.create({
      data: {
        videoId: id,
        kind: 'ORIGINAL',
        storagePath: savedFile.storagePath,
        mimeType: 'video/mp4',
        sizeBytes: savedFile.sizeBytes,
      },
    });
    await this.prisma.video.update({
      where: { id },
      data: { status: 'READY' },
    });

    return {
      videoId: id,
      status: 'READY',
      file: {
        kind: 'ORIGINAL',
        mimeType: 'video/mp4',
        sizeBytes: savedFile.sizeBytes,
      },
    };
  }

  async streamOriginal(id: string, rangeHeader: string | undefined): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    stream: ReadStream;
  }> {
    const file = await this.prisma.videoFile.findFirst({
      where: { videoId: id, kind: 'ORIGINAL' },
    });
    if (!file) {
      throw new NotFoundException('Original video file not found');
    }

    const { stat } = await this.storage.statFile(file.storagePath);
    const range = this.streaming.parseRange(rangeHeader, stat.size);

    return {
      statusCode: range.statusCode,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
        'Content-Length': String(range.contentLength),
        'Content-Type': file.mimeType,
      },
      stream: this.storage.createReadStream(file.storagePath, { start: range.start, end: range.end }),
    };
  }
}
