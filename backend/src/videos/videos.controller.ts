import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
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
}
