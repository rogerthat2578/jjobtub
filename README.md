# jjobtub

jjobtub은 YouTube형 영상 플랫폼을 목표로 만드는 풀스택 MVP입니다. 현재는 로컬 개발 환경에서 사용자 회원가입/로그인, 영상 메타데이터 관리, MP4 업로드, YouTube 링크 임베드 등록, HTTP Range 스트리밍, 조회수 증가, 좋아요, 구독, 댓글/대댓글, 채널/영상 조회 흐름을 검증하는 단계입니다.

## 프로젝트 목표

- 영상 목록, 검색, 채널, 시청 페이지를 갖춘 기본 영상 플랫폼 UI를 만든다.
- MP4 파일을 업로드하고 브라우저 `<video>` 태그에서 스트리밍 재생한다.
- YouTube 링크는 원본을 다운로드하지 않고 iframe 임베드로 재생한다.
- 영상 재생 이벤트를 조회수 증가 API와 연결한다.
- 로그인 사용자가 영상 좋아요와 채널 구독을 토글할 수 있게 한다.
- 로그인한 채널 소유자가 자기 영상을 수정/삭제할 수 있게 한다.
- 사용자 로그인 후 댓글과 대댓글을 작성할 수 있게 한다.
- 프론트엔드와 백엔드를 분리해 각각 독립적으로 개발/빌드/테스트할 수 있게 한다.
- PostgreSQL 기반 데이터 모델을 Prisma 마이그레이션으로 관리한다.

## 큰 흐름

1. 사용자는 프론트엔드에서 영상을 탐색하거나 업로드 페이지로 이동한다.
2. 업로드 페이지에서 `파일 업로드` 또는 `YouTube 링크` 방식을 선택한다.
3. 파일 업로드는 백엔드에 영상 메타데이터를 생성한 뒤 MP4 파일을 업로드한다.
4. YouTube 링크는 백엔드에서 videoId를 검증/추출해 `READY` 영상으로 등록한다.
5. 백엔드는 로컬 파일은 storage에 저장하고, YouTube 영상은 외부 영상 ID만 저장한다.
6. 시청 페이지는 로컬 MP4는 `/stream`으로 재생하고, YouTube 영상은 iframe 임베드로 재생한다.
7. 브라우저에서 영상이 처음 재생되면 조회수 증가 API를 호출한다.
8. 로그인한 사용자는 좋아요, 구독, 댓글, 대댓글을 사용할 수 있다.
9. 영상 채널 소유자는 시청 페이지에서 영상 정보를 수정하거나 영상을 삭제할 수 있다.

## 저장소 구조

```text
.
├── frontend/          # Vite + React 프론트엔드
├── backend/           # NestJS + Prisma 백엔드 API
├── docs/              # 작업 문서
├── test_file/         # 로컬 테스트 파일, git ignored
├── package.json       # 루트 편의 스크립트
└── README.md
```

## 프론트엔드

위치: `frontend/`

주요 역할:

- 홈/검색/채널/시청/업로드 라우트 제공
- 제목/설명/카테고리/채널명 검색과 최신순/조회수순/좋아요순 정렬
- 백엔드 API 연동을 담당하는 `src/services/apiClient.ts`
- 로그인 상태 관리: `src/auth/AuthContext.tsx`
- 별도 로그인/회원가입 페이지와 계정 메뉴
- 영상 업로드 드래그앤드랍 UI
- 파일 업로드 / YouTube 링크 업로드 탭
- 업로드/수정 화면에서 영상 태그 입력 및 관리
- 업로드 진행률, 실패 재시도, 파일 크기 초과 안내, 업로드 중 페이지 이탈 방지
- MP4 썸네일 이미지 업로드, 자동 추출, hover 미리보기 preview mp4 생성 및 YouTube 썸네일 URL 사용
- 영상 재생 시 조회수 증가 API 호출
- 영상 좋아요 및 채널 구독 UI
- 토스트 알림과 공유 링크 복사
- 구독, 재생 목록, 시청 기록 메뉴와 개인 영상 목록
- 시청 페이지 저장 버튼과 재생목록 선택/생성 팝업
- 재생목록 카드 클릭 시 재생목록 큐가 있는 시청 화면으로 이동
- 재생목록 영상 순서 드래그앤드랍 관리
- 재생목록 큐의 직접 정렬순/최근 추가순/오래된 추가순/랜덤 재생 모드
- 영상 플레이어 기본 다운로드 메뉴 제한
- 영상 수정/삭제 UI
- 내 채널 페이지와 채널 정보 수정 UI
- 채널 홈/영상/재생 목록/정보 탭, 구독자 수/영상 수/가입일 표시
- 내 채널에서 비공개 및 업로드 중 영상 확인
- 모바일 폭에서 햄버거 버튼으로 사이드바 열기/닫기
- 댓글과 대댓글 UI

주요 기술:

- React 19
- React Router
- Vite
- TypeScript
- lucide-react

개발 서버 기본 주소:

```text
http://127.0.0.1:5173/jjobtub/
```

## 백엔드

위치: `backend/`

주요 역할:

