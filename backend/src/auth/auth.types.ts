export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt?: string;
  channelId?: string;
};
