import { Bell, Share2, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { CommentList } from "../components/CommentList";
import { VideoCard } from "../components/VideoCard";
import { fetchComments, fetchVideo, fetchVideos, type VideoListResult } from "../services/apiClient";
import type { Channel } from "../types/channel";
import type { Comment } from "../types/comment";
import type { Video } from "../types/video";

export function WatchPage() {
  const { videoId } = useParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [recommended, setRecommended] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!videoId) {
      setNotFound(true);
      return;
    }

    Promise.all([fetchVideo(videoId), fetchComments(videoId), fetchVideos()])
      .then(([videoResult, commentResult, recommendedResult]) => {
        setVideo(videoResult.video);
        setChannel(videoResult.channel);
        setComments(commentResult);
        setRecommended({
          ...recommendedResult,
          videos: recommendedResult.videos.filter((item) => item.id !== videoId).slice(0, 5),
        });
        setNotFound(false);
      })
      .catch(() => setNotFound(true));
  }, [videoId]);

  if (notFound) {
    return <Navigate to="/" replace />;
  }

  if (!video || !channel) {
    return <p className="empty-state">영상을 불러오는 중입니다.</p>;
  }

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
          <h2>댓글 {comments.length}개</h2>
          <CommentList comments={comments} />
        </section>
      </section>

      <aside className="recommendations" aria-label="추천 영상">
        {recommended.videos.map((item) => (
          <VideoCard
            key={item.id}
            video={item}
            channel={recommended.channelsById[item.channelId]}
            orientation="list"
          />
        ))}
      </aside>
    </div>
  );
}
