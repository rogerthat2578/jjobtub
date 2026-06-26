import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

type CommentWithAuthor = {
  id: string;
  body: string;
  likeCount: number;
  createdAt: Date;
  parentId: string | null;
  author: { id: string; displayName: string; avatarUrl: string | null };
  replies?: CommentWithAuthor[];
};

export type CommentResponse = {
  id: string;
  body: string;
  likeCount: number;
  createdAt: string;
  parentId: string | null;
  author: { id: string; displayName: string; avatarUrl: string | null };
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
    replies: comment.replies?.map(toCommentResponse) ?? [],
  };
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async listComments(videoId: string) {
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

    return {
      items: comments.map(toCommentResponse),
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

    if (dto.parentId) {
      const parent = await this.prisma.comment.findUnique({ where: { id: dto.parentId } });
      if (!parent || parent.videoId !== videoId) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const comment = await this.prisma.comment.create({
      data: {
        videoId,
        authorId: author.id,
        parentId: dto.parentId,
        body: dto.body,
      },
      include: { author: true, replies: { include: { author: true } } },
    });

    return toCommentResponse(comment);
  }
}
