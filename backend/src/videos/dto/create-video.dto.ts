import { VideoSource, VideoVisibility } from '@prisma/client';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVideoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(5000)
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  category!: string;

  @IsEnum(VideoVisibility)
  @IsOptional()
  visibility?: VideoVisibility;

  @IsString()
  @IsNotEmpty()
  channelId!: string;

  @IsEnum(VideoSource)
  @IsOptional()
  source?: VideoSource;

  @IsString()
  @MaxLength(2048)
  @IsOptional()
  externalUrl?: string;

  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @IsOptional()
  tags?: string[];
}
