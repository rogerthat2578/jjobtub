import { Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ChannelsService } from './channels.service';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get(':id')
  getChannel(@Param('id') id: string) {
    return this.channelsService.getChannel(id);
  }

  @Get(':id/videos')
  getChannelVideos(@Param('id') id: string) {
    return this.channelsService.getChannelVideos(id);
  }

  @Post(':id/subscribe')
  toggleSubscription(@Param('id') id: string, @Req() request: Request) {
    return this.channelsService.toggleSubscription(id, request);
  }
}
