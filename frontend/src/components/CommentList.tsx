import { Check, ChevronDown, ChevronUp, MessageSquareReply, Pencil, ThumbsUp, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useToast } from "./ToastProvider";
import type { Comment } from "../types/comment";

type CommentListProps = {
  comments: Comment[];
  currentUserId?: string;
  canReply: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
  onUpdate: (commentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onLike: (commentId: string) => Promise<void>;
};

type CommentItemProps = CommentListProps & {
  comment: Comment;
  depth?: number;
};

export function CommentList(props: CommentListProps) {
  if (props.comments.length === 0) {
    return <p className="empty-state">아직 댓글이 없습니다.</p>;
  }

  return (
    <div className="comment-list">
      {props.comments.map((comment) => (
        <CommentItem key={comment.id} {...props} comment={comment} />
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  currentUserId,
  canReply,
  onReply,
  onUpdate,
  onDelete,
  onLike,
  depth = 0,
}: CommentItemProps) {
  const { showToast } = useToast();
  const [isReplying, setIsReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [actionError, setActionError] = useState("");
  const [isActionBusy, setIsActionBusy] = useState(false);
  const [areRepliesCollapsed, setAreRepliesCollapsed] = useState(false);
  const isOwner = Boolean(currentUserId && currentUserId === comment.authorId);
  const hasReplies = comment.replies.length > 0;

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canReply) {
      showToast("로그인 후 답글을 작성할 수 있습니다.", "error");
      return;
    }

    const trimmedBody = replyBody.trim();
    if (!trimmedBody) {
      setReplyError("답글 내용을 입력하세요.");
      return;
    }

    setIsSubmittingReply(true);
    setReplyError("");

    try {
      await onReply(comment.id, trimmedBody);
      setReplyBody("");
      setIsReplying(false);
      setAreRepliesCollapsed(false);
    } catch {
      setReplyError("답글을 등록하지 못했습니다.");
    } finally {
      setIsSubmittingReply(false);
    }
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedBody = editBody.trim();
    if (!trimmedBody) {
      setActionError("댓글 내용을 입력하세요.");
      return;
    }

    setIsActionBusy(true);
    setActionError("");

    try {
      await onUpdate(comment.id, trimmedBody);
      setIsEditing(false);
    } catch {
      setActionError("댓글을 수정하지 못했습니다.");
    } finally {
      setIsActionBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("이 댓글을 삭제할까요?")) {
      return;
    }

    setIsActionBusy(true);
    setActionError("");

    try {
      await onDelete(comment.id);
    } catch {
      setActionError("댓글을 삭제하지 못했습니다.");
      setIsActionBusy(false);
    }
  }

  async function handleLike() {
    if (!canReply) {
      showToast("로그인 후 좋아요를 누를 수 있습니다.", "error");
      return;
    }

    setIsActionBusy(true);
    setActionError("");

    try {
      await onLike(comment.id);
    } catch {
      setActionError("댓글 좋아요 상태를 변경하지 못했습니다.");
    } finally {
      setIsActionBusy(false);
    }
  }

  return (
    <article className={`comment ${depth > 0 ? "comment-reply" : ""}`}>
      <img src={comment.avatarUrl} alt="" />
      <div className="comment-content">
        {isEditing ? (
          <form className="comment-edit-form" onSubmit={handleEditSubmit}>
            <textarea
              maxLength={1000}
              value={editBody}
              onChange={(event) => setEditBody(event.target.value)}
              disabled={isActionBusy}
            />
            <div className="comment-form-actions">
              {actionError ? <p className="form-error">{actionError}</p> : <span />}
              <div className="comment-inline-actions">
                <button
                  className="icon-button"
                  type="button"
                  title="수정 취소"
                  onClick={() => {
                    setIsEditing(false);
                    setEditBody(comment.body);
                    setActionError("");
                  }}
                  disabled={isActionBusy}
                >
                  <X size={16} />
                </button>
                <button className="icon-button" type="submit" title="댓글 저장" disabled={isActionBusy}>
                  <Check size={16} />
                </button>
              </div>
            </div>
          </form>
        ) : (
          <CommentBody comment={comment} />
        )}

        <div className="comment-tools">
          <button
            className={`text-button ${comment.likedByMe ? "active-text-button" : ""}`}
            type="button"
            onClick={handleLike}
            disabled={isActionBusy}
            aria-pressed={comment.likedByMe}
          >
            <ThumbsUp size={14} />
            {comment.likes}
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => {
              if (!canReply) {
                showToast("로그인 후 답글을 작성할 수 있습니다.", "error");
                return;
              }
              setIsReplying((current) => !current);
              setReplyBody("");
              setReplyError("");
            }}
          >
            <MessageSquareReply size={14} />
            답글
          </button>
          {isOwner && !isEditing && (
            <>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setIsEditing(true);
                  setEditBody(comment.body);
                  setActionError("");
                }}
              >
                <Pencil size={14} />
                수정
              </button>
              <button className="text-button danger-text-button" type="button" onClick={handleDelete} disabled={isActionBusy}>
                <Trash2 size={14} />
                삭제
              </button>
            </>
          )}
          {hasReplies && (
            <button className="text-button" type="button" onClick={() => setAreRepliesCollapsed((current) => !current)}>
              {areRepliesCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              답글 {comment.replies.length}개
            </button>
          )}
        </div>

        {actionError && !isEditing && <p className="form-error comment-action-error">{actionError}</p>}

        {isReplying && (
          <form className="reply-form" onSubmit={handleReplySubmit}>
            <textarea
              maxLength={1000}
              placeholder="답글을 입력하세요"
              value={replyBody}
              onChange={(event) => setReplyBody(event.target.value)}
              disabled={!canReply || isSubmittingReply}
            />
            <div className="comment-form-actions">
              {replyError ? <p className="form-error">{replyError}</p> : <span />}
              <button className="pill-button" type="submit" disabled={!canReply || isSubmittingReply}>
                {isSubmittingReply ? "등록 중" : "답글 등록"}
              </button>
            </div>
          </form>
        )}

        {hasReplies && !areRepliesCollapsed && (
          <div className="reply-list">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                comments={[]}
                currentUserId={currentUserId}
                canReply={canReply}
                onReply={onReply}
                onUpdate={onUpdate}
                onDelete={onDelete}
                onLike={onLike}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function CommentBody({ comment }: { comment: Comment }) {
  return (
    <>
      <div className="comment-heading">
        <strong>{comment.author}</strong>
        <span>{comment.postedAt}</span>
      </div>
      <p>{comment.body}</p>
    </>
  );
}
