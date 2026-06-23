# Home Feed Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the home feed feel like a real video platform by fixing visible Korean content, adding category filtering behavior, and improving empty-state behavior.

**Architecture:** Keep the existing Vite + React + TypeScript structure. Put pure filtering logic in `src/utils/videoFilters.ts` so it can be tested without rendering React, then keep `HomePage.tsx` responsible for UI state and layout only.

**Tech Stack:** React 19, TypeScript, Vite, React Router, CSS, Vitest.

---

## File Structure

- Create: `src/utils/videoFilters.ts`
  - Owns reusable category and search filtering helpers for video arrays.
- Create: `src/utils/videoFilters.test.ts`
  - Covers filtering behavior with Vitest before production helper code is written.
- Modify: `package.json`
  - Adds `test` script and Vitest dev dependency.
- Modify: `package-lock.json`
  - Updates lockfile after installing Vitest.
- Modify: `src/data/videos.ts`
  - Replaces broken visible Korean text with valid Korean mock content.
- Modify: `src/data/channels.ts`
  - Replaces broken channel text with valid Korean mock content if needed.
- Modify: `src/data/comments.ts`
  - Replaces broken comment text with valid Korean mock content if needed.
- Modify: `src/routes/HomePage.tsx`
  - Adds selected category state, uses filtering helper, and renders an empty state.
- Modify: `src/components/VideoGrid.tsx`
  - Accepts an `ariaLabel` prop and handles empty lists through its caller.
- Modify: `src/styles/global.css`
  - Adds category chip and home empty-state polish without changing unrelated page styles.

## Task 1: Add Test Harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install Vitest**

Run:

```powershell
npm.cmd install -D vitest
```

Expected: `package.json` gains `vitest` under `devDependencies`, and `package-lock.json` is updated.

- [ ] **Step 2: Add the test script**

In `package.json`, set the scripts block to:

```json
"scripts": {
  "dev": "vite --host 127.0.0.1",
  "build": "tsc -b && vite build",
  "preview": "vite preview --host 127.0.0.1",
  "test": "vitest run"
}
```

- [ ] **Step 3: Verify the empty test harness**

Run:

```powershell
npm.cmd test -- --passWithNoTests
```

Expected: Vitest exits successfully and reports that no tests were found.

- [ ] **Step 4: Commit**

Run:

```powershell
git add package.json package-lock.json
git commit -m "test: add vitest harness"
```

## Task 2: Category Filtering Utility

**Files:**
- Create: `src/utils/videoFilters.test.ts`
- Create: `src/utils/videoFilters.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/videoFilters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Video } from "../types/video";
import { filterVideosByCategory } from "./videoFilters";

const sampleVideos: Video[] = [
  {
    id: "v-dev",
    title: "React 화면 구성",
    description: "컴포넌트 기반 영상 플랫폼 만들기",
    thumbnailUrl: "https://example.com/dev.jpg",
    videoUrl: "https://example.com/dev.mp4",
    channelId: "c-dev",
    views: "조회수 12만회",
    uploadedAt: "3일 전",
    duration: "12:00",
    category: "개발",
    likes: "1.2만",
  },
  {
    id: "v-music",
    title: "작업할 때 듣는 플레이리스트",
    description: "집중하기 좋은 음악",
    thumbnailUrl: "https://example.com/music.jpg",
    videoUrl: "https://example.com/music.mp4",
    channelId: "c-music",
    views: "조회수 40만회",
    uploadedAt: "1주 전",
    duration: "45:20",
    category: "음악",
    likes: "3.1만",
  },
];

describe("filterVideosByCategory", () => {
  it("returns every video when the selected category is 전체", () => {
    expect(filterVideosByCategory(sampleVideos, "전체")).toEqual(sampleVideos);
  });

  it("returns only videos matching the selected category", () => {
    expect(filterVideosByCategory(sampleVideos, "개발")).toEqual([sampleVideos[0]]);
  });

  it("returns an empty list when no video matches the selected category", () => {
    expect(filterVideosByCategory(sampleVideos, "게임")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm.cmd test -- src/utils/videoFilters.test.ts
```

Expected: FAIL because `src/utils/videoFilters.ts` does not exist.

- [ ] **Step 3: Write the minimal implementation**

