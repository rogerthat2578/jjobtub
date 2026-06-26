import type { Channel } from "../types/channel";
import type { Comment } from "../types/comment";
import type { User } from "../types/user";
import type { Video } from "../types/video";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

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
  visibility?: string;
};

type ApiComment = {
  id: string;
  body: string;
  likeCount: number;
  createdAt: string;
  parentId: string | null;
  author: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
  replies?: ApiComment[];
};

type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  channelId?: string;
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

export async function createComment(videoId: string, body: string, parentId?: string) {
  const comment = await request<ApiComment>(`/videos/${videoId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, parentId }),
  });
  return mapComment(videoId, comment);
}

export async function fetchCurrentUser() {
  const data = await request<{ user: ApiUser }>("/auth/me");
  return mapUser(data.user);
}

export async function login(input: { email: string; password: string }) {
  const data = await request<{ user: ApiUser }>("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return mapUser(data.user);
}

export async function register(input: { email: string; password: string; displayName: string }) {
  const data = await request<{ user: ApiUser }>("/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return mapUser(data.user);
}

export async function logout() {
  await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
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

export async function incrementVideoView(videoId: string) {
  return request<{ views: number }>(`/videos/${videoId}/view`, { method: "POST" });
}

export async function updateVideo(
  videoId: string,
  input: { title: string; description: string; category: string; visibility?: string },
) {
  const item = await request<ApiVideoDetail>(`/videos/${videoId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return {
    video: mapVideo(item),
    channel: mapChannel(item.channel),
  };
}

export async function deleteVideo(videoId: string) {
  await request<{ ok: boolean }>(`/videos/${videoId}`, { method: "DELETE" });
}

export function streamUrl(videoId: string) {
  return `${API_BASE_URL}/videos/${videoId}/stream`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    ...init,
  });
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
    viewsCount: item.views,
    visibility: "visibility" in item ? item.visibility : undefined,
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
    parentId: comment.parentId,
    author: comment.author.displayName,
    avatarUrl: comment.author.avatarUrl ?? "",
    body: comment.body,
    postedAt: formatDate(comment.createdAt),
    likes: comment.likeCount,
    replies: (comment.replies ?? []).map((reply) => mapComment(videoId, reply)),
  };
}

function mapUser(user: ApiUser): User {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? "",
    channelId: user.channelId,
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
