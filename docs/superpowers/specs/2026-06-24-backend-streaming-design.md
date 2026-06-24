# jjobtub 백엔드 및 영상 스트리밍 설계 문서

작성일: 2026-06-24
대상 프로젝트: `C:\dev\플랫폼\영상`
저장소: `rogerthat2578/jjobtub`

## 1. 목적

jjobtub의 다음 단계는 목업 데이터 기반 프론트엔드에서 실제 데이터와 실제 영상 파일을 다루는 백엔드로 확장하는 것이다. 이 설계는 PostgreSQL 기반 API 서버를 만들고, 사용자가 업로드한 MP4 파일을 브라우저에서 재생할 수 있도록 HTTP Range 기반 스트리밍을 구현하는 것을 1차 목표로 한다.

이 단계에서 유튜브 수준의 대규모 인코딩, CDN, 적응형 화질 전환까지 한 번에 구현하지 않는다. 먼저 영상 플랫폼의 핵심 원리인 "파일 업로드, 메타데이터 저장, 부분 요청 스트리밍, 프론트엔드 재생" 흐름을 직접 구현한다. 이후 FFmpeg와 HLS를 붙여 실제 서비스형 구조로 확장한다.

## 2. 최종 목표

1차 백엔드 완료 기준은 다음과 같다.

- PostgreSQL에 영상, 채널, 댓글, 파일 메타데이터를 저장한다.
- API 서버가 영상 목록, 상세 정보, 채널, 댓글 데이터를 제공한다.
- 사용자가 MP4 파일과 영상 정보를 업로드할 수 있다.
- 업로드된 원본 MP4 파일은 서버 로컬 저장소에 보관된다.
- 브라우저의 `<video>` 태그가 `/api/videos/:id/stream` 엔드포인트를 통해 영상을 재생한다.
- 영상 탐색 바를 이동할 때 서버가 HTTP Range 요청에 맞춰 파일 일부만 응답한다.
- 프론트엔드는 기존 목업 데이터 대신 API 데이터를 읽을 준비가 된다.

## 3. 기술 선택

### 3.1 백엔드 런타임

백엔드는 Node.js + NestJS로 만든다.

선택 이유:

- 현재 프론트엔드가 TypeScript 기반이므로 타입과 개발 경험을 공유하기 쉽다.
- NestJS는 컨트롤러, 서비스, 모듈 구조가 명확해 기능이 커져도 정리하기 좋다.
- 파일 업로드, 스트림 응답, 환경 설정, 테스트 구성이 안정적이다.

### 3.2 데이터베이스

PostgreSQL을 로컬에 설치해서 사용한다.

선택 이유:

- 영상, 채널, 댓글, 사용자, 파일 상태처럼 관계형 데이터가 많다.
- 이후 검색, 정렬, 공개 상태, 통계 쿼리로 확장하기 좋다.
- 로컬 개발과 실제 서버 배포 모두에서 널리 쓰인다.

### 3.3 ORM

Prisma를 사용한다.

선택 이유:

- 스키마를 읽기 쉽고 마이그레이션 흐름이 명확하다.
- TypeScript 타입이 자동 생성되어 API 코드에서 실수를 줄인다.
- 초기 학습과 유지보수 난이도가 Drizzle이나 TypeORM보다 낮다.

### 3.4 파일 저장소

1차 구현은 로컬 파일 시스템을 사용한다.

```text
storage/
  videos/
    {videoId}/
      original.mp4
      thumbnail.jpg
```

선택 이유:

- 영상 스트리밍 원리를 직접 이해하기 좋다.
- S3나 CDN 없이도 로컬 개발에서 바로 테스트할 수 있다.
- 이후 `FileStorageService` 인터페이스를 유지하면 S3 호환 스토리지로 바꾸기 쉽다.

## 4. 프로젝트 구조

현재 루트는 Vite React 앱이다. 백엔드는 같은 저장소 안에 `apps/api`로 추가한다.

```text
영상/
  apps/
    api/
      src/
        main.ts
        app.module.ts
        config/
        database/
        videos/
        channels/
        comments/
        storage/
        streaming/
      prisma/
        schema.prisma
        migrations/
      test/
  src/
    ...현재 React 앱
  storage/
    videos/
  docs/
```

처음에는 프론트엔드 위치를 바로 옮기지 않는다. 백엔드가 안정되면 `apps/web`으로 옮기는 모노레포 정리를 별도 단계로 진행한다.

## 5. 데이터 모델

### 5.1 users

