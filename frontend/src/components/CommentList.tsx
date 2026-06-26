import { MessageSquareReply, ThumbsUp } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { Comment } from "../types/comment";

type CommentListProps = {
  comments: Comment[];
  canReply: boolean;
  onReply: (parentId: string, body: string) => Promise<void>;
};

export function CommentList({ comments, canReply, onReply }: CommentListProps) {
  const [activeReplyId, setActiveReplyId] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>, parentId: string) {
    event.preventDefault();

    const trimmedBody = replyBody.trim();
    if (!trimmedBody) {
      setReplyError("답글 내용을 입력하세요.");
      return;
    }

    setIsSubmittingReply(true);
    setReplyError("");

    try {
      await onReply(parentId, trimmedBody);
      setReplyBody("");
      setActiveReplyId("");
    } catch {
      setReplyError("답글을 등록하지 못했습니다.");
    } finally {
      setIsSubmittingReply(false);
    }
  }

  if (comments.length === 0) {
    return <p className="empty-state">아직 댓글이 없습니다.</p>;
  }

  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <article className="comment" key={comment.id}>
          <img src={comment.avatarUrl} alt="" />
          <div className="comment-content">
            <CommentBody comment={comment} />
            <div className="comment-tools">
              <span className="comment-like">
                <ThumbsUp size={14} />
                {comment.likes}
              </span>
              <button
                className="text-button"
                type="button"
                onClick={() => {
                  setActiveReplyId((currentId) => (currentId === comment.id ? "" : comment.id));
                  setReplyBody("");
                  setReplyError("");
                }}
              >
                <MessageSquareReply size={14} />
                답글
              </button>
            </div>

            {activeReplyId === comment.id && (
              <form className="reply-form" onSubmit={(event) => handleReplySubmit(event, comment.id)}>
                {!canReply && <p className="form-error">로그인 후 답글을 작성할 수 있습니다.</p>}
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

            {comment.replies.length > 0 && (
              <div className="reply-list">
                {comment.replies.map((reply) => (
                  <article className="comment comment-reply" key={reply.id}>
                    <img src={reply.avatarUrl} alt="" />
                    <div className="comment-content">
                      <CommentBody comment={reply} />
                      <span className="comment-like">
                        <ThumbsUp size={14} />
                        {reply.likes}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
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
