import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArticleFavorite } from '../database/entities/article-favorite.entity.js';
import { ArticleTag } from '../database/entities/article-tag.entity.js';
import { Article } from '../database/entities/article.entity.js';
import { Follow } from '../database/entities/follow.entity.js';
import { Tag } from '../database/entities/tag.entity.js';
import { User } from '../users/entities/user.entity.js';
import { ArticlesService } from './articles.service.js';

describe('ArticlesService', () => {
  let service: ArticlesService;
  let articleRepository: {
    findOne: ReturnType<typeof vi.fn>;
    findAndCount: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let tagRepository: {
    find: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let articleTagRepository: {
    delete: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let favoriteRepository: {
    count: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    createQueryBuilder: ReturnType<typeof vi.fn>;
  };
  let followRepository: {
    find: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
  };
  let userRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let dataSource: {
    transaction: ReturnType<typeof vi.fn>;
  };
  let mockEntityManager: {
    getRepository: ReturnType<typeof vi.fn>;
  };
  let i18nService: {
    t: ReturnType<typeof vi.fn>;
  };

  let mockInsertQueryBuilder: {
    insert: ReturnType<typeof vi.fn>;
    into: ReturnType<typeof vi.fn>;
    values: ReturnType<typeof vi.fn>;
    orIgnore: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
  };

  let mockArticleListQueryBuilder: {
    leftJoinAndSelect: ReturnType<typeof vi.fn>;
    innerJoin: ReturnType<typeof vi.fn>;
    andWhere: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    skip: ReturnType<typeof vi.fn>;
    take: ReturnType<typeof vi.fn>;
    getManyAndCount: ReturnType<typeof vi.fn>;
  };

  const mockAuthor = {
    id: 1,
    username: 'author_john',
    bio: 'Software engineer',
    image: 'https://example.com/avatar.jpg',
  } as User;

  const mockArticle = {
    id: 10,
    slug: 'dragon-training-abc123',
    title: 'Dragon Training',
    description: 'Learn to train dragons',
    body: 'First step is patience',
    authorId: 1,
    author: mockAuthor,
    articleTags: [{ tag: { name: 'dragons' } }],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as Article;

  beforeEach(async () => {
    mockInsertQueryBuilder = {
      insert: vi.fn().mockReturnThis(),
      into: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      orIgnore: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ identifiers: [] }),
    };

    mockArticleListQueryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[mockArticle], 1]),
    };

    articleRepository = {
      findOne: vi.fn(),
      findAndCount: vi.fn(),
      create: vi.fn((data) => ({
        ...data,
        id: 10,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: vi.fn((entity) =>
        Promise.resolve({
          ...entity,
          id: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn(() => mockArticleListQueryBuilder),
    };
    tagRepository = {
      find: vi.fn().mockResolvedValue([
        { id: 1, name: 'dragons' },
        { id: 2, name: 'fantasy' },
      ]),
      createQueryBuilder: vi.fn(() => mockInsertQueryBuilder),
    };
    articleTagRepository = {
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: vi.fn(() => mockInsertQueryBuilder),
    };

    const mockFavoriteSelectQueryBuilder = {
      select: vi.fn().mockReturnThis(),
      addSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      getRawMany: vi.fn().mockResolvedValue([]),
      insert: vi.fn(() => mockInsertQueryBuilder),
    };

    favoriteRepository = {
      count: vi.fn().mockResolvedValue(0),
      exists: vi.fn().mockResolvedValue(false),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(() => mockFavoriteSelectQueryBuilder),
    };
    followRepository = {
      find: vi.fn().mockResolvedValue([]),
      exists: vi.fn().mockResolvedValue(false),
    };
    userRepository = {
      findOne: vi.fn(),
    };
    i18nService = {
      t: vi.fn((key: string) => key),
    };

    mockEntityManager = {
      getRepository: vi.fn((entity) => {
        if (entity === Article) return articleRepository;
        if (entity === Tag) return tagRepository;
        if (entity === ArticleTag) return articleTagRepository;
        return {};
      }),
    };

    dataSource = {
      transaction: vi.fn(async (cb: (em: EntityManager) => Promise<any>) =>
        cb(mockEntityManager as unknown as EntityManager),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArticlesService,
        { provide: getRepositoryToken(Article), useValue: articleRepository },
        { provide: getRepositoryToken(Tag), useValue: tagRepository },
        {
          provide: getRepositoryToken(ArticleTag),
          useValue: articleTagRepository,
        },
        {
          provide: getRepositoryToken(ArticleFavorite),
          useValue: favoriteRepository,
        },
        { provide: getRepositoryToken(Follow), useValue: followRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compile();

    service = module.get<ArticlesService>(ArticlesService);
  });

  describe('createArticle', () => {
    it('should throw NotFoundException if author does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createArticle(999, {
          title: 'Hello',
          description: 'Desc',
          body: 'Body',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create article with batch-synced tags inside transaction', async () => {
      userRepository.findOne.mockResolvedValue(mockAuthor);

      const result = await service.createArticle(1, {
        title: 'New Dragon Story',
        description: 'About dragons',
        body: 'Long content',
        tagList: ['dragons', 'fantasy'],
      });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockInsertQueryBuilder.orIgnore).toHaveBeenCalled();
      expect(result.article.title).toBe('New Dragon Story');
      expect(result.article.tagList).toEqual(['dragons', 'fantasy']);
      expect(result.article.author.username).toBe('author_john');
    });
  });

  describe('listArticles', () => {
    it('should filter by tag, author, favorited and apply pagination', async () => {
      mockArticleListQueryBuilder.getManyAndCount.mockResolvedValue([
        [mockArticle],
        3,
      ]);

      const result = await service.listArticles(
        {
          tag: 'dragons',
          author: 'author_john',
          favorited: 'fan_user',
          limit: 1,
          offset: 2,
        },
        2,
      );

      expect(mockArticleListQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'filterArticleTag.tag',
        'filterTag',
        'filterTag.name = :tagName',
        { tagName: 'dragons' },
      );
      expect(mockArticleListQueryBuilder.andWhere).toHaveBeenCalledWith(
        'author.username = :authorUsername',
        { authorUsername: 'author_john' },
      );
      expect(mockArticleListQueryBuilder.innerJoin).toHaveBeenCalledWith(
        'filterFav.user',
        'favoritedUser',
        'favoritedUser.username = :favoritedUsername',
        { favoritedUsername: 'fan_user' },
      );
      expect(mockArticleListQueryBuilder.skip).toHaveBeenCalledWith(2);
      expect(mockArticleListQueryBuilder.take).toHaveBeenCalledWith(1);
      expect(result.articles).toHaveLength(1);
      expect(result.articlesCount).toBe(3);
    });

    it('should return empty list and 0 count when no articles match', async () => {
      mockArticleListQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      const result = await service.listArticles({});

      expect(result).toEqual({ articles: [], articlesCount: 0 });
    });
  });

  describe('getArticleBySlug', () => {
    it('should throw NotFoundException if article not found', async () => {
      articleRepository.findOne.mockResolvedValue(null);

      await expect(service.getArticleBySlug('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return article with author and favorite metadata', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);
      favoriteRepository.count.mockResolvedValue(5);
      favoriteRepository.exists.mockResolvedValue(true);
      followRepository.exists.mockResolvedValue(true);

      const result = await service.getArticleBySlug('dragon-training-abc123', 2);

      expect(result.article.slug).toBe('dragon-training-abc123');
      expect(result.article.favoritesCount).toBe(5);
      expect(result.article.favorited).toBe(true);
      expect(result.article.author.following).toBe(true);
    });
  });

  describe('updateArticle', () => {
    it('should throw ForbiddenException if current user is not author', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);

      await expect(
        service.updateArticle('dragon-training-abc123', 99, { title: 'New' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update article inside transaction when authorized', async () => {
      const updatedArticle = {
        ...mockArticle,
        title: 'Updated Title',
        slug: 'updated-title-123456',
      };
      articleRepository.findOne
        .mockResolvedValueOnce({ ...mockArticle })
        .mockResolvedValueOnce(updatedArticle);

      const result = await service.updateArticle('dragon-training-abc123', 1, {
        title: 'Updated Title',
      });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.article.title).toBe('Updated Title');
    });
  });

  describe('deleteArticle', () => {
    it('should throw ForbiddenException if user is not author', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);

      await expect(
        service.deleteArticle('dragon-training-abc123', 99),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should delete article when author requests deletion', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);

      await service.deleteArticle('dragon-training-abc123', 1);

      expect(articleRepository.delete).toHaveBeenCalledWith(10);
    });
  });

  describe('favoriteArticle', () => {
    it('should insert favorite using orIgnore and return updated article', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);

      const result = await service.favoriteArticle('dragon-training-abc123', 2);

      expect(mockInsertQueryBuilder.orIgnore).toHaveBeenCalled();
      expect(mockInsertQueryBuilder.execute).toHaveBeenCalled();
      expect(result.article.slug).toBe('dragon-training-abc123');
    });
  });

  describe('unfavoriteArticle', () => {
    it('should delete favorite record and return updated article', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);

      const result = await service.unfavoriteArticle(
        'dragon-training-abc123',
        2,
      );

      expect(favoriteRepository.delete).toHaveBeenCalledWith({
        userId: 2,
        articleId: 10,
      });
      expect(result.article.slug).toBe('dragon-training-abc123');
    });
  });

  describe('feedArticles', () => {
    it('should return empty list if user does not follow anyone', async () => {
      followRepository.find.mockResolvedValue([]);

      const result = await service.feedArticles({}, 1);

      expect(result.articles).toEqual([]);
      expect(result.articlesCount).toBe(0);
    });
  });
});
