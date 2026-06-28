import { Maximize, Pause, Play, Repeat, Settings, Volume2 } from "lucide-react";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";

type LocalVideoPlayerProps = {
  title: string;
  poster: string;
  sourceUrl: string;
  onEnded?: () => void;
};

const QUALITY_OPTIONS = [
  { value: "1440", label: "1440p60", badge: "HD" },
  { value: "1080", label: "1080p60", badge: "HD" },
  { value: "720", label: "720p60" },
  { value: "480", label: "480p" },
  { value: "360", label: "360p" },
  { value: "240", label: "240p" },
  { value: "144", label: "144p" },
  { value: "auto", label: "자동" },
];

const PLAYBACK_RATES = Array.from({ length: 41 }, (_, index) => Number((0.25 + index * 0.05).toFixed(2)));

export function LocalVideoPlayer({ title, poster, sourceUrl, onEnded }: LocalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [quality, setQuality] = useState("auto");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(true);
  const [settingsPanel, setSettingsPanel] = useState<"quality" | "speed" | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const selectedSourceUrl = useMemo(() => buildQualityUrl(sourceUrl, quality), [quality, sourceUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.playbackRate = playbackRate;
  }, [playbackRate, selectedSourceUrl]);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  function handleSeek(event: MouseEvent<HTMLDivElement>) {
    const video = videoRef.current;
    if (!video || !duration) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    video.currentTime = duration * ratio;
  }

  function handleContextMenu(event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setSettingsPanel(null);
    setContextMenu({
      x: Math.min(event.clientX - rect.left, rect.width - 230),
      y: Math.min(event.clientY - rect.top, rect.height - 190),
    });
  }

  async function copyVideoUrl(withTimestamp = false) {
    const video = videoRef.current;
    const url = new URL(window.location.href);
    if (withTimestamp && video) {
      url.searchParams.set("t", String(Math.floor(video.currentTime)));
    }
    await navigator.clipboard.writeText(url.toString());
    setContextMenu(null);
  }

  async function openPictureInPicture() {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) {
      return;
    }
    await video.requestPictureInPicture();
    setContextMenu(null);
  }

  function toggleCaptions() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const nextEnabled = !captionsEnabled;
    Array.from(video.textTracks).forEach((track) => {
      track.mode = nextEnabled ? "showing" : "disabled";
    });
    setCaptionsEnabled(nextEnabled);
  }

  return (
    <div className="custom-player" ref={containerRef} onContextMenu={handleContextMenu} onClick={() => setContextMenu(null)}>
      <video
        ref={videoRef}
        className="player custom-player-video"
        autoPlay
        playsInline
        poster={poster}
        src={selectedSourceUrl}
        loop={isLooping}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
        }}
        onEnded={onEnded}
        onContextMenu={(event) => event.preventDefault()}
      />
      <div className="player-control-layer" aria-label={`${title} 플레이어 컨트롤`}>
        <div className="player-progress" onClick={handleSeek} role="slider" aria-label="재생 위치" aria-valuenow={Math.round(progress)}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="player-controls">
          <button className="player-icon-button" type="button" onClick={togglePlayback} aria-label={isPlaying ? "일시정지" : "재생"}>
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <span className="player-time">
            {formatTime(videoRef.current?.currentTime ?? 0)} / {formatTime(duration)}
          </span>
          <div className="player-spacer" />
          <label className="player-volume">
            <Volume2 size={19} />
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              aria-label="볼륨"
              onChange={(event) => {
                const nextVolume = Number(event.target.value);
                setVolume(nextVolume);
                if (videoRef.current) {
                  videoRef.current.volume = nextVolume;
                }
              }}
            />
          </label>
          <button
            className="player-icon-button"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setContextMenu(null);
              setSettingsPanel((current) => (current ? null : "quality"));
            }}
            aria-label="설정"
          >
            <Settings size={20} />
          </button>
          <button
            className="player-icon-button"
            type="button"
            onClick={() => containerRef.current?.requestFullscreen()}
            aria-label="전체화면"
          >
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {settingsPanel && (
        <div className="player-settings-menu" onClick={(event) => event.stopPropagation()}>
          {settingsPanel === "quality" ? (
            <>
              <button className="player-settings-row" type="button" onClick={() => setSettingsPanel("speed")}>
                재생속도 <span>{playbackRate.toFixed(2)}x</span>
              </button>
              <button className="player-settings-row" type="button" onClick={toggleCaptions}>
                자막 <span>{videoRef.current?.textTracks.length ? (captionsEnabled ? "표시" : "표시 안함") : "없음"}</span>
              </button>
              <div className="player-settings-title">화질</div>
              {QUALITY_OPTIONS.map((option) => (
                <button
                  className={`player-settings-row ${quality === option.value ? "player-settings-row-active" : ""}`}
                  key={option.value}
                  type="button"
                  onClick={() => {
                    const currentTime = videoRef.current?.currentTime ?? 0;
                    setQuality(option.value);
                    window.setTimeout(() => {
                      if (videoRef.current) {
                        videoRef.current.currentTime = currentTime;
                        videoRef.current.playbackRate = playbackRate;
                        void videoRef.current.play();
                      }
                    }, 0);
                  }}
                >
                  {quality === option.value ? "✓ " : ""}
                  {option.label}
                  {option.badge && <small>{option.badge}</small>}
                </button>
              ))}
            </>
          ) : (
            <>
              <button className="player-settings-row" type="button" onClick={() => setSettingsPanel("quality")}>
                화질 <span>{QUALITY_OPTIONS.find((option) => option.value === quality)?.label}</span>
              </button>
              <div className="player-settings-title">재생속도</div>
              <div className="player-speed-list">
                {PLAYBACK_RATES.map((rate) => (
                  <button
                    className={`player-settings-row ${playbackRate === rate ? "player-settings-row-active" : ""}`}
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                  >
                    {playbackRate === rate ? "✓ " : ""}
                    {rate.toFixed(2)}x
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {contextMenu && (
        <div className="player-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            onClick={() => {
              setIsLooping((current) => !current);
              setContextMenu(null);
            }}
          >
            <Repeat size={18} />
            {isLooping ? "연속 재생 끄기" : "연속 재생"}
          </button>
          <button type="button" onClick={() => void openPictureInPicture()}>
            <Maximize size={18} />
            소형 플레이어
          </button>
          <button type="button" onClick={() => void copyVideoUrl(false)}>
            동영상 URL 복사
          </button>
          <button type="button" onClick={() => void copyVideoUrl(true)}>
            현재 시간에 동영상 URL 복사
          </button>
        </div>
      )}
    </div>
  );
}

function buildQualityUrl(sourceUrl: string, quality: string) {
  if (quality === "auto") {
    return sourceUrl;
  }
  const url = new URL(sourceUrl, window.location.origin);
  url.searchParams.set("quality", quality);
  return url.toString();
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) {
    return "0:00";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
