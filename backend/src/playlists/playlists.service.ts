import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Playlist, PlaylistItem, Video, Channel } from '@prisma/client';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { toVideoListItem } from '../videos/video-response';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';

const LIKED_PLAYLIST_NAME = '좋아요 표시한 재생 목록';

type PlaylistWithItems = Playlist & {
  items: Array<PlaylistItem & { video?: Video & { channel: Channel } }>;
};

type PlaylistOrder = 'manual' | 'recent' | 'oldest';

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly notifications: NotificationsService,
  ) {}

  async listPlaylists(request: Request) {
    const user = await this.requireCurrentUser(request);
    await this.ensureLikedPlaylist(user.id);
    const playlists = await this.prisma.playlist.findMany({
      where: { ownerId: user.id },
      include: {
        items: {
          include: { video: { include: { channel: true } } },
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        },
      },
      orderBy: [{ kind: 'desc' }, { updatedAt: 'desc' }],
    });

    return { items: playlists.map(toPlaylistResponse) };
  }

  async createPlaylist(name: string, request: Request) {
    const user = await this.requireCurrentUser(request);
    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('Playlist name is required');
    }

    const playlist = await this.prisma.playlist.create({
      data: { ownerId: user.id, name: trimmedName, kind: 'CUSTOM' },
      include: { items: true },
    });
    await this.notifications.createNotification({
      userId: user.id,
      type: 'PLAYLIST',
      message: `"${playlist.name}" 재생목록을 만들었습니다.`,
      linkUrl: `/library/${playlist.id}`,
    });

    return toPlaylistResponse(playlist);
  }

  async updatePlaylist(id: string, dto: UpdatePlaylistDto, request: Request) {
    const user = await this.requireCurrentUser(request);
    const playlist = await this.assertCustomPlaylistOwner(id, user.id);
    const data: { name?: string; description?: string; isPublic?: boolean } = {};

    if (dto.name !== undefined) {
      const trimmedName = dto.name.trim();
      if (!trimmedName) {
        throw new BadRequestException('Playlist name is required');
      }
      data.name = trimmedName;
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.isPublic !== undefined) {
      data.isPublic = dto.isPublic;
    }

    const updatedPlaylist = await this.prisma.playlist.update({
      where: { id: playlist.id },
      data,
      include: {
        items: {
          include: { video: { include: { channel: true } } },
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        },
      },
    });

    return toPlaylistResponse(updatedPlaylist);
  }

  async deletePlaylist(id: string, request: Request) {
    const user = await this.requireCurrentUser(request);
    const playlist = await this.assertCustomPlaylistOwner(id, user.id);

    await this.prisma.playlist.delete({
      where: { id: playlist.id },
    });

    return { deleted: true };
  }

  async listPlaylistVideos(id: string, request: Request, order: string = 'manual') {
    const user = await this.authService.getCurrentUser(request);
    const playlist = await this.prisma.playlist.findUnique({ where: { id } });
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }
    const isOwner = Boolean(user && playlist.ownerId === user.id);
    if (!isOwner && (playlist.kind !== 'CUSTOM' || !playlist.isPublic)) {
      throw new ForbiddenException('Only the playlist owner can view this playlist');
    }
    const playlistOrder = normalizePlaylistOrder(order);
    const items = await this.prisma.playlistItem.findMany({
      where: { playlistId: playlist.id },
      include: { video: { include: { channel: true } } },
      orderBy: playlistItemOrderBy(playlistOrder),
      take: 100,
    });

    return {
      playlist: toPlaylistResponse({ ...playlist, items }),
      items: items
        .map((item) => item.video)
        .filter((video) => isOwner || (video.status === 'READY' && video.visibility === 'PUBLIC'))
        .map(toVideoListItem),
      nextCursor: null,
    };
  }

  async addPlaylistItem(id: string, videoId: string, request: Request) {
    const user = await this.requireCurrentUser(request);
    const playlist = await this.assertPlaylistOwner(id, user.id);
    const video = await this.ensureVideoExists(videoId);
    const existingItem = await this.prisma.playlistItem.findUnique({
      where: { playlistId_videoId: { playlistId: playlist.id, videoId } },
      select: { id: true },
    });
    const position = await this.prisma.playlistItem.count({ where: { playlistId: playlist.id } });
    await this.prisma.playlistItem.upsert({
      where: { playlistId_videoId: { playlistId: playlist.id, videoId } },
      create: { playlistId: playlist.id, videoId, position },
      update: {},
    });
    if (!existingItem) {
      await this.notifications.createNotification({
        userId: user.id,
        type: 'PLAYLIST',
        message: `"${video.title}" 영상을 "${playlist.name}" 재생목록에 저장했습니다.`,
        linkUrl: `/watch/${videoId}?playlist=${playlist.id}`,
      });
    }

    return { saved: true };
  }

  async reorderPlaylistItems(id: string, videoIds: string[], request: Request) {
    const user = await this.requireCurrentUser(request);
    const playlist = await this.assertPlaylistOwner(id, user.id);
    const uniqueVideoIds = Array.from(new Set(videoIds ?? []));
    if (uniqueVideoIds.length === 0 || uniqueVideoIds.length !== videoIds?.length) {
      throw new BadRequestException('Playlist item order is invalid');
    }

    const existingItems = await this.prisma.playlistItem.findMany({
      where: { playlistId: playlist.id },
      select: { videoId: true },
    });
    const existingVideoIds = existingItems.map((item) => item.videoId).sort();
    const requestedVideoIds = [...uniqueVideoIds].sort();
    if (
      existingVideoIds.length !== requestedVideoIds.length ||
      existingVideoIds.some((videoId, index) => videoId !== requestedVideoIds[index])
    ) {
      throw new BadRequestException('Playlist item order must include every playlist video once');
    }

    await this.prisma.$transaction(
      uniqueVideoIds.map((videoId, position) =>
        this.prisma.playlistItem.update({
          where: { playlistId_videoId: { playlistId: playlist.id, videoId } },
          data: { position },
        }),
      ),
    );

    return { saved: true };
  }

  async removePlaylistItem(id: string, videoId: string, request: Request) {
    const user = await this.requireCurrentUser(request);
    const playlist = await this.assertPlaylistOwner(id, user.id);
    await this.prisma.playlistItem.delete({
      where: { playlistId_videoId: { playlistId: playlist.id, videoId } },
    });
    await this.notifications.createNotification({
      userId: user.id,
      type: 'PLAYLIST',
      message: `"${playlist.name}" 재생목록에서 영상을 제거했습니다.`,
      linkUrl: `/library/${playlist.id}`,
    });

    return { saved: false };
  }

  async ensureLikedPlaylist(userId: string) {
    const existingPlaylist = await this.prisma.playlist.findFirst({
      where: { ownerId: userId, kind: 'LIKED' },
    });
    if (existingPlaylist) {
      return existingPlaylist;
    }

    return this.prisma.playlist.create({
      data: { ownerId: userId, name: LIKED_PLAYLIST_NAME, kind: 'LIKED', isPublic: false },
    });
  }

  private async assertPlaylistOwner(id: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({ where: { id } });
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }
    if (playlist.ownerId !== userId) {
      throw new ForbiddenException('Only the playlist owner can manage this playlist');
    }
    return playlist;
  }

  private async assertCustomPlaylistOwner(id: string, userId: string) {
    const playlist = await this.assertPlaylistOwner(id, userId);
    if (playlist.kind !== 'CUSTOM') {
      throw new BadRequestException('Only custom playlists can be managed this way');
    }
    return playlist;
  }

  private async ensureVideoExists(videoId: string) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    return video;
  }

  private async requireCurrentUser(request: Request) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }
    return user;
  }
}

export function toPlaylistResponse(playlist: PlaylistWithItems) {
  const items = playlist.items ?? [];
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    isPublic: playlist.isPublic,
    kind: playlist.kind,
    videoCount: items.length,
    videos: items
      .map((item) => item.video)
      .filter(Boolean)
      .map((video) => toVideoListItem(video as Video & { channel: Channel })),
    createdAt: playlist.createdAt.toISOString(),
    updatedAt: playlist.updatedAt.toISOString(),
  };
}

function normalizePlaylistOrder(order?: string): PlaylistOrder {
  if (order === 'recent' || order === 'oldest') {
    return order;
  }
  return 'manual';
}

function playlistItemOrderBy(order: PlaylistOrder) {
  if (order === 'recent') {
    return [{ createdAt: 'desc' as const }, { position: 'asc' as const }];
  }
  if (order === 'oldest') {
    return [{ createdAt: 'asc' as const }, { position: 'asc' as const }];
  }
  return [{ position: 'asc' as const }, { createdAt: 'asc' as const }];
}
