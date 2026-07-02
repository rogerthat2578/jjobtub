import type { Video } from "./video";

export type PlaylistKind = "LIKED" | "CUSTOM";

export type Playlist = {
  id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  kind: PlaylistKind;
  videoCount: number;
  videos: Video[];
  createdAt: string;
  updatedAt: string;
};
