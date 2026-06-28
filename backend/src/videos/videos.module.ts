import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StorageModule } from '../storage/storage.module';
import { VideosController } from './videos.controller';
import { VideoThumbnailService } from './video-thumbnail.service';
import { VideosService } from './videos.service';

@Module({
  imports: [AuthModule, StorageModule, NotificationsModule],
  controllers: [VideosController],
  providers: [VideosService, VideoThumbnailService],
  exports: [VideosService],
})
export class VideosModule {}
