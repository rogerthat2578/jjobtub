import { Channel, Video } from '@prisma/client';

type VideoWithChannel = Video & { channel: Channel };

export function toVideoListItem(video: VideoWithChannel) {
  return {
    id: video.id,
    title: video.title,
    thumbnailUrl: `/api/videos/${video.id}/thumbnail`,
    channel: {
      id: video.channel.id,
      name: video.channel.name,
      avatarUrl: video.channel.avatarUrl,
    },
    views: video.viewCount,
    uploadedAt: (video.publishedAt ?? video.createdAt).toISOString(),
    durationSeconds: video.durationSeconds,
    category: video.category,
  };
}

export function toVideoDetail(video: VideoWithChannel) {
  return {
    ...toVideoListItem(video),
    description: video.description,
    visibility: video.visibility,
    status: video.status,
    likeCount: video.likeCount,
    streamUrl: `/api/videos/${video.id}/stream`,
    channel: {
      id: video.channel.id,
      name: video.channel.name,
      description: video.channel.description,
      avatarUrl: video.channel.avatarUrl,
      bannerUrl: video.channel.bannerUrl,
      subscriberCount: video.channel.subscriberCount,
    },
  };
}
