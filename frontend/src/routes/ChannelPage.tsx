import { Bell, Pencil } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import { VideoGrid } from "../components/VideoGrid";
import { fetchChannel, fetchChannelVideos, toggleChannelSubscription, updateChannel, type VideoListResult } from "../services/apiClient";
import type { Channel } from "../types/channel";

type ChannelPageProps = {
  isMine?: boolean;
};

export function ChannelPage({ isMine = false }: ChannelPageProps) {
  const { channelId } = useParams();
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<VideoListResult>({ videos: [], channelsById: {} });
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

    Promise.all([fetchChannel(targetChannelId), fetchChannelVideos(targetChannelId)])
      .then(([channelResult, videoResult]) => {
        setChannel(channelResult);
        setEditName(channelResult.name);
        setEditDescription(channelResult.description);
        setEditAvatarUrl(channelResult.avatarUrl);
        setEditBannerUrl(channelResult.bannerUrl);
        setVideos(videoResult);
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
      setChannel(updatedChannel);
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

  return (
    <div className="page-stack">
      <section className="channel-hero">
        <img className="channel-banner" src={channel.bannerUrl} alt="" />
        <div className="channel-profile">
          <img src={channel.avatarUrl} alt="" />
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
            <div>
              <h1>{channel.name}</h1>
              <p>
                {channel.handle} · 구독자 {channel.subscribers}명 · 영상 {videos.videos.length}개
              </p>
              <p>{channel.description}</p>
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
      {canManageChannel && (
        <section className="section-heading-row">
          <div>
            <h2>내가 올린 영상</h2>
            <p>내 채널에 공개된 영상 목록입니다.</p>
          </div>
        </section>
      )}
      <VideoGrid videos={videos.videos} channelsById={videos.channelsById} />
    </div>
  );
}
