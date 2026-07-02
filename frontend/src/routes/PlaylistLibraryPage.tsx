import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PlaylistCard } from "../components/PlaylistCard";
import { useToast } from "../components/ToastProvider";
import { fetchPlaylists } from "../services/apiClient";
import type { Playlist } from "../types/playlist";

export function PlaylistLibraryPage() {
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [error, setError] = useState("");
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    setError("");
    fetchPlaylists()
      .then(setPlaylists)
      .catch(() => setError("재생목록을 불러오지 못했습니다."))
      .finally(() => setIsFetching(false));
  }, [user]);

  if (!isLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <h1>재생 목록</h1>
          <p>좋아요 표시한 재생목록과 직접 만든 재생목록을 관리합니다.</p>
        </div>
      </section>

      {isFetching || isLoading ? (
        <p className="empty-state">재생목록을 불러오는 중입니다.</p>
      ) : error ? (
        <p className="empty-state">{error}</p>
      ) : playlists.length === 0 ? (
        <div className="empty-panel">
          <p>아직 재생목록이 없습니다.</p>
          <Link className="pill-button" to="/">
            영상 둘러보기
          </Link>
        </div>
      ) : (
        <section className="playlist-grid" aria-label="재생목록">
          {playlists.map((playlist) => (
            <PlaylistCard
              key={playlist.id}
              playlist={playlist}
              onEmpty={() => showToast("재생할 영상이 없습니다.", "info")}
              manageTo={`/library/${playlist.id}`}
            />
          ))}
        </section>
      )}
    </div>
  );
}