초기에는 실제 로그인 없이 seed 사용자 한 명으로 시작한다. 이후 인증이 붙으면 실제 사용자 계정으로 확장한다.

```text
id
email
displayName
avatarUrl
createdAt
updatedAt
```

### 5.2 channels

```text
id
ownerId
name
description
avatarUrl
bannerUrl
subscriberCount
createdAt
updatedAt
```

### 5.3 videos

```text
id
channelId
title
description
category
visibility
status
durationSeconds
viewCount
likeCount
publishedAt
createdAt
updatedAt
```

`visibility` 값:

- `PUBLIC`
- `UNLISTED`
- `PRIVATE`

`status` 값:

- `DRAFT`
- `READY`
- `PROCESSING`
- `FAILED`

1차 구현에서는 업로드 완료 후 `READY`로 둔다. 2차 HLS 변환 단계에서 `PROCESSING` 상태가 본격적으로 사용된다.

### 5.4 video_files

```text
id
videoId
kind
storagePath
mimeType
sizeBytes
width
height
createdAt
```

`kind` 값:

- `ORIGINAL`
- `THUMBNAIL`
- `HLS_MASTER`
- `HLS_VARIANT`

1차 구현에서는 `ORIGINAL`과 선택적으로 `THUMBNAIL`만 사용한다.

### 5.5 comments

```text
id
videoId
authorId
body
likeCount
createdAt
updatedAt
```

### 5.6 subscriptions

```text
id
userId
channelId
createdAt
```

### 5.7 likes

```text
id
userId
targetType
targetId
createdAt
```

1차 구현에서는 좋아요 수를 직접 증가시키는 API만 두고, 사용자별 중복 방지는 인증 단계에서 강화한다.

## 6. API 설계

### 6.1 영상 조회

```text
GET /api/videos
```

쿼리:

- `q`: 검색어
- `category`: 카테고리
- `channelId`: 채널
- `limit`: 개수
- `cursor`: 페이지네이션 커서

응답:

```json
{
  "items": [
    {
      "id": "video-id",
      "title": "React로 영상 플랫폼 만들기",
      "thumbnailUrl": "/api/videos/video-id/thumbnail",
      "channel": {
        "id": "channel-id",
        "name": "프론트엔드 연구소",
        "avatarUrl": "/api/channels/channel-id/avatar"
      },
      "views": 380000,
      "uploadedAt": "2026-06-24T10:00:00.000Z",
      "durationSeconds": 1104,
      "category": "개발"
    }
  ],
  "nextCursor": null
}
```

### 6.2 영상 상세

```text
GET /api/videos/:id
```

응답에는 제목, 설명, 채널 정보, 통계, 스트리밍 URL, 댓글 요약을 포함한다.

### 6.3 영상 생성

```text
POST /api/videos
```

요청:

```json
{
  "title": "새 영상",
  "description": "설명",
  "category": "개발",
  "visibility": "PUBLIC",
  "channelId": "channel-id"
}
```

응답:

```json
{
  "id": "video-id",
  "status": "DRAFT"
}
```

### 6.4 원본 MP4 업로드

```text
POST /api/videos/:id/upload
Content-Type: multipart/form-data
```

필드:

- `file`: MP4 파일

처리:

1. MIME 타입이 `video/mp4`인지 확인한다.
2. 최대 파일 크기를 확인한다.
3. `storage/videos/{videoId}/original.mp4`에 저장한다.
4. `video_files`에 파일 경로, MIME 타입, 크기를 저장한다.
5. `videos.status`를 `READY`로 변경한다.

### 6.5 MP4 스트리밍

```text
GET /api/videos/:id/stream
```

브라우저 `<video>` 태그가 직접 호출한다.

서버는 요청 헤더의 `Range` 값을 읽는다.

예:

```http
Range: bytes=1000000-
```

서버 응답:

```http
HTTP/1.1 206 Partial Content
Accept-Ranges: bytes
Content-Range: bytes 1000000-1999999/9000000
Content-Length: 1000000
Content-Type: video/mp4
```

Range가 없으면 전체 파일을 반환할 수 있지만, 실제 브라우저 재생에서는 Range 요청을 기본으로 처리하는 것을 우선한다.

### 6.6 썸네일

```text
GET /api/videos/:id/thumbnail
```

1차 구현에서는 업로드 요청에서 썸네일 URL을 받거나, 기본 썸네일을 제공한다. FFmpeg로 자동 썸네일을 추출하는 것은 2차 단계로 둔다.

### 6.7 채널

```text
GET /api/channels/:id
GET /api/channels/:id/videos
```

