import type { ReactNode } from "react";
import { channels } from "../data/channels";
import type { Channel } from "../types/channel";
import type { Video } from "../types/video";
import { VideoCard } from "./VideoCard";

type VideoGridProps = {
  videos: Video[];
  channelsById?: Record<string, Channel>;
  renderActions?: (video: Video) => ReactNode;
};

export function VideoGrid({ videos, channelsById, renderActions }: VideoGridProps) {
  return (
    <section className="video-grid" aria-label="영상 목록">
      {videos.map((video) => {
        const channel = channelsById?.[video.channelId] ?? channels.find((item) => item.id === video.channelId)!;
        return <VideoCard key={video.id} video={video} channel={channel} actionSlot={renderActions?.(video)} />;
      })}
    </section>
  );
}
