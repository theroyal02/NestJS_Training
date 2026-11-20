import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, In, Repository } from 'typeorm';
import { ArticleFavorite } from '../database/entities/article-favorite.entity.js';
import { ArticleTag } from '../database/entities/article-tag.entity.js';
import { Article } from '../database/entities/article.entity.js';
import { Follow } from '../database/entities/follow.entity.js';
import { Tag } from '../database/entities/tag.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateArticleDto } from './dto/create-article.dto.js';
import { FeedArticlesQueryDto } from './dto/feed-articles-query.dto.js';
import { ListArticlesQueryDto } from './dto/list-articles-query.dto.js';
import { UpdateArticleDto } from './dto/update-article.dto.js';
import { generateSlug } from './helpers/slug.helper.js';
import {
  ArticleResponse,
  MultipleArticlesResponse,
  SingleArticleResponse,
} from './interfaces/article-response.interface.js';

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

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
      const tagRepo = manager.getRepository(Tag);
      const articleTagRepo = manager.getRepository(ArticleTag);

      const article = articleRepo.create({
        slug,
        title: dto.title.trim(),
        description: dto.description.trim(),
        body: dto.body,
        authorId,
      });
      const persistedArticle = await articleRepo.save(article);

      if (tagNames.length > 0) {
        for (const name of tagNames) {
          let tag = await tagRepo.findOne({ where: { name } });
          if (!tag) {
            tag = await tagRepo.save(tagRepo.create({ name }));
          }
          await articleTagRepo.save(
            articleTagRepo.create({
              articleId: persistedArticle.id,
              tagId: tag.id,
            }),
          );
        }
      }

      return persistedArticle;
    });

    return {
      article: {
        slug: savedArticle.slug,
        title: savedArticle.title,
        description: savedArticle.description,
        body: savedArticle.body,
        tagList: tagNames,
        createdAt: savedArticle.createdAt,
        updatedAt: savedArticle.updatedAt,
        favorited: false,
        favoritesCount: 0,
        author: {
          username: author.username,
          bio: author.bio,
          image: author.image,
          following: false,
        },
      },
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

    const tagList = (article.articleTags || [])
      .map((at) => at.tag?.name)
      .filter((name): name is string => Boolean(name));

    return {
      article: {
        slug: article.slug,
        title: article.title,
        description: article.description,
        body: article.body,
        tagList,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        favorited: isFavorited,
        favoritesCount,
        author: {
          username: article.author.username,
          bio: article.author.bio,
          image: article.author.image,
          following: isFollowing,
        },
      },
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
      const tagRepo = manager.getRepository(Tag);
      const articleTagRepo = manager.getRepository(ArticleTag);

      if (dto.title && dto.title.trim() !== article.title) {
        article.title = dto.title.trim();
        article.slug = generateSlug(article.title);
      }
      if (dto.description !== undefined) {
        article.description = dto.description.trim();
      }
      if (dto.body !== undefined) {
        article.body = dto.body;
      }

      const saved = await articleRepo.save(article);

      if (tagNames !== null) {
        await articleTagRepo.delete({ articleId: article.id });
        for (const name of tagNames) {
          let tag = await tagRepo.findOne({ where: { name } });
          if (!tag) {
            tag = await tagRepo.save(tagRepo.create({ name }));
          }
          await articleTagRepo.save(
            articleTagRepo.create({
              articleId: article.id,
              tagId: tag.id,
            }),
          );
        }
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

    const limit = query.limit ?? 20;
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
    const limit = query.limit ?? 20;
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

    try {
      const existingFav = await this.favoriteRepository.findOne({
        where: { userId, articleId: article.id },
      });
      if (!existingFav) {
        await this.favoriteRepository.save(
          this.favoriteRepository.create({ userId, articleId: article.id }),
        );
      }
    } catch (error: any) {
      // Catch duplicate entry code or re-throw
      if (error?.code !== 'ER_DUP_ENTRY' && error?.errno !== 1062) {
        this.logger.error(
          `Failed to favorite article ${slug} for user ${userId}`,
          error?.stack || error,
        );
        throw new InternalServerErrorException(
          this.i18n.t('messages.articles.favorite_failed'),
        );
      }
    }

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

    return articles.map((article) => {
      const tagList = (article.articleTags || [])
        .map((at) => at.tag?.name)
        .filter((name): name is string => Boolean(name));

      return {
        slug: article.slug,
        title: article.title,
        description: article.description,
        body: article.body,
        tagList,
        createdAt: article.createdAt,
        updatedAt: article.updatedAt,
        favorited: favoritedSet.has(article.id),
        favoritesCount: countMap.get(article.id) || 0,
        author: {
          username: article.author?.username || '',
          bio: article.author?.bio || null,
          image: article.author?.image || null,
          following: followingSet.has(article.authorId),
        },
      };
    });
  }

  private sanitizeTags(tags?: string[]): string[] {
    if (!tags || !Array.isArray(tags)) return [];
    return [
      ...new Set(
        tags
          .map((t) => (typeof t === 'string' ? t.trim().toLowerCase() : ''))
          .filter((t) => t.length > 0 && t.length <= 50),
      ),
    ];
  }
}
