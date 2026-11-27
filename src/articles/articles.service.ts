import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ArticleFavorite } from '../database/entities/article-favorite.entity.js';
import { ArticleTag } from '../database/entities/article-tag.entity.js';
import { Article } from '../database/entities/article.entity.js';
import { Follow } from '../database/entities/follow.entity.js';
import { Tag } from '../database/entities/tag.entity.js';
import { User } from '../users/entities/user.entity.js';
import {
  DEFAULT_ARTICLES_LIMIT,
  TAG_NAME_MAX_LENGTH,
} from './articles.constants.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { FeedArticlesQueryDto } from './dto/feed-articles-query.dto.js';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { toArticleResponse } from './helpers/article-mapper.helper.js';
import { generateSlug } from './helpers/slug.helper.js';
import {
  ArticleResponse,
  MultipleArticlesResponse,
  SingleArticleResponse,
} from './interfaces/article-response.interface.js';

@Injectable()
export class ArticlesService {
  constructor(
    @InjectRepository(Article)
    private readonly articleRepository: Repository<Article>,
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(ArticleTag)
    private readonly articleTagRepository: Repository<ArticleTag>,
    @InjectRepository(ArticleFavorite)
    private readonly favoriteRepository: Repository<ArticleFavorite>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
  ) {}

  async createArticle(
    authorId: number,
    dto: CreateArticleDto,
  ): Promise<SingleArticleResponse> {
    const author = await this.userRepository.findOne({
      where: { id: authorId },
    });
    if (!author) {
      throw new NotFoundException(this.i18n.t('messages.users.user_not_found'));
    }

    const slug = generateSlug(dto.title);
    const tagNames = this.sanitizeTags(dto.tagList);

    const savedArticle = await this.dataSource.transaction(async (manager) => {
      const articleRepo = manager.getRepository(Article);

      const article = articleRepo.create({
        slug,
        title: dto.title,
        description: dto.description,
        body: dto.body,
        authorId,
      });
      const persistedArticle = await articleRepo.save(article);

      if (tagNames.length > 0) {
        await this.syncTags(manager, persistedArticle.id, tagNames);
      }

      persistedArticle.author = author;
      return persistedArticle;
    });

    return {
      article: toArticleResponse(savedArticle, {
        favorited: false,
        favoritesCount: 0,
        following: false,
        tagList: tagNames,
      }),
    };
  }

