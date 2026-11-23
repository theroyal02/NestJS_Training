import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { In, Repository } from 'typeorm';
import { Article } from '../database/entities/article.entity.js';
import { Comment } from '../database/entities/comment.entity.js';
import { Follow } from '../database/entities/follow.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import {
  MultipleCommentsResponse,
  SingleCommentResponse,
} from './interfaces/comment-response.interface.js';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly i18n: I18nService,
  ) {}

  async addComment(
    slug: string,
    authorId: number,
    dto: CreateCommentDto,
  ): Promise<SingleCommentResponse> {
    const body = dto.extractBody();
    if (!body) {
      throw new BadRequestException(
        this.i18n.t('messages.comments.body_required'),
      );
    }

    const article = await this.articleRepository.findOne({
      where: { slug },
      select: { id: true, slug: true },
    });
    if (!article) {
      throw new NotFoundException(
        this.i18n.t('messages.articles.article_not_found'),
      );
    }

    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new NotFoundException(this.i18n.t('messages.users.user_not_found'));
    }

    const comment = this.commentRepository.create({
      body,
      authorId,
      articleId: article.id,
    });
    const saved = await this.commentRepository.save(comment);

    return {
      comment: {
        id: saved.id,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
        body: saved.body,
        author: {
          username: author.username,
          bio: author.bio,
          image: author.image,
          following: false,
        },
      },
    };
  }

  async getComments(
    slug: string,
    viewerId?: number,
  ): Promise<MultipleCommentsResponse> {
    const article = await this.articleRepository.findOne({
      where: { slug },
      select: { id: true },
    });
    if (!article) {
      throw new NotFoundException(
        this.i18n.t('messages.articles.article_not_found'),
      );
    }

    const comments = await this.commentRepository.find({
      where: { articleId: article.id },
      relations: { author: true },
      order: { createdAt: 'DESC', id: 'DESC' },
    });

    if (comments.length === 0) {
      return { comments: [] };
    }

    let followingSet = new Set<number>();
    if (viewerId) {
      const authorIds = [...new Set(comments.map((c) => c.authorId))];
      const follows = await this.followRepository.find({
        where: { followerId: viewerId, followingId: In(authorIds) },
        select: { followingId: true },
      });
      followingSet = new Set(follows.map((f) => f.followingId));
    }

    return {
      comments: comments.map((comment) => ({
        id: comment.id,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        body: comment.body,
        author: {
          username: comment.author?.username || '',
          bio: comment.author?.bio || null,
          image: comment.author?.image || null,
          following: followingSet.has(comment.authorId),
        },
      })),
    };
  }

  async deleteComment(
    slug: string,
    commentId: number,
    currentUserId: number,
  ): Promise<void> {
    const article = await this.articleRepository.findOne({
      where: { slug },
      select: { id: true },
    });
    if (!article) {
      throw new NotFoundException(
        this.i18n.t('messages.articles.article_not_found'),
      );
    }

    const comment = await this.commentRepository.findOne({
      where: { id: commentId, articleId: article.id },
      select: { id: true, authorId: true },
    });
    if (!comment) {
      throw new NotFoundException(
        this.i18n.t('messages.comments.comment_not_found'),
      );
    }

    if (comment.authorId !== currentUserId) {
      throw new ForbiddenException(
        this.i18n.t('messages.comments.not_comment_author'),
      );
    }

    await this.commentRepository.delete(comment.id);
  }
}
