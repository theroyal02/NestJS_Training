import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { COMMENT_BODY_MAX_LENGTH } from '../comments.constants.js';

export class CommentPayloadDto {
  @ApiProperty({ example: 'Thank you for this insightful article!' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsNotEmpty()
  @IsString()
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  body: string;
}

export class CreateCommentDto {
  @ApiProperty({ type: CommentPayloadDto })
  @ValidateNested()
  @IsObject()
  @IsNotEmpty()
  @Type(() => CommentPayloadDto)
  comment: CommentPayloadDto;
}
