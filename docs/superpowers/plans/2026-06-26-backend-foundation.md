# jjobtub Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working backend slice for jjobtub: NestJS API scaffold, PostgreSQL/Prisma schema, seed data, and read-only video/channel/comment endpoints.

**Architecture:** Move the existing Vite frontend into `frontend/` and add the NestJS API in sibling `backend/`. The API uses NestJS modules for videos, channels, comments, and Prisma database access, with response DTO mappers that match the current frontend mock-data shape closely enough for later integration.

**Tech Stack:** Node.js, TypeScript, NestJS, Prisma, PostgreSQL, Jest/Supertest.

---

## File Structure

- Create `backend/package.json`: backend-local scripts and dependencies.
- Create `backend/tsconfig.json`: TypeScript build settings for NestJS.
- Create `backend/tsconfig.build.json`: production build excludes tests.
- Create `backend/nest-cli.json`: NestJS compiler entry.
- Create `backend/.env.example`: documented local API environment values.
- Create `backend/src/main.ts`: bootstrap Nest app with `/api` global prefix and CORS.
- Create `backend/src/app.module.ts`: root module composition.
- Create `backend/src/prisma/prisma.module.ts`: exports Prisma service.
- Create `backend/src/prisma/prisma.service.ts`: Prisma lifecycle service.
- Create `backend/src/videos/videos.module.ts`: videos module wiring.
- Create `backend/src/videos/videos.service.ts`: video query and create logic.
- Create `backend/src/videos/videos.controller.ts`: `/api/videos` routes.
- Create `backend/src/videos/dto/create-video.dto.ts`: request body type and validation decorators.
- Create `backend/src/videos/video-response.ts`: response mappers for list/detail payloads.
- Create `backend/src/channels/channels.module.ts`: channels module wiring.
- Create `backend/src/channels/channels.service.ts`: channel query logic.
- Create `backend/src/channels/channels.controller.ts`: `/api/channels` routes.
- Create `backend/src/comments/comments.module.ts`: comments module wiring.
- Create `backend/src/comments/comments.service.ts`: comment query/create logic.
- Create `backend/src/comments/comments.controller.ts`: `/api/videos/:id/comments` routes.
- Create `backend/src/comments/dto/create-comment.dto.ts`: request body type and validation decorators.
- Create `backend/prisma/schema.prisma`: initial relational schema.
- Create `backend/prisma/seed.ts`: seed user, channel, videos, and comments.
- Create `backend/test/videos.e2e-spec.ts`: endpoint-level tests for video list/detail/create.
- Create `backend/test/channels.e2e-spec.ts`: endpoint-level tests for channel detail/videos.
- Create `backend/test/comments.e2e-spec.ts`: endpoint-level tests for comments list/create.
- Create root `package.json`: add scripts that delegate to `frontend` and `backend`.
- Modify `.gitignore`: ignore API build output and local env files.

---

