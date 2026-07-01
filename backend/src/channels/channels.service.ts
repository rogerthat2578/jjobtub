import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { toPlaylistResponse } from '../playlists/playlists.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { toVideoListItem } from '../videos/video-response';
import { UpdateChannelHomeDto } from './dto/update-channel-home.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';

const DEFAULT_HOME_SECTION_ORDER = ['featured', 'videos', 'playlists'];

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly notifications: NotificationsService,
    private readonly storage: StorageService,
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
      bannerMobilePosition: normalizeBannerMobilePosition(channel.bannerMobilePosition),
      featuredVideoId: channel.featuredVideoId,
      featuredPlaylistId: channel.featuredPlaylistId,
      homeSectionOrder: channel.homeSectionOrder,
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

  async getChannelPlaylists(id: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const playlists = await this.prisma.playlist.findMany({
      where: { ownerId: channel.ownerId, kind: 'CUSTOM' },
      include: {
        items: {
          where: { video: { status: 'READY', visibility: 'PUBLIC' } },
          include: { video: { include: { channel: true } } },
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
          take: 6,
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 24,
    });

    return { items: playlists.map(toPlaylistResponse) };
  }

  async updateChannel(id: string, dto: UpdateChannelDto, request: Request) {
    const channel = await this.assertChannelOwner(id, request);
    const data: { name?: string; description?: string; avatarUrl?: string | null; bannerUrl?: string | null; bannerMobilePosition?: string } = {};

    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl.trim() || null;
    if (dto.bannerUrl !== undefined) data.bannerUrl = dto.bannerUrl.trim() || null;
    if (dto.bannerMobilePosition !== undefined) data.bannerMobilePosition = normalizeBannerMobilePosition(dto.bannerMobilePosition);

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
      bannerMobilePosition: normalizeBannerMobilePosition(updatedChannel.bannerMobilePosition),
      featuredVideoId: updatedChannel.featuredVideoId,
      featuredPlaylistId: updatedChannel.featuredPlaylistId,
      homeSectionOrder: updatedChannel.homeSectionOrder,
      subscriberCount: updatedChannel.subscriberCount,
      createdAt: updatedChannel.createdAt.toISOString(),
    };
  }

  async updateChannelHome(id: string, dto: UpdateChannelHomeDto, request: Request) {
    const channel = await this.assertChannelOwner(id, request);
    const data: {
      featuredVideoId?: string | null;
      featuredPlaylistId?: string | null;
      homeSectionOrder?: string[];
    } = {};

    if (dto.featuredVideoId !== undefined) {
      data.featuredVideoId = dto.featuredVideoId ? await this.assertVideoBelongsToChannel(dto.featuredVideoId, channel.id) : null;
    }
    if (dto.featuredPlaylistId !== undefined) {
      data.featuredPlaylistId = dto.featuredPlaylistId ? await this.assertPlaylistBelongsToChannelOwner(dto.featuredPlaylistId, channel.ownerId) : null;
    }
    if (dto.homeSectionOrder !== undefined) {
      data.homeSectionOrder = normalizeHomeSectionOrder(dto.homeSectionOrder);
    }

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
      bannerMobilePosition: normalizeBannerMobilePosition(updatedChannel.bannerMobilePosition),
      featuredVideoId: updatedChannel.featuredVideoId,
      featuredPlaylistId: updatedChannel.featuredPlaylistId,
      homeSectionOrder: updatedChannel.homeSectionOrder,
      subscriberCount: updatedChannel.subscriberCount,
      createdAt: updatedChannel.createdAt.toISOString(),
    };
  }

  async uploadChannelAsset(id: string, kind: 'avatar' | 'banner', file: any, request: Request) {
    const channel = await this.assertChannelOwner(id, request);
    const normalizedKind = normalizeChannelAssetKind(kind);
    if (!file?.buffer) {
      throw new BadRequestException('Image file is required');
    }
    const extension = imageExtension(file.mimetype);
    if (!extension) {
      throw new BadRequestException('Only PNG, JPEG, and WebP images are supported');
    }

    await Promise.all(['webp', 'png', 'jpg'].map((candidate) => this.storage.deleteFile(this.storage.channelAssetPath(channel.id, normalizedKind, candidate))));
    const saved = await this.storage.saveChannelAsset(channel.id, normalizedKind, extension, file.buffer);
    const assetUrl = `/api/channels/${channel.id}/assets/${normalizedKind}?v=${Date.now()}`;
    const updatedChannel = await this.prisma.channel.update({
      where: { id: channel.id },
      data: normalizedKind === 'avatar' ? { avatarUrl: assetUrl } : { bannerUrl: assetUrl },
    });

    return {
      id: updatedChannel.id,
      name: updatedChannel.name,
      description: updatedChannel.description,
      avatarUrl: updatedChannel.avatarUrl,
      bannerUrl: updatedChannel.bannerUrl,
      bannerMobilePosition: normalizeBannerMobilePosition(updatedChannel.bannerMobilePosition),
      featuredVideoId: updatedChannel.featuredVideoId,
      featuredPlaylistId: updatedChannel.featuredPlaylistId,
      homeSectionOrder: updatedChannel.homeSectionOrder,
      subscriberCount: updatedChannel.subscriberCount,
      createdAt: updatedChannel.createdAt.toISOString(),
      sizeBytes: saved.sizeBytes,
    };
  }

  async getChannelAsset(id: string, kind: 'avatar' | 'banner') {
    const normalizedKind = normalizeChannelAssetKind(kind);
    const candidates = ['webp', 'png', 'jpg'];
    for (const extension of candidates) {
      const storagePath = this.storage.channelAssetPath(id, normalizedKind, extension);
      try {
        await this.storage.statFile(storagePath);
        return {
          stream: this.storage.createFileReadStream(storagePath),
          mimeType: mimeTypeFromExtension(extension),
        };
      } catch {
        continue;
      }
    }
    throw new NotFoundException('Channel asset not found');
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
    await this.notifications.createNotification({
      userId: channel.ownerId,
      actorId: user.id,
      type: 'SUBSCRIPTION',
      message: `${user.displayName}님이 내 채널을 구독했습니다.`,
      linkUrl: `/channel/${id}`,
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

  private async assertVideoBelongsToChannel(videoId: string, channelId: string) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video || video.channelId !== channelId) {
      throw new BadRequestException('Featured video must belong to this channel');
    }
    return video.id;
  }

  private async assertPlaylistBelongsToChannelOwner(playlistId: string, ownerId: string) {
    const playlist = await this.prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist || playlist.ownerId !== ownerId) {
      throw new BadRequestException('Featured playlist must belong to this channel owner');
    }
    return playlist.id;
  }
}

function normalizeChannelAssetKind(kind: string): 'avatar' | 'banner' {
  if (kind === 'avatar' || kind === 'banner') {
    return kind;
  }
  throw new BadRequestException('Unsupported channel asset kind');
}

function normalizeBannerMobilePosition(position?: string | null) {
  if (position === 'left' || position === 'right') {
    return position;
  }
  return 'center';
}

function imageExtension(mimeType?: string) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return '';
}

function mimeTypeFromExtension(extension: string) {
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg') return 'image/jpeg';
  return 'image/webp';
}

function normalizeHomeSectionOrder(order?: string[]) {
  const uniqueSections = Array.from(new Set(order ?? []));
  const allowedSections = uniqueSections.filter((section) => DEFAULT_HOME_SECTION_ORDER.includes(section));
  const missingSections = DEFAULT_HOME_SECTION_ORDER.filter((section) => !allowedSections.includes(section));
  return [...allowedSections, ...missingSections];
}