Create `src/utils/videoFilters.ts`:

```ts
import type { Video } from "../types/video";

export function filterVideosByCategory(videos: Video[], selectedCategory: string) {
  if (selectedCategory === "전체") {
    return videos;
  }

  return videos.filter((video) => video.category === selectedCategory);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```powershell
npm.cmd test -- src/utils/videoFilters.test.ts
```

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/utils/videoFilters.ts src/utils/videoFilters.test.ts
git commit -m "feat: add video category filtering"
```

## Task 3: Repair Mock Content

**Files:**
- Modify: `src/data/videos.ts`
- Modify: `src/data/channels.ts`
- Modify: `src/data/comments.ts`

- [ ] **Step 1: Write a failing content integrity test**

Create `src/data/mockContent.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { channels } from "./channels";
import { comments } from "./comments";
import { videos } from "./videos";

const mojibakePattern = /[�]|\\?꾪|\\?곸|留|議고|濡|媛|釉|移|쨌/;

describe("mock content", () => {
  it("does not expose mojibake in visible video, channel, or comment text", () => {
    const visibleText = [
      ...videos.flatMap((video) => [
        video.title,
        video.description,
        video.views,
        video.uploadedAt,
        video.category,
        video.likes,
      ]),
      ...channels.flatMap((channel) => [
        channel.name,
        channel.description,
        channel.subscribers,
      ]),
      ...comments.flatMap((comment) => [
        comment.author,
        comment.body,
        comment.createdAt,
        comment.likes,
      ]),
    ].join(" ");

    expect(visibleText).not.toMatch(mojibakePattern);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm.cmd test -- src/data/mockContent.test.ts
```

Expected: FAIL because current visible Korean strings are mojibake.

- [ ] **Step 3: Replace `src/data/videos.ts` content**

Use six valid Korean mock videos with categories exactly matching these values: `개발`, `브이로그`, `음악`, `생산성`, `라이프스타일`.

Each video keeps the existing `Video` type shape:

```ts
{
  id: "v-001",
  title: "React로 영상 플랫폼 홈 화면 만들기",
  description: "영상 카드 그리드, 검색 헤더, 반응형 레이아웃을 차근차근 구현합니다.",
  thumbnailUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=900&q=80",
  videoUrl: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  channelId: "c-frontend-lab",
  views: "조회수 38만회",
  uploadedAt: "3일 전",
  duration: "18:24",
  category: "개발",
  likes: "1.8만",
}
```

- [ ] **Step 4: Replace channel and comment visible text**

Keep the existing IDs, avatar URLs, and relationships. Replace only visible Korean strings with natural text such as:

```ts
name: "프론트엔드 연구소"
description: "React, TypeScript, UI 구조를 다루는 개발 채널입니다."
subscribers: "구독자 24.8만명"
```

```ts
author: "민지"
body: "카드 구조를 나누는 방식이 이해하기 쉬웠어요."
createdAt: "2시간 전"
likes: "128"
```

- [ ] **Step 5: Run the content test**

Run:

```powershell
npm.cmd test -- src/data/mockContent.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/data/videos.ts src/data/channels.ts src/data/comments.ts src/data/mockContent.test.ts
git commit -m "fix: repair Korean mock content"
```

## Task 4: Connect Home Category Filtering

**Files:**
- Modify: `src/routes/HomePage.tsx`
- Modify: `src/components/VideoGrid.tsx`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Write the failing UI-independent test for category options**

Append to `src/utils/videoFilters.test.ts`:

```ts
import { getVideoCategories } from "./videoFilters";

describe("getVideoCategories", () => {
  it("returns 전체 followed by unique video categories in first-seen order", () => {
    expect(getVideoCategories(sampleVideos)).toEqual(["전체", "개발", "음악"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```powershell
npm.cmd test -- src/utils/videoFilters.test.ts
```

Expected: FAIL because `getVideoCategories` is not exported.

- [ ] **Step 3: Implement category option generation**

Update `src/utils/videoFilters.ts`:

```ts
import type { Video } from "../types/video";

export function filterVideosByCategory(videos: Video[], selectedCategory: string) {
  if (selectedCategory === "전체") {
    return videos;
  }

  return videos.filter((video) => video.category === selectedCategory);
}

