import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import { VideoGrid } from "../components/VideoGrid";
import type { VideoListResult } from "../services/apiClient";
import type { Video } from "../types/video";

type PersonalVideoListPageProps = {
  title: string;
  description: string;
  emptyMessage: string;
  loadVideos: () => Promise<VideoListResult>;
  removeVideo?: (videoId: string) => Promise<void>;
  removeLabel?: string;
  removeSuccessMessage?: string;
  clearVideos?: () => Promise<{ count: number }>;
  clearLabel?: string;
};

export function PersonalVideoListPage({
  title,
  description,
  emptyMessage,
  loadVideos,
  removeVideo,
  removeLabel,
  removeSuccessMessage = "목록에서 제거했습니다.",
  clearVideos,
  clearLabel,
}: PersonalVideoListPageProps) {
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [result, setResult] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [error, setError] = useState("");
  const [isFetching, setIsFetching] = useState(true);
  const [busyVideoId, setBusyVideoId] = useState("");
  const [isClearing, setIsClearing] = useState(false);

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

  async function handleRemove(video: Video) {
    if (!removeVideo || busyVideoId) {
      return;
    }

    setBusyVideoId(video.id);
    setError("");

    try {
      await removeVideo(video.id);
      setResult((currentResult) => ({
        ...currentResult,
        videos: currentResult.videos.filter((item) => item.id !== video.id),
      }));
      showToast(removeSuccessMessage, "success");
    } catch {
      setError("목록을 변경하지 못했습니다.");
      showToast("목록을 변경하지 못했습니다.", "error");
    } finally {
      setBusyVideoId("");
    }
  }

  async function handleClear() {
    if (!clearVideos || isClearing || result.videos.length === 0 || !window.confirm("시청 기록을 모두 삭제할까요?")) {
      return;
    }

    setIsClearing(true);
    setError("");

    try {
      await clearVideos();
      setResult((currentResult) => ({ ...currentResult, videos: [] }));
      showToast("시청 기록을 삭제했습니다.", "success");
    } catch {
      setError("시청 기록을 삭제하지 못했습니다.");
      showToast("시청 기록을 삭제하지 못했습니다.", "error");
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {clearVideos && result.videos.length > 0 && (
          <button className="pill-button" type="button" onClick={handleClear} disabled={isClearing}>
            {isClearing ? "삭제 중" : clearLabel}
          </button>
        )}
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
        <VideoGrid
          videos={result.videos}
          channelsById={result.channelsById}
          renderActions={
            removeVideo
              ? (video) => (
                  <button className="text-button" type="button" onClick={() => handleRemove(video)} disabled={busyVideoId === video.id}>
                    {busyVideoId === video.id ? "처리 중" : removeLabel}
                  </button>
                )
              : undefined
          }
        />
      )}
    </div>
  );
}
