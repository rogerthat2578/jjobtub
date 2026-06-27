import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { VideoCard } from "../components/VideoCard";
import { fetchVideos, type VideoListResult } from "../services/apiClient";

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const sort = searchParams.get("sort") ?? "latest";
  const [result, setResult] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchVideos({ q: query, sort })
      .then(setResult)
      .catch(() => setError("검색 결과를 불러오지 못했습니다."));
  }, [query, sort]);

  function handleSortChange(nextSort: string) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextSort === "latest") {
      nextParams.delete("sort");
    } else {
      nextParams.set("sort", nextSort);
    }
    setSearchParams(nextParams);
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <h1>{query ? `"${query}" 검색 결과` : "검색 결과"}</h1>
          <p>{result.videos.length}개의 영상</p>
        </div>
        <label className="sort-control">
          <span>정렬</span>
          <select value={sort} onChange={(event) => handleSortChange(event.target.value)}>
            <option value="latest">최신순</option>
            <option value="views">조회수순</option>
            <option value="likes">좋아요순</option>
          </select>
        </label>
      </div>
      <section className="result-list" aria-label="검색 결과 목록">
        {error ? (
          <p className="empty-state">{error}</p>
        ) : result.videos.length > 0 ? (
          result.videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              channel={result.channelsById[video.channelId]}
              orientation="list"
            />
          ))
        ) : (
          <p className="empty-state">검색 결과가 없습니다. 다른 검색어를 입력해 보세요.</p>
        )}
      </section>
    </div>
  );
}
