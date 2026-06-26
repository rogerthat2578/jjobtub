import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, VideosModule],
})
export class AppModule {}
