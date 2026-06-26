import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ChannelsModule } from './channels/channels.module';
import { CommentsModule } from './comments/comments.module';
import { PrismaModule } from './prisma/prisma.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, VideosModule, ChannelsModule, CommentsModule],
})
export class AppModule {}