### 6.8 댓글

```text
GET /api/videos/:id/comments
POST /api/videos/:id/comments
```

초기에는 seed 사용자 기준으로 댓글을 작성한다.

## 7. 영상 스트리밍 구현 상세

### 7.1 왜 Range 스트리밍인가

MP4 파일을 `res.sendFile()`로 통째로 보내면 영상이 커질수록 비효율적이다. 브라우저의 `<video>` 태그는 필요한 구간만 요청할 수 있어야 탐색 바 이동이 자연스럽다.

HTTP Range 기반 스트리밍은 파일을 여러 조각으로 미리 변환하지 않는다. 대신 원본 MP4 파일에서 요청된 바이트 구간만 잘라 응답한다.

### 7.2 기본 흐름

```text
브라우저 video 태그
  -> GET /api/videos/:id/stream
  -> Range: bytes=0-

NestJS StreamingController
  -> DB에서 video_files ORIGINAL 조회
  -> storagePath로 파일 크기 확인
  -> Range 헤더 파싱
  -> fs.createReadStream(filePath, { start, end })
  -> 206 Partial Content 응답
```

### 7.3 chunk 크기

서버는 요청 시작 지점부터 일정 크기만 응답한다. 1차 구현에서는 1MB 단위로 응답한다.

```text
chunkSize = 1 * 1024 * 1024
start = Range에서 읽은 시작 byte
end = min(start + chunkSize - 1, fileSize - 1)
```

이렇게 하면 큰 파일도 메모리에 한 번에 올리지 않고 스트림으로 전송한다.

### 7.4 Range 파싱 규칙

지원할 형식:

```text
bytes=0-
bytes=1000-
bytes=1000-2000
```

처리 규칙:

- 시작 byte가 없거나 숫자가 아니면 `416 Range Not Satisfiable`
- 시작 byte가 파일 크기보다 크면 `416 Range Not Satisfiable`
- 종료 byte가 없으면 `start + chunkSize - 1`
- 종료 byte가 파일 끝을 넘으면 `fileSize - 1`
- 종료 byte가 시작 byte보다 작으면 `416 Range Not Satisfiable`

### 7.5 보안과 제한

1차 구현에서 반드시 둘 제한:

- 업로드 MIME 타입은 `video/mp4`만 허용
- 파일 확장자도 `.mp4`만 허용
- 파일 크기 제한을 둔다. 로컬 개발 기본값은 500MB로 시작한다.
- 저장 경로는 서버가 생성한 videoId 디렉터리만 사용한다.
- 사용자가 제공한 파일명을 저장 경로에 직접 사용하지 않는다.

### 7.6 Range 스트리밍의 한계

이 방식은 작은 개인 프로젝트와 원리 학습에는 좋지만, 대규모 서비스에는 한계가 있다.

- 네트워크 상태에 따라 자동 화질 변경이 어렵다.
- 모바일 환경에서 최적화가 제한적이다.
- 원본 MP4가 재생 친화적으로 인코딩되어 있어야 한다.
- 서버가 직접 파일을 계속 전송하므로 트래픽 부담이 크다.

따라서 2차 단계에서 HLS로 넘어간다.

## 8. HLS 확장 설계

HLS는 원본 영상을 여러 화질과 작은 조각으로 변환해서 제공하는 방식이다.

```text
original.mp4
  -> hls/
    master.m3u8
    360p/
      index.m3u8
      segment_000.ts
      segment_001.ts
    720p/
      index.m3u8
      segment_000.ts
      segment_001.ts
```

브라우저는 `master.m3u8`을 읽고 네트워크 상태에 따라 360p, 720p 같은 화질을 선택한다.

2차 구현에 필요한 것:

- FFmpeg 설치
- 업로드 후 변환 job
- `videos.status = PROCESSING`
- 변환 성공 시 `READY`
- 변환 실패 시 `FAILED`
- HLS 정적 파일 제공 엔드포인트
- 프론트엔드에서 hls.js 사용

1차에서는 HLS를 구현하지 않고, 문서와 확장 가능한 데이터 모델만 준비한다.

## 9. PostgreSQL 설치 및 로컬 개발

PostgreSQL은 로컬 PC에 설치해서 진행한다. 개발 DB 이름은 다음으로 둔다.

```text
Database: jjobtub_dev
User: postgres 또는 jjobtub_app
```

환경 변수:

```text
DATABASE_URL="postgresql://postgres:password@localhost:5432/jjobtub_dev?schema=public"
API_PORT=4000
STORAGE_ROOT="./storage"
MAX_UPLOAD_BYTES=524288000
```