export function getVideoCategories(videos: Video[]) {
  return ["전체", ...new Set(videos.map((video) => video.category))];
}
```

- [ ] **Step 4: Run the utility tests**

Run:

```powershell
npm.cmd test -- src/utils/videoFilters.test.ts
```

Expected: PASS with 4 tests.

- [ ] **Step 5: Update the home page**

Update `src/routes/HomePage.tsx` so it:

- imports `useMemo` and `useState`
- computes categories from video data
- filters videos by the selected category
- marks the selected chip with `aria-pressed`
- shows a short empty state when no videos match

Core shape:

```tsx
import { useMemo, useState } from "react";
import { videos } from "../data/videos";
import { VideoGrid } from "../components/VideoGrid";
import { filterVideosByCategory, getVideoCategories } from "../utils/videoFilters";

export function HomePage() {
  const categories = useMemo(() => getVideoCategories(videos), []);
  const [selectedCategory, setSelectedCategory] = useState(categories[0]);
  const filteredVideos = filterVideosByCategory(videos, selectedCategory);

  return (
    <div className="page-stack">
      <nav className="chip-row" aria-label="카테고리">
        {categories.map((category) => (
          <button
            className={category === selectedCategory ? "chip chip-active" : "chip"}
            key={category}
            type="button"
            aria-pressed={category === selectedCategory}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </nav>
      {filteredVideos.length > 0 ? (
        <VideoGrid videos={filteredVideos} ariaLabel={`${selectedCategory} 영상 목록`} />
      ) : (
        <section className="empty-state" aria-live="polite">
          <h2>{selectedCategory} 영상이 아직 없습니다</h2>
          <p>다른 카테고리를 선택하거나 새 영상을 업로드해 보세요.</p>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Update `VideoGrid` props**

Update `src/components/VideoGrid.tsx`:

```tsx
import { channels } from "../data/channels";
import type { Video } from "../types/video";
import { VideoCard } from "./VideoCard";

type VideoGridProps = {
  videos: Video[];
  ariaLabel?: string;
};

export function VideoGrid({ videos, ariaLabel = "영상 목록" }: VideoGridProps) {
  return (
    <section className="video-grid" aria-label={ariaLabel}>
      {videos.map((video) => {
        const channel = channels.find((item) => item.id === video.channelId)!;
        return <VideoCard key={video.id} video={video} channel={channel} />;
      })}
    </section>
  );
}
```

- [ ] **Step 7: Add empty-state CSS**

Append a focused empty-state style to `src/styles/global.css`:

```css
.empty-state {
  display: grid;
  min-height: 280px;
  align-content: center;
  justify-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  text-align: center;
}

.empty-state h2 {
  margin: 0;
  color: var(--ink);
  font-size: 22px;
}

.empty-state p {
  margin: 0;
  color: var(--muted);
}
```

- [ ] **Step 8: Run tests and build**

Run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: all tests pass and Vite build succeeds.

- [ ] **Step 9: Commit**

Run:

```powershell
git add src/routes/HomePage.tsx src/components/VideoGrid.tsx src/styles/global.css src/utils/videoFilters.ts src/utils/videoFilters.test.ts
git commit -m "feat: filter home feed by category"
```

## Task 5: Push Phase 2 Start

**Files:**
- No file changes expected beyond committed work.

- [ ] **Step 1: Verify clean status**

Run:

```powershell
git status -sb
```

Expected: current branch is clean and ahead of `origin/main` by the new commits.

- [ ] **Step 2: Push**

Run:

```powershell
git push
```

Expected: commits are pushed to `origin/main`.

- [ ] **Step 3: Verify GitHub state**

Run:

```powershell
git status -sb
git log --oneline -5
```

Expected: local `main` is aligned with `origin/main`, and the latest commits include:

```text
feat: filter home feed by category
fix: repair Korean mock content
feat: add video category filtering
test: add vitest harness
```

## Self-Review

- Spec coverage: This plan implements the next approved project milestone: home feed quality, category filtering, visible Korean content repair, and verification.
- Placeholder scan: No placeholder steps remain; each task has concrete file paths, commands, expected output, and implementation snippets.
- Type consistency: `Video.category`, `Video.likes`, and existing component props are used consistently with the current source structure.
