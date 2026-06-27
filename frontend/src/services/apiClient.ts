import type { Channel } from "../types/channel";
import type { Comment } from "../types/comment";
import type { Playlist } from "../types/playlist";
import type { User } from "../types/user";
import type { Video } from "../types/video";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

type ApiChannel = {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  subscriberCount?: number;
  videoCount?: number;
  createdAt?: string;
  subscribedByMe?: boolean;
};

type ApiVideoListItem = {
  id: string;
  title: string;
  thumbnailUrl: string;
  channel: ApiChannel;
  views: number;
  source?: "LOCAL" | "YOUTUBE";
  uploadedAt: string;
  durationSeconds: number;
  category: string;
  visibility?: string;
  status?: string;
};

type ApiVideoDetail = ApiVideoListItem & {
  description: string;
  likeCount: number;
  likedByMe?: boolean;
  streamUrl: string;
  embedUrl?: string | null;
  externalUrl?: string | null;
  channel: ApiChannel;
  visibility?: string;
};

type ApiPlaylist = {
  id: string;
  name: string;
  kind: "LIKED" | "CUSTOM";
  videoCount: number;
  videos: ApiVideoListItem[];
  createdAt: string;
  updatedAt: string;
};

type ApiComment = {
  id: string;
  body: string;
  likeCount: number;
  likedByMe?: boolean;
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

export async function fetchVideos(params: { q?: string; category?: string; channelId?: string; sort?: string } = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const data = await request<{ items: ApiVideoListItem[] }>(`/videos${toQuery(searchParams)}`);
  return mapVideoList(data.items);
}

export async function fetchSubscribedVideos() {
  const data = await request<{ items: ApiVideoListItem[] }>("/videos/subscriptions");
  return mapVideoList(data.items);
}

export async function fetchLibraryVideos() {
  const data = await request<{ items: ApiVideoListItem[] }>("/videos/library");
  return mapVideoList(data.items);
}

export async function fetchPlaylists() {
  const data = await request<{ items: ApiPlaylist[] }>("/playlists");
  return data.items.map(mapPlaylist);
}

export async function createPlaylist(name: string) {
  const data = await request<ApiPlaylist>("/playlists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return mapPlaylist(data);
}

export async function addVideoToPlaylist(playlistId: string, videoId: string) {
  return request<{ saved: boolean }>(`/playlists/${playlistId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId }),
  });
}

export async function removeVideoFromPlaylist(playlistId: string, videoId: string) {
  return request<{ saved: boolean }>(`/playlists/${playlistId}/items/${videoId}`, { method: "DELETE" });
}

export async function fetchPlaylistVideos(playlistId: string) {
  const data = await request<{ playlist: ApiPlaylist; items: ApiVideoListItem[] }>(`/playlists/${playlistId}/videos`);
  return {
    playlist: mapPlaylist(data.playlist),
    ...mapVideoList(data.items),
  };
}

export async function fetchHistoryVideos() {
  const data = await request<{ items: ApiVideoListItem[] }>("/videos/history");
  return mapVideoList(data.items);
}

export async function removeLibraryVideo(videoId: string) {
  await request<{ ok: boolean }>(`/videos/library/${videoId}`, { method: "DELETE" });
}

export async function removeHistoryVideo(videoId: string) {
  await request<{ ok: boolean }>(`/videos/history/${videoId}`, { method: "DELETE" });
}

export async function clearHistoryVideos() {
  return request<{ ok: boolean; count: number }>("/videos/history", { method: "DELETE" });
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

export async function updateComment(videoId: string, commentId: string, body: string) {
  const comment = await request<ApiComment>(`/comments/${commentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return mapComment(videoId, comment);
}

export async function deleteComment(commentId: string) {
  await request<{ ok: boolean }>(`/comments/${commentId}`, { method: "DELETE" });
}

export async function toggleCommentLike(commentId: string) {
  return request<{ liked: boolean; likes: number }>(`/comments/${commentId}/like`, { method: "POST" });
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
  source?: "LOCAL" | "YOUTUBE";
  externalUrl?: string;
}) {
  return request<{ id: string; status: string }>("/videos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, visibility: "PUBLIC" }),
  });
}

export async function uploadVideoFile(videoId: string, file: File) {
  return uploadFileWithProgress<{ videoId: string; status: string }>(`/videos/${videoId}/upload`, file);
}

export async function uploadVideoThumbnail(videoId: string, file: File, onProgress?: (progress: number) => void) {
  return uploadFileWithProgress<{ videoId: string; thumbnailUrl: string }>(`/videos/${videoId}/thumbnail`, file, onProgress);
}

export async function uploadVideoFileWithProgress(videoId: string, file: File, onProgress?: (progress: number) => void) {
  return uploadFileWithProgress<{ videoId: string; status: string }>(`/videos/${videoId}/upload`, file, onProgress);
}

function uploadFileWithProgress<T>(path: string, file: File, onProgress?: (progress: number) => void) {
  const form = new FormData();
  form.append("file", file);

  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText || "{}") as T);
        return;
      }
      reject(new ApiRequestError(readXhrErrorMessage(xhr), xhr.status));
    };
    xhr.onerror = () => reject(new ApiRequestError("Network request failed", 0));
    xhr.send(form);
  });
}

