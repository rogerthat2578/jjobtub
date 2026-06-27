import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { VideoGrid } from "../components/VideoGrid";
import type { VideoListResult } from "../services/apiClient";

type PersonalVideoListPageProps = {
  title: string;
  description: string;
  emptyMessage: string;
  loadVideos: () => Promise<VideoListResult>;
};

export function PersonalVideoListPage({ title, description, emptyMessage, loadVideos }: PersonalVideoListPageProps) {
  const { user, isLoading } = useAuth();
  const [result, setResult] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [error, setError] = useState("");
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    setError("");
    loadVideos()
      .then(setResult)
      .catch(() => setError("목록을 불러오지 못했습니다."))
      .finally(() => setIsFetching(false));
  }, [loadVideos, user]);

  if (!isLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      {isFetching || isLoading ? (
        <p className="empty-state">목록을 불러오는 중입니다.</p>
      ) : error ? (
        <p className="empty-state">{error}</p>
      ) : result.videos.length === 0 ? (
        <div className="empty-panel">
          <p>{emptyMessage}</p>
          <Link className="pill-button" to="/">
            영상 둘러보기
          </Link>
        </div>
      ) : (
        <VideoGrid videos={result.videos} channelsById={result.channelsById} />
      )}
    </div>
  );
}
