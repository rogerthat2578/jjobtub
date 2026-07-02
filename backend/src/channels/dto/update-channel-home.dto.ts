import { IsArray, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateChannelHomeDto {
  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MaxLength(80)
  featuredVideoId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @IsString()
  @MaxLength(80)
  featuredPlaylistId?: string | null;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  homeSectionOrder?: string[];
}
