import { VideoVisibility } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateVideoDto {
  @IsString()
  @MaxLength(120)
  @IsOptional()
  title?: string;

  @IsString()
  @MaxLength(5000)
  @IsOptional()
  description?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  category?: string;

  @IsEnum(VideoVisibility)
  @IsOptional()
  visibility?: VideoVisibility;
}
