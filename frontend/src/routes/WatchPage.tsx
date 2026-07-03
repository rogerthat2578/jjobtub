import { Bell, ListPlus, Pencil, Share2, ThumbsUp, Trash2 } from "lucide-react";
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CommentList } from "../components/CommentList";
import { LocalVideoPlayer } from "../components/LocalVideoPlayer";
import { PlaylistSaveDialog } from "../components/PlaylistSaveDialog";
import { useToast } from "../components/ToastProvider";
import { VideoCard } from "../components/VideoCard";
import {
  createComment,
  deleteComment,
  deleteVideo,
  fetchComments,
  fetchPlaylistVideos,
  fetchVideo,
  fetchVideos,
  incrementVideoView,
  reprocessVideoQualities,
  toggleCommentLike,
  toggleChannelSubscription,
  toggleVideoLike,
  updateComment,
  updateVideo,
  uploadVideoSubtitle,
  type VideoListResult,
} from "../services/apiClient";
import type { Channel } from "../types/channel";
import type { Comment } from "../types/comment";
import type { Playlist } from "../types/playlist";
import type { Video } from "../types/video";

type PlaylistQueue = {
  playlist: Playlist;
  videos: Video[];
  channelsById: Record<string, Channel>;
};

type PlaylistOrder = "manual" | "recent" | "oldest" | "random";

const PLAYLIST_ORDER_OPTIONS: Array<{ value: PlaylistOrder; label: string }> = [
  { value: "manual", label: "직접 정렬순" },
  { value: "recent", label: "최근 추가순" },
  { value: "oldest", label: "오래된 추가순" },
  { value: "random", label: "랜덤 재생" },
];

type CommentSort = "oldest" | "latest" | "popular";

