# jjobtub

jjobtub은 YouTube 스타일의 영상 플랫폼을 목표로 만드는 학습용 MVP입니다. 현재는 로컬 개발 환경에서 회원가입/로그인, 채널, 영상 업로드, YouTube 링크 등록, 재생목록, 댓글/대댓글, 좋아요, 구독, 알림, 검색, 커스텀 MP4 플레이어까지 이어지는 기본 흐름을 검증하고 있습니다.

## 프로젝트 목표

- 영상 목록, 검색, 채널, 시청 페이지를 갖춘 기본 영상 플랫폼 UI를 만든다.
- 로컬 MP4 파일은 서버 파일 저장소에 저장하고 HTTP Range 스트리밍으로 재생한다.
- YouTube 링크는 파일을 내려받지 않고 YouTube videoId를 검증한 뒤 iframe으로 재생한다.
- 로그인 사용자가 영상 업로드, 좋아요, 구독, 댓글, 재생목록 저장을 사용할 수 있게 한다.
- 채널 소유자가 영상/채널/재생목록을 관리할 수 있게 한다.
- 프론트엔드와 백엔드를 분리해 각각 독립적으로 개발, 빌드, 테스트할 수 있게 한다.

## 저장소 구조

```text
.
├── frontend/          # Vite + React 프론트엔드
├── backend/           # NestJS + Prisma 백엔드 API
├── docs/              # 문서와 ERD
├── test_file/         # 로컬 테스트 파일, git ignored
├── package.json       # 루트 실행 스크립트
└── README.md
```

## 프론트엔드

위치: `frontend/`

주요 역할:

- React 기반 영상 플랫폼 UI
- 영상 목록, 검색, 시청, 업로드, 로그인/회원가입, 내 채널, 재생목록 화면
- 로컬 MP4 커스텀 플레이어와 YouTube iframe 플레이어
- 드래그앤드랍 파일 업로드, YouTube 링크 업로드
- 좋아요, 구독, 저장, 공유, 댓글/대댓글, 알림 메뉴
- 재생목록 저장 팝업, 재생목록 상세/관리, 드래그앤드랍 순서 변경
- 채널 홈/영상/재생목록/정보 탭과 대표 영상/대표 재생목록 설정
- 검색 필터와 정렬, 검색 결과 페이지네이션
- 모바일 사이드바와 반응형 레이아웃

주요 기술:

- React 19
- React Router
- Vite
- TypeScript
- lucide-react

개발 서버:

```text
http://127.0.0.1:5173/jjobtub/
```

## 백엔드

위치: `backend/`

주요 역할:

- NestJS 기반 REST API
- Prisma Client를 통한 PostgreSQL 접근
- 쿠키 기반 세션 인증
- 영상, 채널, 댓글, 재생목록, 알림, 검색 API
- MP4 업로드, 썸네일/미리보기 생성, 자막 업로드, HTTP Range 스트리밍
- YouTube URL 검증과 videoId 추출
- 권한 검증: 영상/채널/재생목록/댓글 소유자 중심 관리

주요 모듈:

- `auth`: 회원가입, 로그인, 로그아웃, 현재 사용자 조회, 세션 쿠키
- `videos`: 영상 목록/상세/생성/수정/삭제/업로드/스트리밍/조회수/좋아요/시청 기록
- `channels`: 채널 상세, 채널 영상/재생목록, 채널 정보/이미지/홈 구성, 구독
- `comments`: 댓글/대댓글 조회, 작성, 수정, 삭제, 좋아요
- `playlists`: 재생목록 생성, 저장/제거, 정렬, 재생 큐
- `notifications`: 알림 목록, 읽음, 삭제, 전체 삭제
- `search`: 영상/채널/재생목록 통합 검색
- `storage`: 로컬 파일 저장과 스트리밍 보조
- `prisma`: PrismaService

개발 API:

```text
http://127.0.0.1:4000/api
```

## 아키텍처

```text
Browser
  ↓
Vite React Frontend
  ↓ /api proxy
NestJS Backend API
  ├─ Prisma Client → PostgreSQL
  └─ StorageService → backend/storage
```

프론트엔드는 개발 환경에서 `/api` 요청을 `http://127.0.0.1:4000`으로 프록시합니다. 백엔드는 DB에는 메타데이터와 파일 경로를 저장하고, 실제 MP4/썸네일/미리보기 파일은 로컬 storage 경로에 저장합니다.

