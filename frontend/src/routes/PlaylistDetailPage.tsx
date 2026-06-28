import { ArrowLeft, ListVideo, Play, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PlaylistOrderManager } from "../components/PlaylistOrderManager";
import { useToast } from "../components/ToastProvider";
import { fetchPlaylistVideos, removeVideoFromPlaylist, reorderPlaylistItems, type VideoListResult } from "../services/apiClient";
import type { Playlist } from "../types/playlist";

export function PlaylistDetailPage() {
  const { playlistId } = useParams();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [error, setError] = useState("");
  const [isFetching, setIsFetching] = useState(true);
  const [isManagingOrder, setIsManagingOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [removingVideoId, setRemovingVideoId] = useState("");

  useEffect(() => {
    if (!playlistId || !user) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    setError("");
    fetchPlaylistVideos(playlistId, "manual")
      .then((result) => {
        setPlaylist({ ...result.playlist, videos: result.videos, videoCount: result.videos.length });
        setVideos({ videos: result.videos, channelsById: result.channelsById });
      })
      .catch((fetchError) => {
        setError(toPlaylistErrorMessage(fetchError));
      })
      .finally(() => setIsFetching(false));
  }, [playlistId, user]);

  async function handleSaveOrder(videoIds: string[]) {
    if (!playlistId || !playlist) {
      return;
    }
    setIsSavingOrder(true);
    try {
      await reorderPlaylistItems(playlistId, videoIds);
      const orderedVideos = videoIds
        .map((videoId) => videos.videos.find((video) => video.id === videoId))
        .filter(Boolean) as typeof videos.videos;
      setVideos((current) => ({ ...current, videos: orderedVideos }));
      setPlaylist({ ...playlist, videos: orderedVideos, videoCount: orderedVideos.length });
      setIsManagingOrder(false);
      showToast("재생목록 순서가 저장되었습니다.", "success");
    } catch {
      showToast("재생목록 순서를 저장하지 못했습니다.", "error");
    } finally {
      setIsSavingOrder(false);
    }
  }

  async function handleRemove(videoId: string) {
    if (!playlistId || !playlist || removingVideoId) {
      return;
    }
    setRemovingVideoId(videoId);
    try {
      await removeVideoFromPlaylist(playlistId, videoId);
      const nextVideos = videos.videos.filter((video) => video.id !== videoId);
      setVideos((current) => ({ ...current, videos: nextVideos }));
      setPlaylist({ ...playlist, videos: nextVideos, videoCount: nextVideos.length });
      showToast("재생목록에서 제거했습니다.", "success");
    } catch {
      showToast("재생목록에서 제거하지 못했습니다.", "error");
    } finally {
      setRemovingVideoId("");
    }
  }

  if (!isLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!playlistId) {
    return <Navigate to="/library" replace />;
  }

  if (isFetching || isLoading) {
    return <p className="empty-state">재생목록을 불러오는 중입니다.</p>;
  }

  if (error || !playlist) {
    return (
      <div className="empty-panel">
        <p>{error || "재생목록을 찾을 수 없습니다."}</p>
        <Link className="pill-button" to="/library">
          재생목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <Link className="text-button" to="/library">
            <ArrowLeft size={15} />
            재생목록
          </Link>
          <h1>{playlist.name}</h1>
          <p>{playlist.videoCount.toLocaleString()}개 영상 · 직접 정렬순으로 관리합니다.</p>
        </div>
        {videos.videos[0] && (
          <Link className="primary-button" to={`/watch/${videos.videos[0].id}?playlist=${playlist.id}&order=manual`}>
            <Play size={18} />
            모두 재생
          </Link>
        )}
      </section>

      {videos.videos.length > 1 && !isManagingOrder && (
        <button className="pill-button" type="button" onClick={() => setIsManagingOrder(true)}>
          <ListVideo size={17} />
          순서 관리
        </button>
      )}

      {isManagingOrder ? (
        <PlaylistOrderManager playlist={playlist} isSaving={isSavingOrder} onCancel={() => setIsManagingOrder(false)} onSave={handleSaveOrder} />
      ) : videos.videos.length === 0 ? (
        <p className="empty-state">이 재생목록에는 아직 영상이 없습니다.</p>
      ) : (
        <section className="playlist-detail-list" aria-label="재생목록 영상">
          {videos.videos.map((video, index) => {
            const channel = videos.channelsById[video.channelId];
            return (
              <article className="playlist-detail-item" key={video.id}>
                <span className="playlist-order-index">{index + 1}</span>
                <Link className="playlist-detail-thumb" to={`/watch/${video.id}?playlist=${playlist.id}&order=manual`}>
                  <img src={video.thumbnailUrl} alt="" />
                  <small>{video.duration}</small>
                </Link>
                <div className="playlist-detail-copy">
                  <Link to={`/watch/${video.id}?playlist=${playlist.id}&order=manual`}>
                    <strong>{video.title}</strong>
                  </Link>
                  <small>{channel?.name ?? "알 수 없는 채널"} · {video.views} · {video.uploadedAt}</small>
                </div>
                <button
                  className="icon-button danger-icon-button"
                  type="button"
                  title="재생목록에서 제거"
                  onClick={() => handleRemove(video.id)}
                  disabled={removingVideoId === video.id}
                >
                  <Trash2 size={17} />
                </button>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

function toPlaylistErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    if (error.message.includes("Login required") || error.message.includes("Unauthorized")) {
      return "로그인이 만료되었습니다. 다시 로그인해 주세요.";
    }
    if (error.message.includes("Forbidden")) {
      return "접근 권한이 없는 재생목록입니다.";
    }
  }
  return "재생목록을 불러오지 못했습니다.";
}
