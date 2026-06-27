import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { PlaylistsService } from './playlists.service';

@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Get()
  listPlaylists(@Req() request: Request) {
    return this.playlistsService.listPlaylists(request);
  }

  @Post()
  createPlaylist(@Body('name') name: string, @Req() request: Request) {
    return this.playlistsService.createPlaylist(name, request);
  }

  @Get(':id/videos')
  listPlaylistVideos(@Param('id') id: string, @Query('order') order: string | undefined, @Req() request: Request) {
    return this.playlistsService.listPlaylistVideos(id, request, order);
  }

  @Post(':id/items')
  addPlaylistItem(@Param('id') id: string, @Body('videoId') videoId: string, @Req() request: Request) {
    return this.playlistsService.addPlaylistItem(id, videoId, request);
  }

  @Delete(':id/items/:videoId')
  removePlaylistItem(@Param('id') id: string, @Param('videoId') videoId: string, @Req() request: Request) {
    return this.playlistsService.removePlaylistItem(id, videoId, request);
  }

  @Patch(':id/items/reorder')
  reorderPlaylistItems(@Param('id') id: string, @Body('videoIds') videoIds: string[], @Req() request: Request) {
    return this.playlistsService.reorderPlaylistItems(id, videoIds, request);
  }
}