### Task 1: Backend Package Scaffold

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/tsconfig.build.json`
- Create: `backend/nest-cli.json`
- Create: `backend/.env.example`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add backend package files**

Create `backend/package.json`:

```json
{
  "name": "jjobtub-api",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "test": "jest",
    "test:e2e": "jest --config ./test/jest-e2e.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "prisma db seed"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@prisma/client": "^6.0.0",
    "class-transformer": "^0.5.1",
    "class-validator": "^0.14.1",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^30.0.0",
    "@types/node": "^24.0.0",
    "@types/supertest": "^6.0.0",
    "jest": "^30.0.0",
    "prisma": "^6.0.0",
    "source-map-support": "^0.5.21",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.0",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.0"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  }
}
```

Create `backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "strict": true,
    "skipLibCheck": true,
    "types": ["node", "jest"]
  }
}
```

Create `backend/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*spec.ts"]
}
```

Create `backend/nest-cli.json`:

```json
{
  "collection": "@nestjs/schematics",
  "sourceRoot": "src"
}
```

Create `backend/.env.example`:

```text
DATABASE_URL="postgresql://postgres:password@localhost:5432/jjobtub_dev?schema=public"
API_PORT=4000
STORAGE_ROOT="./storage"
MAX_UPLOAD_BYTES=524288000
```

- [ ] **Step 2: Add root scripts**

Create root `package.json` with workspace scripts:

```json
{
  "frontend:dev": "npm --prefix frontend run dev",`n  "frontend:build": "npm --prefix frontend run build",`n  "frontend:preview": "npm --prefix frontend run preview",`n  "backend:dev": "npm --prefix backend run dev",`n  "backend:build": "npm --prefix backend run build",`n  "backend:test": "npm --prefix backend run test",`n  "backend:test:e2e": "npm --prefix backend run test:e2e",`n  "backend:prisma:generate": "npm --prefix backend run prisma:generate",`n  "backend:prisma:migrate": "npm --prefix backend run prisma:migrate",`n  "backend:prisma:seed": "npm --prefix backend run prisma:seed"
}
```

- [ ] **Step 3: Ignore backend local output**

Append to `.gitignore`:

```text
backend/dist/
backend/.env
backend/storage/
```

- [ ] **Step 4: Install backend dependencies**

Run:

```powershell
npm install --prefix backend
```

Expected: `backend/package-lock.json` is created and npm exits with code `0`.

- [ ] **Step 5: Commit scaffold**

Run:

```powershell
git add package.json .gitignore backend/package.json backend/package-lock.json backend/tsconfig.json backend/tsconfig.build.json backend/nest-cli.json backend/.env.example
git commit -m "chore: scaffold backend package"
```

Expected: commit succeeds with the scaffold files.

---

### Task 2: Prisma Schema And Seed

**Files:**
- Create: `backend/prisma/schema.prisma`
- Create: `backend/prisma/seed.ts`

- [ ] **Step 1: Write the Prisma schema**

Create `backend/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum VideoVisibility {
  PUBLIC
  UNLISTED
  PRIVATE
}

enum VideoStatus {
  DRAFT
  READY
  PROCESSING
  FAILED
}

enum VideoFileKind {
  ORIGINAL
  THUMBNAIL
  HLS_MASTER
  HLS_VARIANT
}

model User {
  id          String    @id @default(cuid())
  email       String    @unique
  displayName String
  avatarUrl   String?
  channels    Channel[]
  comments    Comment[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
}

model Channel {
  id              String         @id @default(cuid())
  ownerId         String
  owner           User           @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  name            String
  description     String
  avatarUrl       String?
  bannerUrl       String?
  subscriberCount Int            @default(0)
  videos          Video[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model Video {
  id              String          @id @default(cuid())
  channelId       String
  channel         Channel         @relation(fields: [channelId], references: [id], onDelete: Cascade)
  title           String
  description     String
  category        String
  visibility      VideoVisibility @default(PUBLIC)
  status          VideoStatus     @default(DRAFT)
  durationSeconds Int             @default(0)
  viewCount       Int             @default(0)
  likeCount       Int             @default(0)
  publishedAt     DateTime?
  files           VideoFile[]
  comments        Comment[]
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}

model VideoFile {
  id          String        @id @default(cuid())
  videoId     String
  video       Video         @relation(fields: [videoId], references: [id], onDelete: Cascade)
  kind        VideoFileKind
  storagePath String
  mimeType    String
  sizeBytes   BigInt
  width       Int?
  height      Int?
  createdAt   DateTime      @default(now())

  @@index([videoId, kind])
}

model Comment {
  id        String   @id @default(cuid())
  videoId   String
  video     Video    @relation(fields: [videoId], references: [id], onDelete: Cascade)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  body      String
  likeCount Int      @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 2: Write seed data**

Create `backend/prisma/seed.ts`:

```ts
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
      displayName: '?꾨줎?몄뿏???곌뎄??,
      avatarUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=256&q=80',
    },
  });

  const channel = await prisma.channel.create({
    data: {
      ownerId: user.id,
      name: '?꾨줎?몄뿏???곌뎄??,
      description: 'React, TypeScript, UI engineering videos.',
      avatarUrl: user.avatarUrl,
      bannerUrl: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80',
      subscriberCount: 128000,
    },
  });

  const video = await prisma.video.create({
    data: {
      channelId: channel.id,
      title: 'React濡??곸긽 ?뚮옯??留뚮뱾湲?,
      description: 'jjobtub MVP瑜?留뚮뱾硫??쇱슦?? 移대뱶 洹몃━?? ?곸꽭 ?섏씠吏瑜?援ъ꽦?⑸땲??',
      category: '媛쒕컻',
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
            body: '諛깆뿏???곌껐源뚯? ?섎㈃ 吏꾩쭨 ?쒕퉬?ㅼ쿂???먭뺨吏?寃?媛숈븘??',
            likeCount: 42,
          },
        ],
      },
    },
  });

  await prisma.video.create({
    data: {
      channelId: channel.id,
      title: 'HTTP Range ?ㅽ듃由щ컢 ?댄빐?섍린',
      description: 'MP4 ?뚯씪??釉뚮씪?곗? video ?쒓렇?먯꽌 ?먯깋 媛?ν븯寃??쒓났?섎뒗 諛⑹떇???ㅻ챸?⑸땲??',
      category: '媛쒕컻',
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
```

- [ ] **Step 3: Generate Prisma client**

Run:

```powershell
npm --prefix backend run prisma:generate
```

Expected: Prisma client generation exits with code `0`.

- [ ] **Step 4: Create local database migration**

Run after local PostgreSQL database `jjobtub_dev` exists:

```powershell
npm --prefix backend run prisma:migrate -- --name init
```

Expected: migration folder appears under `backend/prisma/migrations` and command exits with code `0`.

- [ ] **Step 5: Seed the database**

Run:

```powershell
npm --prefix backend run prisma:seed
```

Expected: terminal prints `Seeded channel ... and video ...`.

- [ ] **Step 6: Commit schema and seed**

Run:

```powershell
git add backend/prisma/schema.prisma backend/prisma/seed.ts backend/prisma/migrations
git commit -m "feat: add backend database schema"
```

Expected: commit succeeds with schema, seed, and migration files.

---

### Task 3: NestJS App And Prisma Module

**Files:**
- Create: `backend/src/main.ts`
- Create: `backend/src/app.module.ts`
- Create: `backend/src/prisma/prisma.module.ts`
- Create: `backend/src/prisma/prisma.service.ts`

- [ ] **Step 1: Write the app bootstrap**

Create `backend/src/main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = config.get<number>('API_PORT') ?? 4000;
  await app.listen(port, '127.0.0.1');
}

bootstrap();
```

- [ ] **Step 2: Write the root module**

Create `backend/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChannelsModule } from './channels/channels.module';
import { CommentsModule } from './comments/comments.module';
import { PrismaModule } from './prisma/prisma.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    VideosModule,
    ChannelsModule,
    CommentsModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Write Prisma service**

Create `backend/src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

Create `backend/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 4: Build to catch TypeScript errors**

Run:

```powershell
npm --prefix backend run build
```

Expected: build exits with code `0`.

- [ ] **Step 5: Commit app shell**

Run:

```powershell
git add backend/src/main.ts backend/src/app.module.ts backend/src/prisma
git commit -m "feat: add api application shell"
```

Expected: commit succeeds with NestJS bootstrap and Prisma module.

---

### Task 4: Video Metadata API

**Files:**
- Create: `backend/src/videos/videos.module.ts`
- Create: `backend/src/videos/videos.service.ts`
- Create: `backend/src/videos/videos.controller.ts`
- Create: `backend/src/videos/dto/create-video.dto.ts`
- Create: `backend/src/videos/video-response.ts`
- Create: `backend/test/jest-e2e.json`
- Create: `backend/test/videos.e2e-spec.ts`

- [ ] **Step 1: Write failing e2e tests**

Create `backend/test/jest-e2e.json`:

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.(t|j)s$": "ts-jest"
  }
}
```

Create `backend/test/videos.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Videos API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let channelId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.comment.deleteMany();
    await prisma.videoFile.deleteMany();
    await prisma.video.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { email: 'test@jjobtub.local', displayName: 'Test Creator' },
    });
    const channel = await prisma.channel.create({
      data: {
        ownerId: user.id,
        name: 'Test Channel',
        description: 'Testing channel',
        subscriberCount: 10,
      },
    });
    channelId = channel.id;
    await prisma.video.create({
      data: {
        channelId,
        title: 'First Video',
        description: 'The first test video',
        category: '媛쒕컻',
        status: 'READY',
        durationSeconds: 123,
        viewCount: 7,
        publishedAt: new Date('2026-06-26T00:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists videos', async () => {
    const response = await request(app.getHttpServer()).get('/api/videos').expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      title: 'First Video',
      category: '媛쒕컻',
      views: 7,
      channel: { id: channelId, name: 'Test Channel' },
    });
    expect(response.body.items[0].thumbnailUrl).toContain('/api/videos/');
    expect(response.body.nextCursor).toBeNull();
  });

  it('returns video details', async () => {
    const listResponse = await request(app.getHttpServer()).get('/api/videos');
    const videoId = listResponse.body.items[0].id;

    const response = await request(app.getHttpServer()).get(`/api/videos/${videoId}`).expect(200);

    expect(response.body).toMatchObject({
      id: videoId,
      title: 'First Video',
      streamUrl: `/api/videos/${videoId}/stream`,
      channel: { id: channelId, name: 'Test Channel' },
    });
  });

  it('creates a draft video', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/videos')
      .send({
        title: 'New Draft',
        description: 'Draft description',
        category: '?뚯븙',
        channelId,
        visibility: 'PUBLIC',
      })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      status: 'DRAFT',
    });
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```powershell
npm --prefix backend run test:e2e -- --runInBand test/videos.e2e-spec.ts
```

