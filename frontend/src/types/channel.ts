export type Channel = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  bannerUrl: string;
  bannerMobilePosition?: "left" | "center" | "right";
  subscribers: string;
  subscribersCount?: number;
  videoCount?: number;
  joinedAt?: string;
  description: string;
  subscribedByMe?: boolean;
  featuredVideoId?: string | null;
  featuredPlaylistId?: string | null;
  homeSectionOrder?: string[];
};
