import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { toVideoListItem } from '../videos/video-response';
import { UpdateChannelDto } from './dto/update-channel.dto';

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
    const videoCount = await this.prisma.video.count({ where: { channelId: id, status: 'READY', visibility: 'PUBLIC' } });

    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      avatarUrl: channel.avatarUrl,
      bannerUrl: channel.bannerUrl,
      subscriberCount: channel.subscriberCount,
      videoCount,
      createdAt: channel.createdAt.toISOString(),
    };
  }

  async getChannelVideos(id: string, request?: Request) {
    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    const user = request ? await this.authService.getCurrentUser(request) : null;
    const isOwner = Boolean(user && channel.ownerId === user.id);
    const videos = await this.prisma.video.findMany({
      where: isOwner ? { channelId: id } : { channelId: id, status: 'READY', visibility: 'PUBLIC' },
      include: { channel: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items: videos.map(toVideoListItem),
      nextCursor: null,
    };
  }

  async updateChannel(id: string, dto: UpdateChannelDto, request: Request) {
    const channel = await this.assertChannelOwner(id, request);
    const data: { name?: string; description?: string; avatarUrl?: string | null; bannerUrl?: string | null } = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl.trim() || null;
    if (dto.bannerUrl !== undefined) data.bannerUrl = dto.bannerUrl.trim() || null;

    const updatedChannel = await this.prisma.channel.update({
      where: { id: channel.id },
      data,
    });

    return {
      id: updatedChannel.id,
      name: updatedChannel.name,
      description: updatedChannel.description,
      avatarUrl: updatedChannel.avatarUrl,
      bannerUrl: updatedChannel.bannerUrl,
      subscriberCount: updatedChannel.subscriberCount,
      createdAt: updatedChannel.createdAt.toISOString(),
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

  private async assertChannelOwner(id: string, request: Request) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }

    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.ownerId !== user.id) {
      throw new ForbiddenException('Only the channel owner can manage this channel');
    }

    return channel;
  }
}
