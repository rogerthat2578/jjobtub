CREATE TYPE "VideoSource" AS ENUM ('LOCAL', 'YOUTUBE');

ALTER TABLE "Video"
ADD COLUMN "source" "VideoSource" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN "externalUrl" TEXT,
ADD COLUMN "externalVideoId" TEXT;

CREATE INDEX "Video_source_idx" ON "Video"("source");
