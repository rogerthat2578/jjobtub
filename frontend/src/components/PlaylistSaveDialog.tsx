import { ListPlus, Plus, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { useToast } from "./ToastProvider";
import {
  addVideoToPlaylist,
  createPlaylist,
  fetchPlaylists,
  removeVideoFromPlaylist,
} from "../services/apiClient";
import type { Playlist } from "../types/playlist";

type PlaylistSaveDialogProps = {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
};

export function PlaylistSaveDialog({ videoId, isOpen, onClose }: PlaylistSaveDialogProps) {
  const { showToast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [error, setError] = useState("");
  const [busyPlaylistId, setBusyPlaylistId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setIsLoading(true);
    setError("");
    fetchPlaylists()
      .then(setPlaylists)
      .catch(() => setError("재생목록을 불러오지 못했습니다."))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  async function handleToggle(playlist: Playlist) {
    if (busyPlaylistId) {
      return;
    }

    const isSaved = playlist.videos.some((video) => video.id === videoId);
    setBusyPlaylistId(playlist.id);
    setError("");

    try {
      if (isSaved) {
        await removeVideoFromPlaylist(playlist.id, videoId);
      } else {
        await addVideoToPlaylist(playlist.id, videoId);
      }
      setPlaylists((currentPlaylists) =>
        currentPlaylists.map((item) =>
          item.id === playlist.id
            ? {
                ...item,
                videoCount: Math.max(0, item.videoCount + (isSaved ? -1 : 1)),
                videos: isSaved ? item.videos.filter((video) => video.id !== videoId) : [...item.videos, { id: videoId } as Playlist["videos"][number]],
              }
            : item,
        ),
      );
    } catch {
      setError("재생목록 저장 상태를 변경하지 못했습니다.");
    } finally {
      setBusyPlaylistId("");
    }
  }

  async function handleCreatePlaylist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCreating) {
      return;
    }

    const trimmedName = newPlaylistName.trim();
    if (!trimmedName) {
      setError("재생목록 이름을 입력하세요.");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const playlist = await createPlaylist(trimmedName);
      await addVideoToPlaylist(playlist.id, videoId);
      setPlaylists((currentPlaylists) => [
        { ...playlist, videoCount: 1, videos: [{ id: videoId } as Playlist["videos"][number]] },
        ...currentPlaylists,
      ]);
      setNewPlaylistName("");
      showToast("새 재생목록에 저장했습니다.", "success");
    } catch {
      setError("재생목록을 만들지 못했습니다.");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="playlist-dialog" role="dialog" aria-modal="true" aria-labelledby="playlist-dialog-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="playlist-dialog-header">
          <h2 id="playlist-dialog-title">저장</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </header>

        {isLoading ? (
          <p className="dialog-muted">재생목록을 불러오는 중입니다.</p>
        ) : (
          <div className="playlist-check-list">
            {playlists.map((playlist) => {
              const isSaved = playlist.videos.some((video) => video.id === videoId);
              return (
                <label key={playlist.id} className="playlist-check-row">
                  <input
                    type="checkbox"
                    checked={isSaved}
                    disabled={busyPlaylistId === playlist.id}
                    onChange={() => handleToggle(playlist)}
                  />
                  <span>
                    <strong>{playlist.name}</strong>
                    <small>{playlist.videoCount.toLocaleString()}개 영상</small>
                  </span>
                </label>
              );
            })}
          </div>
        )}

        <form className="playlist-create-form" onSubmit={handleCreatePlaylist}>
          <label htmlFor="playlist-name">
            <ListPlus size={17} />
            새 재생목록
          </label>
          <div>
            <input
              id="playlist-name"
              value={newPlaylistName}
              onChange={(event) => setNewPlaylistName(event.target.value)}
              placeholder="재생목록 이름"
              maxLength={80}
            />
            <button className="pill-button" type="submit" disabled={isCreating}>
              <Plus size={16} />
              {isCreating ? "생성 중" : "만들기"}
            </button>
          </div>
        </form>
        {error && <p className="form-error">{error}</p>}
      </section>
    </div>
  );
}
