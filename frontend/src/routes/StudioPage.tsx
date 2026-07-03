import {
  BarChart3,
  Captions,
  CheckCircle2,
  CircleAlert,
  Clapperboard,
  Eye,
  FolderPen,
  ImageUp,
  LayoutDashboard,
  ListVideo,
  MessageSquare,
  Pencil,
  PlaySquare,
  Settings,
  Upload,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastProvider";
import {
  fetchChannel,
  fetchChannelVideos,
  fetchPlaylists,
  updateChannel,
  uploadChannelAsset,
  type VideoListResult,
} from "../services/apiClient";
import type { Channel } from "../types/channel";
import type { Playlist } from "../types/playlist";
import type { Video } from "../types/video";

type StudioTab = "dashboard" | "content" | "playlists" | "customization";
type VideoStatusFilter = "all" | "READY" | "PROCESSING" | "FAILED" | "DRAFT";
type VideoVisibilityFilter = "all" | "PUBLIC" | "UNLISTED" | "PRIVATE";
type StudioSort = "latest" | "views" | "likes" | "comments";
type BannerMobilePosition = "left" | "center" | "right";

const STUDIO_TABS: Array<{ value: StudioTab; label: string; icon: typeof LayoutDashboard }> = [
  { value: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { value: "content", label: "콘텐츠", icon: ListVideo },
  { value: "playlists", label: "재생목록", icon: FolderPen },
  { value: "customization", label: "맞춤설정", icon: Settings },
];

function normalizeStudioTab(value: string | null): StudioTab {
  if (value === "content" || value === "playlists" || value === "customization") {
    return value;
  }

  return "dashboard";
}

export function StudioPage() {
  const { user, isLoading } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = normalizeStudioTab(searchParams.get("tab"));
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videoResult, setVideoResult] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VideoStatusFilter>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VideoVisibilityFilter>("all");
  const [sort, setSort] = useState<StudioSort>("latest");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [editBannerMobilePosition, setEditBannerMobilePosition] = useState<BannerMobilePosition>("center");
  const [isSavingChannel, setIsSavingChannel] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"avatar" | "banner" | null>(null);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!user?.channelId) {
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    setError("");
    Promise.all([fetchChannel(user.channelId), fetchChannelVideos(user.channelId), fetchPlaylists()])
      .then(([channelResult, videos, playlistResult]) => {
        setChannel(channelResult);
        setVideoResult(videos);
        setPlaylists(playlistResult);
        setEditName(channelResult.name);
        setEditDescription(channelResult.description);
        setEditAvatarUrl(toEditableImageUrl(channelResult.avatarUrl));
        setEditBannerUrl(toEditableImageUrl(channelResult.bannerUrl));
        setEditBannerMobilePosition(channelResult.bannerMobilePosition ?? "center");
      })
      .catch(() => setError("스튜디오 정보를 불러오지 못했습니다. 잠시 후 다시 시도하세요."))
      .finally(() => setIsFetching(false));
  }, [isLoading, user?.channelId]);

  const videos = videoResult.videos;
  const filteredVideos = useMemo(
    () => filterStudioVideos(videos, { query, statusFilter, visibilityFilter, sort }),
    [query, sort, statusFilter, videos, visibilityFilter],
  );
  const summary = useMemo(() => buildStudioSummary(videos, playlists), [playlists, videos]);
  const latestVideos = useMemo(() => filterStudioVideos(videos, { query: "", statusFilter: "all", visibilityFilter: "all", sort: "latest" }).slice(0, 5), [videos]);
  const attentionVideos = videos.filter((video) => video.status === "PROCESSING" || video.status === "FAILED" || video.visibility === "PRIVATE").slice(0, 4);

  if (!isLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  if (!isLoading && user && !user.channelId) {
    return <p className="empty-state">채널을 만든 뒤 스튜디오를 사용할 수 있습니다.</p>;
  }

  function setActiveTab(tab: StudioTab) {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === "dashboard") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }
    setSearchParams(nextParams, { replace: false });
  }

  async function handleChannelSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!channel || isSavingChannel) {
      return;
    }

    setIsSavingChannel(true);
    setError("");
    try {
      const updatedChannel = await updateChannel(channel.id, {
        name: editName,
        description: editDescription,
        avatarUrl: editAvatarUrl,
        bannerUrl: editBannerUrl,
        bannerMobilePosition: editBannerMobilePosition,
      });
      setChannel({ ...updatedChannel, videoCount: channel.videoCount, joinedAt: channel.joinedAt });
      showToast("채널 정보가 저장되었습니다.", "success");
    } catch {
      setError("채널 정보를 저장하지 못했습니다. 이름과 이미지 주소를 확인하세요.");
      showToast("채널 저장에 실패했습니다.", "error");
    } finally {
      setIsSavingChannel(false);
    }
  }

  async function handleAssetChange(kind: "avatar" | "banner", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!channel || !file || uploadingAsset) {
      return;
    }

    setUploadingAsset(kind);
    setError("");
    const previousChannel = channel;
    const previewUrl = URL.createObjectURL(file);
    setChannel({ ...channel, [kind === "avatar" ? "avatarUrl" : "bannerUrl"]: previewUrl });
    try {
      const updatedChannel = await uploadChannelAsset(channel.id, kind, file);
      setChannel({ ...updatedChannel, videoCount: channel.videoCount, joinedAt: channel.joinedAt });
      setEditAvatarUrl(toEditableImageUrl(updatedChannel.avatarUrl));
      setEditBannerUrl(toEditableImageUrl(updatedChannel.bannerUrl));
      showToast(kind === "avatar" ? "아바타를 업데이트했습니다." : "배너를 업데이트했습니다.", "success");
    } catch {
      setChannel(previousChannel);
      setError("이미지를 업로드하지 못했습니다. PNG, JPEG, WebP 파일만 사용할 수 있습니다.");
      showToast("이미지 업로드에 실패했습니다.", "error");
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingAsset(null);
    }
  }

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar" aria-label="스튜디오 메뉴">
        <div className="studio-channel-card">
          <span className="studio-avatar">{channel?.avatarUrl ? <img src={channel.avatarUrl} alt="" /> : <Clapperboard size={30} />}</span>
          <span>
            <small>내 스튜디오</small>
            <strong>{channel?.name ?? user?.displayName ?? "채널"}</strong>
          </span>
        </div>
        <nav className="studio-nav">
          {STUDIO_TABS.map((tab) => (
            <button className={activeTab === tab.value ? "active" : ""} key={tab.value} type="button" onClick={() => setActiveTab(tab.value)}>
              <tab.icon size={19} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <Link className="studio-upload-link" to="/upload">
          <Upload size={18} />
          <span>영상 업로드</span>
        </Link>
      </aside>

      <section className="studio-main">
        <header className="studio-header">
          <div>
            <p>Jjobtub Studio</p>
            <h1>{studioTabTitle(activeTab)}</h1>
          </div>
          <div className="studio-header-actions">
            <Link className="pill-button" to="/my-channel">
              공개 채널 보기
            </Link>
            <Link className="primary-button" to="/upload">
              <Upload size={17} />
              업로드
            </Link>
          </div>
        </header>

        {isFetching && <p className="empty-state">스튜디오 정보를 불러오는 중입니다.</p>}
        {error && <p className="form-error">{error}</p>}

        {!isFetching && activeTab === "dashboard" && (
          <section className="studio-dashboard">
            <div className="studio-metric-grid">
              <StudioMetric icon={PlaySquare} label="전체 영상" value={summary.totalVideos} tone="neutral" />
              <StudioMetric icon={Eye} label="총 조회수" value={summary.totalViews} tone="neutral" />
              <StudioMetric icon={CheckCircle2} label="공개 영상" value={summary.publicVideos} tone="success" />
              <StudioMetric icon={CircleAlert} label="확인 필요" value={summary.attentionVideos} tone="warning" />
            </div>

            <div className="studio-dashboard-grid">
              <section className="studio-panel">
                <header className="studio-panel-header">
                  <div>
                    <h2>최근 콘텐츠</h2>
                    <p>최근 등록된 영상의 공개 상태와 성과를 빠르게 확인합니다.</p>
                  </div>
                  <button className="text-button" type="button" onClick={() => setActiveTab("content")}>
                    모두 보기
                  </button>
                </header>
                <StudioVideoTable videos={latestVideos} compact />
              </section>

              <section className="studio-panel">
                <header className="studio-panel-header">
                  <div>
                    <h2>채널 스냅샷</h2>
                    <p>구독자, 재생목록, 댓글 반응을 관리합니다.</p>
                  </div>
                </header>
                <div className="studio-snapshot-list">
                  <SnapshotRow icon={BarChart3} label="구독자" value={`${channel?.subscribers ?? "0"}명`} />
                  <SnapshotRow icon={FolderPen} label="재생목록" value={`${summary.playlists}개`} />
                  <SnapshotRow icon={MessageSquare} label="댓글" value={`${summary.comments}개`} />
                  <SnapshotRow icon={Captions} label="좋아요" value={`${summary.likes}개`} />
                </div>
              </section>
            </div>

            <section className="studio-panel">
              <header className="studio-panel-header">
                <div>
                  <h2>확인 필요</h2>
                  <p>처리 중, 실패, 비공개 상태인 영상을 모아 보여줍니다.</p>
                </div>
              </header>
              {attentionVideos.length > 0 ? <StudioVideoTable videos={attentionVideos} compact /> : <p className="empty-state">현재 확인이 필요한 영상이 없습니다.</p>}
            </section>
          </section>
        )}

        {!isFetching && activeTab === "content" && (
          <section className="studio-panel">
            <header className="studio-panel-header">
              <div>
                <h2>채널 콘텐츠</h2>
                <p>공개, 비공개, 업로드 중 영상을 한 곳에서 관리합니다.</p>
              </div>
            </header>
            <div className="studio-filter-bar">
              <label>
                <span>검색</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="제목, 설명, 카테고리, 태그" />
              </label>
              <label>
                <span>처리 상태</span>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as VideoStatusFilter)}>
                  <option value="all">전체</option>
                  <option value="READY">완료</option>
                  <option value="PROCESSING">처리 중</option>
                  <option value="FAILED">실패</option>
                  <option value="DRAFT">초안</option>
                </select>
              </label>
              <label>
                <span>공개 상태</span>
                <select value={visibilityFilter} onChange={(event) => setVisibilityFilter(event.target.value as VideoVisibilityFilter)}>
                  <option value="all">전체</option>
                  <option value="PUBLIC">공개</option>
                  <option value="UNLISTED">일부 공개</option>
                  <option value="PRIVATE">비공개</option>
                </select>
              </label>
              <label>
                <span>정렬</span>
                <select value={sort} onChange={(event) => setSort(event.target.value as StudioSort)}>
                  <option value="latest">최신순</option>
                  <option value="views">조회수순</option>
                  <option value="likes">좋아요순</option>
                  <option value="comments">댓글순</option>
                </select>
              </label>
            </div>
            <StudioVideoTable videos={filteredVideos} />
          </section>
        )}

        {!isFetching && activeTab === "playlists" && (
          <section className="studio-panel">
            <header className="studio-panel-header">
              <div>
                <h2>재생목록</h2>
                <p>내가 만든 재생목록과 좋아요 표시한 재생목록을 확인합니다.</p>
              </div>
              <Link className="pill-button" to="/library">
                재생목록 관리
              </Link>
            </header>
            <div className="studio-playlist-table" role="table" aria-label="스튜디오 재생목록">
              <div className="studio-table-head" role="row">
                <span>재생목록</span>
                <span>공개 상태</span>
                <span>영상</span>
                <span>업데이트</span>
              </div>
              {playlists.map((playlist) => (
                <Link className="studio-playlist-row" key={playlist.id} to={`/library/${playlist.id}`} role="row">
                  <strong>{playlist.name}</strong>
                  <span>{playlist.kind === "LIKED" ? "비공개" : playlist.isPublic ? "공개" : "비공개"}</span>
                  <span>{playlist.videoCount.toLocaleString()}개</span>
                  <span>{playlist.updatedAt}</span>
                </Link>
              ))}
              {playlists.length === 0 && <p className="empty-state">아직 재생목록이 없습니다.</p>}
            </div>
          </section>
        )}

        {!isFetching && activeTab === "customization" && channel && (
          <section className="studio-panel">
            <header className="studio-panel-header">
              <div>
                <h2>채널 맞춤설정</h2>
                <p>공개 채널에 보이는 이름, 설명, 아바타, 배너를 수정합니다.</p>
              </div>
            </header>
            <form className="studio-custom-form" onSubmit={handleChannelSubmit}>
              <div className="studio-channel-preview">
                <img className="studio-preview-banner" src={channel.bannerUrl} alt="" />
                <img className="studio-preview-avatar" src={channel.avatarUrl} alt="" />
                <div>
                  <strong>{editName || channel.name}</strong>
                  <span>{editDescription || "채널 설명이 아직 없습니다."}</span>
                </div>
              </div>
              <label>
                <span>채널 이름</span>
                <input value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={80} />
              </label>
              <label>
                <span>채널 설명</span>
                <textarea value={editDescription} onChange={(event) => setEditDescription(event.target.value)} rows={4} maxLength={1000} />
              </label>
              <div className="studio-form-grid">
                <label>
                  <span>아바타 URL</span>
                  <input value={editAvatarUrl} onChange={(event) => setEditAvatarUrl(event.target.value)} placeholder="https://..." />
                </label>
                <label>
                  <span>배너 URL</span>
                  <input value={editBannerUrl} onChange={(event) => setEditBannerUrl(event.target.value)} placeholder="https://..." />
                </label>
              </div>
              <div className="studio-upload-row">
                <label className="pill-button">
                  <ImageUp size={17} />
                  <span>{uploadingAsset === "avatar" ? "아바타 업로드 중" : "아바타 파일"}</span>
                  <input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploadingAsset)} onChange={(event) => void handleAssetChange("avatar", event)} />
                </label>
                <label className="pill-button">
                  <ImageUp size={17} />
                  <span>{uploadingAsset === "banner" ? "배너 업로드 중" : "배너 파일"}</span>
                  <input className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" disabled={Boolean(uploadingAsset)} onChange={(event) => void handleAssetChange("banner", event)} />
                </label>
              </div>
              <div className="studio-position-row" aria-label="모바일 배너 위치">
                <span>모바일 배너 위치</span>
                {(["left", "center", "right"] as BannerMobilePosition[]).map((position) => (
                  <button className={editBannerMobilePosition === position ? "active" : ""} key={position} type="button" onClick={() => setEditBannerMobilePosition(position)}>
                    {bannerMobilePositionLabel(position)}
                  </button>
                ))}
              </div>
              <div className="studio-form-actions">
                <button
                  className="pill-button"
                  type="button"
                  onClick={() => {
                    setEditName(channel.name);
                    setEditDescription(channel.description);
                    setEditAvatarUrl(toEditableImageUrl(channel.avatarUrl));
                    setEditBannerUrl(toEditableImageUrl(channel.bannerUrl));
                    setEditBannerMobilePosition(channel.bannerMobilePosition ?? "center");
                  }}
                >
                  되돌리기
                </button>
                <button className="primary-button" type="submit" disabled={isSavingChannel}>
                  {isSavingChannel ? "저장 중" : "저장"}
                </button>
              </div>
            </form>
          </section>
        )}
      </section>
    </div>
  );
}

