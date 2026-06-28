import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

type CommentWithAuthor = {
  id: string;
  body: string;
  likeCount: number;
  createdAt: Date;
  parentId: string | null;
  author: { id: string; displayName: string; avatarUrl: string | null };
  likedByMe?: boolean;
  replies?: CommentWithAuthor[];
};

export type CommentResponse = {
  id: string;
  body: string;
  likeCount: number;
  createdAt: string;
  parentId: string | null;
  author: { id: string; displayName: string; avatarUrl: string | null };
  likedByMe: boolean;
  replies: CommentResponse[];
};

function toCommentResponse(comment: CommentWithAuthor): CommentResponse {
  return {
    id: comment.id,
    body: comment.body,
    likeCount: comment.likeCount,
    createdAt: comment.createdAt.toISOString(),
    parentId: comment.parentId,
    author: {
      id: comment.author.id,
      displayName: comment.author.displayName,
      avatarUrl: comment.author.avatarUrl,
    },
    likedByMe: Boolean(comment.likedByMe),
    replies: comment.replies?.map(toCommentResponse) ?? [],
  };
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly notifications: NotificationsService,
  ) {}

  async listComments(videoId: string, request?: Pick<Request, 'headers'>) {
    const comments = await this.prisma.comment.findMany({
      where: { videoId, parentId: null },
      include: {
        author: true,
        replies: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const currentUser = request ? await this.authService.getCurrentUser(request) : null;
    if (!currentUser) {
      return {
        items: comments.map(toCommentResponse),
      };
    }

    const commentIds = collectCommentIds(comments);
    const likes = await this.prisma.commentLike.findMany({
      where: { userId: currentUser.id, commentId: { in: commentIds } },
      select: { commentId: true },
    });
    const likedCommentIds = new Set(likes.map((like) => like.commentId));

    return {
      items: comments.map((comment) => toCommentResponse(markLikedByMe(comment, likedCommentIds))),
    };
  }

  async createComment(videoId: string, dto: CreateCommentDto, request?: Pick<Request, 'headers'>) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const currentUser = request ? await this.authService.getCurrentUser(request) : null;
    const author = currentUser
      ? await this.prisma.user.findUnique({ where: { id: currentUser.id } })
      : dto.authorId
        ? await this.prisma.user.findUnique({ where: { id: dto.authorId } })
        : null;
    if (!author) {
      throw new UnauthorizedException('Login required');
    }

    let parentComment: { id: string; videoId: string; authorId: string } | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.videoId !== videoId) {
        throw new NotFoundException('Parent comment not found');
      }
      parentComment = parent;
    }

    const comment = await this.prisma.comment.create({
      data: {
        videoId,
        authorId: author.id,
        parentId: dto.parentId,
        body: dto.body.trim(),
      },
      include: { author: true, replies: { include: { author: true } } },
    });

    if (parentComment) {
      await this.notifications.createNotification({
        userId: parentComment.authorId,
        actorId: author.id,
        type: 'REPLY',
        message: `${author.displayName}님이 내 댓글에 답글을 남겼습니다.`,
        linkUrl: `/watch/${videoId}`,
      });
    } else {
      const videoWithChannel = await this.prisma.video.findUnique({
        where: { id: videoId },
        include: { channel: true },
      });
      if (videoWithChannel) {
        await this.notifications.createNotification({
          userId: videoWithChannel.channel.ownerId,
          actorId: author.id,
          type: 'COMMENT',
          message: `${author.displayName}님이 내 영상에 댓글을 남겼습니다.`,
          linkUrl: `/watch/${videoId}`,
        });
      }
    }

    return toCommentResponse(comment);
  }

  async updateComment(id: string, dto: UpdateCommentDto, request: Pick<Request, 'headers'>) {
    const comment = await this.assertCommentAuthor(id, request);
    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException('Comment body is required');
    }

    const updatedComment = await this.prisma.comment.update({
      where: { id: comment.id },
      data: { body },
      include: { author: true, replies: { include: { author: true } } },
    });

    return toCommentResponse(updatedComment);
  }

  async deleteComment(id: string, request: Pick<Request, 'headers'>) {
    const comment = await this.assertCommentAuthor(id, request);
    await this.prisma.comment.delete({ where: { id: comment.id } });

    return { ok: true };
  }

  async toggleLike(id: string, request: Pick<Request, 'headers'>) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }

    const targetComment = await this.ensureCommentExists(id);
    const key = { commentId_userId: { commentId: id, userId: user.id } };
    const existingLike = await this.prisma.commentLike.findUnique({ where: key });
    if (existingLike) {
      await this.prisma.commentLike.delete({ where: key });
      const comment = await this.prisma.comment.update({
        where: { id },
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      });

      return { liked: false, likes: comment.likeCount };
    }

    await this.prisma.commentLike.create({ data: { commentId: id, userId: user.id } });
    const comment = await this.prisma.comment.update({
      where: { id },
      data: { likeCount: { increment: 1 } },
      select: { likeCount: true },
    });
    await this.notifications.createNotification({
      userId: targetComment.authorId,
      actorId: user.id,
      type: 'COMMENT_LIKE',
      message: `${user.displayName}님이 내 댓글을 좋아합니다.`,
      linkUrl: `/watch/${targetComment.videoId}`,
    });

    return { liked: true, likes: comment.likeCount };
  }

  private async assertCommentAuthor(id: string, request: Pick<Request, 'headers'>) {
    const user = await this.authService.getCurrentUser(request);
    if (!user) {
      throw new UnauthorizedException('Login required');
    }

    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== user.id) {
      throw new ForbiddenException('Only the comment author can manage this comment');
    }

    return comment;
  }

  private async ensureCommentExists(id: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id } });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }
}

function collectCommentIds(comments: CommentWithAuthor[]) {
  return comments.flatMap((comment) => [comment.id, ...(comment.replies?.map((reply) => reply.id) ?? [])]);
}

function markLikedByMe(comment: CommentWithAuthor, likedCommentIds: Set<string>): CommentWithAuthor {
  return {
    ...comment,
    likedByMe: likedCommentIds.has(comment.id),
    replies: comment.replies?.map((reply) => markLikedByMe(reply, likedCommentIds)),
  };
}
