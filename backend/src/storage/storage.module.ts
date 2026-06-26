import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StreamingService } from './streaming.service';

@Module({
  providers: [StorageService, StreamingService],
  exports: [StorageService, StreamingService],
})
export class StorageModule {}
