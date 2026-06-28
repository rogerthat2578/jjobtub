import { Link, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { PlaylistCard } from "../components/PlaylistCard";
import { VideoCard } from "../components/VideoCard";
import { fetchSearchResults, type SearchResult } from "../services/apiClient";

type SearchType = "all" | "videos" | "channels" | "playlists";

const SEARCH_FILTERS: Array<{ value: SearchType; label: string }> = [
  { value: "all", label: "전체" },
  { value: "videos", label: "영상" },
  { value: "channels", label: "채널" },
  { value: "playlists", label: "재생목록" },
];

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q")?.trim() ?? "";
  const sort = searchParams.get("sort") ?? "latest";
  const type = normalizeSearchType(searchParams.get("type"));
  const [result, setResult] = useState<SearchResult>({ videos: [], channels: [], playlists: [], channelsById: {} });
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    fetchSearchResults({ q: query, sort, type })
      .then(setResult)
      .catch(() => setError("검색 결과를 불러오지 못했습니다."));
  }, [query, sort, type]);

  function updateParam(key: string, value: string, defaultValue: string) {
    const nextParams = new URLSearchParams(searchParams);
    if (value === defaultValue) {
      nextParams.delete(key);
    } else {
      nextParams.set(key, value);
    }
    setSearchParams(nextParams);
  }

  const totalCount = result.videos.length + result.channels.length + result.playlists.length;

  return (
    <div className="page-stack">
      <div className="page-heading search-heading">
        <div>
          <h1>{query ? `"${query}" 검색 결과` : "검색 결과"}</h1>
          <p>영상 {result.videos.length}개 · 채널 {result.channels.length}개 · 재생목록 {result.playlists.length}개</p>
        </div>
        <label className="sort-control">
          <span>정렬</span>
          <select value={sort} onChange={(event) => updateParam("sort", event.target.value, "latest")}>
            <option value="latest">최신순</option>
            <option value="views">조회수순</option>
            <option value="likes">좋아요순</option>
          </select>
        </label>
      </div>

      <div className="search-filter-bar" aria-label="검색 필터">
        {SEARCH_FILTERS.map((filter) => (
          <button
            className={type === filter.value ? "search-filter-active" : ""}
            key={filter.value}
            type="button"
            onClick={() => updateParam("type", filter.value, "all")}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {error ? (
        <p className="empty-state">{error}</p>
      ) : totalCount === 0 ? (
        <p className="empty-state">검색 결과가 없습니다. 다른 검색어를 입력해 보세요.</p>
      ) : (
        <div className="page-stack">
          {(type === "all" || type === "videos") && result.videos.length > 0 && (
            <section className="page-stack">
              <h2 className="section-title">영상</h2>
              <div className="result-list" aria-label="영상 검색 결과">
                {result.videos.map((video) => (
                  <VideoCard key={video.id} video={video} channel={result.channelsById[video.channelId]} orientation="list" />
                ))}
              </div>
            </section>
          )}

          {(type === "all" || type === "channels") && result.channels.length > 0 && (
            <section className="page-stack">
              <h2 className="section-title">채널</h2>
              <div className="channel-result-list" aria-label="채널 검색 결과">
                {result.channels.map((channel) => (
                  <Link className="channel-result-card" key={channel.id} to={`/channel/${channel.id}`}>
                    <img src={channel.avatarUrl} alt="" />
                    <span>
                      <strong>{channel.name}</strong>
                      <small>구독자 {channel.subscribers}명 · 영상 {(channel.videoCount ?? 0).toLocaleString()}개</small>
                      <em>{channel.description || "채널 설명이 없습니다."}</em>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {(type === "all" || type === "playlists") && result.playlists.length > 0 && (
            <section className="page-stack">
              <h2 className="section-title">재생목록</h2>
              <div className="playlist-grid" aria-label="재생목록 검색 결과">
                {result.playlists.map((playlist) => (
                  <PlaylistCard key={playlist.id} playlist={playlist} onEmpty={() => undefined} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function normalizeSearchType(value: string | null): SearchType {
  if (value === "videos" || value === "channels" || value === "playlists") {
    return value;
  }
  return "all";
}
