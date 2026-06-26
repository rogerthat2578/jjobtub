import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  authorId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  body!: string;
}