`.env`는 커밋하지 않는다. `.env.example`만 저장소에 둔다.

## 10. 프론트엔드 연동 계획

초기 프론트엔드는 목업 데이터를 사용하고 있다. 백엔드 1차 완성 후 다음 순서로 API를 연결한다.

1. `src/services/apiClient.ts` 생성
2. 홈 화면 영상 목록을 `GET /api/videos`로 대체
3. 영상 상세를 `GET /api/videos/:id`로 대체
4. `<video src>`를 `/api/videos/:id/stream`으로 연결
5. 댓글 목록을 `GET /api/videos/:id/comments`로 대체
6. 업로드 화면을 `POST /api/videos`, `POST /api/videos/:id/upload` 흐름으로 연결

React Query 도입은 API 연결이 2개 이상으로 늘어나는 시점에 진행한다.

## 11. 오류 처리

### 업로드 오류

- MP4가 아니면 `400 Bad Request`
- 파일 크기가 제한을 넘으면 `413 Payload Too Large`
- 존재하지 않는 videoId에 업로드하면 `404 Not Found`
- 저장 실패 시 `500 Internal Server Error`

### 스트리밍 오류

- 영상이 없으면 `404 Not Found`
- 원본 파일 레코드가 없으면 `404 Not Found`
- 실제 파일이 디스크에 없으면 `410 Gone`
- Range가 잘못되면 `416 Range Not Satisfiable`

### DB 오류

- Prisma 예외는 API 응답 형태로 감싼다.
- 개발 환경에서는 로그에 상세 원인을 남긴다.
- 응답에는 내부 파일 경로나 스택을 노출하지 않는다.

## 12. 테스트 계획

### 단위 테스트

- Range 헤더 파싱
- Content-Range 계산
- 업로드 파일 타입 검증
- 저장 경로 생성

### 통합 테스트

- 영상 생성 API
- MP4 업로드 API
- Range 요청 시 206 응답
- 잘못된 Range 요청 시 416 응답
- 영상 목록과 상세 조회

### 수동 테스트

- 작은 MP4 파일 업로드
- 브라우저 `<video>`에서 재생
- 탐색 바 이동
- 새로고침 후 재생
- 서버 재시작 후 기존 영상 재생

## 13. 단계별 구현 순서

### 1단계: 백엔드 프로젝트 생성

- `apps/api`에 NestJS 프로젝트 생성
- TypeScript, 테스트, 빌드 스크립트 구성
- 루트 package script에서 API 실행 가능하게 정리

### 2단계: PostgreSQL과 Prisma 연결

- PostgreSQL 설치 확인
- `jjobtub_dev` DB 생성
- Prisma schema 작성
- 첫 migration 실행
- seed 데이터 작성

### 3단계: 영상 메타데이터 API

- 채널 seed 데이터
- 영상 생성, 목록, 상세 조회 API
- 댓글 조회 API

### 4단계: 파일 업로드

- multipart 업로드
- MP4 검증
- 로컬 저장소 저장
- `video_files` 레코드 생성

### 5단계: HTTP Range 스트리밍

- Range 파서 작성
- 파일 스트림 응답 작성
- 206, 416, 404, 410 처리
- 브라우저 재생 확인

### 6단계: 프론트엔드 연결

- 홈 목록 API 연결
- 상세 페이지 API 연결
- `<video>` 스트리밍 URL 연결
- 업로드 화면 API 연결

### 7단계: HLS 확장 준비

- FFmpeg 설치 문서
- HLS 변환 job 설계
- `video_files.kind` 확장 사용
- hls.js 도입 계획 작성

## 14. 범위 밖

이번 백엔드 1차 구현에서 제외한다.

- 실제 로그인과 회원가입
- 권한별 접근 제어
- S3 업로드
- CDN
- HLS 실제 변환
- 대용량 병렬 업로드
- 라이브 스트리밍
- 추천 알고리즘
- 결제, 광고, 멤버십

## 15. 승인 기준

이 설계가 승인되면 구현 계획서는 다음 기준으로 작성한다.

- PostgreSQL 설치와 DB 생성 절차를 포함한다.
- NestJS 백엔드 생성 절차를 포함한다.
- Prisma migration과 seed 절차를 포함한다.
- MP4 업로드와 HTTP Range 스트리밍 구현을 별도 작업으로 나눈다.
- 각 작업은 테스트 우선으로 진행할 수 있게 구체적인 테스트 케이스를 포함한다.
