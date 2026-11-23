import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { COMMENT_BODY_MAX_LENGTH } from '../comments.constants.js';

export class CommentPayloadDto {
  @ApiProperty({ example: 'Thank you for this insightful article!' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  body: string;
}

export class CreateCommentDto {
  @ApiPropertyOptional({ type: CommentPayloadDto })
  @IsOptional()
  @ValidateNested()
  @IsObject()
  @Type(() => CommentPayloadDto)
  comment?: CommentPayloadDto;

  @ApiPropertyOptional({ example: 'Thank you for this insightful article!' })
  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_BODY_MAX_LENGTH)
  body?: string;

  extractBody(): string {
    return (this.comment?.body || this.body || '').trim();
  }
}
