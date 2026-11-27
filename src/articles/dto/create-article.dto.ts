import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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

const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateArticleDto {
  @ApiProperty({ example: 'How to train your dragon' })
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(ARTICLE_TITLE_MAX_LENGTH)
  title: string;

  @ApiProperty({ example: 'Ever wonder how?' })
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(ARTICLE_DESC_MAX_LENGTH)
  description: string;

  @ApiProperty({ example: 'It takes a lot of patience...' })
  @Transform(trimString)
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
