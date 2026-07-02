import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @MaxLength(60)
  @IsOptional()
  displayName?: string;

  @IsString()
  @MaxLength(1000)
  @IsOptional()
  avatarUrl?: string;
}
