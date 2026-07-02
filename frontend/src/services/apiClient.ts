import type { Channel } from "../types/channel";
import type { Comment } from "../types/comment";
import type { AppNotification } from "../types/notification";
import type { Playlist } from "../types/playlist";
import type { User } from "../types/user";
import type { Video } from "../types/video";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";
const DEFAULT_AVATAR_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' fill='%23e7e5e4'/%3E%3Ccircle cx='80' cy='62' r='30' fill='%2378706a'/%3E%3Cpath d='M32 142c7-30 27-46 48-46s41 16 48 46' fill='%2378706a'/%3E%3C/svg%3E";

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
  bannerMobilePosition?: "left" | "center" | "right";
  subscriberCount?: number;
  videoCount?: number;
  createdAt?: string;
  subscribedByMe?: boolean;
  featuredVideoId?: string | null;
  featuredPlaylistId?: string | null;
  homeSectionOrder?: string[];
};

type ApiVideoListItem = {
  id: string;
  title: string;
  thumbnailUrl: string;
  previewUrl?: string | null;
  channel: ApiChannel;
  views: number;
  source?: "LOCAL" | "YOUTUBE";
  uploadedAt: string;
  durationSeconds: number;
  category: string;
  tags?: string[];
  visibility?: string;
  status?: string;
  availableQualities?: number[];
  subtitles?: Array<{ id: string; language: string; label: string; src: string }>;
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
  description?: string;
  isPublic?: boolean;
  kind: "LIKED" | "CUSTOM";
  videoCount: number;
  videos: ApiVideoListItem[];
  createdAt: string;
  updatedAt: string;
};

type ApiPageInfo = {
  page: number;
  limit: number;
  total: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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

type ApiNotification = {
  id: string;
  type: AppNotification["type"];
  message: string;
  linkUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
};

type ApiNotificationPageInfo = {
  page: number;
  limit: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
};

type ApiNotificationArchivePolicy = {
  retentionDays: number | null;
  deletion: "manual";
  maxPageSize: number;
};

type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  createdAt?: string;
  channelId?: string;
};

export type VideoListResult = {
  videos: Video[];
  channelsById: Record<string, Channel>;
};

export type SearchResult = {
  videos: Video[];
  channels: Channel[];
  playlists: Playlist[];
  channelsById: Record<string, Channel>;
  pageInfo?: {
    videos: ApiPageInfo;
    channels: ApiPageInfo;
    playlists: ApiPageInfo;
  };
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

export async function fetchSearchResults(params: { q?: string; sort?: string; type?: string; page?: string; limit?: string } = {}): Promise<SearchResult> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const data = await request<{
    videos: ApiVideoListItem[];
    channels: ApiChannel[];
    playlists: ApiPlaylist[];
    pageInfo?: SearchResult["pageInfo"];
  }>(
    `/search${toQuery(searchParams)}`,
  );
  const videoResult = mapVideoList(data.videos);
  return {
    ...videoResult,
    channels: data.channels.map(mapChannel),
    playlists: data.playlists.map(mapPlaylist),
    pageInfo: data.pageInfo,
  };
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

export async function updatePlaylist(
  playlistId: string,
  input: { name?: string; description?: string; isPublic?: boolean },
) {
  const data = await request<ApiPlaylist>(`/playlists/${playlistId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return mapPlaylist(data);
}

export async function deletePlaylist(playlistId: string) {
  return request<{ deleted: boolean }>(`/playlists/${playlistId}`, { method: "DELETE" });
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

export async function fetchPlaylistVideos(playlistId: string, order?: string) {
  const searchParams = new URLSearchParams();
  if (order) {
    searchParams.set("order", order);
  }
  const data = await request<{ playlist: ApiPlaylist; items: ApiVideoListItem[] }>(
    `/playlists/${playlistId}/videos${toQuery(searchParams)}`,
  );
  return {
    playlist: mapPlaylist(data.playlist),
    ...mapVideoList(data.items),
  };
}

export async function reorderPlaylistItems(playlistId: string, videoIds: string[]) {
  return request<{ saved: boolean }>(`/playlists/${playlistId}/items/reorder`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoIds }),
  });
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

export async function fetchChannelPlaylists(id: string) {
  const data = await request<{ items: ApiPlaylist[] }>(`/channels/${id}/playlists`);
  return data.items.map(mapPlaylist);
}

export async function uploadChannelAsset(channelId: string, kind: "avatar" | "banner", file: File) {
  const channel = await uploadFileWithProgress<ApiChannel>(`/channels/${channelId}/assets/${kind}`, file);
  return mapChannel(channel);
}

export async function updateChannelHome(
  channelId: string,
  input: { featuredVideoId?: string | null; featuredPlaylistId?: string | null; homeSectionOrder?: string[] },
) {
  return mapChannel(
    await request<ApiChannel>(`/channels/${channelId}/home`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function fetchComments(videoId: string, sort?: string) {
  const searchParams = new URLSearchParams();
  if (sort) {
    searchParams.set("sort", sort);
  }
  const data = await request<{ items: ApiComment[] }>(`/videos/${videoId}/comments${toQuery(searchParams)}`);
  return data.items.map((comment) => mapComment(videoId, comment));
}

export async function createComment(videoId: string, body: string, parentId?: string) {
  const comment = await request<ApiComment>(`/videos/${videoId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body, parentId }),
  });
  notifyNotificationsRefresh();
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
  const result = await request<{ liked: boolean; likes: number }>(`/comments/${commentId}/like`, { method: "POST" });
  notifyNotificationsRefresh();
  return result;
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