function StudioMetric({ icon: Icon, label, value, tone }: { icon: typeof PlaySquare; label: string; value: number; tone: "neutral" | "success" | "warning" }) {
  return (
    <article className={`studio-metric studio-metric-${tone}`}>
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

function SnapshotRow({ icon: Icon, label, value }: { icon: typeof BarChart3; label: string; value: string }) {
  return (
    <div className="studio-snapshot-row">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StudioVideoTable({ videos, compact = false }: { videos: Video[]; compact?: boolean }) {
  if (videos.length === 0) {
    return <p className="empty-state">표시할 영상이 없습니다.</p>;
  }

  return (
    <div className={`studio-video-table ${compact ? "studio-video-table-compact" : ""}`} role="table" aria-label="스튜디오 영상 목록">
      <div className="studio-table-head" role="row">
        <span>영상</span>
        <span>공개 상태</span>
        <span>처리</span>
        <span>날짜</span>
        <span>조회수</span>
        <span>좋아요</span>
        <span>댓글</span>
        <span>작업</span>
      </div>
      {videos.map((video) => (
        <div className="studio-video-row" key={video.id} role="row">
          <Link className="studio-video-cell" to={`/watch/${video.id}`}>
            <img src={video.thumbnailUrl} alt="" />
            <span>
              <strong>{video.title}</strong>
              <small>{video.category}</small>
            </span>
          </Link>
          <span>{visibilityLabel(video.visibility)}</span>
          <span className={video.status === "FAILED" ? "studio-status-danger" : video.status === "PROCESSING" ? "studio-status-warning" : ""}>{statusLabel(video.status)}</span>
          <span>{video.uploadedAt}</span>
          <span>{(video.viewsCount ?? 0).toLocaleString()}</span>
          <span>{(video.likesCount ?? 0).toLocaleString()}</span>
          <span>{(video.commentCount ?? 0).toLocaleString()}</span>
          <span className="studio-row-actions">
            <Link className="icon-button" to={`/watch/${video.id}`} aria-label={`${video.title} 보기`}>
              <Eye size={17} />
            </Link>
            <Link className="icon-button" to={`/watch/${video.id}?edit=1`} aria-label={`${video.title} 수정`}>
              <Pencil size={17} />
            </Link>
          </span>
        </div>
      ))}
    </div>
  );
}

function filterStudioVideos(
  videos: Video[],
  filters: { query: string; statusFilter: VideoStatusFilter; visibilityFilter: VideoVisibilityFilter; sort: StudioSort },
) {
  const normalizedQuery = filters.query.trim().toLowerCase();
  return [...videos]
    .filter((video) => {
      const matchesQuery =
        !normalizedQuery ||
        [video.title, video.description, video.category, ...video.tags].some((value) => value.toLowerCase().includes(normalizedQuery));
      const matchesStatus = filters.statusFilter === "all" || video.status === filters.statusFilter;
      const matchesVisibility = filters.visibilityFilter === "all" || video.visibility === filters.visibilityFilter;
      return matchesQuery && matchesStatus && matchesVisibility;
    })
    .sort((left, right) => {
      if (filters.sort === "views") return (right.viewsCount ?? 0) - (left.viewsCount ?? 0);
      if (filters.sort === "likes") return (right.likesCount ?? 0) - (left.likesCount ?? 0);
      if (filters.sort === "comments") return (right.commentCount ?? 0) - (left.commentCount ?? 0);
      return new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime();
    });
}

function buildStudioSummary(videos: Video[], playlists: Playlist[]) {
  return {
    totalVideos: videos.length,
    publicVideos: videos.filter((video) => video.visibility === "PUBLIC" && video.status === "READY").length,
    attentionVideos: videos.filter((video) => video.status === "PROCESSING" || video.status === "FAILED" || video.visibility === "PRIVATE").length,
    totalViews: videos.reduce((sum, video) => sum + (video.viewsCount ?? 0), 0),
    likes: videos.reduce((sum, video) => sum + (video.likesCount ?? 0), 0),
    comments: videos.reduce((sum, video) => sum + (video.commentCount ?? 0), 0),
    playlists: playlists.length,
  };
}

function studioTabTitle(tab: StudioTab) {
  if (tab === "content") return "콘텐츠";
  if (tab === "playlists") return "재생목록";
  if (tab === "customization") return "채널 맞춤설정";
  return "대시보드";
}

function statusLabel(status?: string) {
  if (status === "PROCESSING") return "처리 중";
  if (status === "FAILED") return "실패";
  if (status === "DRAFT") return "초안";
  return "완료";
}

function visibilityLabel(visibility?: string) {
  if (visibility === "PRIVATE") return "비공개";
  if (visibility === "UNLISTED") return "일부 공개";
  return "공개";
}

function bannerMobilePositionLabel(position: BannerMobilePosition) {
  if (position === "left") return "왼쪽";
  if (position === "right") return "오른쪽";
  return "가운데";
}

function toEditableImageUrl(url?: string) {
  if (!url || url.startsWith("data:")) {
    return "";
  }

  return url;
}
