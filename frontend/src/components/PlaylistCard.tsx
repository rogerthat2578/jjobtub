import { Link } from "react-router-dom";
import type { Playlist } from "../types/playlist";

type PlaylistCardProps = {
  playlist: Playlist;
  onEmpty: () => void;
  manageTo?: string;
};

export function PlaylistCard({ playlist, onEmpty, manageTo }: PlaylistCardProps) {
  const firstVideo = playlist.videos[0];
  const playbackUrl = firstVideo ? `/watch/${firstVideo.id}?playlist=${playlist.id}` : "";

  return (
    <article className="playlist-card">
      {firstVideo ? (
        <Link className="playlist-card-media" to={playbackUrl}>
          <PlaylistThumbStack playlist={playlist} />
        </Link>
      ) : (
        <button className="playlist-card-media playlist-card-button" type="button" onClick={onEmpty}>
          <PlaylistThumbStack playlist={playlist} />
        </button>
      )}
      <div className="playlist-card-copy">
        {firstVideo ? (
          <Link to={playbackUrl}>
            <h2>{playlist.name}</h2>
          </Link>
        ) : (
          <button className="playlist-card-title-button" type="button" onClick={onEmpty}>
            <h2>{playlist.name}</h2>
          </button>
        )}
        <p>
          {playlist.kind === "LIKED" ? "자동 재생목록" : "내 재생목록"} · {playlist.videoCount.toLocaleString()}개 영상
        </p>
        {manageTo && (
          <Link className="text-button" to={manageTo}>
            관리
          </Link>
        )}
      </div>
    </article>
  );
}

function PlaylistThumbStack({ playlist }: { playlist: Playlist }) {
  return (
    <div className="playlist-thumb-stack">
      {playlist.videos.slice(0, 3).map((video) => (
        <img key={video.id} src={video.thumbnailUrl} alt="" />
      ))}
      {playlist.videos.length === 0 && <span>비어 있음</span>}
    </div>
  );
}
