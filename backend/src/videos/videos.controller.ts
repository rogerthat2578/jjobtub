import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Req, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { CreateVideoDto } from './dto/create-video.dto';
import { UpdateVideoDto } from './dto/update-video.dto';
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

  @Get('subscriptions')
  listSubscribedVideos(@Req() request: Request) {
    return this.videosService.listSubscribedVideos(request);
  }

  @Get('library')
  listLibraryVideos(@Req() request: Request) {
    return this.videosService.listLibraryVideos(request);
  }

  @Get('history')
  listHistoryVideos(@Req() request: Request) {
    return this.videosService.listHistoryVideos(request);
  }

  @Get(':id')
  getVideo(@Param('id') id: string, @Req() request: Request) {
    return this.videosService.getVideo(id, request);
  }

  @Post()
  createVideo(@Body() dto: CreateVideoDto, @Req() request: Request) {
    return this.videosService.createVideo(dto, request);
  }

  @Post(':id/view')
  incrementView(@Param('id') id: string, @Req() request: Request) {
    return this.videosService.incrementView(id, request);
  }

  @Post(':id/like')
  toggleLike(@Param('id') id: string, @Req() request: Request) {
    return this.videosService.toggleLike(id, request);
  }

  @Patch(':id')
  updateVideo(@Param('id') id: string, @Body() dto: UpdateVideoDto, @Req() request: Request) {
    return this.videosService.updateVideo(id, dto, request);
  }

  @Delete(':id')
  deleteVideo(@Param('id') id: string, @Req() request: Request) {
    return this.videosService.deleteVideo(id, request);
  }

  @Post(':id/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 524288000 } }))
  uploadOriginal(@Param('id') id: string, @UploadedFile() file: any, @Req() request: Request) {
    return this.videosService.uploadOriginal(id, file, request);
  }

  @Post(':id/thumbnail')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5242880 } }))
  uploadThumbnail(@Param('id') id: string, @UploadedFile() file: any, @Req() request: Request) {
    return this.videosService.uploadThumbnail(id, file, request);
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

  @Get(':id/thumbnail')
  async getThumbnail(@Param('id') id: string, @Res({ passthrough: true }) response: Response) {
    const thumbnail = await this.videosService.getThumbnail(id);
    response.set({
      'Content-Type': thumbnail.contentType,
      'Cache-Control': 'public, max-age=300',
    });

    return thumbnail.stream ? new StreamableFile(thumbnail.stream) : thumbnail.body;
  }
}
