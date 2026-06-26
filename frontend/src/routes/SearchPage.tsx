import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { VideoCard } from "../components/VideoCard";
import { fetchVideos, type VideoListResult } from "../services/apiClient";

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const [result, setResult] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchVideos({ q: query })
      .then(setResult)
      .catch(() => setError("검색 결과를 불러오지 못했습니다."));
  }, [query]);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>{query ? `"${query}" 검색 결과` : "검색 결과"}</h1>
        <p>{result.videos.length}개의 영상</p>
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
