import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { CommentsModule } from './comments/comments.module';
import { PrismaModule } from './prisma/prisma.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, VideosModule, ChannelsModule, CommentsModule, PlaylistsModule],
})
export class AppModule {}
