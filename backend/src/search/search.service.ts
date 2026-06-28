import { Injectable } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { toPlaylistResponse } from '../playlists/playlists.service';
import { PrismaService } from '../prisma/prisma.service';
import { toVideoListItem } from '../videos/video-response';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: { q?: string; sort?: string; type?: string }) {
    const search = query.q?.trim();
    const type = normalizeSearchType(query.type);
    const [videos, channels, playlists] = await Promise.all([
      type === 'all' || type === 'videos' ? this.searchVideos(search, query.sort) : Promise.resolve([]),
      type === 'all' || type === 'channels' ? this.searchChannels(search) : Promise.resolve([]),
      type === 'all' || type === 'playlists' ? this.searchPlaylists(search) : Promise.resolve([]),
    ]);

    return {
      videos: videos.map(toVideoListItem),
      channels: channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        description: channel.description,
        avatarUrl: channel.avatarUrl,
        bannerUrl: channel.bannerUrl,
        subscriberCount: channel.subscriberCount,
        videoCount: channel._count.videos,
        createdAt: channel.createdAt.toISOString(),
      })),
      playlists: playlists.map(toPlaylistResponse),
    };
  }

  private searchVideos(search: string | undefined, sort?: string) {
    return this.prisma.video.findMany({
      where: {
        status: VideoStatus.READY,
        visibility: 'PUBLIC',
        OR: search
          ? [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              { tags: { has: search } },
              { channel: { name: { contains: search, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: { channel: true },
      orderBy: videoOrderBy(sort),
      take: 30,
    });
  }

  private searchChannels(search: string | undefined) {
    return this.prisma.channel.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        _count: {
          select: {
            videos: { where: { status: VideoStatus.READY, visibility: 'PUBLIC' } },
          },
        },
      },
      orderBy: [{ subscriberCount: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    });
  }

  private searchPlaylists(search: string | undefined) {
    return this.prisma.playlist.findMany({
      where: {
        kind: 'CUSTOM',
        name: search ? { contains: search, mode: 'insensitive' } : undefined,
      },
      include: {
        items: {
          where: { video: { status: VideoStatus.READY, visibility: 'PUBLIC' } },
          include: { video: { include: { channel: true } } },
          orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
          take: 6,
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
      take: 12,
    });
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
