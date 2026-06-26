import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Controller('videos/:videoId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  listComments(@Param('videoId') videoId: string) {
    return this.commentsService.listComments(videoId);
  }

  @Post()
  createComment(@Param('videoId') videoId: string, @Body() dto: CreateCommentDto) {
    return this.commentsService.createComment(videoId, dto);
  }
}
