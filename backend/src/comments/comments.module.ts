import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommentActionsController, CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [AuthModule],
  controllers: [CommentsController, CommentActionsController],
  providers: [CommentsService],
})
export class CommentsModule {}
