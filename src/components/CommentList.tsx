import { ThumbsUp } from "lucide-react";
import type { Comment } from "../types/comment";

type CommentListProps = {
  comments: Comment[];
};

export function CommentList({ comments }: CommentListProps) {
  if (comments.length === 0) {
    return <p className="empty-state">아직 댓글이 없습니다.</p>;
  }

  return (
    <div className="comment-list">
      {comments.map((comment) => (
        <article className="comment" key={comment.id}>
          <img src={comment.avatarUrl} alt="" />
          <div>
            <div className="comment-heading">
              <strong>{comment.author}</strong>
              <span>{comment.postedAt}</span>
            </div>
            <p>{comment.body}</p>
            <span className="comment-like">
              <ThumbsUp size={14} />
              {comment.likes}
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}
