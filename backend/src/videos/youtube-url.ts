import { BadRequestException } from '@nestjs/common';

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new BadRequestException('Invalid YouTube URL');
  }

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  let videoId = '';

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (url.pathname === '/watch') {
      videoId = url.searchParams.get('v') ?? '';
    } else if (url.pathname.startsWith('/embed/') || url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/')[2] ?? '';
    }
  }

  if (host === 'youtu.be') {
    videoId = url.pathname.split('/').filter(Boolean)[0] ?? '';
  }

  if (!YOUTUBE_ID_PATTERN.test(videoId)) {
    throw new BadRequestException('Invalid YouTube URL');
  }

  return videoId;
}
