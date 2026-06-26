import type { Channel } from "../types/channel";
import type { Comment } from "../types/comment";
import type { Video } from "../types/video";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:4000/api";

type ApiChannel = {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  subscriberCount?: number;
};

type ApiVideoListItem = {
  id: string;
  title: string;
  thumbnailUrl: string;
  channel: ApiChannel;
  views: number;
  uploadedAt: string;
  durationSeconds: number;
  category: string;
};

type ApiVideoDetail = ApiVideoListItem & {
  description: string;
  likeCount: number;
  streamUrl: string;
  channel: ApiChannel;
};

type ApiComment = {
  id: string;
  body: string;
  likeCount: number;
  createdAt: string;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
};

export type VideoListResult = {
  videos: Video[];
  channelsById: Record<string, Channel>;
};

export async function fetchVideos(params: { q?: string; category?: string; channelId?: string } = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const data = await request<{ items: ApiVideoListItem[] }>(`/videos${toQuery(searchParams)}`);
  return mapVideoList(data.items);
}

export async function fetchVideo(id: string) {
  const item = await request<ApiVideoDetail>(`/videos/${id}`);
  return {
    video: mapVideo(item),
    channel: mapChannel(item.channel),
  };
}

export async function fetchChannel(id: string) {
  return mapChannel(await request<ApiChannel>(`/channels/${id}`));
}

export async function fetchChannelVideos(id: string) {
  const data = await request<{ items: ApiVideoListItem[] }>(`/channels/${id}/videos`);
  return mapVideoList(data.items);
}

export async function fetchComments(videoId: string) {
  const data = await request<{ items: ApiComment[] }>(`/videos/${videoId}/comments`);
  return data.items.map((comment) => mapComment(videoId, comment));
}

export async function createVideo(input: {
  title: string;
  description: string;
  category: string;
  channelId: string;
}) {
  return request<{ id: string; status: string }>("/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, visibility: "PUBLIC" }),
  });
}

export async function uploadVideoFile(videoId: string, file: File) {
  const form = new FormData();
  form.append("file", file);

  return request<{ videoId: string; status: string }>(`/videos/${videoId}/upload`, {
    method: "POST",
    body: form,
  });
}

export function streamUrl(videoId: string) {
  return `${API_BASE_URL}/videos/${videoId}/stream`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function mapVideoList(items: ApiVideoListItem[]): VideoListResult {
  const channelsById: Record<string, Channel> = {};
  const videos = items.map((item) => {
    channelsById[item.channel.id] = mapChannel(item.channel);
    return mapVideo(item);
  });

  return { videos, channelsById };
}

function mapVideo(item: ApiVideoListItem | ApiVideoDetail): Video {
  return {
    id: item.id,
    title: item.title,
    description: "description" in item ? item.description : "",
    thumbnailUrl: absoluteApiUrl(item.thumbnailUrl),
    videoUrl: "streamUrl" in item ? absoluteApiUrl(item.streamUrl) : streamUrl(item.id),
    channelId: item.channel.id,
    views: `${item.views.toLocaleString()}회`,
    uploadedAt: formatDate(item.uploadedAt),
    duration: formatDuration(item.durationSeconds),
    category: item.category,
    likes: "likeCount" in item ? item.likeCount.toLocaleString() : "0",
  };
}

function mapChannel(channel: ApiChannel): Channel {
  return {
    id: channel.id,
    name: channel.name,
    handle: `@${channel.name}`,
    avatarUrl: channel.avatarUrl ?? "",
    bannerUrl: channel.bannerUrl ?? "",
    subscribers: (channel.subscriberCount ?? 0).toLocaleString(),
    description: channel.description ?? "",
  };
}

function mapComment(videoId: string, comment: ApiComment): Comment {
  return {
    id: comment.id,
    videoId,
    author: comment.author.displayName,
    avatarUrl: comment.author.avatarUrl ?? "",
    body: comment.body,
    postedAt: formatDate(comment.createdAt),
    likes: comment.likeCount,
  };
}

function absoluteApiUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http")) {
    return pathOrUrl;
  }
  return `${API_BASE_URL}${pathOrUrl.replace(/^\/api/, "")}`;
}

function toQuery(searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}
