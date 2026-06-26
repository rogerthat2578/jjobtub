import { Bell, Share2, ThumbsUp } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CommentList } from "../components/CommentList";
import { VideoCard } from "../components/VideoCard";
import { channels } from "../data/channels";
import { comments } from "../data/comments";
import { videos } from "../data/videos";

export function WatchPage() {
  const { videoId } = useParams();
  const video = videos.find((item) => item.id === videoId);

  if (!video) {
    return <Navigate to="/" replace />;
  }

  const channel = channels.find((item) => item.id === video.channelId)!;
  const videoComments = comments.filter((comment) => comment.videoId === video.id);
  const recommendedVideos = videos.filter((item) => item.id !== video.id).slice(0, 5);

  return (
    <div className="watch-layout">
      <section className="watch-main">
        <video className="player" controls poster={video.thumbnailUrl} src={video.videoUrl} />
        <h1 className="watch-title">{video.title}</h1>
        <div className="watch-meta-row">
          <span>
            {video.views} · {video.uploadedAt}
          </span>
          <div className="watch-actions">
            <button className="pill-button" type="button">
              <ThumbsUp size={17} />
              {video.likes}
            </button>
            <button className="pill-button" type="button">
              <Share2 size={17} />
              공유
            </button>
          </div>
        </div>

        <div className="channel-panel">
          <Link to={`/channel/${channel.id}`} className="channel-identity">
            <img src={channel.avatarUrl} alt="" />
            <span>
              <strong>{channel.name}</strong>
              <small>구독자 {channel.subscribers}명</small>
            </span>
          </Link>
          <button className="subscribe-button" type="button">
            <Bell size={17} />
            구독
          </button>
        </div>

        <section className="description-box">
          <strong>{video.category}</strong>
          <p>{video.description}</p>
        </section>

        <section className="comments-section">
          <h2>댓글 {videoComments.length}개</h2>
          <CommentList comments={videoComments} />
        </section>
      </section>

      <aside className="recommendations" aria-label="추천 영상">
        {recommendedVideos.map((item) => {
          const itemChannel = channels.find((channelItem) => channelItem.id === item.channelId)!;
          return <VideoCard key={item.id} video={item} channel={itemChannel} orientation="list" />;
        })}
      </aside>
    </div>
  );
}
