import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateArticleDto {
  @ApiPropertyOptional({ example: 'How to train your dragon - Part 2' })
  @IsOptional()
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(ARTICLE_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(ARTICLE_DESC_MAX_LENGTH)
  description?: string;

  @ApiPropertyOptional({ example: 'Updated content...' })
  @IsOptional()
  @Transform(trimString)
  @IsNotEmpty()
  @IsString()
  @MaxLength(ARTICLE_BODY_MAX_LENGTH)
  body?: string;

  @ApiPropertyOptional({ example: ['dragons', 'movies'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(30)
  tagList?: string[];
}