- NestJS 기반 REST API
- Prisma Client를 통한 PostgreSQL 접근
- 영상/채널/댓글/인증 API 제공
- MP4 파일 업로드 및 로컬 저장
- HTTP Range 요청을 지원하는 영상 스트리밍
- 쿠키 기반 세션 로그인/로그아웃

주요 모듈:

- `auth`: 회원가입, 로그인, 로그아웃, 현재 사용자 조회, 비밀번호 해시 검증, 세션 쿠키
- `videos`: 영상 목록/상세/생성/수정/삭제/업로드/스트리밍/YouTube 임베드/썸네일/조회수 증가/좋아요 토글/구독 영상/시청 기록
- `playlists`: 재생목록 목록/생성, 영상 저장/제거, 좋아요 표시한 재생목록
- `channels`: 채널 상세, 채널 영상 목록, 채널 정보 수정, 구독 토글
- `comments`: 댓글/대댓글 조회, 작성, 수정, 삭제, 댓글 좋아요 토글
- `storage`: 로컬 파일 저장과 Range 스트리밍 보조
- `prisma`: PrismaService

개발 API 기본 주소:

```text
http://127.0.0.1:4000/api
```

## 아키텍처

```text
Browser
  │
  ▼
Vite React Frontend
  │  /api proxy
  ▼
NestJS Backend API
  ├── Prisma Client ── PostgreSQL
  └── StorageService ── backend/storage/videos
```

프론트엔드는 개발 환경에서 `/api` 요청을 `http://127.0.0.1:4000`으로 프록시합니다. 백엔드는 DB 데이터와 로컬 파일 저장소를 함께 사용합니다. 영상 파일은 현재 로컬 개발용 storage에 저장되며, 실제 배포 단계에서는 S3 같은 외부 오브젝트 스토리지로 교체할 수 있습니다.

## 데이터 모델 요약

ERD 문서: [docs/database-erd.md](docs/database-erd.md)

Prisma 모델:

- `User`: 회원가입/로그인 사용자, 채널 소유자, 댓글 작성자
- `Session`: 쿠키 기반 로그인 세션
- `Channel`: 사용자 채널
- `Video`: 영상 메타데이터, 소스 타입(`LOCAL`/`YOUTUBE`), 외부 영상 ID, 공개 상태, 조회수, 좋아요 수, 태그, 처리 상태
- `VideoLike`: 사용자별 영상 좋아요
- `VideoView`: 사용자별 시청 기록
- `Playlist`: 좋아요 표시한 재생목록과 사용자 지정 재생목록
- `PlaylistItem`: 재생목록에 저장된 영상과 직접 정렬 순서
- `ChannelSubscription`: 사용자별 채널 구독
- `VideoFile`: 업로드된 원본 MP4, 썸네일 이미지, hover 미리보기 preview mp4 파일 정보
- `Comment`: 댓글과 대댓글, `parentId`로 1단계 답글 구조 표현

## 사용 기술

공통:

- TypeScript
- npm workspace-style scripts

프론트엔드:

- React
- Vite
- React Router
- lucide-react

백엔드:

- NestJS
- Prisma
- PostgreSQL
- Jest / Supertest
- Node.js `crypto.scrypt` 기반 비밀번호 해시

## 시작 방법

### 1. 사전 준비

로컬에 다음이 설치되어 있어야 합니다.

- Node.js
- npm
- PostgreSQL 17.x

PostgreSQL은 로컬에서 실행 중이어야 합니다. 현재 개발 기준 예시는 다음 DB 접속 정보를 사용합니다.

```env
DATABASE_URL="postgresql://jjobtub_app:jjobtub_dev_password@localhost:5432/jjobtub_dev?schema=public"
API_PORT=4000
STORAGE_ROOT="./storage"
MAX_UPLOAD_BYTES=524288000
FFMPEG_PATH="C:\\dev\\tools\\ffmpeg\\ffmpeg.exe"
FFPROBE_PATH="C:\\dev\\tools\\ffmpeg\\ffprobe.exe"
```

이 값을 `backend/.env`에 저장합니다. `.env`는 git에 올리지 않습니다. `backend/.env.example`을 복사해서 시작할 수 있습니다. `FFMPEG_PATH`는 MP4 썸네일 자동 추출과 hover 미리보기 preview mp4 생성에 사용하며, `FFPROBE_PATH`는 화질 변환 가능 높이 확인에 사용합니다. 값이 없으면 서버는 `ffmpeg`/`ffprobe` 명령 또는 `C:\dev\tools\ffmpeg\*.exe`를 순서대로 찾습니다.

### 2. 의존성 설치

```bash
npm --prefix backend install
npm --prefix frontend install
```

주의: 이 프로젝트는 루트가 실제 패키지 앱이 아니라 편의 스크립트용입니다. 의존성은 `backend/`, `frontend/` 각각에 설치합니다.

### 3. DB 마이그레이션 및 시드

```bash
npm run backend:prisma:migrate
npm run backend:prisma:seed
```

시드 후 기본 로그인 계정:

```text
email: creator@jjobtub.local
password: password123
```

### 4. 개발 서버 실행

터미널 1:

