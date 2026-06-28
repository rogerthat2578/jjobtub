import { Bell, Pencil } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { PlaylistCard } from "../components/PlaylistCard";
import { useToast } from "../components/ToastProvider";
import { VideoGrid } from "../components/VideoGrid";
import {
  fetchChannel,
  fetchChannelPlaylists,
  fetchChannelVideos,
  fetchPlaylists,
  toggleChannelSubscription,
  updateChannel,
  type VideoListResult,
} from "../services/apiClient";
import type { Channel } from "../types/channel";
import type { Playlist } from "../types/playlist";
import type { Video } from "../types/video";

type ChannelPageProps = {
  isMine?: boolean;
};

type ChannelTab = "home" | "videos" | "playlists" | "about";

const DEFAULT_AVATAR =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'%3E%3Crect width='160' height='160' fill='%23e7e5e4'/%3E%3Ccircle cx='80' cy='62' r='30' fill='%2378706a'/%3E%3Cpath d='M32 142c7-30 27-46 48-46s41 16 48 46' fill='%2378706a'/%3E%3C/svg%3E";
const DEFAULT_BANNER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='320' viewBox='0 0 1200 320'%3E%3Crect width='1200' height='320' fill='%23f4f2ef'/%3E%3Cpath d='M0 238c126-58 244-58 354 0s233 58 368 0 294-58 478 0v82H0z' fill='%23d6d3d1'/%3E%3C/svg%3E";

