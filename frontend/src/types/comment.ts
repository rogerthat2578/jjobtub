export type Comment = {
  id: string;
  videoId: string;
  parentId: string | null;
  authorId: string;
  author: string;
  avatarUrl: string;
  body: string;
  postedAt: string;
  likes: number;
  likedByMe: boolean;
  replies: Comment[];
};