```bash
npm run backend:dev
```

터미널 2:

```bash
npm run frontend:dev
```

브라우저에서 접속:

```text
http://127.0.0.1:5173/jjobtub/
```

## 주요 스크립트

루트에서 실행:

```bash
npm run frontend:dev
npm run frontend:build
npm run frontend:preview

npm run backend:dev
npm run backend:build
npm run backend:test
npm run backend:test:e2e
npm run backend:prisma:generate
npm run backend:prisma:migrate
npm run backend:prisma:seed
```

## 검증

백엔드 e2e 테스트:

```bash
npm run backend:test:e2e -- --runInBand
```

백엔드 빌드:

```bash
npm run backend:build
```

프론트엔드 빌드:

```bash
npm run frontend:build
```

## 현재 구현된 기능

- 영상 목록/검색/채널/시청 페이지
- 제목/설명/카테고리/채널명 통합 검색
- 최신순/조회수순/좋아요순 검색 정렬
- MP4 업로드
- 업로드/수정 화면에서 영상 태그 관리
- 업로드 드래그앤드랍
- 업로드 진행률 표시
- 업로드 실패 후 재시도
- 업로드 상태 안내 문구
- 업로드 파일 크기 초과 안내
- 업로드 중 페이지 이탈 방지
- MP4 영상 썸네일 이미지 업로드
- ffmpeg 기반 MP4 영상 썸네일 자동 추출
- ffmpeg 기반 MP4 hover 미리보기 preview mp4 자동 생성
- 영상 카드 hover 시 muted/loop 미리보기 재생
- YouTube 영상 썸네일 URL 사용
- YouTube 링크 등록 및 iframe 재생
- HTTP Range 기반 MP4 스트리밍
- 로컬 MP4 커스텀 플레이어, 우클릭 메뉴, 재생속도 0.05 단위 조절, 화질 선택 UI
- 신규 MP4 업로드 시 원본 높이 이하의 144p/240p/360p/480p/720p/1080p/1440p/2160p 변환 파일 생성 및 화질 스트림 fallback
- 기존 로컬 MP4 영상의 화질 변환 재처리
- WebVTT 자막 업로드 및 플레이어 자막 선택
- 회원가입
- 로그인/로그아웃/현재 사용자 조회
- 쿠키 기반 세션
- 영상 재생 이벤트 기반 조회수 증가
- 영상 좋아요 토글
- 좋아요한 영상은 좋아요 표시한 재생 목록에 자동 저장
- 채널 구독 토글
- 구독한 채널의 영상 목록
- 재생목록 메뉴
- 시청 페이지 저장 버튼
- 저장 팝업에서 재생목록 선택 및 새 재생목록 생성
- 재생목록 상세/관리 페이지
- 재생목록에서 영상 제거
- 재생목록 카드 클릭 시 재생목록 큐가 있는 시청 화면으로 이동
- 재생목록 로컬 MP4 다음 영상 자동 재생
- 재생목록 영상 순서 드래그앤드랍 관리
- 재생목록 큐의 직접 정렬순/최근 추가순/오래된 추가순/랜덤 재생 모드
- 랜덤 재생 순서 세션 유지
- 로그인 사용자 시청 기록
- 시청 기록 단건 삭제 및 전체 삭제
- 채널 소유자 영상 수정/삭제
- 채널 이름/설명/아바타/배너 수정
- 내 채널 페이지와 내가 올린 영상 목록
- 채널 홈/영상/재생 목록/정보 탭
- 채널 구독자 수, 영상 수, 가입일 표시
- 내 채널에서 비공개 및 업로드 중 영상 확인
- 영상 생성/업로드 소유자 권한 검사
- 영상 플레이어 다운로드 메뉴 제한
- 별도 로그인/회원가입 페이지
- 로그인 만료 안내
- 토스트 알림
- 공유 버튼 링크 복사
- 좋아요/구독 처리 중 표시
- 댓글 작성
- 대댓글 작성 및 중첩 조회
- 댓글 수정/삭제
- 댓글 좋아요 토글
- 대댓글 접기/펼치기
- 모바일 사이드바 열기/닫기
- 로컬 fallback 썸네일

## 앞으로의 작업 후보

- 작업 메모: 완료되면 이 목록에서 제거합니다.
- 배포 준비
  - `.env.example` 정리
  - production build 실행 방식 정리
  - VPS 배포 구조, 파일 저장 경로, DB 백업, nginx reverse proxy 설계
- 파일 저장소를 S3 등 외부 스토리지로 교체
- 실제 배포 환경 구성
- 테스트 커버리지 확대
- 중간 우선순위 메모
  - 검색/탐색 개선
    - 태그 검색
    - 재생목록 검색
    - 채널/영상/재생목록 통합 검색 결과
    - 필터 UI 정리
  - 채널 기능 확장
    - 채널 재생목록 공개 화면
    - 채널 홈 대표 영상/대표 재생목록
    - 채널 아바타/배너 파일 업로드
  - 댓글/알림
    - 댓글 알림
    - 대댓글 알림
    - 좋아요/구독 알림
    - 알림 메뉴 UI
