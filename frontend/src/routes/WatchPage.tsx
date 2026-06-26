import { Bell, Pencil, Share2, ThumbsUp, Trash2 } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { CommentList } from "../components/CommentList";
import { VideoCard } from "../components/VideoCard";
import {
  createComment,
  deleteVideo,
  fetchComments,
  fetchVideo,
  fetchVideos,
  incrementVideoView,
  toggleChannelSubscription,
  toggleVideoLike,
  updateVideo,
  type VideoListResult,
} from "../services/apiClient";
import type { Channel } from "../types/channel";
import type { Comment } from "../types/comment";
import type { Video } from "../types/video";

export function WatchPage() {
  const { videoId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [video, setVideo] = useState<Video | null>(null);
  const [channel, setChannel] = useState<Channel | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [recommended, setRecommended] = useState<VideoListResult>({ videos: [], channelsById: {} });
  const [notFound, setNotFound] = useState(false);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("개발");
  const [managementError, setManagementError] = useState("");
  const [isManagingVideo, setIsManagingVideo] = useState(false);
  const [reactionError, setReactionError] = useState("");
  const [isLikeBusy, setIsLikeBusy] = useState(false);
  const [isSubscriptionBusy, setIsSubscriptionBusy] = useState(false);

  useEffect(() => {
    if (!videoId) {
      setNotFound(true);
      return;
    }

    Promise.all([fetchVideo(videoId), fetchComments(videoId), fetchVideos()])
      .then(([videoResult, commentResult, recommendedResult]) => {
        setVideo(videoResult.video);
        setChannel(videoResult.channel);
        setEditTitle(videoResult.video.title);
        setEditDescription(videoResult.video.description);
        setEditCategory(videoResult.video.category);
        setComments(commentResult);
        setRecommended({
          ...recommendedResult,
          videos: recommendedResult.videos.filter((item) => item.id !== videoId).slice(0, 5),
        });
        setNotFound(false);
      })
      .catch(() => setNotFound(true));
  }, [videoId]);

  async function handlePlaybackStarted() {
    if (!videoId || !video) {
      return;
    }

    const storageKey = `jjobtub:viewed:${videoId}`;
    if (sessionStorage.getItem(storageKey)) {
      return;
    }

    sessionStorage.setItem(storageKey, "1");
    try {
      const result = await incrementVideoView(videoId);
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
      sessionStorage.removeItem(storageKey);
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
      setReactionError("로그인 후 좋아요를 누를 수 있습니다.");
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
      setReactionError("로그인 후 구독할 수 있습니다.");
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

  async function handleCommentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!videoId || isSubmittingComment) {
      return;
    }
    if (!user) {
      setCommentError("로그인 후 댓글을 작성할 수 있습니다.");
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
  }

  if (notFound) {
    return <Navigate to="/" replace />;
  }

  if (!video || !channel) {
    return <p className="empty-state">영상을 불러오는 중입니다.</p>;
  }

  const canManageVideo = Boolean(user?.channelId && user.channelId === video.channelId);
  const isOwnChannel = Boolean(user?.channelId && user.channelId === channel.id);

  return (
    <div className="watch-layout">
      <section className="watch-main">
        <video
          className="player"
          controls
          controlsList="nodownload"
          disablePictureInPicture
          poster={video.thumbnailUrl}
          src={video.videoUrl}
          onContextMenu={(event) => event.preventDefault()}
          onPlay={handlePlaybackStarted}
        />
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
                <button className="pill-button" type="button" onClick={() => setIsEditing(true)}>
                  <Pencil size={17} />
                  수정
                </button>
                <button className="pill-button danger-button" type="button" onClick={handleDelete} disabled={isManagingVideo}>
                  <Trash2 size={17} />
                  삭제
                </button>
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
              {video.likes}
            </button>
            <button className="pill-button" type="button">
              <Share2 size={17} />
              공유
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
            {channel.subscribedByMe ? "구독 중" : "구독"}
          </button>
        </div>

        <section className="description-box">
          <strong>{video.category}</strong>
          <p>{video.description}</p>
          {managementError && !isEditing && <p className="form-error">{managementError}</p>}
          {reactionError && <p className="form-error">{reactionError}</p>}
        </section>

        <section className="comments-section">
          <h2>댓글 {comments.length}개</h2>
          <form className="comment-form" onSubmit={handleCommentSubmit}>
            <label htmlFor="comment-body">댓글 작성</label>
            {!user && <p className="form-error">로그인 후 댓글을 작성할 수 있습니다.</p>}
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
          <CommentList comments={comments} canReply={Boolean(user)} onReply={handleReply} />
        </section>
      </section>

      <aside className="recommendations" aria-label="추천 영상">
        {recommended.videos.map((item) => (
          <VideoCard
            key={item.id}
            video={item}
            channel={recommended.channelsById[item.channelId]}
            orientation="list"
          />
        ))}
      </aside>
    </div>
  );
}
