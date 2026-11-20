import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  DEFAULT_ARTICLES_LIMIT,
  MAX_ARTICLES_LIMIT,
} from '../articles.constants.js';

export class ListArticlesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by tag name' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filter by author username' })
  @IsOptional()
  @IsString()
  author?: string;

  @ApiPropertyOptional({ description: 'Filter by favorited by username' })
  @IsOptional()
  @IsString()
  favorited?: string;

  @ApiPropertyOptional({ default: DEFAULT_ARTICLES_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_ARTICLES_LIMIT)
  limit?: number = DEFAULT_ARTICLES_LIMIT;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
