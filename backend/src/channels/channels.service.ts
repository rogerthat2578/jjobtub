import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toVideoListItem } from '../videos/video-response';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async getChannel(id: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      avatarUrl: channel.avatarUrl,
      bannerUrl: channel.bannerUrl,
      subscriberCount: channel.subscriberCount,
      createdAt: channel.createdAt.toISOString(),
    };
  }

  async getChannelVideos(id: string) {
    await this.getChannel(id);
    const videos = await this.prisma.video.findMany({
      where: { channelId: id, status: 'READY', visibility: 'PUBLIC' },
      include: { channel: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items: videos.map(toVideoListItem),
      nextCursor: null,
    };
  }
}