export async function incrementVideoView(videoId: string) {
  return request<{ views: number }>(`/videos/${videoId}/view`, { method: "POST" });
}

export async function toggleVideoLike(videoId: string) {
  return request<{ liked: boolean; likes: number }>(`/videos/${videoId}/like`, { method: "POST" });
}

export async function toggleChannelSubscription(channelId: string) {
  return request<{ subscribed: boolean; subscribers: number }>(`/channels/${channelId}/subscribe`, { method: "POST" });
}

export async function updateChannel(
  channelId: string,
  input: { name?: string; description?: string; avatarUrl?: string; bannerUrl?: string },
) {
  return mapChannel(
    await request<ApiChannel>(`/channels/${channelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
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
    throw new ApiRequestError(await readErrorMessage(response), response.status);
  }
  return response.json() as Promise<T>;
}

async function readErrorMessage(response: Response) {
  const text = await response.text();
  if (!text) {
    return `Request failed with ${response.status}`;
  }

  try {
    const body = JSON.parse(text) as { message?: string | string[]; error?: string };
    if (Array.isArray(body.message)) {
      return body.message.join("\n");
    }
    return body.message || body.error || text;
  } catch {
    return text;
  }
}

function readXhrErrorMessage(xhr: XMLHttpRequest) {
  if (!xhr.responseText) {
    return `Request failed with ${xhr.status}`;
  }

  try {
    const body = JSON.parse(xhr.responseText) as { message?: string | string[]; error?: string };
    if (Array.isArray(body.message)) {
      return body.message.join("\n");
    }
    return body.message || body.error || xhr.responseText;
  } catch {
    return xhr.responseText;
  }
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
    embedUrl: "embedUrl" in item ? item.embedUrl ?? undefined : undefined,
    source: item.source,
    channelId: item.channel.id,
    views: `${item.views.toLocaleString()}회`,
    uploadedAt: formatDate(item.uploadedAt),
    duration: formatDuration(item.durationSeconds),
    category: item.category,
    likes: "likeCount" in item ? item.likeCount.toLocaleString() : "0",
    likesCount: "likeCount" in item ? item.likeCount : undefined,
    likedByMe: "likedByMe" in item ? item.likedByMe : undefined,
    viewsCount: item.views,
    visibility: "visibility" in item ? item.visibility : undefined,
    status: "status" in item ? item.status : undefined,
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
    subscribersCount: channel.subscriberCount,
    videoCount: channel.videoCount,
    joinedAt: channel.createdAt ? formatDate(channel.createdAt) : undefined,
    description: channel.description ?? "",
    subscribedByMe: channel.subscribedByMe,
  };
}

function mapPlaylist(playlist: ApiPlaylist): Playlist {
  return {
    id: playlist.id,
    name: playlist.name,
    kind: playlist.kind,
    videoCount: playlist.videoCount,
    videos: playlist.videos.map(mapVideo),
    createdAt: formatDate(playlist.createdAt),
    updatedAt: formatDate(playlist.updatedAt),
  };
}

function mapComment(videoId: string, comment: ApiComment): Comment {
  return {
    id: comment.id,
    videoId,
    parentId: comment.parentId,
    authorId: comment.author.id,
    author: comment.author.displayName,
    avatarUrl: comment.author.avatarUrl ?? "",
    body: comment.body,
    postedAt: formatDate(comment.createdAt),
    likes: comment.likeCount,
    likedByMe: Boolean(comment.likedByMe),
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
