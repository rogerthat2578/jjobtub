export type Channel = {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string;
  bannerUrl: string;
  subscribers: string;
  subscribersCount?: number;
  description: string;
  subscribedByMe?: boolean;
};