  async getArticleBySlug(
    slug: string,
    viewerId?: number,
  ): Promise<SingleArticleResponse> {
    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: {
        author: true,
        articleTags: {
          tag: true,
        },
      },
    });

    if (!article) {
      throw new NotFoundException(
        this.i18n.t('messages.articles.article_not_found'),
      );
    }

    const [favoritesCount, isFavorited, isFollowing] = await Promise.all([
      this.favoriteRepository.count({ where: { articleId: article.id } }),
      viewerId
        ? this.favoriteRepository.exists({
            where: { articleId: article.id, userId: viewerId },
          })
        : Promise.resolve(false),
      viewerId && viewerId !== article.authorId
        ? this.followRepository.exists({
            where: { followerId: viewerId, followingId: article.authorId },
          })
        : Promise.resolve(false),
    ]);

    return {
      article: toArticleResponse(article, {
        favorited: isFavorited,
        favoritesCount,
        following: isFollowing,
      }),
    };
  }

  async updateArticle(
    slug: string,
    authorId: number,
    dto: UpdateArticleDto,
  ): Promise<SingleArticleResponse> {
    const article = await this.articleRepository.findOne({
      where: { slug },
      relations: { author: true },
    });

    if (!article) {
      throw new NotFoundException(
        this.i18n.t('messages.articles.article_not_found'),
      );
    }

    if (article.authorId !== authorId) {
      throw new ForbiddenException(
        this.i18n.t('messages.articles.not_article_author'),
      );
    }

    const tagNames = dto.tagList ? this.sanitizeTags(dto.tagList) : null;

    const updated = await this.dataSource.transaction(async (manager) => {
      const articleRepo = manager.getRepository(Article);

      if (dto.title && dto.title !== article.title) {
        article.title = dto.title;
        article.slug = generateSlug(article.title);
      }
      if (dto.description !== undefined) {
        article.description = dto.description;
      }
      if (dto.body !== undefined) {
        article.body = dto.body;
      }

      const saved = await articleRepo.save(article);

      if (tagNames !== null) {
        await this.syncTags(manager, article.id, tagNames);
      }

      return saved;
    });

    return this.getArticleBySlug(updated.slug, authorId);
  }

  async deleteArticle(slug: string, authorId: number): Promise<void> {
    const article = await this.articleRepository.findOne({ where: { slug } });
    if (!article) {
      throw new NotFoundException(
        this.i18n.t('messages.articles.article_not_found'),
      );
    }

    if (article.authorId !== authorId) {
      throw new ForbiddenException(
        this.i18n.t('messages.articles.not_article_author'),
      );
    }

    await this.articleRepository.delete(article.id);
  }

  async listArticles(
    query: ListArticlesQueryDto,
    viewerId?: number,
  ): Promise<MultipleArticlesResponse> {
    const qb = this.articleRepository
      .createQueryBuilder('article')
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.articleTags', 'articleTag')
      .leftJoinAndSelect('articleTag.tag', 'tag');

    if (query.tag) {
      qb.innerJoin('article.articleTags', 'filterArticleTag').innerJoin(
        'filterArticleTag.tag',
        'filterTag',
        'filterTag.name = :tagName',
        { tagName: query.tag },
      );
    }

    if (query.author) {
      qb.andWhere('author.username = :authorUsername', {
        authorUsername: query.author,
      });
    }

    if (query.favorited) {
      qb.innerJoin('article.favorites', 'filterFav').innerJoin(
        'filterFav.user',
        'favoritedUser',
        'favoritedUser.username = :favoritedUsername',
        { favoritedUsername: query.favorited },
      );
    }

    const limit = query.limit ?? DEFAULT_ARTICLES_LIMIT;
    const offset = query.offset ?? 0;

    qb.orderBy('article.createdAt', 'DESC');
    qb.skip(offset).take(limit);

    const [articles, articlesCount] = await qb.getManyAndCount();

    const formattedArticles = await this.buildArticlesResponseList(
      articles,
      viewerId,
    );

    return {
      articles: formattedArticles,
      articlesCount,
    };
  }

  async feedArticles(
    query: FeedArticlesQueryDto,
    viewerId: number,
  ): Promise<MultipleArticlesResponse> {
    const follows = await this.followRepository.find({
      where: { followerId: viewerId },
      select: { followingId: true },
    });

    if (follows.length === 0) {
      return { articles: [], articlesCount: 0 };
    }

    const followingIds = follows.map((f) => f.followingId);
    const limit = query.limit ?? DEFAULT_ARTICLES_LIMIT;
    const offset = query.offset ?? 0;

    const [articles, articlesCount] = await this.articleRepository.findAndCount(
      {
        where: { authorId: In(followingIds) },
        relations: {
          author: true,
          articleTags: {
            tag: true,
          },
        },
        order: { createdAt: 'DESC' },
        skip: offset,
        take: limit,
      },
    );

    const formattedArticles = await this.buildArticlesResponseList(
      articles,
      viewerId,
    );

    return {
      articles: formattedArticles,
      articlesCount,
    };
  }

  async favoriteArticle(
    slug: string,
    userId: number,
  ): Promise<SingleArticleResponse> {
    const article = await this.articleRepository.findOne({ where: { slug } });
    if (!article) {
      throw new NotFoundException(
        this.i18n.t('messages.articles.article_not_found'),
      );
    }

    await this.favoriteRepository
      .createQueryBuilder()
      .insert()
      .into(ArticleFavorite)
      .values({ userId, articleId: article.id })
      .orIgnore()
      .execute();

    return this.getArticleBySlug(slug, userId);
  }

  async unfavoriteArticle(
    slug: string,
    userId: number,
  ): Promise<SingleArticleResponse> {
    const article = await this.articleRepository.findOne({ where: { slug } });
    if (!article) {
      throw new NotFoundException(
        this.i18n.t('messages.articles.article_not_found'),
      );
    }

    await this.favoriteRepository.delete({ userId, articleId: article.id });
    return this.getArticleBySlug(slug, userId);
  }

  private async syncTags(
    manager: EntityManager,
    articleId: number,
    tagNames: string[],
  ): Promise<void> {
    const articleTagRepo = manager.getRepository(ArticleTag);
    await articleTagRepo.delete({ articleId });

    if (tagNames.length === 0) return;

    const tagRepo = manager.getRepository(Tag);
    await tagRepo
      .createQueryBuilder()
      .insert()
      .into(Tag)
      .values(tagNames.map((name) => ({ name })))
      .orIgnore()
      .execute();

    const tags = await tagRepo.find({ where: { name: In(tagNames) } });
    if (tags.length > 0) {
      await articleTagRepo
        .createQueryBuilder()
        .insert()
        .into(ArticleTag)
        .values(tags.map((tag) => ({ articleId, tagId: tag.id })))
        .orIgnore()
        .execute();
    }
  }

  private async buildArticlesResponseList(
    articles: Article[],
    viewerId?: number,
  ): Promise<ArticleResponse[]> {
    if (articles.length === 0) return [];

    const articleIds = articles.map((a) => a.id);
    const authorIds = [...new Set(articles.map((a) => a.authorId))];

    const [favoritesCounts, viewerFavorites, viewerFollows] = await Promise.all(
      [
        this.favoriteRepository
          .createQueryBuilder('fav')
          .select('fav.articleId', 'articleId')
          .addSelect('COUNT(*)', 'count')
          .where('fav.articleId IN (:...articleIds)', { articleIds })
          .groupBy('fav.articleId')
          .getRawMany<{ articleId: number; count: string }>(),
        viewerId
          ? this.favoriteRepository.find({
              where: { userId: viewerId, articleId: In(articleIds) },
              select: { articleId: true },
            })
          : Promise.resolve([]),
        viewerId
          ? this.followRepository.find({
              where: { followerId: viewerId, followingId: In(authorIds) },
              select: { followingId: true },
            })
          : Promise.resolve([]),
      ],
    );

    const countMap = new Map<number, number>();
    for (const row of favoritesCounts) {
      countMap.set(Number(row.articleId), parseInt(row.count, 10));
    }

    const favoritedSet = new Set(viewerFavorites.map((f) => f.articleId));
    const followingSet = new Set(viewerFollows.map((f) => f.followingId));

    return articles.map((article) =>
      toArticleResponse(article, {
        favorited: favoritedSet.has(article.id),
        favoritesCount: countMap.get(article.id) || 0,
        following: followingSet.has(article.authorId),
      }),
    );
  }

  private sanitizeTags(tags?: string[]): string[] {
    if (!tags || !Array.isArray(tags)) return [];
    return [
      ...new Set(
        tags
          .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
          .filter((t) => t.length > 0 && t.length <= TAG_NAME_MAX_LENGTH),
      ),
    ];
  }
}
