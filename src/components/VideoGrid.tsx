import { channels } from "../data/channels";
import type { Video } from "../types/video";
import { VideoCard } from "./VideoCard";

type VideoGridProps = {
  videos: Video[];
};

export function VideoGrid({ videos }: VideoGridProps) {
  return (
    <section className="video-grid" aria-label="영상 목록">
      {videos.map((video) => {
        const channel = channels.find((item) => item.id === video.channelId)!;
        return <VideoCard key={video.id} video={video} channel={channel} />;
      })}
    </section>
  );
}
