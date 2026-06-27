import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import type { Request } from 'express';
import { ReadStream } from 'fs';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { StreamingService } from '../storage/streaming.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
import { VideoThumbnailService } from './video-thumbnail.service';
import { toVideoDetail, toVideoListItem } from './video-response';
import { extractYouTubeVideoId } from './youtube-url';

@Injectable()
export class VideosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly storage: StorageService,
    private readonly streaming: StreamingService,
    private readonly thumbnails: VideoThumbnailService,
  ) {}

  async listVideos(query: { q?: string; category?: string; channelId?: string; sort?: string; limit?: number }) {
    const limit = Number.isFinite(query.limit) ? Math.min(Math.max(query.limit ?? 24, 1), 50) : 24;
    const search = query.q?.trim();
    const videos = await this.prisma.video.findMany({
      where: {
        status: VideoStatus.READY,
        visibility: 'PUBLIC',
        category: query.category,
        channelId: query.channelId,
        OR: search
          ? [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { category: { contains: search, mode: 'insensitive' } },
              { channel: { name: { contains: search, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: { channel: true },
      orderBy: videoOrderBy(query.sort),
      take: limit,
    });

    return {
      items: videos.map(toVideoListItem),
      nextCursor: null,
    };
  }

  async listSubscribedVideos(request: Request) {
    const user = await this.requireCurrentUser(request);
    const subscriptions = await this.prisma.channelSubscription.findMany({
      where: { userId: user.id },
      select: { channelId: true },
    });
    const channelIds = subscriptions.map((subscription) => subscription.channelId);
    if (channelIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const videos = await this.prisma.video.findMany({
      where: {
        status: VideoStatus.READY,
        visibility: 'PUBLIC',
        channelId: { in: channelIds },
      },
      include: { channel: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    return { items: videos.map(toVideoListItem), nextCursor: null };
  }

  async listLibraryVideos(request: Request) {
    const user = await this.requireCurrentUser(request);
    const likes = await this.prisma.videoLike.findMany({
      where: { userId: user.id },
      include: { video: { include: { channel: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return {
      items: likes
        .map((like) => like.video)
        .filter((video) => video.status === VideoStatus.READY && video.visibility === 'PUBLIC')
        .map(toVideoListItem),
      nextCursor: null,
    };
  }

  async removeLibraryVideo(id: string, request: Request) {
    const user = await this.requireCurrentUser(request);
    await this.prisma.videoLike.delete({
      where: { videoId_userId: { videoId: id, userId: user.id } },
    });
    await this.prisma.video.update({
      where: { id },
      data: { likeCount: { decrement: 1 } },
      select: { likeCount: true },
    });

    return { ok: true };
  }

  async listHistoryVideos(request: Request) {
    const user = await this.requireCurrentUser(request);
    const views = await this.prisma.videoView.findMany({
      where: { userId: user.id },
      include: { video: { include: { channel: true } } },
      orderBy: { lastViewedAt: 'desc' },
      take: 50,
    });

    return {
      items: views
        .map((view) => view.video)
        .filter((video) => video.status === VideoStatus.READY && video.visibility === 'PUBLIC')
        .map(toVideoListItem),
      nextCursor: null,
    };
  }

  async removeHistoryVideo(id: string, request: Request) {
    const user = await this.requireCurrentUser(request);
    await this.prisma.videoView.delete({
      where: { videoId_userId: { videoId: id, userId: user.id } },
    });

    return { ok: true };
  }

  async clearHistory(request: Request) {
    const user = await this.requireCurrentUser(request);
    const result = await this.prisma.videoView.deleteMany({
      where: { userId: user.id },
    });

    return { ok: true, count: result.count };
  }

  async getVideo(id: string, request?: Request) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: { channel: true },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const user = request ? await this.authService.getCurrentUser(request) : null;
    if (!user) {
      return toVideoDetail(video);
    }

    const [like, subscription] = await Promise.all([
      this.prisma.videoLike.findUnique({
        where: { videoId_userId: { videoId: id, userId: user.id } },
      }),
      this.prisma.channelSubscription.findUnique({
        where: { channelId_userId: { channelId: video.channelId, userId: user.id } },
      }),
    ]);

    return toVideoDetail(video, {
      likedByMe: Boolean(like),
      subscribedByMe: Boolean(subscription),
    });
  }

  async createVideo(dto: CreateVideoDto, request: Request) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }

    const channel = await this.prisma.channel.findUnique({ where: { id: dto.channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }
    if (channel.ownerId !== user.id) {
      throw new ForbiddenException('Only the channel owner can create videos');
    }

    if (dto.source === 'YOUTUBE') {
      if (!dto.externalUrl) {
        throw new BadRequestException('YouTube URL is required');
      }
      const externalVideoId = extractYouTubeVideoId(dto.externalUrl);
      const video = await this.prisma.video.create({
        data: {
          channelId: dto.channelId,
          title: dto.title,
          description: dto.description,
          category: dto.category,
          visibility: dto.visibility ?? 'PUBLIC',
          status: 'READY',
          source: 'YOUTUBE',
          externalUrl: dto.externalUrl,
          externalVideoId,
          publishedAt: new Date(),
        },
      });

      return {
        id: video.id,
        status: video.status,
      };
    }

    const video = await this.prisma.video.create({
      data: {
        channelId: dto.channelId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        visibility: dto.visibility ?? 'PUBLIC',
        status: 'DRAFT',
        source: 'LOCAL',
      },
    });

    return {
      id: video.id,
      status: video.status,
    };
  }

  async uploadOriginal(
    id: string,
    file: { buffer?: Buffer; mimetype?: string; originalname?: string; size?: number },
    request: Request,
  ) {
    const video = await this.assertVideoOwner(id, request);
    if (video.source !== 'LOCAL') {
      throw new BadRequestException('Only local videos can receive uploaded files');
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
    await this.extractAndStoreThumbnail(id, savedFile.absolutePath);
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

  async uploadThumbnail(
    id: string,
    file: { buffer?: Buffer; mimetype?: string; originalname?: string; size?: number },
    request: Request,
  ) {
    const video = await this.assertVideoOwner(id, request);
    if (video.source !== 'LOCAL') {
      throw new BadRequestException('Only local videos can receive uploaded thumbnails');
    }
    if (!file?.buffer) {
      throw new BadRequestException('Thumbnail image is required');
    }

    const extension = thumbnailExtension(file.mimetype, file.originalname);
    if (!extension) {
      throw new BadRequestException('Only JPG, PNG, or WebP thumbnails are supported');
    }

    const existingFiles = await this.prisma.videoFile.findMany({
      where: { videoId: id, kind: 'THUMBNAIL' },
      select: { storagePath: true },
    });
    const savedFile = await this.storage.saveThumbnail(id, file.buffer, extension);
    await this.prisma.videoFile.deleteMany({
      where: { videoId: id, kind: 'THUMBNAIL' },
    });
    await this.prisma.videoFile.create({
      data: {
        videoId: id,
        kind: 'THUMBNAIL',
        storagePath: savedFile.storagePath,
        mimeType: file.mimetype ?? thumbnailMimeType(extension),
        sizeBytes: savedFile.sizeBytes,
      },
    });
    await Promise.all(existingFiles.map((existingFile) => this.storage.deleteFile(existingFile.storagePath)));

    return {
      videoId: id,
      thumbnailUrl: `/api/videos/${id}/thumbnail`,
    };
  }

  async incrementView(id: string, request?: Request) {
    const video = await this.prisma.video.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
      select: { viewCount: true },
    });
    const user = request ? await this.authService.getCurrentUser(request) : null;
    if (user) {
      await this.prisma.videoView.upsert({
        where: { videoId_userId: { videoId: id, userId: user.id } },
        create: { videoId: id, userId: user.id },
        update: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
      });
    }

    return { views: video.viewCount };
  }

  async toggleLike(id: string, request: Request) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }

    await this.ensureVideoExists(id);
    const key = { videoId_userId: { videoId: id, userId: user.id } };
    const existingLike = await this.prisma.videoLike.findUnique({ where: key });
    if (existingLike) {
      await this.prisma.videoLike.delete({ where: key });
      const video = await this.prisma.video.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });

      return { liked: false, likes: video.likeCount };
    }

    await this.prisma.videoLike.create({
      data: { videoId: id, userId: user.id },
    });
    const video = await this.prisma.video.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });

    return { liked: true, likes: video.likeCount };
  }

  async updateVideo(id: string, dto: UpdateVideoDto, request: Request) {
    await this.assertVideoOwner(id, request);
    const data: UpdateVideoDto = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.visibility !== undefined) data.visibility = dto.visibility;

    const video = await this.prisma.video.update({
      where: { id },
      data,
      include: { channel: true },
    });

    return toVideoDetail(video);
  }

  async deleteVideo(id: string, request: Request) {
    await this.assertVideoOwner(id, request);
    const files = await this.prisma.videoFile.findMany({
      where: { videoId: id },
      select: { storagePath: true },
    });

    await this.prisma.video.delete({ where: { id } });
    await Promise.all(files.map((file) => this.storage.deleteFile(file.storagePath)));

    return { ok: true };
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

  async getThumbnail(id: string): Promise<{ contentType: string; stream?: ReadStream; body?: string }> {
    const file = await this.prisma.videoFile.findFirst({
      where: { videoId: id, kind: 'THUMBNAIL' },
    });
    if (file) {
      return {
        contentType: file.mimeType,
        stream: this.storage.createFileReadStream(file.storagePath),
      };
    }

    return {
      contentType: 'image/svg+xml',
      body: this.getFallbackThumbnail(id),
    };
  }

  getFallbackThumbnail(id: string) {
    const label = id.slice(0, 8);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#111827"/>
  <rect x="60" y="60" width="1160" height="600" rx="28" fill="#27272a"/>
  <path d="M560 260v200l180-100-180-100z" fill="#f43f5e"/>
  <text x="640" y="560" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="700" fill="#ffffff">jjobtub ${label}</text>
</svg>`;
  }

  private async assertVideoOwner(id: string, request: Request) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }

    const video = await this.prisma.video.findUnique({
      where: { id },
      include: { channel: true },
    });
    if (!video) {
      throw new NotFoundException('Video not found');
    }
    if (video.channel.ownerId !== user.id) {
      throw new ForbiddenException('Only the channel owner can manage this video');
    }

    return video;
  }

  private async ensureVideoExists(id: string) {
    const video = await this.prisma.video.findUnique({ where: { id } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }
  }

  private async requireCurrentUser(request: Request) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }
    return user;
  }

  private async extractAndStoreThumbnail(videoId: string, inputPath: string) {
    try {
      const existingFiles = await this.prisma.videoFile.findMany({
        where: { videoId, kind: 'THUMBNAIL' },
        select: { storagePath: true },
      });
      const thumbnail = await this.thumbnails.extractFromVideo(videoId, inputPath);
      await this.prisma.videoFile.deleteMany({
        where: { videoId, kind: 'THUMBNAIL' },
      });
      await this.prisma.videoFile.create({
        data: {
          videoId,
          kind: 'THUMBNAIL',
          storagePath: thumbnail.storagePath,
          mimeType: thumbnail.mimeType,
          sizeBytes: thumbnail.sizeBytes,
        },
      });
      await Promise.all(existingFiles.map((existingFile) => this.storage.deleteFile(existingFile.storagePath)));
    } catch {
      // Keep upload successful when thumbnail extraction fails; the fallback SVG remains available.
    }
  }
}

function thumbnailExtension(mimeType?: string, originalName?: string) {
  const loweredName = originalName?.toLowerCase() ?? '';
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg' || loweredName.endsWith('.jpg') || loweredName.endsWith('.jpeg')) {
    return 'jpg';
  }
  if (mimeType === 'image/png' || loweredName.endsWith('.png')) {
    return 'png';
  }
  if (mimeType === 'image/webp' || loweredName.endsWith('.webp')) {
    return 'webp';
  }
  return '';
}

function thumbnailMimeType(extension: string) {
  if (extension === 'jpg') {
    return 'image/jpeg';
  }
  if (extension === 'png') {
    return 'image/png';
  }
  return 'image/webp';
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
