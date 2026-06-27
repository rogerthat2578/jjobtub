import { Body, Controller, Get, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ChannelsService } from './channels.service';
import { UpdateChannelDto } from './dto/update-channel.dto';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get(':id')
  getChannel(@Param('id') id: string) {
    return this.channelsService.getChannel(id);
  }

  @Get(':id/videos')
  getChannelVideos(@Param('id') id: string, @Req() request: Request) {
    return this.channelsService.getChannelVideos(id, request);
  }

  @Patch(':id')
  updateChannel(@Param('id') id: string, @Body() dto: UpdateChannelDto, @Req() request: Request) {
    return this.channelsService.updateChannel(id, dto, request);
  }

  @Post(':id/subscribe')
  toggleSubscription(@Param('id') id: string, @Req() request: Request) {
    return this.channelsService.toggleSubscription(id, request);
  }
}
