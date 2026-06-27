import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateChannelDto {
  @IsString()
  @MaxLength(80)
  @IsOptional()
  name?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  description?: string;

  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  @IsOptional()
  avatarUrl?: string;

  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  @IsOptional()
  bannerUrl?: string;
}
