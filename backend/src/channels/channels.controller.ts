import { Controller, Get, Param } from '@nestjs/common';
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
}
