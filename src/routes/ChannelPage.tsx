import { Bell } from "lucide-react";
import { useParams, Navigate } from "react-router-dom";
import { VideoGrid } from "../components/VideoGrid";
import { channels } from "../data/channels";
import { videos } from "../data/videos";

export function ChannelPage() {
  const { channelId } = useParams();
  const channel = channels.find((item) => item.id === channelId);

  if (!channel) {
    return <Navigate to="/" replace />;
  }

  const channelVideos = videos.filter((video) => video.channelId === channel.id);

  return (
    <div className="page-stack">
      <section className="channel-hero">
        <img className="channel-banner" src={channel.bannerUrl} alt="" />
        <div className="channel-profile">
          <img src={channel.avatarUrl} alt="" />
          <div>
            <h1>{channel.name}</h1>
            <p>
              {channel.handle} · 구독자 {channel.subscribers}명 · 영상 {channelVideos.length}개
            </p>
            <p>{channel.description}</p>
          </div>
          <button className="subscribe-button" type="button">
            <Bell size={17} />
            구독
          </button>
        </div>
      </section>
      <VideoGrid videos={channelVideos} />
    </div>
  );
}
