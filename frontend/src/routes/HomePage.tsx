import { videos } from "../data/videos";
import { VideoGrid } from "../components/VideoGrid";

const categories = ["전체", "개발", "브이로그", "음악", "생산성", "라이프스타일"];

export function HomePage() {
  return (
    <div className="page-stack">
      <nav className="chip-row" aria-label="카테고리">
        {categories.map((category, index) => (
          <button className={index === 0 ? "chip chip-active" : "chip"} key={category} type="button">
            {category}
          </button>
        ))}
      </nav>
      <VideoGrid videos={videos} />
    </div>
  );
}