Expected: FAIL because `VideosModule` and routes do not exist yet.

- [ ] **Step 3: Implement video DTO and response mappers**

Create `backend/src/videos/dto/create-video.dto.ts`:

```ts
import { VideoVisibility } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  category!: string;

  @IsEnum(VideoVisibility)
  visibility!: VideoVisibility;

  @IsString()
  @IsNotEmpty()
  channelId!: string;
}
```

Create `backend/src/videos/video-response.ts`:

```ts
import { Channel, Video } from '@prisma/client';

type VideoWithChannel = Video & { channel: Channel };

export function toVideoListItem(video: VideoWithChannel) {
  return {
    id: video.id,
    title: video.title,
    thumbnailUrl: `/api/videos/${video.id}/thumbnail`,
    channel: {
      id: video.channel.id,
      name: video.channel.name,
      avatarUrl: video.channel.avatarUrl,
    },
    views: video.viewCount,
    uploadedAt: (video.publishedAt ?? video.createdAt).toISOString(),
    durationSeconds: video.durationSeconds,
    category: video.category,
  };
}

export function toVideoDetail(video: VideoWithChannel) {
  return {
    ...toVideoListItem(video),
    description: video.description,
    visibility: video.visibility,
    status: video.status,
    likeCount: video.likeCount,
    streamUrl: `/api/videos/${video.id}/stream`,
    channel: {
      id: video.channel.id,
      name: video.channel.name,
      description: video.channel.description,
      avatarUrl: video.channel.avatarUrl,
      bannerUrl: video.channel.bannerUrl,
      subscriberCount: video.channel.subscriberCount,
    },
  };
}
```

