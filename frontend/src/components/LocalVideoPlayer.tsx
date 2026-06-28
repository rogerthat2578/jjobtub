import {
  Captions,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Maximize,
  Minus,
  Pause,
  Play,
  Plus,
  Repeat,
  Settings,
  SlidersHorizontal,
  Volume2,
} from "lucide-react";
import { type MouseEvent, type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";

type LocalVideoPlayerProps = {
  title: string;
  poster: string;
  sourceUrl: string;
  availableQualities?: number[];
  onEnded?: () => void;
};

type SettingsPanel = "root" | "quality" | "speed" | "captions";

const QUALITY_OPTIONS = [
  { value: "2160", height: 2160, label: "2160p", badge: "4K" },
  { value: "1440", height: 1440, label: "1440p", badge: "HD" },
  { value: "1080", height: 1080, label: "1080p", badge: "HD" },
  { value: "720", height: 720, label: "720p" },
  { value: "480", height: 480, label: "480p" },
  { value: "360", height: 360, label: "360p" },
  { value: "240", height: 240, label: "240p" },
  { value: "144", height: 144, label: "144p" },
];

export function LocalVideoPlayer({ title, poster, sourceUrl, availableQualities = [], onEnded }: LocalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [quality, setQuality] = useState("auto");
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLooping, setIsLooping] = useState(false);
  const [selectedCaption, setSelectedCaption] = useState("off");
  const [textTracks, setTextTracks] = useState<Array<{ id: string; label: string }>>([]);
  const [settingsPanel, setSettingsPanel] = useState<SettingsPanel | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const qualityOptions = useMemo(
    () => QUALITY_OPTIONS.filter((option) => availableQualities.includes(option.height)),
    [availableQualities],
  );
  const selectedSourceUrl = useMemo(() => buildQualityUrl(sourceUrl, quality), [quality, sourceUrl]);

  useEffect(() => {
    if (quality !== "auto" && !qualityOptions.some((option) => option.value === quality)) {
      setQuality("auto");
    }
  }, [quality, qualityOptions]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = playbackRate;
    }
  }, [playbackRate, selectedSourceUrl]);

  useEffect(() => {
    if (!settingsPanel && !contextMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        closePopups();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [contextMenu, settingsPanel]);

  function closePopups() {
    setSettingsPanel(null);
    setContextMenu(null);
  }

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

  function handlePlayerPointerDownCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    const clickedPopup = target.closest(".player-settings-menu, .player-context-menu");
    if ((settingsPanel || contextMenu) && !clickedPopup) {
      closePopups();
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handlePlayerPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("[data-player-interactive='true']")) {
      return;
    }
    togglePlayback();
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
    closePopups();
    setContextMenu({
      x: Math.min(Math.max(event.clientX - rect.left, 8), Math.max(rect.width - 280, 8)),
      y: Math.min(Math.max(event.clientY - rect.top, 8), Math.max(rect.height - 190, 8)),
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

  function refreshTextTracks() {
    const video = videoRef.current;
    if (!video) {
      setTextTracks([]);
      return;
    }
    setTextTracks(
      Array.from(video.textTracks).map((track, index) => ({
        id: String(index),
        label: track.label || track.language || `자막 ${index + 1}`,
      })),
    );
  }

  function changeCaption(nextCaption: string) {
    const video = videoRef.current;
    if (video) {
      Array.from(video.textTracks).forEach((track, index) => {
        track.mode = nextCaption === String(index) ? "showing" : "disabled";
      });
    }
    setSelectedCaption(nextCaption);
  }

  function changeQuality(nextQuality: string) {
    const currentTime = videoRef.current?.currentTime ?? 0;
    setQuality(nextQuality);
    window.setTimeout(() => {
      if (!videoRef.current) {
        return;
      }
      videoRef.current.currentTime = currentTime;
      videoRef.current.playbackRate = playbackRate;
      void videoRef.current.play();
    }, 0);
  }

  return (
    <div
      className="custom-player"
      ref={containerRef}
      onContextMenu={handleContextMenu}
      onPointerDownCapture={handlePlayerPointerDownCapture}
      onPointerDown={handlePlayerPointerDown}
    >
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
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          refreshTextTracks();
        }}
        onTimeUpdate={(event) => {
          const video = event.currentTarget;
          setProgress(video.duration ? (video.currentTime / video.duration) * 100 : 0);
        }}
        onEnded={onEnded}
        onContextMenu={(event) => event.preventDefault()}
      />

      <div className="player-control-layer" data-player-interactive="true" aria-label={`${title} 플레이어 컨트롤`}>
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
            onClick={() => {
              setContextMenu(null);
              setSettingsPanel((current) => (current ? null : "root"));
            }}
            aria-label="설정"
          >
            <Settings size={20} />
          </button>
          <button className="player-icon-button" type="button" onClick={() => containerRef.current?.requestFullscreen()} aria-label="전체화면">
            <Maximize size={20} />
          </button>
        </div>
      </div>

      {settingsPanel && (
        <div
          className={`player-settings-menu player-settings-menu-${settingsPanel}`}
          data-player-interactive="true"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {settingsPanel === "root" && (
            <>
              <button className="player-settings-row player-settings-root-row" type="button" onClick={() => setSettingsPanel("speed")}>
                <span className="player-settings-row-label">
                  <Gauge size={20} />
                  재생 속도
                </span>
                <span>
                  {playbackRateLabel(playbackRate)}
                  <ChevronRight size={17} />
                </span>
              </button>
              <button className="player-settings-row player-settings-root-row" type="button" onClick={() => setSettingsPanel("quality")}>
                <span className="player-settings-row-label">
                  <SlidersHorizontal size={20} />
                  화질
                </span>
                <span>
                  {qualityLabel(quality, qualityOptions)}
                  <ChevronRight size={17} />
                </span>
              </button>
              <button className="player-settings-row player-settings-root-row" type="button" onClick={() => setSettingsPanel("captions")}>
                <span className="player-settings-row-label">
                  <Captions size={20} />
                  자막
                </span>
                <span>
                  {captionLabel(selectedCaption, textTracks)}
                  <ChevronRight size={17} />
                </span>
              </button>
            </>
          )}

          {settingsPanel === "quality" && (
            <>
              <button className="player-settings-header" type="button" onClick={() => setSettingsPanel("root")}>
                <ChevronLeft size={20} />
                화질
              </button>
              {qualityOptions.map((option) => (
                <button
                  className={`player-settings-row ${quality === option.value ? "player-settings-row-active" : ""}`}
                  key={option.value}
                  type="button"
                  onClick={() => changeQuality(option.value)}
                >
                  <span>{quality === option.value ? "✓ " : ""}{option.label}</span>
                  {option.badge && <small>{option.badge}</small>}
                </button>
              ))}
              <button
                className={`player-settings-row ${quality === "auto" ? "player-settings-row-active" : ""}`}
                type="button"
                onClick={() => changeQuality("auto")}
              >
                <span>{quality === "auto" ? "✓ " : ""}자동</span>
              </button>
            </>
          )}

          {settingsPanel === "captions" && (
            <>
              <button className="player-settings-header" type="button" onClick={() => setSettingsPanel("root")}>
                <ChevronLeft size={20} />
                자막
              </button>
              <button
                className={`player-settings-row ${selectedCaption === "off" ? "player-settings-row-active" : ""}`}
                type="button"
                onClick={() => changeCaption("off")}
              >
                <span>{selectedCaption === "off" ? "✓ " : ""}사용 안함</span>
              </button>
              {textTracks.map((track) => (
                <button
                  className={`player-settings-row ${selectedCaption === track.id ? "player-settings-row-active" : ""}`}
                  key={track.id}
                  type="button"
                  onClick={() => changeCaption(track.id)}
                >
                  <span>{selectedCaption === track.id ? "✓ " : ""}{track.label}</span>
                </button>
              ))}
            </>
          )}

          {settingsPanel === "speed" && (
            <>
              <button className="player-settings-header" type="button" onClick={() => setSettingsPanel("root")}>
                <ChevronLeft size={20} />
                재생 속도
              </button>
              <strong className="player-speed-value">{playbackRate.toFixed(2)}x</strong>
              <div className="player-speed-slider-row">
                <button className="player-speed-step" type="button" onClick={() => setPlaybackRate((rate) => clampRate(rate - 0.05))}>
                  <Minus size={18} />
                </button>
                <input
                  type="range"
                  min="0.25"
                  max="3"
                  step="0.05"
                  value={playbackRate}
                  aria-label="재생 속도"
                  onChange={(event) => setPlaybackRate(Number(event.target.value))}
                />
                <button className="player-speed-step" type="button" onClick={() => setPlaybackRate((rate) => clampRate(rate + 0.05))}>
                  <Plus size={18} />
                </button>
              </div>
              <div className="player-speed-presets">
                {[1, 1.25, 1.5, 2, 3].map((rate) => (
                  <button className={playbackRate === rate ? "player-speed-preset-active" : ""} key={rate} type="button" onClick={() => setPlaybackRate(rate)}>
                    {rate.toFixed(rate === 1 ? 1 : rate % 1 === 0 ? 1 : 2).replace(/0$/, "")}
                  </button>
                ))}
              </div>
              <small className="player-speed-caption">보통</small>
            </>
          )}
        </div>
      )}

      {contextMenu && (
        <div
          className="player-context-menu"
          data-player-interactive="true"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
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

function qualityLabel(value: string, qualityOptions: typeof QUALITY_OPTIONS) {
  if (value === "auto") {
    return "자동";
  }
  return qualityOptions.find((option) => option.value === value)?.label ?? "자동";
}

function captionLabel(value: string, tracks: Array<{ id: string; label: string }>) {
  if (value === "off") {
    return "사용 안함";
  }
  return tracks.find((track) => track.id === value)?.label ?? "사용 안함";
}

function playbackRateLabel(value: number) {
  return value === 1 ? "보통" : `${value.toFixed(2)}x`;
}

function clampRate(value: number) {
  return Number(Math.min(Math.max(value, 0.25), 3).toFixed(2));
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) {
    return "0:00";
  }
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