export function WatchPage() {
  const { videoId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const playlistId = searchParams.get("playlist");
  const targetCommentId = searchParams.get("comment");
  const playlistOrder = normalizePlaylistOrder(searchParams.get("order"));
  const commentSort = normalizeCommentSort(searchParams.get("comments"));
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [video, setVideo] = useState<Video | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [recommended, setRecommended] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [playlistQueue, setPlaylistQueue] = useState<PlaylistQueue | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("개발");
  const [editTagsInput, setEditTagsInput] = useState("");
  const [managementError, setManagementError] = useState("");
  const [isManagingVideo, setIsManagingVideo] = useState(false);
  const [reactionError, setReactionError] = useState("");
  const [isLikeBusy, setIsLikeBusy] = useState(false);
  const [isSubscriptionBusy, setIsSubscriptionBusy] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [isProcessingQualities, setIsProcessingQualities] = useState(false);
  const [isUploadingSubtitle, setIsUploadingSubtitle] = useState(false);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(true);
  const viewedVideoIdRef = useRef<string | null>(null);
  const subtitleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!videoId) {
      setNotFound(true);
      return;
    }
    viewedVideoIdRef.current = null;
    setIsCommentsExpanded(typeof window === "undefined" ? true : window.innerWidth > 1120);

    Promise.all([
      fetchVideo(videoId),
      fetchComments(videoId, commentSort),
      fetchVideos(),
      playlistId
        ? fetchPlaylistVideos(playlistId, playlistOrder === "random" ? "manual" : playlistOrder).catch((error) => {
            if (error instanceof Error && error.message.includes("Login required")) {
              showToast("로그인이 만료되었습니다. 다시 로그인해 주세요.", "error");
            } else {
              showToast("재생목록을 불러오지 못했습니다.", "error");
            }
            return null;
          })
        : Promise.resolve(null),
    ])
      .then(([videoResult, commentResult, recommendedResult, playlistResult]) => {
        setVideo(videoResult.video);
        setChannel(videoResult.channel);
        setEditTitle(videoResult.video.title);
        setEditDescription(videoResult.video.description);
        setEditCategory(videoResult.video.category);
        setEditTagsInput(videoResult.video.tags.join(", "));
        setComments(commentResult);
        setRecommended({
          ...recommendedResult,
          videos: recommendedResult.videos.filter((item) => item.id !== videoId).slice(0, 5),
        });
        setPlaylistQueue(
          playlistResult && playlistResult.videos.some((item) => item.id === videoId)
            ? {
                playlist: playlistResult.playlist,
                videos:
                  playlistOrder === "random" && playlistId
                    ? stableRandomPlaylistVideos(playlistId, playlistResult.videos)
                    : playlistResult.videos,
                channelsById: playlistResult.channelsById,
              }
            : null,
        );
        setNotFound(false);
        void recordVideoView(videoId);
      })
      .catch(() => setNotFound(true));
  }, [commentSort, playlistId, playlistOrder, showToast, videoId]);

  useEffect(() => {
    if (!targetCommentId || comments.length === 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      document.getElementById(`comment-${targetCommentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [comments, targetCommentId]);

  async function recordVideoView(targetVideoId: string) {
    if (viewedVideoIdRef.current === targetVideoId) {
      return;
    }
    viewedVideoIdRef.current = targetVideoId;
    try {
      const result = await incrementVideoView(targetVideoId);
      setVideo((currentVideo) =>
        currentVideo
          ? {
              ...currentVideo,
              viewsCount: result.views,
              views: `${result.views.toLocaleString()}회`,
            }
          : currentVideo,
      );
    } catch {
      viewedVideoIdRef.current = null;
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoId || isManagingVideo) {
      return;
    }

    setIsManagingVideo(true);
    setManagementError("");

    try {
      const result = await updateVideo(videoId, {
        title: editTitle,
        description: editDescription,
        category: editCategory,
        visibility: video?.visibility ?? "PUBLIC",
        tags: parseTags(editTagsInput),
      });
      setVideo(result.video);
      setChannel(result.channel);
      setIsEditing(false);
    } catch {
      setManagementError("영상 정보를 수정하지 못했습니다.");
    } finally {
      setIsManagingVideo(false);
    }
  }

  async function handleDelete() {
    if (!videoId || isManagingVideo || !window.confirm("이 영상을 삭제할까요?")) {
      return;
    }

    setIsManagingVideo(true);
    setManagementError("");

    try {
      await deleteVideo(videoId);
      navigate("/");
    } catch {
      setManagementError("영상을 삭제하지 못했습니다.");
      setIsManagingVideo(false);
    }
  }

  async function handleLike() {
    if (!videoId || !video || isLikeBusy) {
      return;
    }
    if (!user) {
      showToast("로그인 후 좋아요를 누를 수 있습니다.", "error");
      return;
    }

    setIsLikeBusy(true);
    setReactionError("");

    try {
      const result = await toggleVideoLike(videoId);
      setVideo({
        ...video,
        likedByMe: result.liked,
        likesCount: result.likes,
        likes: result.likes.toLocaleString(),
      });
    } catch {
      setReactionError("좋아요 상태를 변경하지 못했습니다.");
    } finally {
      setIsLikeBusy(false);
    }
  }

  async function handleSubscription() {
    if (!channel || isSubscriptionBusy) {
      return;
    }
    if (!user) {
      showToast("로그인 후 구독할 수 있습니다.", "error");
      return;
    }
    if (user.channelId === channel.id) {
      setReactionError("내 채널은 구독할 수 없습니다.");
      return;
    }

    setIsSubscriptionBusy(true);
    setReactionError("");

    try {
      const result = await toggleChannelSubscription(channel.id);
      setChannel({
        ...channel,
        subscribedByMe: result.subscribed,
        subscribersCount: result.subscribers,
        subscribers: result.subscribers.toLocaleString(),
      });
    } catch {
      setReactionError("구독 상태를 변경하지 못했습니다.");
    } finally {
      setIsSubscriptionBusy(false);
    }
  }

  async function handleShare() {
    const shareUrl = window.location.href;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast("영상 링크를 복사했습니다.", "success");
    } catch {
      showToast("링크 복사에 실패했습니다.", "error");
    }
  }

  async function handleReprocessQualities() {
    if (!videoId || !video || isProcessingQualities) {
      return;
    }
    setIsProcessingQualities(true);
    setManagementError("");
    try {
      setVideo({ ...video, status: "PROCESSING" });
      const result = await reprocessVideoQualities(videoId);
      setVideo((currentVideo) =>
        currentVideo
          ? {
              ...currentVideo,
              status: result.status,
              availableQualities: result.availableQualities,
            }
          : currentVideo,
      );
      showToast("화질 변환이 완료됐습니다.", "success");
    } catch {
      setVideo((currentVideo) => (currentVideo ? { ...currentVideo, status: "FAILED" } : currentVideo));
      showToast("화질 변환에 실패했습니다.", "error");
    } finally {
      setIsProcessingQualities(false);
    }
  }

  async function handleSubtitleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!videoId || !video || !file || isUploadingSubtitle) {
      return;
    }
    setIsUploadingSubtitle(true);
    setManagementError("");
    try {
      const subtitle = await uploadVideoSubtitle(videoId, file, { language: "ko", label: "한국어" });
      setVideo({
        ...video,
        subtitles: [...(video.subtitles ?? []).filter((item) => item.language !== subtitle.language), subtitle],
      });
      showToast("자막을 업로드했습니다.", "success");
    } catch {
      showToast("자막 업로드에 실패했습니다. WebVTT(.vtt) 파일인지 확인해 주세요.", "error");
    } finally {
      setIsUploadingSubtitle(false);
    }
  }

  function handleSaveClick() {
    if (!user) {
      showToast("로그인 후 재생목록에 저장할 수 있습니다.", "error");
      return;
    }
    setReactionError("");
    setIsSaveDialogOpen(true);
  }

  function updateCommentSort(nextSort: CommentSort) {
    const nextParams = new URLSearchParams(searchParams);
    if (nextSort === "oldest") {
      nextParams.delete("comments");
    } else {
      nextParams.set("comments", nextSort);
    }
    setSearchParams(nextParams, { replace: true });
  }

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoId || isSubmittingComment) {
      return;
    }
    if (!user) {
      showToast("로그인 후 댓글을 작성할 수 있습니다.", "error");
      return;
    }

    const trimmedBody = commentBody.trim();
    if (!trimmedBody) {
      setCommentError("댓글 내용을 입력하세요.");
      return;
    }

    setIsSubmittingComment(true);
    setCommentError("");

    try {
      const createdComment = await createComment(videoId, trimmedBody);
      setComments((currentComments) => [...currentComments, createdComment]);
      setCommentBody("");
      scrollToComment(createdComment.id);
    } catch {
      setCommentError("댓글을 등록하지 못했습니다. 잠시 후 다시 시도하세요.");
    } finally {
      setIsSubmittingComment(false);
    }
  }

  async function handleReply(parentId: string, body: string) {
    if (!videoId || !user) {
      throw new Error("Login required");
    }

    const createdReply = await createComment(videoId, body, parentId);
    setComments((currentComments) =>
      currentComments.map((comment) =>
        comment.id === parentId ? { ...comment, replies: [...comment.replies, createdReply] } : comment,
      ),
    );
    scrollToComment(createdReply.id);
  }

  async function handleCommentUpdate(commentId: string, body: string) {
    if (!videoId || !user) {
      throw new Error("Login required");
    }

    const updatedComment = await updateComment(videoId, commentId, body);
    setComments((currentComments) => updateCommentInTree(currentComments, updatedComment));
  }

  async function handleCommentDelete(commentId: string) {
    if (!user) {
      throw new Error("Login required");
    }

    await deleteComment(commentId);
    setComments((currentComments) => removeCommentFromTree(currentComments, commentId));
  }

  async function handleCommentLike(commentId: string) {
    if (!user) {
      throw new Error("Login required");
    }

    const result = await toggleCommentLike(commentId);
    setComments((currentComments) => updateCommentReaction(currentComments, commentId, result));
  }

  if (notFound) {
    return <Navigate to="/" replace />;
  }

  if (!video || !channel) {
    return <p className="empty-state">영상을 불러오는 중입니다.</p>;
  }

  const canManageVideo = Boolean(user?.channelId && user.channelId === video.channelId);
  const isOwnChannel = Boolean(user?.channelId && user.channelId === channel.id);
  const youtubeAutoplayUrl =
    video.embedUrl && video.embedUrl.includes("?") ? `${video.embedUrl}&autoplay=1` : `${video.embedUrl}?autoplay=1`;
  const nextPlaylistVideo = playlistQueue ? nextVideoInQueue(playlistQueue.videos, video.id) : null;

  return (
    <div className="watch-layout">
      <section className="watch-main">
        {video.source === "YOUTUBE" && video.embedUrl ? (
          <iframe
            className="player youtube-player"
            src={youtubeAutoplayUrl}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <LocalVideoPlayer
            title={video.title}
            poster={video.thumbnailUrl}
            sourceUrl={video.videoUrl}
            availableQualities={video.availableQualities ?? []}
            subtitles={video.subtitles ?? []}
            onEnded={() => {
              if (nextPlaylistVideo && playlistId) {
                navigate(`/watch/${nextPlaylistVideo.id}?playlist=${playlistId}&order=${playlistOrder}`);
              }
            }}
          />
        )}
        {isEditing ? (
          <form className="video-edit-form" onSubmit={handleEditSubmit}>
            <label>
              <span>제목</span>
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={120} />
            </label>
            <label>
              <span>설명</span>
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                maxLength={5000}
                rows={4}
              />
            </label>
            <label>
              <span>카테고리</span>
              <select value={editCategory} onChange={(event) => setEditCategory(event.target.value)}>
                <option>개발</option>
                <option>브이로그</option>
                <option>음악</option>
                <option>생산성</option>
                <option>라이프스타일</option>
              </select>
            </label>
            <label>
              <span>태그</span>
              <input
                value={editTagsInput}
                onChange={(event) => setEditTagsInput(event.target.value)}
                placeholder="예: react, tutorial, vlog"
                maxLength={240}
              />
              <small>쉼표로 구분해 최대 12개까지 추가할 수 있습니다.</small>
            </label>
            <div className="video-management-row">
              {managementError ? <p className="form-error">{managementError}</p> : <span />}
              <button className="pill-button" type="button" onClick={() => setIsEditing(false)}>
                취소
              </button>
              <button className="primary-button" type="submit" disabled={isManagingVideo}>
                {isManagingVideo ? "저장 중" : "저장"}
              </button>
            </div>
          </form>
        ) : (
          <h1 className="watch-title">{video.title}</h1>
        )}
        <div className="watch-meta-row">
          <span>
            {video.views} · {video.uploadedAt}
          </span>
          <div className="watch-actions">
            {canManageVideo && !isEditing && (
              <>
                <button
                  className="pill-button"
                  type="button"
                  onClick={() => {
                    setEditTagsInput(video.tags.join(", "));
                    setIsEditing(true);
                  }}
                >
                  <Pencil size={17} />
                  수정
                </button>
                <button className="pill-button danger-button" type="button" onClick={handleDelete} disabled={isManagingVideo}>
                  <Trash2 size={17} />
                  삭제
                </button>
                {video.source === "LOCAL" && (
                  <>
                    <button className="pill-button" type="button" onClick={handleReprocessQualities} disabled={isProcessingQualities}>
                      {isProcessingQualities ? "변환 중" : "화질 재처리"}
                    </button>
                    <button className="pill-button" type="button" onClick={() => subtitleInputRef.current?.click()} disabled={isUploadingSubtitle}>
                      {isUploadingSubtitle ? "자막 업로드 중" : "자막 업로드"}
                    </button>
                    <input
                      ref={subtitleInputRef}
                      className="visually-hidden"
                      type="file"
                      accept=".vtt,text/vtt"
                      onChange={handleSubtitleChange}
                    />
                  </>
                )}
              </>
            )}
            <button
              className={`pill-button ${video.likedByMe ? "active-pill" : ""}`}
              type="button"
              onClick={handleLike}
              disabled={isLikeBusy}
              aria-pressed={Boolean(video.likedByMe)}
            >
              <ThumbsUp size={17} />
              {isLikeBusy ? "처리 중" : video.likes}
            </button>
            <button className="pill-button" type="button" onClick={handleShare}>
              <Share2 size={17} />
              공유
            </button>
            <button className="pill-button" type="button" onClick={handleSaveClick}>
              <ListPlus size={17} />
              저장
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
          <button
            className={`subscribe-button ${channel.subscribedByMe ? "subscribe-button-active" : ""}`}
            type="button"
            onClick={handleSubscription}
            disabled={isSubscriptionBusy || isOwnChannel}
            aria-pressed={Boolean(channel.subscribedByMe)}
          >
            <Bell size={17} />
            {isSubscriptionBusy ? "처리 중" : channel.subscribedByMe ? "구독 중" : "구독"}
          </button>
        </div>

        <section className="description-box">
          <strong>{video.category}</strong>
          {video.tags.length > 0 && (
            <div className="tag-row" aria-label="영상 태그">
              {video.tags.map((tag) => (
                <span className="tag-chip" key={tag}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
          <p>{video.description}</p>
          {managementError && !isEditing && <p className="form-error">{managementError}</p>}
          {reactionError && <p className="form-error">{reactionError}</p>}
        </section>

        <section className="comments-section">
          <div className="comments-header">
            <h2>댓글 {comments.length}개</h2>
            <div className="comment-sort-tabs" aria-label="댓글 정렬">
              {(["oldest", "latest", "popular"] as CommentSort[]).map((sort) => (
                <button
                  key={sort}
                  type="button"
                  className={commentSort === sort ? "active" : ""}
                  onClick={() => updateCommentSort(sort)}
                >
                  {commentSortLabel(sort)}
                </button>
              ))}
            </div>
            <button className="pill-button comments-toggle-button" type="button" onClick={() => setIsCommentsExpanded((isExpanded) => !isExpanded)} aria-expanded={isCommentsExpanded}>
              {isCommentsExpanded ? "댓글 접기" : "댓글 펼치기"}
            </button>
          </div>
          {isCommentsExpanded ? (
            <>
          <form className="comment-form" onSubmit={handleCommentSubmit}>
            <label htmlFor="comment-body">댓글 작성</label>
            <textarea
              id="comment-body"
              maxLength={1000}
              placeholder="댓글을 입력하세요"
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              disabled={!user || isSubmittingComment}
            />
            <div className="comment-form-actions">
              {commentError ? <p className="form-error">{commentError}</p> : <span />}
              <button className="pill-button" type="submit" disabled={!user || isSubmittingComment}>
                {isSubmittingComment ? "등록 중" : "댓글 등록"}
              </button>
            </div>
          </form>
          <CommentList
            comments={comments}
            currentUserId={user?.id}
            canReply={Boolean(user)}
            onReply={handleReply}
            onUpdate={handleCommentUpdate}
            onDelete={handleCommentDelete}
            onLike={handleCommentLike}
          />
            </>
          ) : (
            <button className="comments-collapsed-panel" type="button" onClick={() => setIsCommentsExpanded(true)}>
              댓글 {comments.length.toLocaleString()}개가 접혀 있습니다. 펼쳐서 확인하기
            </button>
          )}
        </section>
      </section>

      <aside className="recommendations" aria-label="추천 영상">
        {playlistQueue && videoId && <PlaylistQueuePanel queue={playlistQueue} currentVideoId={videoId} order={playlistOrder} />}
        {recommended.videos.map((item) => (
          <VideoCard
            key={item.id}
            video={item}
            channel={recommended.channelsById[item.channelId]}
            orientation="list"
          />
        ))}
      </aside>
      <PlaylistSaveDialog videoId={video.id} isOpen={isSaveDialogOpen} onClose={() => setIsSaveDialogOpen(false)} />
    </div>
  );
}

function PlaylistQueuePanel({ queue, currentVideoId, order }: { queue: PlaylistQueue; currentVideoId: string; order: PlaylistOrder }) {
  const currentIndex = queue.videos.findIndex((item) => item.id === currentVideoId);

  return (
    <section className="playlist-queue" aria-label="현재 재생목록">
      <header className="playlist-queue-header">
        <div>
          <h2>{queue.playlist.name}</h2>
          <p>
            {currentIndex >= 0 ? `${currentIndex + 1} / ${queue.videos.length}` : `${queue.videos.length}개 영상`}
          </p>
        </div>
        <Link className="icon-button" to="/library" title="재생목록으로 이동" aria-label="재생목록으로 이동">
          <ListPlus size={18} />
        </Link>
      </header>
      <div className="playlist-queue-controls" aria-label="재생 순서">
        {PLAYLIST_ORDER_OPTIONS.map((option) => (
          <Link
            className={`playlist-order-chip ${order === option.value ? "playlist-order-chip-active" : ""}`}
            key={option.value}
            to={`/watch/${currentVideoId}?playlist=${queue.playlist.id}&order=${option.value}`}
          >
            {option.label}
          </Link>
        ))}
      </div>
      <div className="playlist-queue-list">
        {queue.videos.map((item, index) => {
          const channel = queue.channelsById[item.channelId];
          const isActive = item.id === currentVideoId;

          return (
            <Link
              className={`playlist-queue-item ${isActive ? "playlist-queue-item-active" : ""}`}
              key={item.id}
              to={`/watch/${item.id}?playlist=${queue.playlist.id}&order=${order}`}
              aria-current={isActive ? "true" : undefined}
            >
              <span className="playlist-queue-index">{isActive ? "▶" : index + 1}</span>
              <span className="playlist-queue-thumb">
                <img src={item.thumbnailUrl} alt="" />
                <small>{item.duration}</small>
              </span>
              <span className="playlist-queue-copy">
                <strong>{item.title}</strong>
                <small>{channel?.name ?? "알 수 없는 채널"}</small>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function updateCommentInTree(comments: Comment[], updatedComment: Comment): Comment[] {
  return comments.map((comment) => {
    if (comment.id === updatedComment.id) {
      return { ...updatedComment, replies: comment.replies };
    }

    return { ...comment, replies: updateCommentInTree(comment.replies, updatedComment) };
  });
}

function removeCommentFromTree(comments: Comment[], commentId: string): Comment[] {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({ ...comment, replies: removeCommentFromTree(comment.replies, commentId) }));
}

function updateCommentReaction(
  comments: Comment[],
  commentId: string,
  reaction: { liked: boolean; likes: number },
): Comment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      return { ...comment, likedByMe: reaction.liked, likes: reaction.likes };
    }

    return { ...comment, replies: updateCommentReaction(comment.replies, commentId, reaction) };
  });
}

function parseTags(value: string) {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .map((tag) => tag.slice(0, 30)),
    ),
  ).slice(0, 12);
}

function normalizePlaylistOrder(value: string | null): PlaylistOrder {
  if (value === "recent" || value === "oldest" || value === "random") {
    return value;
  }
  return "manual";
}

function normalizeCommentSort(value: string | null): CommentSort {
  if (value === "latest" || value === "popular") {
    return value;
  }
  return "oldest";
}

function stableRandomPlaylistVideos(playlistId: string, videos: Video[]) {
  const storageKey = `jjobtub:playlist-random:${playlistId}`;
  const videoIds = videos.map((video) => video.id);
  try {
    const storedVideoIds = JSON.parse(sessionStorage.getItem(storageKey) || "[]") as string[];
    const hasSameVideos =
      storedVideoIds.length === videoIds.length && storedVideoIds.every((videoId) => videoIds.includes(videoId));
    if (hasSameVideos) {
      return storedVideoIds
        .map((videoId) => videos.find((video) => video.id === videoId))
        .filter(Boolean) as Video[];
    }
    const shuffledVideos = shuffleVideos(videos);
    sessionStorage.setItem(storageKey, JSON.stringify(shuffledVideos.map((video) => video.id)));
    return shuffledVideos;
  } catch {
    return shuffleVideos(videos);
  }
}

function shuffleVideos(videos: Video[]) {
  const nextVideos = [...videos];
  for (let index = nextVideos.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextVideos[index], nextVideos[swapIndex]] = [nextVideos[swapIndex], nextVideos[index]];
  }
  return nextVideos;
}

function nextVideoInQueue(videos: Video[], currentVideoId: string) {
  const currentIndex = videos.findIndex((video) => video.id === currentVideoId);
  if (currentIndex < 0 || currentIndex >= videos.length - 1) {
    return null;
  }
  return videos[currentIndex + 1];
}

function scrollToComment(commentId: string) {
  window.setTimeout(() => {
    document.getElementById(`comment-${commentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 80);
}

function commentSortLabel(sort: CommentSort) {
  if (sort === "latest") return "최신순";
  if (sort === "popular") return "인기순";
  return "오래된순";
}