## 데이터 모델

ERD 문서: [docs/database-erd.md](docs/database-erd.md)

핵심 모델:

- `User`: 사용자 계정
- `Session`: 쿠키 기반 로그인 세션
- `Channel`: 사용자 채널, 대표 콘텐츠 설정
- `Video`: 영상 메타데이터, 소스 타입, 상태, 공개 범위, 태그
- `VideoFile`: 원본 MP4, 썸네일, 미리보기, 변환 파일 정보
- `VideoLike`: 영상 좋아요
- `VideoView`: 시청 기록
- `Playlist`: 좋아요 표시 재생목록과 사용자 재생목록
- `PlaylistItem`: 재생목록 영상과 순서
- `ChannelSubscription`: 채널 구독
- `Comment`: 댓글과 대댓글
- `CommentLike`: 댓글 좋아요
- `Notification`: 댓글/대댓글/좋아요/구독 알림

## 시작 방법

### 1. 사전 준비

로컬에 다음 프로그램이 필요합니다.

- Node.js
- npm
- PostgreSQL 17.x
- ffmpeg / ffprobe

`backend/.env` 예시:

```env
DATABASE_URL="postgresql://jjobtub_app:jjobtub_dev_password@localhost:5432/jjobtub_dev?schema=public"
API_PORT=4000
STORAGE_ROOT="./storage"
MAX_UPLOAD_BYTES=524288000
FFMPEG_PATH="C:\\dev\\tools\\ffmpeg\\ffmpeg.exe"
FFPROBE_PATH="C:\\dev\\tools\\ffmpeg\\ffprobe.exe"
```

`backend/.env.example`을 복사해서 시작할 수 있습니다. `.env`는 git에 올리지 않습니다.

### 2. 의존성 설치

```bash
npm --prefix backend install
npm --prefix frontend install
```

### 3. DB 마이그레이션과 시드

```bash
npm run backend:prisma:migrate
npm run backend:prisma:seed
```

기본 시드 계정:

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

접속:

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

백엔드 e2e:

