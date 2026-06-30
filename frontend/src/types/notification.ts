export type AppNotification = {
  id: string;
  type: "COMMENT" | "REPLY" | "COMMENT_LIKE" | "VIDEO_LIKE" | "SUBSCRIPTION" | "PLAYLIST";
  message: string;
  linkUrl?: string;
  readAt?: string | null;
  createdAt: string;
};
