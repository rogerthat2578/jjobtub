import { Injectable, NotFoundException } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { toVideoDetail, toVideoListItem } from './video-response';

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

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
}
