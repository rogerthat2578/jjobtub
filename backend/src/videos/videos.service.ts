import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import type { Request } from 'express';
import { ReadStream } from 'fs';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
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
    private readonly notifications: NotificationsService,
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
              { tags: { has: search } },
              { channel: { name: { contains: search, mode: 'insensitive' } } },
            ]
          : undefined,
      },
      include: { channel: true, _count: { select: { comments: true } } },
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
    const [availableQualities, subtitles] =
      video.source === 'LOCAL' ? await Promise.all([this.getAvailableQualities(id), this.listSubtitles(id)]) : [[], []];
    if (!user) {
      return toVideoDetail(video, { availableQualities, subtitles });
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
      availableQualities,
      subtitles,
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
          tags: normalizeTags(dto.tags),
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
        tags: normalizeTags(dto.tags),
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
    const durationSeconds = await this.thumbnails.probeVideoDuration(savedFile.absolutePath);
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
    await this.extractAndStorePreview(id, savedFile.absolutePath);
    await this.extractAndStoreQualityVariants(id, savedFile.absolutePath);
    await this.prisma.video.update({
      where: { id },
      data: {
        status: 'READY',
        durationSeconds,
        publishedAt: video.publishedAt ?? new Date(),
      },
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

  async reprocessQualities(id: string, request: Request) {
    const video = await this.assertVideoOwner(id, request);
    if (video.source !== 'LOCAL') {
      throw new BadRequestException('Only local videos can be processed');
    }

    const file = await this.prisma.videoFile.findFirst({
      where: { videoId: id, kind: 'ORIGINAL' },
    });
    if (!file) {
      throw new NotFoundException('Original video file not found');
    }

    const { absolutePath } = await this.storage.statFile(file.storagePath);
    await this.prisma.video.update({
      where: { id },
      data: { status: 'PROCESSING' },
    });

    try {
      await this.extractAndStoreQualityVariants(id, absolutePath, true);
      await this.prisma.video.update({
        where: { id },
        data: { status: 'READY' },
      });
    } catch {
      await this.prisma.video.update({
        where: { id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException('Video quality processing failed');
    }

    return {
      videoId: id,
      status: 'READY',
      availableQualities: await this.getAvailableQualities(id),
    };
  }

  async uploadSubtitle(
    id: string,
    file: { buffer?: Buffer; mimetype?: string; originalname?: string },
    input: { language?: string; label?: string },
    request: Request,
  ) {
    await this.assertVideoOwner(id, request);
    if (!file?.buffer) {
      throw new BadRequestException('WebVTT subtitle file is required');
    }
    if (!file.originalname?.toLowerCase().endsWith('.vtt') && file.mimetype !== 'text/vtt') {
      throw new BadRequestException('Only WebVTT .vtt subtitle files are supported');
    }

    const language = normalizeSubtitleLanguage(input.language);
    const label = (input.label?.trim() || languageLabel(language)).slice(0, 60);
    const existingSubtitle = await this.prisma.videoSubtitle.findUnique({
      where: { videoId_language: { videoId: id, language } },
      select: { storagePath: true },
    });
    const savedFile = await this.storage.saveSubtitle(id, language, file.buffer);
    const subtitle = await this.prisma.videoSubtitle.upsert({
      where: { videoId_language: { videoId: id, language } },
      create: {
        videoId: id,
        language,
        label,
        storagePath: savedFile.storagePath,
        mimeType: 'text/vtt',
      },
      update: {
        label,
        storagePath: savedFile.storagePath,
        mimeType: 'text/vtt',
      },
      select: { id: true, language: true, label: true },
    });
    if (existingSubtitle && existingSubtitle.storagePath !== savedFile.storagePath) {
      await this.storage.deleteFile(existingSubtitle.storagePath);
    }

    return {
      ...subtitle,
      src: `/api/videos/${id}/subtitles/${subtitle.id}`,
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

    const targetVideo = await this.prisma.video.findUnique({ where: { id }, include: { channel: true } });
    if (!targetVideo) {
      throw new NotFoundException('Video not found');
    }
    const key = { videoId_userId: { videoId: id, userId: user.id } };
    const existingLike = await this.prisma.videoLike.findUnique({ where: key });
    if (existingLike) {
      await this.prisma.videoLike.delete({ where: key });
      const likedPlaylist = await this.ensureLikedPlaylist(user.id);
      await this.prisma.playlistItem.deleteMany({
        where: { playlistId: likedPlaylist.id, videoId: id },
      });
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
    const likedPlaylist = await this.ensureLikedPlaylist(user.id);
    await this.prisma.playlistItem.upsert({
      where: { playlistId_videoId: { playlistId: likedPlaylist.id, videoId: id } },
      create: { playlistId: likedPlaylist.id, videoId: id },
      update: {},
    });
    const video = await this.prisma.video.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    await this.notifications.createNotification({
      userId: targetVideo.channel.ownerId,
      actorId: user.id,
      type: 'VIDEO_LIKE',
      message: `${user.displayName}님이 내 영상을 좋아합니다.`,
      linkUrl: `/watch/${id}`,
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
    if (dto.tags !== undefined) data.tags = normalizeTags(dto.tags);

    const video = await this.prisma.video.update({
      where: { id },
      data,
      include: { channel: true },
    });

    return toVideoDetail(video);
  }

  async deleteVideo(id: string, request: Request) {
    await this.assertVideoOwner(id, request);
    const [files, subtitles] = await Promise.all([
      this.prisma.videoFile.findMany({
        where: { videoId: id },
        select: { storagePath: true },
      }),
      this.prisma.videoSubtitle.findMany({
        where: { videoId: id },
        select: { storagePath: true },
      }),
    ]);

    await this.prisma.video.delete({ where: { id } });
    await Promise.all([...files, ...subtitles].map((file) => this.storage.deleteFile(file.storagePath)));

    return { ok: true };
  }

  async streamOriginal(id: string, rangeHeader: string | undefined, quality?: string): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    stream: ReadStream;
  }> {
    const qualityHeight = parseQualityHeight(quality);
    const file =
      qualityHeight !== null
        ? (await this.prisma.videoFile.findFirst({
            where: { videoId: id, kind: 'HLS_VARIANT', height: qualityHeight },
          })) ??
          (await this.prisma.videoFile.findFirst({
            where: { videoId: id, kind: 'ORIGINAL' },
          }))
        : await this.prisma.videoFile.findFirst({
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

  async streamPreview(id: string, rangeHeader: string | undefined): Promise<{
    statusCode: number;
    headers: Record<string, string>;
    stream: ReadStream;
  }> {
    const file =
      (await this.prisma.videoFile.findFirst({
        where: { videoId: id, kind: 'PREVIEW' },
      })) ??
      (await this.prisma.videoFile.findFirst({
        where: { videoId: id, kind: 'ORIGINAL' },
      }));
    if (!file) {
      throw new NotFoundException('Preview video file not found');
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

  async getSubtitle(id: string, subtitleId: string): Promise<{ contentType: string; stream: ReadStream }> {
    const subtitle = await this.prisma.videoSubtitle.findFirst({
      where: { id: subtitleId, videoId: id },
    });
    if (!subtitle) {
      throw new NotFoundException('Subtitle not found');
    }

    return {
      contentType: subtitle.mimeType,
      stream: this.storage.createFileReadStream(subtitle.storagePath),
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

  private async ensureLikedPlaylist(userId: string) {
    const existingPlaylist = await this.prisma.playlist.findFirst({
      where: { ownerId: userId, kind: 'LIKED' },
    });
    if (existingPlaylist) {
      return existingPlaylist;
    }

    return this.prisma.playlist.create({
      data: { ownerId: userId, name: '좋아요 표시한 재생 목록', kind: 'LIKED' },
    });
  }

  private async getAvailableQualities(videoId: string) {
    const files = await this.prisma.videoFile.findMany({
      where: { videoId, kind: 'HLS_VARIANT' },
      select: { height: true },
      orderBy: { height: 'desc' },
    });

    return Array.from(new Set(files.map((file) => file.height).filter((height): height is number => Boolean(height))));
  }

  private async listSubtitles(videoId: string) {
    return this.prisma.videoSubtitle.findMany({
      where: { videoId },
      select: { id: true, language: true, label: true },
      orderBy: { createdAt: 'asc' },
    });
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

  private async extractAndStorePreview(videoId: string, inputPath: string) {
    try {
      const existingFiles = await this.prisma.videoFile.findMany({
        where: { videoId, kind: 'PREVIEW' },
        select: { storagePath: true },
      });
      const preview = await this.thumbnails.createPreviewFromVideo(videoId, inputPath);
      await this.prisma.videoFile.deleteMany({
        where: { videoId, kind: 'PREVIEW' },
      });
      await this.prisma.videoFile.create({
        data: {
          videoId,
          kind: 'PREVIEW',
          storagePath: preview.storagePath,
          mimeType: preview.mimeType,
          sizeBytes: preview.sizeBytes,
        },
      });
      await Promise.all(existingFiles.map((existingFile) => this.storage.deleteFile(existingFile.storagePath)));
    } catch {
      // Keep upload successful when preview generation fails; existing videos can fall back to original stream.
    }
  }

  private async extractAndStoreQualityVariants(videoId: string, inputPath: string, throwOnFailure = false) {
    try {
      const existingFiles = await this.prisma.videoFile.findMany({
        where: { videoId, kind: 'HLS_VARIANT' },
        select: { storagePath: true },
      });
      const variants = await this.thumbnails.createQualityVariants(videoId, inputPath);
      await this.prisma.videoFile.deleteMany({
        where: { videoId, kind: 'HLS_VARIANT' },
      });
      await Promise.all(
        variants.map((variant) =>
          this.prisma.videoFile.create({
            data: {
              videoId,
              kind: 'HLS_VARIANT',
              storagePath: variant.storagePath,
              mimeType: variant.mimeType,
              sizeBytes: variant.sizeBytes,
              height: variant.height,
            },
          }),
        ),
      );
      await Promise.all(existingFiles.map((existingFile) => this.storage.deleteFile(existingFile.storagePath)));
    } catch (error) {
      if (throwOnFailure) {
        throw error;
      }
      // Keep upload successful when quality variant generation fails; playback falls back to the original file.
    }
  }
}

function parseQualityHeight(quality?: string) {
  if (!quality || quality === 'auto') {
    return null;
  }
  const height = Number(quality);
  return [144, 240, 360, 480, 720, 1080, 1440, 2160].includes(height) ? height : null;
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

function normalizeTags(tags?: string[]) {
  if (!tags) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter(Boolean)
        .map((tag) => tag.slice(0, 30)),
    ),
  ).slice(0, 12);
}

function normalizeSubtitleLanguage(language?: string) {
  const normalized = language?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'ko';
  return normalized.slice(0, 16) || 'ko';
}

function languageLabel(language: string) {
  if (language === 'ko') return '한국어';
  if (language === 'en') return '영어';
  if (language === 'zh') return '중국어';
  if (language === 'ja') return '일본어';
  return language;
}
