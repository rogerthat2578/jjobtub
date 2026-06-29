import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller('videos/:videoId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  listComments(@Param('videoId') videoId: string, @Query('sort') sort: string | undefined, @Req() request: Request) {
    return this.commentsService.listComments(videoId, request, sort);
  }

  @Post()
  createComment(@Param('videoId') videoId: string, @Body() dto: CreateCommentDto, @Req() request: Request) {
    return this.commentsService.createComment(videoId, dto, request);
  }
}

@Controller('comments')
export class CommentActionsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Patch(':id')
  updateComment(@Param('id') id: string, @Body() dto: UpdateCommentDto, @Req() request: Request) {
    return this.commentsService.updateComment(id, dto, request);
  }

  @Delete(':id')
  deleteComment(@Param('id') id: string, @Req() request: Request) {
    return this.commentsService.deleteComment(id, request);
  }

  @Post(':id/like')
  toggleLike(@Param('id') id: string, @Req() request: Request) {
    return this.commentsService.toggleLike(id, request);
  }
}
