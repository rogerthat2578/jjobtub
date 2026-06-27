import { VideoVisibility } from '@prisma/client';
import { IsArray, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

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

  @IsArray()
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  @IsOptional()
  tags?: string[];
}
