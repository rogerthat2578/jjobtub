import { useEffect, useState } from "react";
import { VideoGrid } from "../components/VideoGrid";
import { fetchVideos, type VideoListResult } from "../services/apiClient";

const categories = ["전체", "개발", "브이로그", "음악", "생산성", "라이프스타일"];

export function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [result, setResult] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    setError("");
    fetchVideos(selectedCategory === "전체" ? {} : { category: selectedCategory })
      .then(setResult)
      .catch(() => setError("영상을 불러오지 못했습니다."))
      .finally(() => setIsLoading(false));
  }, [selectedCategory]);

  return (
    <div className="home-feed">
      <nav className="chip-row sticky-chip-row" aria-label="카테고리">
        {categories.map((category) => (
          <button
            className={category === selectedCategory ? "chip chip-active" : "chip"}
            key={category}
            type="button"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </nav>
      {isLoading ? (
        <p className="empty-state">영상을 불러오는 중입니다.</p>
      ) : error ? (
        <p className="empty-state">{error}</p>
      ) : result.videos.length === 0 ? (
        <p className="empty-state">표시할 영상이 없습니다.</p>
      ) : (
        <VideoGrid videos={result.videos} channelsById={result.channelsById} />
      )}
    </div>
  );
}
