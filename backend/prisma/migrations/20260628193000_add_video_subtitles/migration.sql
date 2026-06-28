CREATE TABLE "VideoSubtitle" (
  "id" TEXT NOT NULL,
  "videoId" TEXT NOT NULL,
  "language" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "storagePath" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "VideoSubtitle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VideoSubtitle_videoId_idx" ON "VideoSubtitle"("videoId");
CREATE UNIQUE INDEX "VideoSubtitle_videoId_language_key" ON "VideoSubtitle"("videoId", "language");

ALTER TABLE "VideoSubtitle" ADD CONSTRAINT "VideoSubtitle_videoId_fkey"
  FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;
