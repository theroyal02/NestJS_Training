import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager } from 'typeorm';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentsService } from '../attachments/attachments.service.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { RedisService } from '../redis/redis.service.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: {
    findOne: ReturnType<typeof vi.fn>;
    exists: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let attachmentsService: {
    saveUserAvatar: ReturnType<typeof vi.fn>;
  };
  let redisService: {
    setBlacklistToken: ReturnType<typeof vi.fn>;
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

  const mockUser: User = {
    id: 1,
    email: 'test@example.com',
    username: 'testuser',
    password: 'hashed-password',
    bio: 'Initial bio',
    image: 'https://example.com/avatar.jpg',
    passwordChangedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    usersRepository = {
      findOne: vi.fn(),
      exists: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };
    attachmentsService = {
      saveUserAvatar: vi.fn(),
    };
    redisService = {
      setBlacklistToken: vi.fn(),
    };
    i18nService = {
      t: vi.fn((key: string) => key),
    };
    mockEntityManager = {
      getRepository: vi.fn((entity) => {
        if (entity === User) return usersRepository;
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
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: usersRepository,
        },
        {
          provide: AttachmentsService,
          useValue: attachmentsService,
        },
        {
          provide: RedisService,
          useValue: redisService,
        },
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: I18nService,
          useValue: i18nService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('getCurrentUser', () => {
    it('should return user info when user is found', async () => {
      usersRepository.findOne.mockResolvedValue({ ...mockUser });

      const result = await service.getCurrentUser(1);

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        username: mockUser.username,
        bio: mockUser.bio,
        image: mockUser.image,
        createdAt: mockUser.createdAt,
        updatedAt: mockUser.updatedAt,
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.getCurrentUser(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUser', () => {
    it('should throw NotFoundException when user does not exist', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.updateUser(999, { bio: 'New bio' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException if new email is already in use', async () => {
      usersRepository.findOne.mockResolvedValue({ ...mockUser });
      usersRepository.exists.mockResolvedValue(true);

      await expect(
        service.updateUser(1, { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if new username is already in use', async () => {
      usersRepository.findOne.mockResolvedValue({ ...mockUser });
      usersRepository.exists.mockResolvedValue(true);

      await expect(
        service.updateUser(1, { username: 'takenusername' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update user bio and image url successfully', async () => {
      const user = { ...mockUser };
      usersRepository.findOne.mockResolvedValue(user);
      usersRepository.save.mockImplementation(async (u: User) => u);

      const result = await service.updateUser(1, {
        bio: 'Updated bio',
        image: 'https://example.com/new.jpg',
      });

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result.bio).toBe('Updated bio');
      expect(result.image).toBe('https://example.com/new.jpg');
      expect(usersRepository.save).toHaveBeenCalled();
    });

    it('should hash new password and revoke token if token payload is provided', async () => {
      const user = { ...mockUser };
      usersRepository.findOne.mockResolvedValue(user);
      usersRepository.save.mockImplementation(async (u: User) => u);

      const tokenPayload: JwtPayload = {
        sub: 1,
        email: 'test@example.com',
        jti: 'mock-jti-123',
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      await service.updateUser(
        1,
        { password: 'NewSecurePassword123!' },
        undefined,
        tokenPayload,
      );

      expect(redisService.setBlacklistToken).toHaveBeenCalledWith(
        'mock-jti-123',
        expect.any(Number),
      );
      expect(user.password).not.toBe('hashed-password');
      expect(user.password.startsWith('$2')).toBe(true);
    });

    it('should delegate to attachmentsService with transaction manager when avatar file is passed', async () => {
      const user = { ...mockUser };
      usersRepository.findOne.mockResolvedValue(user);
      usersRepository.save.mockImplementation(async (u: User) => u);
      attachmentsService.saveUserAvatar.mockResolvedValue({
        url: '/uploads/avatars/new.png',
      });

      const mockFile = {
        buffer: Buffer.from('test'),
        originalname: 'avatar.png',
        size: 4,
      } as Express.Multer.File;

      const result = await service.updateUser(1, {}, mockFile);

      expect(attachmentsService.saveUserAvatar).toHaveBeenCalledWith(
        mockFile,
        1,
        expect.anything(),
      );
      expect(result.image).toBe('/uploads/avatars/new.png');
    });
  });
});
