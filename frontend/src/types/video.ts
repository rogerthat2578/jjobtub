export type Video = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoUrl: string;
  channelId: string;
  views: string;
  uploadedAt: string;
  duration: string;
  category: string;
  likes: string;
  likesCount?: number;
  likedByMe?: boolean;
  viewsCount?: number;
  visibility?: string;
};
