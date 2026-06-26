import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { toVideoListItem } from '../videos/video-response';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

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

  async toggleSubscription(id: string, request: Request) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }

    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.ownerId === user.id) {
      throw new BadRequestException('Cannot subscribe to your own channel');
    }

    const key = { channelId_userId: { channelId: id, userId: user.id } };
    const existingSubscription = await this.prisma.channelSubscription.findUnique({ where: key });
    if (existingSubscription) {
      await this.prisma.channelSubscription.delete({ where: key });
      const updatedChannel = await this.prisma.channel.update({
        where: { id },
        data: { subscriberCount: { decrement: 1 } },
        select: { subscriberCount: true },
      });

      return { subscribed: false, subscribers: updatedChannel.subscriberCount };
    }

    await this.prisma.channelSubscription.create({
      data: { channelId: id, userId: user.id },
    });
    const updatedChannel = await this.prisma.channel.update({
      where: { id },
      data: { subscriberCount: { increment: 1 } },
      select: { subscriberCount: true },
    });

    return { subscribed: true, subscribers: updatedChannel.subscriberCount };
  }
}