export function ChannelPage({ isMine = false }: ChannelPageProps) {
  const { channelId } = useParams();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activeTab, setActiveTab] = useState<ChannelTab>("home");
  const [notFound, setNotFound] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);

  useEffect(() => {
    const targetChannelId = isMine ? user?.channelId : channelId;
    if (isMine && isLoading) {
      return;
    }
    if (!targetChannelId) {
      setNotFound(true);
      return;
    }

    const playlistRequest = user?.channelId === targetChannelId ? fetchPlaylists() : fetchChannelPlaylists(targetChannelId);

    Promise.all([fetchChannel(targetChannelId), fetchChannelVideos(targetChannelId), playlistRequest])
      .then(([channelResult, videoResult, playlistResult]) => {
        setChannel(channelResult);
        setEditName(channelResult.name);
        setEditDescription(channelResult.description);
        setEditAvatarUrl(channelResult.avatarUrl);
        setEditBannerUrl(channelResult.bannerUrl);
        setVideos(videoResult);
        setPlaylists(playlistResult);
        setActiveTab("home");
        setNotFound(false);
      })
      .catch(() => setNotFound(true));
  }, [channelId, isLoading, isMine, user?.channelId]);

  async function handleChannelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!channel || isSaving) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const updatedChannel = await updateChannel(channel.id, {
        name: editName,
        description: editDescription,
        avatarUrl: editAvatarUrl,
        bannerUrl: editBannerUrl,
      });
      setChannel({ ...updatedChannel, videoCount: channel.videoCount, joinedAt: channel.joinedAt });
      setIsEditing(false);
      showToast("채널 정보가 저장되었습니다.", "success");
    } catch {
      setError("채널 정보를 저장하지 못했습니다.");
      showToast("채널 저장에 실패했습니다.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubscribe() {
    if (!channel || isSubscribing) {
      return;
    }
    if (!user) {
      showToast("로그인 후 구독할 수 있습니다.", "error");
      return;
    }

    setIsSubscribing(true);
    setError("");

    try {
      const result = await toggleChannelSubscription(channel.id);
      setChannel({
        ...channel,
        subscribedByMe: result.subscribed,
        subscribersCount: result.subscribers,
        subscribers: result.subscribers.toLocaleString(),
      });
    } catch {
      showToast("구독 상태를 변경하지 못했습니다.", "error");
    } finally {
      setIsSubscribing(false);
    }
  }

  if (isMine && !isLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (notFound) {
    return <Navigate to="/" replace />;
  }

  if (!channel) {
    return <p className="empty-state">채널을 불러오는 중입니다.</p>;
  }

  const canManageChannel = Boolean(user?.channelId && user.channelId === channel.id);
  const videoCount = channel.videoCount ?? videos.videos.length;
  const featuredVideos = videos.videos.slice(0, 6);

  return (
    <div className="page-stack">
      <section className="channel-hero">
        <img className="channel-banner" src={channel.bannerUrl || DEFAULT_BANNER} alt="" />
        <div className="channel-profile">
          <img src={channel.avatarUrl || DEFAULT_AVATAR} alt="" />
          {isEditing ? (
            <form className="channel-edit-form" onSubmit={handleChannelSubmit}>
              <label>
                <span>채널 이름</span>
                <input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} />
              </label>
              <label>
                <span>설명</span>
                <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={3} maxLength={1000} />
              </label>
              <label>
                <span>아바타 URL</span>
                <input value={editAvatarUrl} onChange={(event) => setEditAvatarUrl(event.target.value)} placeholder="https://..." />
              </label>
              <label>
                <span>배너 URL</span>
                <input value={editBannerUrl} onChange={(event) => setEditBannerUrl(event.target.value)} placeholder="https://..." />
              </label>
              {error && <p className="form-error">{error}</p>}
              <div className="video-management-row">
                <button className="pill-button" type="button" onClick={() => setIsEditing(false)}>
                  취소
                </button>
                <button className="primary-button" type="submit" disabled={isSaving}>
                  {isSaving ? "저장 중" : "저장"}
                </button>
              </div>
            </form>
          ) : (
            <div className="channel-summary">
              <h1>{channel.name}</h1>
              <p className="channel-stats">
                {channel.handle} · 구독자 {channel.subscribers}명 · 영상 {videoCount.toLocaleString()}개 · 가입일 {channel.joinedAt ?? "-"}
              </p>
              <p>{channel.description || "채널 설명이 아직 없습니다."}</p>
            </div>
          )}
          {canManageChannel ? (
            !isEditing && (
              <button className="subscribe-button" type="button" onClick={() => setIsEditing(true)}>
                <Pencil size={17} />
                채널 수정
              </button>
            )
          ) : (
            <button
              className={`subscribe-button ${channel.subscribedByMe ? "subscribe-button-active" : ""}`}
              type="button"
              onClick={handleSubscribe}
              disabled={isSubscribing}
              aria-pressed={Boolean(channel.subscribedByMe)}
            >
              <Bell size={17} />
              {isSubscribing ? "처리 중" : channel.subscribedByMe ? "구독 중" : "구독"}
            </button>
          )}
        </div>
      </section>

      <nav className="channel-tabs" aria-label="채널 탭">
        <button type="button" className={activeTab === "home" ? "active" : ""} onClick={() => setActiveTab("home")}>
          홈
        </button>
        <button type="button" className={activeTab === "videos" ? "active" : ""} onClick={() => setActiveTab("videos")}>
          영상
        </button>
        {(canManageChannel || playlists.length > 0) && (
          <button type="button" className={activeTab === "playlists" ? "active" : ""} onClick={() => setActiveTab("playlists")}>
            재생 목록
          </button>
        )}
        <button type="button" className={activeTab === "about" ? "active" : ""} onClick={() => setActiveTab("about")}>
          정보
        </button>
      </nav>

      {activeTab === "home" && (
        <section className="page-stack">
          <div className="section-heading-row">
            <div>
              <h2>최근 영상</h2>
              <p>{canManageChannel ? "내 채널에서는 비공개 및 업로드 중 영상도 함께 표시됩니다." : "공개된 최신 영상을 보여줍니다."}</p>
            </div>
          </div>
          {featuredVideos.length > 0 ? (
            <VideoGrid videos={featuredVideos} channelsById={videos.channelsById} renderActions={canManageChannel ? renderOwnerBadge : undefined} />
          ) : (
            <p className="empty-state">아직 표시할 영상이 없습니다.</p>
          )}
        </section>
      )}

      {activeTab === "videos" && (
        <section className="page-stack">
          <div className="section-heading-row">
            <div>
              <h2>영상</h2>
              <p>{canManageChannel ? "공개, 비공개, 업로드 중 영상을 모두 확인할 수 있습니다." : "이 채널의 공개 영상 목록입니다."}</p>
            </div>
          </div>
          {videos.videos.length > 0 ? (
            <VideoGrid videos={videos.videos} channelsById={videos.channelsById} renderActions={canManageChannel ? renderOwnerBadge : undefined} />
          ) : (
            <p className="empty-state">아직 표시할 영상이 없습니다.</p>
          )}
        </section>
      )}

      {activeTab === "playlists" && (
        <section className="page-stack">
          <div className="section-heading-row">
            <div>
              <h2>재생 목록</h2>
              <p>좋아요 표시한 재생 목록과 직접 만든 재생목록을 관리합니다.</p>
            </div>
          </div>
          {playlists.length > 0 ? (
            <section className="playlist-grid" aria-label="내 채널 재생목록">
              {playlists.map((playlist) => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  onEmpty={() => showToast("재생할 영상이 없습니다.", "info")}
                  manageTo={canManageChannel ? `/library/${playlist.id}` : undefined}
                />
              ))}
            </section>
          ) : (
            <p className="empty-state">아직 재생목록이 없습니다. 시청 페이지에서 저장 버튼으로 새 재생목록을 만들 수 있습니다.</p>
          )}
        </section>
      )}

      {activeTab === "about" && (
        <section className="channel-info-panel">
          <h2>채널 정보</h2>
          <p>{channel.description || "채널 설명이 아직 없습니다."}</p>
          <dl className="channel-info-grid">
            <div>
              <dt>구독자</dt>
              <dd>{channel.subscribers}명</dd>
            </div>
            <div>
              <dt>영상</dt>
              <dd>{videoCount.toLocaleString()}개</dd>
            </div>
            <div>
              <dt>가입일</dt>
              <dd>{channel.joinedAt ?? "-"}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}

function renderOwnerBadge(video: Video) {
  const labels = [
    video.visibility === "PRIVATE" ? "비공개" : null,
    video.status && video.status !== "READY" ? statusLabel(video.status) : null,
  ].filter(Boolean);

  if (labels.length === 0) {
    return null;
  }

  return <span className="video-state-badge">{labels.join(" · ")}</span>;
}

function statusLabel(status: string) {
  if (status === "PROCESSING") return "업로드 중";
  if (status === "FAILED") return "처리 실패";
  if (status === "DRAFT") return "초안";
  return status;
}
