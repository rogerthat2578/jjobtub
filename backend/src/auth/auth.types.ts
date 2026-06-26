export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  channelId?: string;
};
