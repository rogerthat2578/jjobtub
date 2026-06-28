export type AppNotification = {
  id: string;
  type: "COMMENT" | "REPLY" | "COMMENT_LIKE" | "VIDEO_LIKE" | "SUBSCRIPTION";
  message: string;
  linkUrl?: string;
  readAt?: string | null;
  createdAt: string;
};