- [ ] **Step 4: Implement video service and controller**

Create `backend/src/videos/videos.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { VideoStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVideoDto } from './dto/create-video.dto';
import { toVideoDetail, toVideoListItem } from './video-response';

@Injectable()
export class VideosService {
  constructor(private readonly prisma: PrismaService) {}

  async listVideos(query: { q?: string; category?: string; channelId?: string; limit?: number }) {
    const limit = Math.min(Math.max(query.limit ?? 24, 1), 50);
    const videos = await this.prisma.video.findMany({
      where: {
        status: VideoStatus.READY,
        visibility: 'PUBLIC',
        category: query.category,
        channelId: query.channelId,
        title: query.q ? { contains: query.q, mode: 'insensitive' } : undefined,
      },
      include: { channel: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    return {
      items: videos.map(toVideoListItem),
      nextCursor: null,
    };
  }

  async getVideo(id: string) {
    const video = await this.prisma.video.findUnique({
      where: { id },
      include: { channel: true },
    });

    if (!video) {
      throw new NotFoundException('Video not found');
    }

    return toVideoDetail(video);
  }

  async createVideo(dto: CreateVideoDto) {
    const channel = await this.prisma.channel.findUnique({ where: { id: dto.channelId } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const video = await this.prisma.video.create({
      data: {
        channelId: dto.channelId,
        title: dto.title,
        description: dto.description,
        category: dto.category,
        visibility: dto.visibility,
        status: 'DRAFT',
      },
    });

    return {
      id: video.id,
      status: video.status,
    };
  }
}
```

