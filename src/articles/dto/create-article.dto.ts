import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  ARTICLE_BODY_MAX_LENGTH,
  ARTICLE_DESC_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
} from '../articles.constants.js';

export class CreateArticleDto {
  @ApiProperty({ example: 'How to train your dragon' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(ARTICLE_TITLE_MAX_LENGTH)
  title: string;

  @ApiProperty({ example: 'Ever wonder how?' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(ARTICLE_DESC_MAX_LENGTH)
  description: string;

  @ApiProperty({ example: 'It takes a lot of patience...' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(ARTICLE_BODY_MAX_LENGTH)
  body: string;

  @ApiPropertyOptional({ example: ['dragons', 'training'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  tagList?: string[];
}
