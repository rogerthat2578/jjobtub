import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Channel } from "../types/channel";
import type { Video } from "../types/video";

type VideoCardProps = {
  video: Video;
  channel: Channel;
  orientation?: "grid" | "list";
  actionSlot?: ReactNode;
};

export function VideoCard({ video, channel, orientation = "grid", actionSlot }: VideoCardProps) {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const previewTimerRef = useRef<number | null>(null);

  const startPreview = () => {
    if (!video.previewUrl || previewTimerRef.current !== null) {
      return;
    }
    previewTimerRef.current = window.setTimeout(() => {
      setIsPreviewing(true);
      previewTimerRef.current = null;
    }, 350);
  };

  const stopPreview = () => {
    if (previewTimerRef.current !== null) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    setIsPreviewing(false);
  };

  return (
    <article className={`video-card video-card-${orientation}`}>
      <Link
        className={`thumbnail-link${isPreviewing ? " thumbnail-preview-active" : ""}`}
        to={`/watch/${video.id}`}
        onMouseEnter={startPreview}
        onMouseLeave={stopPreview}
        onFocus={startPreview}
        onBlur={stopPreview}
      >
        <img src={video.thumbnailUrl} alt="" />
        {video.previewUrl && isPreviewing && (
          <video
            className="thumbnail-preview"
            src={video.previewUrl}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
            aria-hidden="true"
            onError={stopPreview}
          />
        )}
        <span className="duration">{video.duration}</span>
      </Link>
      <div className="video-card-body">
        <Link to={`/channel/${channel.id}`} className="avatar-link" aria-label={`${channel.name} 채널`}>
          <img src={channel.avatarUrl} alt="" />
        </Link>
        <div className="video-meta">
          <Link className="video-title" to={`/watch/${video.id}`}>
            {video.title}
          </Link>
          <Link className="channel-name" to={`/channel/${channel.id}`}>
            {channel.name}
          </Link>
          <p>
            {video.views} · {video.uploadedAt}
          </p>
          {video.tags.length > 0 && (
            <div className="video-card-tags" aria-label={`${video.title} 태그`}>
              {video.tags.slice(0, orientation === "list" ? 6 : 3).map((tag) => (
                <Link
                  className="video-card-tag"
                  key={tag}
                  to={`/search?q=${encodeURIComponent(tag)}&type=videos`}
                  onClick={stopPreview}
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}
          {actionSlot && <div className="video-card-actions">{actionSlot}</div>}
        </div>
      </div>
    </article>
  );
}
