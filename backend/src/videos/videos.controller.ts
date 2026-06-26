import { Body, Controller, Get, Headers, Param, Post, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { CreateVideoDto } from './dto/create-video.dto';
import { VideosService } from './videos.service';

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Get()
  listVideos(
    @Query('q') q?: string,
    @Query('category') category?: string,
    @Query('channelId') channelId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.videosService.listVideos({
      q,
      category,
      channelId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get(':id')
  getVideo(@Param('id') id: string) {
    return this.videosService.getVideo(id);
  }

  @Post()
  createVideo(@Body() dto: CreateVideoDto) {
    return this.videosService.createVideo(dto);
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 524288000 } }))
  uploadOriginal(@Param('id') id: string, @UploadedFile() file: any) {
    return this.videosService.uploadOriginal(id, file);
  }

  @Get(':id/stream')
  async streamOriginal(
    @Param('id') id: string,
    @Headers('range') range: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
    const streamResponse = await this.videosService.streamOriginal(id, range);
    response.status(streamResponse.statusCode);
    response.set(streamResponse.headers);

    return new StreamableFile(streamResponse.stream);
  }
}
