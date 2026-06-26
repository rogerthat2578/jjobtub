import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StorageModule } from '../storage/storage.module';
import { VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  imports: [AuthModule, StorageModule],
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}
