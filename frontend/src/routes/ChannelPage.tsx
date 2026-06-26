import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { VideoGrid } from "../components/VideoGrid";
import { fetchChannel, fetchChannelVideos, type VideoListResult } from "../services/apiClient";
import type { Channel } from "../types/channel";

export function ChannelPage() {
  const { channelId } = useParams();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!channelId) {
      setNotFound(true);
      return;
    }

    Promise.all([fetchChannel(channelId), fetchChannelVideos(channelId)])
      .then(([channelResult, videoResult]) => {
        setChannel(channelResult);
        setVideos(videoResult);
      })
      .catch(() => setNotFound(true));
  }, [channelId]);

  if (notFound) {
    return <Navigate to="/" replace />;
  }

  if (!channel) {
    return <p className="empty-state">채널을 불러오는 중입니다.</p>;
  }

  return (
    <div className="page-stack">
      <section className="channel-hero">
        <img className="channel-banner" src={channel.bannerUrl} alt="" />
        <div className="channel-profile">
          <img src={channel.avatarUrl} alt="" />
          <div>
            <h1>{channel.name}</h1>
            <p>
              {channel.handle} · 구독자 {channel.subscribers}명 · 영상 {videos.videos.length}개
            </p>
            <p>{channel.description}</p>
          </div>
          <button className="subscribe-button" type="button">
            <Bell size={17} />
            구독
          </button>
        </div>
      </section>
      <VideoGrid videos={videos.videos} channelsById={videos.channelsById} />
    </div>
  );
}
