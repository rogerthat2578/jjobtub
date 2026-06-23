import { Link } from "react-router-dom";
import type { Channel } from "../types/channel";
import type { Video } from "../types/video";

type VideoCardProps = {
  video: Video;
  channel: Channel;
  orientation?: "grid" | "list";
};

export function VideoCard({ video, channel, orientation = "grid" }: VideoCardProps) {
  return (
    <article className={`video-card video-card-${orientation}`}>
      <Link className="thumbnail-link" to={`/watch/${video.id}`}>
        <img src={video.thumbnailUrl} alt="" />
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
        </div>
      </div>
    </article>
  );
}
