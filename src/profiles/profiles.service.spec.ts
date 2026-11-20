import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Follow } from '../database/entities/follow.entity.js';
import { User } from '../users/entities/user.entity.js';
import { ProfilesService } from './profiles.service.js';

describe('ProfilesService', () => {
  let service: ProfilesService;
  let userRepository: {
    findOne: ReturnType<typeof vi.fn>;
  };
  let followRepository: {
    exists: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let i18nService: {
    t: ReturnType<typeof vi.fn>;
  };

  const mockTargetUser = {
    id: 2,
    username: 'targetuser',
    bio: 'Software engineer',
    image: 'https://example.com/avatar.jpg',
  } as User;

  beforeEach(async () => {
    userRepository = {
      findOne: vi.fn(),
    };
    followRepository = {
      exists: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
    };
    i18nService = {
      t: vi.fn((key: string) => key),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: getRepositoryToken(Follow),
          useValue: followRepository,
        },
        {
          provide: I18nService,
          useValue: i18nService,
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  describe('getProfile', () => {
    it('should return profile with following=false for anonymous viewer', async () => {
      userRepository.findOne.mockResolvedValue(mockTargetUser);

      const result = await service.getProfile('targetuser');

      expect(result).toEqual({
        profile: {
          username: 'targetuser',
          bio: 'Software engineer',
          image: 'https://example.com/avatar.jpg',
          following: false,
        },
      });
      expect(followRepository.exists).not.toHaveBeenCalled();
    });

    it('should return profile with following=true when viewer follows target', async () => {
      userRepository.findOne.mockResolvedValue(mockTargetUser);
      followRepository.exists.mockResolvedValue(true);

      const result = await service.getProfile('targetuser', 1);

      expect(result.profile.following).toBe(true);
      expect(followRepository.exists).toHaveBeenCalledWith({
        where: { followerId: 1, followingId: 2 },
      });
    });

    it('should throw NotFoundException when target user is not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('followUser', () => {
    it('should throw BadRequestException when user tries to follow self', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 1,
        username: 'myself',
      } as User);

      await expect(service.followUser('myself', 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should follow target user and return following=true', async () => {
      userRepository.findOne.mockResolvedValue(mockTargetUser);
      followRepository.exists.mockResolvedValue(false);
      followRepository.create.mockReturnValue({
        followerId: 1,
        followingId: 2,
      });
      followRepository.save.mockResolvedValue({
        followerId: 1,
        followingId: 2,
      });

      const result = await service.followUser('targetuser', 1);

      expect(followRepository.save).toHaveBeenCalled();
      expect(result.profile.following).toBe(true);
    });

    it('should be idempotent when already following', async () => {
      userRepository.findOne.mockResolvedValue(mockTargetUser);
      followRepository.exists.mockResolvedValue(true);

      const result = await service.followUser('targetuser', 1);

      expect(followRepository.save).not.toHaveBeenCalled();
      expect(result.profile.following).toBe(true);
    });
  });

  describe('unfollowUser', () => {
    it('should delete follow record and return following=false', async () => {
      userRepository.findOne.mockResolvedValue(mockTargetUser);
      followRepository.delete.mockResolvedValue({ affected: 1 });

      const result = await service.unfollowUser('targetuser', 1);

      expect(followRepository.delete).toHaveBeenCalledWith({
        followerId: 1,
        followingId: 2,
      });
      expect(result.profile.following).toBe(false);
    });
  });
});
