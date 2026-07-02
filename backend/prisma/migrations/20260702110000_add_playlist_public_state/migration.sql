ALTER TABLE "Playlist" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Playlist" SET "isPublic" = false WHERE "kind" = 'LIKED';
