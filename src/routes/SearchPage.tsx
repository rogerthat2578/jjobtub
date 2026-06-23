import { useSearchParams } from "react-router-dom";
import { channels } from "../data/channels";
import { videos } from "../data/videos";
import { VideoCard } from "../components/VideoCard";

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const results = videos.filter((video) => {
    const channel = channels.find((item) => item.id === video.channelId);
    const searchable = [video.title, video.description, video.category, channel?.name].join(" ").toLowerCase();
    return query.length === 0 || searchable.includes(query);
  });

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h1>{query ? `"${query}" 검색 결과` : "검색 결과"}</h1>
        <p>{results.length}개의 영상</p>
      </div>
      <section className="result-list" aria-label="검색 결과 목록">
        {results.length > 0 ? (
          results.map((video) => {
            const channel = channels.find((item) => item.id === video.channelId)!;
            return <VideoCard key={video.id} video={video} channel={channel} orientation="list" />;
          })
        ) : (
          <p className="empty-state">검색 결과가 없습니다. 다른 검색어를 입력해 보세요.</p>
        )}
      </section>
    </div>
  );
}
