import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Article } from '../database/entities/article.entity.js';
import { Comment } from '../database/entities/comment.entity.js';
import { Follow } from '../database/entities/follow.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepository: {
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    find: ReturnType<typeof vi.fn>;
    findOne: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let articleRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let followRepository: {
    find: ReturnType<typeof vi.fn>;
  };
  let userRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let i18nService: {
    t: ReturnType<typeof vi.fn>;
  };

  const mockUser: User = {
    id: 1,
    username: 'commenter',
    bio: 'Tech enthusiast',
    image: 'https://example.com/avatar.jpg',
  } as User;

  const mockArticle: Article = {
    id: 10,
    slug: 'test-article-slug',
  } as Article;

  const mockComment: Comment = {
    id: 100,
    body: 'Great article!',
    authorId: 1,
    articleId: 10,
    author: mockUser,
    article: mockArticle,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };

  beforeEach(async () => {
    commentRepository = {
      create: vi.fn((data) => ({
        ...data,
        id: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: vi.fn((entity) => Promise.resolve(entity)),
      find: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    articleRepository = {
      findOne: vi.fn(),
    };
    followRepository = {
      find: vi.fn().mockResolvedValue([]),
    };
    userRepository = {
      findOne: vi.fn(),
    };
    i18nService = {
      t: vi.fn((key: string) => key),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentRepository },
        { provide: getRepositoryToken(Article), useValue: articleRepository },
        { provide: getRepositoryToken(Follow), useValue: followRepository },
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compile();

    service = module.get<CommentsService>(CommentsService);
  });

  describe('addComment', () => {
    it('should throw NotFoundException if article does not exist', async () => {
      const dto: CreateCommentDto = { comment: { body: 'Valid body' } };
      articleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addComment('test-article-slug', 1, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if author does not exist', async () => {
      const dto: CreateCommentDto = { comment: { body: 'Valid body' } };
      articleRepository.findOne.mockResolvedValue(mockArticle);
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.addComment('test-article-slug', 1, dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should add comment successfully and return single comment response', async () => {
      const dto: CreateCommentDto = { comment: { body: 'Nice work!' } };
      articleRepository.findOne.mockResolvedValue(mockArticle);
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.addComment('test-article-slug', 1, dto);

      expect(commentRepository.save).toHaveBeenCalled();
      expect(result.comment.body).toBe('Nice work!');
      expect(result.comment.author.username).toBe('commenter');
      expect(result.comment.author.following).toBe(false);
    });
  });

  describe('getComments', () => {
    it('should throw NotFoundException if article not found', async () => {
      articleRepository.findOne.mockResolvedValue(null);

      await expect(service.getComments('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return empty comments list if no comments found', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);
      commentRepository.find.mockResolvedValue([]);

      const result = await service.getComments('test-article-slug');

      expect(result.comments).toEqual([]);
    });

    it('should return comments with following status for viewer and preserve empty bio string', async () => {
      const userWithEmptyBio = { ...mockUser, bio: '' } as User;
      const commentWithEmptyBio = { ...mockComment, author: userWithEmptyBio };
      articleRepository.findOne.mockResolvedValue(mockArticle);
      commentRepository.find.mockResolvedValue([commentWithEmptyBio]);
      followRepository.find.mockResolvedValue([{ followingId: 1 }]);

      const result = await service.getComments('test-article-slug', 2);

      expect(result.comments.length).toBe(1);
      expect(result.comments[0].body).toBe('Great article!');
      expect(result.comments[0].author.bio).toBe('');
      expect(result.comments[0].author.following).toBe(true);
    });
  });

  describe('deleteComment', () => {
    it('should throw NotFoundException if article not found', async () => {
      articleRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteComment('test-article-slug', 100, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if comment not found for this article', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);
      commentRepository.findOne.mockResolvedValue(null);

      await expect(
        service.deleteComment('test-article-slug', 100, 1),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not author of comment', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);
      commentRepository.findOne.mockResolvedValue({ id: 100, authorId: 1 });

      await expect(
        service.deleteComment('test-article-slug', 100, 999),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should delete comment when user is author', async () => {
      articleRepository.findOne.mockResolvedValue(mockArticle);
      commentRepository.findOne.mockResolvedValue({ id: 100, authorId: 1 });

      await service.deleteComment('test-article-slug', 100, 1);

      expect(commentRepository.delete).toHaveBeenCalledWith(100);
    });
  });
});
