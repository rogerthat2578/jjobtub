import { Injectable } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { toPlaylistResponse } from '../playlists/playlists.service';
import { PrismaService } from '../prisma/prisma.service';
import { toVideoListItem } from '../videos/video-response';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: { q?: string; sort?: string; type?: string; page?: number; limit?: number }) {
    const search = query.q?.trim();
    const type = normalizeSearchType(query.type);
    const page = normalizePage(query.page);
    const limit = normalizeLimit(query.limit);
    const [videoResult, channelResult, playlistResult] = await Promise.all([
      type === 'all' || type === 'videos' ? this.searchVideos(search, query.sort, page, limit) : Promise.resolve(emptyResult()),
      type === 'all' || type === 'channels' ? this.searchChannels(search, page, limit) : Promise.resolve(emptyResult()),
      type === 'all' || type === 'playlists' ? this.searchPlaylists(search, page, limit) : Promise.resolve(emptyResult()),
    ]);

    return {
      videos: videoResult.items.map(toVideoListItem),
      channels: channelResult.items.map((channel: any) => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        avatarUrl: channel.avatarUrl,
        bannerUrl: channel.bannerUrl,
        subscriberCount: channel.subscriberCount,
        videoCount: channel._count.videos,
        createdAt: channel.createdAt.toISOString(),
      })),
      playlists: playlistResult.items.map(toPlaylistResponse),
      pageInfo: {
        videos: toPageInfo(page, limit, videoResult.total),
        channels: toPageInfo(page, limit, channelResult.total),
        playlists: toPageInfo(page, limit, playlistResult.total),
      },
    };
  }

  private async searchVideos(search: string | undefined, sort: string | undefined, page: number, limit: number) {
    const where = {
      status: VideoStatus.READY,
      visibility: 'PUBLIC' as const,
      OR: search
        ? [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
            { category: { contains: search, mode: 'insensitive' as const } },
            { tags: { hasSome: tagCandidates(search) } },
            { channel: { name: { contains: search, mode: 'insensitive' as const } } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        include: { channel: true },
        orderBy: videoOrderBy(sort),
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.video.count({ where }),
    ]);

    return { items, total };
  }

  private async searchChannels(search: string | undefined, page: number, limit: number) {
    const where = search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { description: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : undefined;
    const [items, total] = await Promise.all([
      this.prisma.channel.findMany({
        where,
        include: {
          _count: {
            select: {
              videos: { where: { status: VideoStatus.READY, visibility: 'PUBLIC' } },
            },
          },
        },
        orderBy: [{ subscriberCount: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.channel.count({ where }),
    ]);

    return { items, total };
  }

  private async searchPlaylists(search: string | undefined, page: number, limit: number) {
    const where = {
      kind: 'CUSTOM' as const,
      isPublic: true,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
            { owner: { channels: { some: { name: { contains: search, mode: 'insensitive' as const } } } } },
          ]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.playlist.findMany({
        where,
        include: {
          owner: { include: { channels: { take: 1, orderBy: { createdAt: 'asc' } } } },
          items: {
            where: { video: { status: VideoStatus.READY, visibility: 'PUBLIC' } },
            include: { video: { include: { channel: true } } },
            orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
            take: 6,
          },
        },
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.playlist.count({ where }),
    ]);

    return { items, total };
  }
}

function normalizeSearchType(type?: string) {
  if (type === 'videos' || type === 'channels' || type === 'playlists') {
    return type;
  }
  return 'all';
}

function videoOrderBy(sort?: string) {
  if (sort === 'views') {
    return [{ viewCount: 'desc' as const }, { publishedAt: 'desc' as const }, { createdAt: 'desc' as const }];
  }
  if (sort === 'likes') {
    return [{ likeCount: 'desc' as const }, { publishedAt: 'desc' as const }, { createdAt: 'desc' as const }];
  }
  return [{ publishedAt: 'desc' as const }, { createdAt: 'desc' as const }];
}

function normalizePage(page?: number) {
  return Number.isFinite(page) ? Math.max(1, Math.floor(page ?? 1)) : 1;
}

function normalizeLimit(limit?: number) {
  return Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit ?? 12), 1), 30) : 12;
}

function toPageInfo(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    hasNextPage: page * limit < total,
    hasPreviousPage: page > 1,
  };
}

function emptyResult<T = never>() {
  return { items: [] as T[], total: 0 };
}

function tagCandidates(search: string) {
  return Array.from(new Set([search, search.toLowerCase(), search.trim()])).filter(Boolean);
}