export async function updateCurrentUser(input: { displayName?: string; avatarUrl?: string }) {
  const data = await request<{ user: ApiUser }>("/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return mapUser(data.user);
}

export async function changePassword(input: { currentPassword: string; newPassword: string }) {
  await request<{ ok: boolean }>("/auth/password", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function logout() {
  await request<{ ok: boolean }>("/auth/logout", { method: "POST" });
}

export async function fetchNotifications(options: { page?: number; limit?: number; filter?: string } = {}) {
  const params = new URLSearchParams();
  if (options.page) {
    params.set("page", String(options.page));
  }
  if (options.limit) {
    params.set("limit", String(options.limit));
  }
  if (options.filter && options.filter !== "all") {
    params.set("filter", options.filter);
  }
  const query = params.toString();
  const data = await request<{
    unreadCount: number;
    totalCount: number;
    pageInfo: ApiNotificationPageInfo;
    archivePolicy: ApiNotificationArchivePolicy;
    items: ApiNotification[];
  }>(`/notifications${query ? `?${query}` : ""}`);
  return {
    unreadCount: data.unreadCount,
    totalCount: data.totalCount,
    pageInfo: data.pageInfo,
    archivePolicy: data.archivePolicy,
    items: data.items.map(mapNotification),
  };
}

export function notificationStreamUrl() {
  return `${API_BASE_URL}/notifications/stream`;
}

export async function markNotificationRead(id: string) {
  await request<{ ok: boolean }>(`/notifications/${id}/read`, { method: "PATCH" });
}

export async function markAllNotificationsRead() {
  await request<{ ok: boolean }>("/notifications/read-all", { method: "PATCH" });
}

export async function deleteNotification(id: string) {
  await request<{ ok: boolean }>(`/notifications/${id}`, { method: "DELETE" });
}

export async function deleteAllNotifications() {
  await request<{ ok: boolean }>("/notifications", { method: "DELETE" });
}

export async function createVideo(input: {
  title: string;
  description: string;
  category: string;
  channelId: string;
  source?: "LOCAL" | "YOUTUBE";
  externalUrl?: string;
  tags?: string[];
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

export async function uploadVideoSubtitle(videoId: string, file: File, input: { language: string; label: string }) {
  const form = new FormData();
  form.append("file", file);
  form.append("language", input.language);
  form.append("label", input.label);
  return request<{ id: string; language: string; label: string; src: string }>(`/videos/${videoId}/subtitles`, {
    method: "POST",
    body: form,
  });
}

export async function reprocessVideoQualities(videoId: string) {
  return request<{ videoId: string; status: string; availableQualities: number[] }>(`/videos/${videoId}/process/qualities`, {
    method: "POST",
  });
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
      if (xhr.status === 401) {
        window.dispatchEvent(new CustomEvent("jjobtub:unauthorized"));
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
  const result = await request<{ liked: boolean; likes: number }>(`/videos/${videoId}/like`, { method: "POST" });
  notifyNotificationsRefresh();
  return result;
}

export async function toggleChannelSubscription(channelId: string) {
  const result = await request<{ subscribed: boolean; subscribers: number }>(`/channels/${channelId}/subscribe`, { method: "POST" });
  notifyNotificationsRefresh();
  return result;
}

export async function updateChannel(
  channelId: string,
  input: { name?: string; description?: string; avatarUrl?: string; bannerUrl?: string; bannerMobilePosition?: "left" | "center" | "right" },
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
  input: { title: string; description: string; category: string; visibility?: string; tags?: string[] },
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
    const message = await readErrorMessage(response);
    if (response.status === 401 && path !== "/auth/me" && path !== "/auth/login") {
      window.dispatchEvent(new CustomEvent("jjobtub:unauthorized"));
    }
    throw new ApiRequestError(message, response.status);
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
    previewUrl: item.previewUrl ? absoluteApiUrl(item.previewUrl) : undefined,
    videoUrl: "streamUrl" in item ? absoluteApiUrl(item.streamUrl) : streamUrl(item.id),
    embedUrl: "embedUrl" in item ? item.embedUrl ?? undefined : undefined,
    source: item.source,
    channelId: item.channel.id,
    views: `${item.views.toLocaleString()}회`,
    uploadedAt: formatDate(item.uploadedAt),
    duration: formatDuration(item.durationSeconds),
    category: item.category,
    tags: item.tags ?? [],
    likes: "likeCount" in item ? item.likeCount.toLocaleString() : "0",
    likesCount: "likeCount" in item ? item.likeCount : undefined,
    likedByMe: "likedByMe" in item ? item.likedByMe : undefined,
    viewsCount: item.views,
    visibility: "visibility" in item ? item.visibility : undefined,
    status: "status" in item ? item.status : undefined,
    availableQualities: "availableQualities" in item ? item.availableQualities ?? [] : [],
    subtitles:
      "subtitles" in item
        ? (item.subtitles ?? []).map((subtitle) => ({ ...subtitle, src: absoluteApiUrl(subtitle.src) }))
        : [],
  };
}

function mapChannel(channel: ApiChannel): Channel {
  return {
    id: channel.id,
    name: channel.name,
    handle: `@${channel.name}`,
    avatarUrl: channel.avatarUrl ? absoluteApiUrl(channel.avatarUrl) : DEFAULT_AVATAR_URL,
    bannerUrl: channel.bannerUrl ? absoluteApiUrl(channel.bannerUrl) : "",
    bannerMobilePosition: channel.bannerMobilePosition ?? "center",
    subscribers: (channel.subscriberCount ?? 0).toLocaleString(),
    subscribersCount: channel.subscriberCount,
    videoCount: channel.videoCount,
    joinedAt: channel.createdAt ? formatDate(channel.createdAt) : undefined,
    description: channel.description ?? "",
    subscribedByMe: channel.subscribedByMe,
    featuredVideoId: channel.featuredVideoId,
    featuredPlaylistId: channel.featuredPlaylistId,
    homeSectionOrder: channel.homeSectionOrder,
  };
}

function mapNotification(notification: ApiNotification): AppNotification {
  return {
    id: notification.id,
    type: notification.type,
    message: notification.message,
    linkUrl: notification.linkUrl ?? undefined,
    readAt: notification.readAt,
    createdAt: formatDate(notification.createdAt),
  };
}

function mapPlaylist(playlist: ApiPlaylist): Playlist {
  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description ?? "",
    isPublic: playlist.isPublic ?? (playlist.kind === "CUSTOM"),
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
    avatarUrl: comment.author.avatarUrl ? absoluteApiUrl(comment.author.avatarUrl) : DEFAULT_AVATAR_URL,
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
    createdAt: user.createdAt,
    channelId: user.channelId,
  };
}

function absoluteApiUrl(pathOrUrl: string) {
  if (pathOrUrl.startsWith("http") || pathOrUrl.startsWith("data:")) {
    return pathOrUrl;
  }
  return `${API_BASE_URL}${pathOrUrl.replace(/^\/api/, "")}`;
}

function toQuery(searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function notifyNotificationsRefresh() {
  window.dispatchEvent(new CustomEvent("jjobtub:notifications-refresh"));
  try {
    const message = { at: Date.now() };
    const channel = new BroadcastChannel("jjobtub:notifications");
    channel.postMessage(message);
    channel.close();
    localStorage.setItem("jjobtub:notifications-refresh", String(message.at));
  } catch {
    // Cross-tab refresh is best effort only.
  }
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium" }).format(new Date(value));
}