Create `backend/src/videos/videos.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CreateVideoDto } from './dto/create-video.dto';
import { VideosService } from './videos.service';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  listVideos(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.videosService.listVideos({
      q,
      category,
      channelId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  getVideo(@Param('id') id: string) {
    return this.videosService.getVideo(id);
  }

  @Post()
  createVideo(@Body() dto: CreateVideoDto) {
    return this.videosService.createVideo(dto);
  }
}
```

Create `backend/src/videos/videos.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
```

- [ ] **Step 5: Run video e2e tests**

Run:

```powershell
npm --prefix backend run test:e2e -- --runInBand test/videos.e2e-spec.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 6: Commit video API**

Run:

```powershell
git add backend/src/videos backend/test/jest-e2e.json backend/test/videos.e2e-spec.ts
git commit -m "feat: add video metadata api"
```

Expected: commit succeeds with video API files.

---

### Task 5: Channels And Comments APIs

**Files:**
- Create: `backend/src/channels/channels.module.ts`
- Create: `backend/src/channels/channels.service.ts`
- Create: `backend/src/channels/channels.controller.ts`
- Create: `backend/src/comments/comments.module.ts`
- Create: `backend/src/comments/comments.service.ts`
- Create: `backend/src/comments/comments.controller.ts`
- Create: `backend/src/comments/dto/create-comment.dto.ts`
- Create: `backend/test/channels.e2e-spec.ts`
- Create: `backend/test/comments.e2e-spec.ts`

- [ ] **Step 1: Write failing channels e2e test**

Create `backend/test/channels.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Channels API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let channelId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.comment.deleteMany();
    await prisma.videoFile.deleteMany();
    await prisma.video.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { email: 'channel-test@jjobtub.local', displayName: 'Channel Owner' },
    });
    const channel = await prisma.channel.create({
      data: {
        ownerId: user.id,
        name: 'Channel API',
        description: 'Channel endpoint tests',
        subscriberCount: 22,
      },
    });
    channelId = channel.id;
    await prisma.video.create({
      data: {
        channelId,
        title: 'Channel Video',
        description: 'Visible on channel page',
        category: '媛쒕컻',
        status: 'READY',
        visibility: 'PUBLIC',
        publishedAt: new Date('2026-06-26T01:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns channel details', async () => {
    const response = await request(app.getHttpServer()).get(`/api/channels/${channelId}`).expect(200);

    expect(response.body).toMatchObject({
      id: channelId,
      name: 'Channel API',
      description: 'Channel endpoint tests',
      subscriberCount: 22,
    });
  });

  it('returns channel videos', async () => {
    const response = await request(app.getHttpServer()).get(`/api/channels/${channelId}/videos`).expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      title: 'Channel Video',
      channel: { id: channelId, name: 'Channel API' },
    });
  });
});
```

- [ ] **Step 2: Implement channels API**

Create `backend/src/channels/channels.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toVideoListItem } from '../videos/video-response';

@Injectable()
export class ChannelsService {
  constructor(private readonly prisma: PrismaService) {}

  async getChannel(id: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    return {
      id: channel.id,
      name: channel.name,
      description: channel.description,
      avatarUrl: channel.avatarUrl,
      bannerUrl: channel.bannerUrl,
      subscriberCount: channel.subscriberCount,
      createdAt: channel.createdAt.toISOString(),
    };
  }

