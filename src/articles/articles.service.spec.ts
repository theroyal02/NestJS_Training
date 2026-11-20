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
    findOne: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let articleTagRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let favoriteRepository: {
    findOne: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
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
      createQueryBuilder: vi.fn(),
    };
    tagRepository = {
      findOne: vi.fn(),
      create: vi.fn((data) => ({ ...data, id: 1 })),
      save: vi.fn((entity) => Promise.resolve({ ...entity, id: 1 })),
    };
    articleTagRepository = {
      create: vi.fn((data) => data),
      save: vi.fn((entity) => Promise.resolve(entity)),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    favoriteRepository = {
      findOne: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      exists: vi.fn().mockResolvedValue(false),
      create: vi.fn((data) => data),
      save: vi.fn((entity) => Promise.resolve(entity)),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
      find: vi.fn().mockResolvedValue([]),
      createQueryBuilder: vi.fn(),
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

    it('should create article with tags inside transaction', async () => {
      userRepository.findOne.mockResolvedValue(mockAuthor);
      tagRepository.findOne.mockResolvedValue(null);

      const result = await service.createArticle(1, {
        title: 'New Dragon Story',
        description: 'About dragons',
        body: 'Long content',
        tagList: ['dragons', 'fantasy'],
      });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.article.title).toBe('New Dragon Story');
      expect(result.article.tagList).toEqual(['dragons', 'fantasy']);
      expect(result.article.author.username).toBe('author_john');
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

      const result = await service.getArticleBySlug(
        'dragon-training-abc123',
        2,
      );

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
      articleRepository.findOne.mockResolvedValue({ ...mockArticle });
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
    it('should save favorite record and return updated article', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);
      favoriteRepository.findOne.mockResolvedValue(null);

      const result = await service.favoriteArticle('dragon-training-abc123', 2);

      expect(favoriteRepository.save).toHaveBeenCalled();
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
