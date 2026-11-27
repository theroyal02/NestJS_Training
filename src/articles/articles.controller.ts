import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { ArticlesService } from './articles.service.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { FeedArticlesQueryDto } from './dto/feed-articles-query.dto.js';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import {
  MultipleArticlesResponse,
  SingleArticleResponse,
} from './interfaces/article-response.interface.js';

@ApiTags('Articles')
@Controller('api/articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new article' })
  @ApiResponse({ status: 201, description: 'Article created successfully' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createArticle(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateArticleDto,
  ): Promise<SingleArticleResponse> {
    return this.articlesService.createArticle(user.sub, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List articles with filters' })
  @ApiResponse({ status: 200, description: 'List of articles' })
  async listArticles(
    @Query() query: ListArticlesQueryDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<MultipleArticlesResponse> {
    return this.articlesService.listArticles(query, user?.sub);
  }

  @Get('feed')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get feed of articles by followed users' })
  @ApiResponse({ status: 200, description: 'User feed articles' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async feedArticles(
    @Query() query: FeedArticlesQueryDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<MultipleArticlesResponse> {
    return this.articlesService.feedArticles(query, user.sub);
  }

  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an article by slug' })
  @ApiResponse({ status: 200, description: 'Article details' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async getArticle(
    @Param('slug') slug: string,
    @CurrentUser() user?: JwtPayload,
  ): Promise<SingleArticleResponse> {
    return this.articlesService.getArticleBySlug(slug, user?.sub);
  }

  @Put(':slug')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update an article' })
  @ApiResponse({ status: 200, description: 'Article updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not author' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async updateArticle(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateArticleDto,
  ): Promise<SingleArticleResponse> {
    return this.articlesService.updateArticle(slug, user.sub, dto);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete an article' })
  @ApiResponse({ status: 204, description: 'Article deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - not author' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async deleteArticle(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.articlesService.deleteArticle(slug, user.sub);
  }

  @Post(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Favorite an article' })
  @ApiResponse({ status: 200, description: 'Article favorited' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async favoriteArticle(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SingleArticleResponse> {
    return this.articlesService.favoriteArticle(slug, user.sub);
  }

  @Delete(':slug/favorite')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfavorite an article' })
  @ApiResponse({ status: 200, description: 'Article unfavorited' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async unfavoriteArticle(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<SingleArticleResponse> {
    return this.articlesService.unfavoriteArticle(slug, user.sub);
  }
}
