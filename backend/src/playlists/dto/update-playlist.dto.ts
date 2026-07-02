import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdatePlaylistDto {
  @IsString()
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