  async getChannelVideos(id: string) {
    await this.getChannel(id);
    const videos = await this.prisma.video.findMany({
      where: { channelId: id, status: 'READY', visibility: 'PUBLIC' },
      include: { channel: true },
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return {
      items: videos.map(toVideoListItem),
      nextCursor: null,
    };
  }
}
```

Create `backend/src/channels/channels.controller.ts`:

```ts
import { Controller, Get, Param } from '@nestjs/common';
import { ChannelsService } from './channels.service';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get(':id')
  getChannel(@Param('id') id: string) {
    return this.channelsService.getChannel(id);
  }

  @Get(':id/videos')
  getChannelVideos(@Param('id') id: string) {
    return this.channelsService.getChannelVideos(id);
  }
}
```

Create `backend/src/channels/channels.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  controllers: [ChannelsController],
  providers: [ChannelsService],
})
export class ChannelsModule {}
```

- [ ] **Step 3: Write failing comments e2e test**

Create `backend/test/comments.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Comments API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let videoId: string;
  let authorId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.comment.deleteMany();
    await prisma.videoFile.deleteMany();
    await prisma.video.deleteMany();
    await prisma.channel.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: { email: 'comment-test@jjobtub.local', displayName: 'Comment Author' },
    });
    authorId = user.id;
    const channel = await prisma.channel.create({
      data: {
        ownerId: user.id,
        name: 'Comment Channel',
        description: 'Comment endpoint tests',
      },
    });
    const video = await prisma.video.create({
      data: {
        channelId: channel.id,
        title: 'Comment Video',
        description: 'Commentable video',
        category: '媛쒕컻',
        status: 'READY',
        visibility: 'PUBLIC',
      },
    });
    videoId = video.id;
    await prisma.comment.create({
      data: {
        videoId,
        authorId,
        body: 'Existing comment',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists comments for a video', async () => {
    const response = await request(app.getHttpServer()).get(`/api/videos/${videoId}/comments`).expect(200);

    expect(response.body.items).toHaveLength(1);
    expect(response.body.items[0]).toMatchObject({
      body: 'Existing comment',
      author: { id: authorId, displayName: 'Comment Author' },
    });
  });

  it('creates a comment for a video', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/videos/${videoId}/comments`)
      .send({ authorId, body: 'New comment' })
      .expect(201);

    expect(response.body).toMatchObject({
      id: expect.any(String),
      body: 'New comment',
      author: { id: authorId, displayName: 'Comment Author' },
    });
  });
});
```

- [ ] **Step 4: Implement comments API**

Create `backend/src/comments/dto/create-comment.dto.ts`:

```ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  authorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;
}
```

Create `backend/src/comments/comments.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

function toCommentResponse(comment: {
  id: string;
  body: string;
  likeCount: number;
  createdAt: Date;
  author: { id: string; displayName: string; avatarUrl: string | null };
}) {
  return {
    id: comment.id,
    body: comment.body,
    likeCount: comment.likeCount,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.author.id,
      displayName: comment.author.displayName,
      avatarUrl: comment.author.avatarUrl,
    },
  };
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listComments(videoId: string) {
    const comments = await this.prisma.comment.findMany({
      where: { videoId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      items: comments.map(toCommentResponse),
    };
  }

  async createComment(videoId: string, dto: CreateCommentDto) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const author = await this.prisma.user.findUnique({ where: { id: dto.authorId } });
    if (!author) {
      throw new NotFoundException('Author not found');
    }

    const comment = await this.prisma.comment.create({
      data: {
        videoId,
        authorId: dto.authorId,
        body: dto.body,
      },
      include: { author: true },
    });

    return toCommentResponse(comment);
  }
}
```

Create `backend/src/comments/comments.controller.ts`:

```ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('videos/:videoId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  listComments(@Param('videoId') videoId: string) {
    return this.commentsService.listComments(videoId);
  }

  @Post()
  createComment(@Param('videoId') videoId: string, @Body() dto: CreateCommentDto) {
    return this.commentsService.createComment(videoId, dto);
  }
}
```

Create `backend/src/comments/comments.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
```

- [ ] **Step 5: Run channels and comments tests**

Run:

```powershell
npm --prefix backend run test:e2e -- --runInBand test/channels.e2e-spec.ts test/comments.e2e-spec.ts
```

Expected: PASS with 4 tests.

- [ ] **Step 6: Run all backend checks**

Run:

```powershell
npm --prefix backend run build
npm --prefix backend run test:e2e -- --runInBand
```

Expected: build exits with code `0`, e2e test suite passes.

- [ ] **Step 7: Commit channels and comments APIs**

Run:

```powershell
git add backend/src/channels backend/src/comments backend/test/channels.e2e-spec.ts backend/test/comments.e2e-spec.ts
git commit -m "feat: add channel and comment APIs"
```

Expected: commit succeeds with channels and comments API files.

---

## Self-Review

- Spec coverage: This plan covers backend scaffold, PostgreSQL/Prisma schema, seed data, and metadata endpoints for videos, channels, and comments. Upload, local file storage, thumbnail serving, and HTTP Range streaming are intentionally left for the next implementation plan because they are a separate storage/streaming subsystem.
- Placeholder scan: No placeholder work items remain; each code-producing step includes concrete file contents or exact commands.
- Type consistency: The plan consistently uses Prisma `VideoStatus`, `VideoVisibility`, channel/video/comment IDs as strings, and response fields matching the existing frontend API design direction.


