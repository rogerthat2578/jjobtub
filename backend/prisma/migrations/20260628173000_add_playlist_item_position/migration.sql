ALTER TABLE "PlaylistItem" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ranked_items AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (PARTITION BY "playlistId" ORDER BY "createdAt" ASC, "id" ASC) - 1 AS "nextPosition"
  FROM "PlaylistItem"
)
UPDATE "PlaylistItem"
SET "position" = ranked_items."nextPosition"
FROM ranked_items
WHERE "PlaylistItem"."id" = ranked_items."id";

CREATE INDEX "PlaylistItem_playlistId_position_idx" ON "PlaylistItem"("playlistId", "position");
