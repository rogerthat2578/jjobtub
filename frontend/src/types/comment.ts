export type Comment = {
  id: string;
  videoId: string;
  parentId: string | null;
  author: string;
  avatarUrl: string;
  body: string;
  postedAt: string;
  likes: number;
  replies: Comment[];
};
