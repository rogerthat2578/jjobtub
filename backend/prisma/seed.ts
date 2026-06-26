import { PrismaClient, VideoStatus, VideoVisibility } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.comment.deleteMany();
  await prisma.videoFile.deleteMany();
  await prisma.video.deleteMany();
  await prisma.channel.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      email: 'creator@jjobtub.local',
      passwordHash:
        'scrypt:test-salt:39b6436a81d9f2258eef8c7f0a2e04327027806dc2cbdbae6be3ae72b6207a1961c9b8048985535cbea36326279cbbfc7ad042fe2e036d51c13230dac2d0eb13',
      displayName: '프론트엔드 연구소',
      avatarUrl:
        'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=256&q=80',
    },
  });

  const channel = await prisma.channel.create({
    data: {
      ownerId: user.id,
      name: '프론트엔드 연구소',
      description: 'React, TypeScript, UI engineering videos.',
      avatarUrl: user.avatarUrl,
      bannerUrl:
        'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80',
      subscriberCount: 128000,
    },
  });

  const video = await prisma.video.create({
    data: {
      channelId: channel.id,
      title: 'React로 영상 플랫폼 만들기',
      description: 'jjobtub MVP를 만들며 라우팅, 카드 그리드, 상세 페이지를 구성합니다.',
      category: '개발',
      visibility: VideoVisibility.PUBLIC,
      status: VideoStatus.READY,
      durationSeconds: 1104,
      viewCount: 380000,
      likeCount: 14000,
      publishedAt: new Date('2026-06-24T10:00:00.000Z'),
      comments: {
        create: [
          {
            authorId: user.id,
            body: '백엔드 연결까지 되면 진짜 서비스처럼 느껴질 것 같아요.',
            likeCount: 42,
          },
        ],
      },
    },
  });

  await prisma.video.create({
    data: {
      channelId: channel.id,
      title: 'HTTP Range 스트리밍 이해하기',
      description: 'MP4 파일을 브라우저 video 태그에서 탐색 가능하게 제공하는 방식을 설명합니다.',
      category: '개발',
      visibility: VideoVisibility.PUBLIC,
      status: VideoStatus.READY,
      durationSeconds: 840,
      viewCount: 92000,
      likeCount: 5100,
      publishedAt: new Date('2026-06-25T12:00:00.000Z'),
    },
  });

  console.log(`Seeded channel ${channel.id} and video ${video.id}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
