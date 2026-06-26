import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

function toCommentResponse(comment: {
  id: string;
  body: string;
  likeCount: number;
  createdAt: Date;
  author: { id: string; displayName: string; avatarUrl: string | null };
}) {
  return {
    id: comment.id,
    body: comment.body,
    likeCount: comment.likeCount,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.author.id,
      displayName: comment.author.displayName,
      avatarUrl: comment.author.avatarUrl,
    },
  };
}

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listComments(videoId: string) {
    const comments = await this.prisma.comment.findMany({
      where: { videoId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      items: comments.map(toCommentResponse),
    };
  }

  async createComment(videoId: string, dto: CreateCommentDto) {
    const video = await this.prisma.video.findUnique({ where: { id: videoId } });
    if (!video) {
      throw new NotFoundException('Video not found');
    }

    const author = dto.authorId
      ? await this.prisma.user.findUnique({ where: { id: dto.authorId } })
      : await this.prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!author) {
      throw new NotFoundException('Author not found');
    }

    const comment = await this.prisma.comment.create({
      data: {
        videoId,
        authorId: author.id,
        body: dto.body,
      },
      include: { author: true },
    });

    return toCommentResponse(comment);
  }
}