```bash
npm run backend:test:e2e
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

- 회원가입, 로그인, 로그아웃, 현재 사용자 조회
- 쿠키 기반 세션 인증
- MP4 파일 업로드와 YouTube 링크 등록
- 업로드 진행률, 실패 안내, 재시도, 파일 크기 제한 안내, 업로드 중 이탈 방지
- 영상 태그 입력/수정
- MP4 썸네일 업로드와 ffmpeg 자동 추출
- hover 미리보기 preview mp4 생성과 카드 hover 재생
- YouTube 썸네일 URL 사용
- 로컬 MP4 HTTP Range 스트리밍
- 커스텀 MP4 플레이어
  - 재생/일시정지
  - 우클릭 컨텍스트 메뉴
  - URL 복사, 현재 시간 URL 복사
  - 반복 재생
  - 소형 플레이어
  - 재생 속도 0.05 단위 조절
  - 지원 가능한 화질만 표시
  - WebVTT 자막 업로드와 선택
- 영상 조회수 누적
- 영상 좋아요
- 채널 구독
- 영상 수정/삭제
- 좋아요 표시한 영상 자동 재생목록 저장
- 사용자 재생목록 생성/저장/제거
- 재생목록 상세 화면과 재생 큐
- 재생목록 드래그앤드랍 순서 변경
- 직접 정렬, 최근 추가순, 오래된 추가순, 랜덤 재생
- 구독 영상, 시청 기록, 재생목록 메뉴
- 시청 기록 개별 삭제와 전체 삭제
- 댓글/대댓글 작성, 수정, 삭제, 좋아요
- 댓글 정렬: 오래된순, 최신순, 인기순
- 댓글 정렬 상태 URL 파라미터 유지
- 댓글 알림 링크로 해당 댓글 위치 이동
- 알림 메뉴, 읽음, 삭제, 전체 삭제, 알림 종류별 아이콘/색상
- 알림 메뉴 종류별/읽지 않음 필터와 탭 간 즉시 갱신 신호
- SSE 기반 서버 알림 변경 실시간 갱신
- 알림 목록 전용 페이지
- 헤더 알림 badge 주기적 갱신
- 공유 버튼 링크 복사
- 채널 홈/영상/재생목록/정보 탭
- 채널 이름/설명/아바타/배너 수정
- 채널 이미지 파일 업로드와 즉시 미리보기
- 채널 대표 영상/대표 재생목록/홈 섹션 순서 설정
- 채널 대표 콘텐츠 설정 미리보기
- 채널 소유자 전용 관리 메뉴
- 내 채널에서 비공개/업로드 중 영상 확인
- 영상/채널/재생목록 통합 검색
- 검색 범위: 제목, 설명, 카테고리, 채널명, 태그, 재생목록 이름/설명/소유 채널명
- 검색 정렬: 최신순, 조회수순, 좋아요순
- 영상 카드 태그 chip 검색
- 검색 결과 하이라이트
- 검색 결과 페이지네이션
- 모바일 사이드바 열기/닫기
- 미니 플레이어 크기 프리셋
- 시스템 설정 기반 라이트/다크 모드 자동 전환
- 로그인 필요 안내 토스트

## 최근 작업 요약

- 검색 API와 UI를 확장하고 페이지네이션 계약을 정리했습니다.
- 알림 삭제/전체 삭제 API와 UI를 추가했습니다.
- 채널 대표 콘텐츠와 홈 섹션 순서 설정을 추가했습니다.
- 댓글 정렬과 댓글 앵커 이동을 추가했습니다.
- 미니 플레이어 위치/크기 저장과 리사이즈를 추가했습니다.
- 빈 `src=""`가 렌더링되지 않도록 기본 아바타 처리를 보강했습니다.
- 관련 e2e 테스트를 추가했습니다.
- 알림 종류별 아이콘/색상, 영상 태그 chip 검색, 검색 결과 하이라이트를 보강했습니다.
- 댓글 정렬 상태를 URL 파라미터로 유지하고, 미니 플레이어 크기 프리셋을 추가했습니다.
- `docs/database-erd.md`를 최신 Prisma 모델 기준으로 갱신했습니다.
- 알림 필터와 탭 간 알림 갱신 신호를 추가했습니다.
- 채널 소유자 전용 관리 메뉴를 분리하고 채널 정보/홈 구성/상태 요약을 한곳에서 관리하도록 정리했습니다.
- 알림 SSE 스트림과 알림 목록 전용 페이지를 추가했습니다.
- 채널 대표 영상/대표 재생목록 설정 미리보기를 추가했습니다.

## 다음 진행 후보

### 우선순위 높음

- 실제 브라우저 화면 기준 회귀 확인
  - 채널 홈 구성 저장 후 새로고침 확인
  - 검색 결과 페이지네이션과 필터 조합 확인
  - 알림 삭제/전체 삭제와 댓글 앵커 이동 확인
  - 미니 플레이어 드래그/리사이즈/작은 화면 확인
- 알림 UX 고도화
  - 알림 링크 대상을 댓글 외 재생목록/채널 이벤트까지 확장
  - 알림 아카이브 보관 기간/전체 조회 정책 정리
- 채널 관리 고도화
  - 채널 배너 모바일 crop/position 설정
  - 채널 관리 메뉴에서 영상 상태별 필터 제공

### 중간 우선순위

- 검색/탐색 개선
  - 필터 UI 정리
  - 검색 결과에서 영상/채널/재생목록별 표시 밀도 정리
  - 재생목록 공개 범위와 검색 노출 정책 정리
- 댓글/대댓글 경험 개선
  - 답글 작성 후 답글 영역 자동 펼침 보강
  - 댓글 신고/숨김 같은 운영 기능 검토
- 미니 플레이어 개선
  - 페이지 이동 중 유지 여부 결정
  - 미니 플레이어 닫기/복원 UX 정리
  - 모바일에서 프리셋 버튼 노출 방식 추가 조정
- 영상 처리/운영
  - 화질 변환 작업 큐 분리
  - 업로드/변환 실패 원인 상세 표시
  - 오래된 preview/quality 파일 정리 작업

### 운영/품질 개선

- GitHub Actions CI 구성
- 주요 API e2e 확대
- 프론트엔드 주요 화면 스모크 테스트 자동화
- 오래된 preview/quality 파일 정리 작업
