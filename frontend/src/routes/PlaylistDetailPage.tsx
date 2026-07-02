import { ArrowLeft, ListVideo, Pencil, Play, Save, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PlaylistOrderManager } from "../components/PlaylistOrderManager";
import { useToast } from "../components/ToastProvider";
import {
  deletePlaylist,
  fetchPlaylistVideos,
  removeVideoFromPlaylist,
  reorderPlaylistItems,
  updatePlaylist,
  type VideoListResult,
} from "../services/apiClient";
import type { Playlist } from "../types/playlist";

export function PlaylistDetailPage() {
  const { playlistId } = useParams();
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [videos, setVideos] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [error, setError] = useState("");
  const [isFetching, setIsFetching] = useState(true);
  const [isManagingOrder, setIsManagingOrder] = useState(false);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isDeletingPlaylist, setIsDeletingPlaylist] = useState(false);
  const [removingVideoId, setRemovingVideoId] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(true);

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
        setEditName(result.playlist.name);
        setEditDescription(result.playlist.description ?? "");
        setEditIsPublic(result.playlist.isPublic);
      })
      .catch((fetchError) => {
        setError(toPlaylistErrorMessage(fetchError));
      })
      .finally(() => setIsFetching(false));
  }, [playlistId, user]);

  async function handleSaveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!playlistId || !playlist || playlist.kind !== "CUSTOM" || isSavingDetails) {
      return;
    }

    const nextName = editName.trim();
    if (!nextName) {
      showToast("재생목록 이름을 입력하세요.", "error");
      return;
    }

    setIsSavingDetails(true);
    try {
      const updatedPlaylist = await updatePlaylist(playlistId, {
        name: nextName,
        description: editDescription,
        isPublic: editIsPublic,
      });
      setPlaylist({ ...playlist, ...updatedPlaylist, videos: playlist.videos, videoCount: playlist.videoCount });
      setEditName(updatedPlaylist.name);
      setEditDescription(updatedPlaylist.description ?? "");
      setEditIsPublic(updatedPlaylist.isPublic);
      setIsEditingDetails(false);
      showToast("재생목록 정보가 저장되었습니다.", "success");
    } catch {
      showToast("재생목록 정보를 저장하지 못했습니다.", "error");
    } finally {
      setIsSavingDetails(false);
    }
  }

  async function handleDeletePlaylist() {
    if (!playlistId || !playlist || playlist.kind !== "CUSTOM" || isDeletingPlaylist) {
      return;
    }

    if (!window.confirm(`"${playlist.name}" 재생목록을 삭제할까요?`)) {
      return;
    }

    setIsDeletingPlaylist(true);
    try {
      await deletePlaylist(playlistId);
      showToast("재생목록이 삭제되었습니다.", "success");
      navigate("/library", { replace: true });
    } catch {
      showToast("재생목록을 삭제하지 못했습니다.", "error");
    } finally {
      setIsDeletingPlaylist(false);
    }
  }

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
      showToast("재생목록에서 제거되었습니다.", "success");
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
          재생 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const isCustomPlaylist = playlist.kind === "CUSTOM";

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <Link className="text-button" to="/library">
            <ArrowLeft size={15} />
            재생 목록
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

      <section className="playlist-management-panel" aria-label="재생목록 정보">
        <div className="playlist-management-summary">
          <strong>{isCustomPlaylist ? "사용자 재생목록" : "좋아요 표시한 재생목록"}</strong>
          <span>{isCustomPlaylist ? (playlist.isPublic ? "공개" : "비공개") : "비공개"}</span>
          {playlist.description ? <p>{playlist.description}</p> : <p>설명이 아직 없습니다.</p>}
        </div>
        {isCustomPlaylist && (
          <div className="playlist-management-actions">
            <button className="pill-button" type="button" onClick={() => setIsEditingDetails((current) => !current)}>
              {isEditingDetails ? <X size={17} /> : <Pencil size={17} />}
              {isEditingDetails ? "닫기" : "정보 수정"}
            </button>
            <button className="pill-button danger-button" type="button" onClick={handleDeletePlaylist} disabled={isDeletingPlaylist}>
              <Trash2 size={17} />
              {isDeletingPlaylist ? "삭제 중" : "삭제"}
            </button>
          </div>
        )}
      </section>

      {isCustomPlaylist && isEditingDetails && (
        <form className="playlist-edit-form" onSubmit={handleSaveDetails}>
          <label>
            재생목록 이름
            <input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={120} />
          </label>
          <label>
            설명
            <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={1000} rows={4} />
          </label>
          <label className="playlist-visibility-toggle">
            <input type="checkbox" checked={editIsPublic} onChange={(event) => setEditIsPublic(event.target.checked)} />
            공개 재생목록으로 표시
          </label>
          <div className="playlist-edit-actions">
            <button className="primary-button" type="submit" disabled={isSavingDetails}>
              <Save size={17} />
              {isSavingDetails ? "저장 중" : "저장"}
            </button>
            <button className="pill-button" type="button" onClick={() => setIsEditingDetails(false)} disabled={isSavingDetails}>
              취소
            </button>
          </div>
        </form>
      )}

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
                  <small>
                    {channel?.name ?? "알 수 없는 채널"} · 조회수 {video.views.toLocaleString()}회 · {video.uploadedAt}
                  </small>
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
