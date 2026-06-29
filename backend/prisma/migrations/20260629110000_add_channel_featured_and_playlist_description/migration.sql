ALTER TABLE "Channel" ADD COLUMN "featuredVideoId" TEXT;
ALTER TABLE "Channel" ADD COLUMN "featuredPlaylistId" TEXT;
ALTER TABLE "Channel" ADD COLUMN "homeSectionOrder" TEXT[] NOT NULL DEFAULT ARRAY['featured', 'videos', 'playlists']::TEXT[];

ALTER TABLE "Playlist" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';
