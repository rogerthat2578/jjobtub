import { Channel, Video } from '@prisma/client';

type VideoWithChannel = Video & { channel: Channel };
type VideoViewerState = {
  likedByMe?: boolean;
  subscribedByMe?: boolean;
  availableQualities?: number[];
};

export function toVideoListItem(video: VideoWithChannel) {
  return {
    id: video.id,
    title: video.title,
    thumbnailUrl:
      video.source === 'YOUTUBE' && video.externalVideoId
        ? `https://img.youtube.com/vi/${video.externalVideoId}/hqdefault.jpg`
        : `/api/videos/${video.id}/thumbnail`,
    previewUrl: video.source === 'LOCAL' ? `/api/videos/${video.id}/preview` : null,
    channel: {
      id: video.channel.id,
      name: video.channel.name,
      avatarUrl: video.channel.avatarUrl,
    },
    views: video.viewCount,
    source: video.source,
    uploadedAt: (video.publishedAt ?? video.createdAt).toISOString(),
    durationSeconds: video.durationSeconds,
    category: video.category,
    tags: video.tags,
    visibility: video.visibility,
    status: video.status,
  };
}

export function toVideoDetail(video: VideoWithChannel, viewerState: VideoViewerState = {}) {
  return {
    ...toVideoListItem(video),
    description: video.description,
    visibility: video.visibility,
    status: video.status,
    likeCount: video.likeCount,
    likedByMe: Boolean(viewerState.likedByMe),
    availableQualities: viewerState.availableQualities ?? [],
    streamUrl: `/api/videos/${video.id}/stream`,
    embedUrl:
      video.source === 'YOUTUBE' && video.externalVideoId
        ? `https://www.youtube.com/embed/${video.externalVideoId}`
        : null,
    externalUrl: video.externalUrl,
    channel: {
      id: video.channel.id,
      name: video.channel.name,
      description: video.channel.description,
      avatarUrl: video.channel.avatarUrl,
      bannerUrl: video.channel.bannerUrl,
      subscriberCount: video.channel.subscriberCount,
      subscribedByMe: Boolean(viewerState.subscribedByMe),
    },
  };
}
