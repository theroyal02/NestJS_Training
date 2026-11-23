import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
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
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import {
  MultipleCommentsResponse,
  SingleCommentResponse,
} from './interfaces/comment-response.interface.js';

@ApiTags('Comments')
@Controller('api/articles/:slug/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a comment to an article' })
  @ApiResponse({ status: 201, description: 'Comment added successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or missing body',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async addComment(
    @Param('slug') slug: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateCommentDto,
  ): Promise<SingleCommentResponse> {
    return this.commentsService.addComment(slug, user.sub, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all comments for an article' })
  @ApiResponse({ status: 200, description: 'List of article comments' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  async getComments(
    @Param('slug') slug: string,
    @CurrentUser() user?: JwtPayload,
  ): Promise<MultipleCommentsResponse> {
    return this.commentsService.getComments(slug, user?.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a comment from an article' })
  @ApiResponse({ status: 204, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - not author of comment',
  })
  @ApiResponse({ status: 404, description: 'Article or comment not found' })
  async deleteComment(
    @Param('slug') slug: string,
    @Param('id', ParseIntPipe) commentId: number,
    @CurrentUser() user: JwtPayload,
  ): Promise<void> {
    return this.commentsService.deleteComment(slug, commentId, user.sub);
  }
}
