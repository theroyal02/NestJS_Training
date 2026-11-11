import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../redis/redis.service.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    createUser: ReturnType<typeof vi.fn>;
  };
  let jwtService: {
    signAsync: ReturnType<typeof vi.fn>;
  };
  let redisService: {
    setBlacklistToken: ReturnType<typeof vi.fn>;
    isTokenBlacklisted: ReturnType<typeof vi.fn>;
  };
  let i18nService: {
    t: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      createUser: vi.fn(),
    };
    jwtService = {
      signAsync: vi.fn().mockResolvedValue('mock-signed-jwt-token'),
    };
    redisService = {
      setBlacklistToken: vi.fn().mockResolvedValue(undefined),
      isTokenBlacklisted: vi.fn().mockResolvedValue(false),
    };
    i18nService = {
      t: vi.fn((key: string) => key),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: RedisService, useValue: redisService },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a new user successfully with sanitized email', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.createUser.mockResolvedValue({
        id: 1,
        email: 'user@sun-asterisk.vn',
        username: 'sun_dev',
        createdAt: new Date(),
      });

      const result = await authService.register({
        email: '  USER@SUN-ASTERISK.VN  ',
        username: 'sun_dev',
        password: 'Password@123',
      });

      expect(result.email).toBe('user@sun-asterisk.vn');
      expect(usersService.findByEmail).toHaveBeenCalledWith(
        'user@sun-asterisk.vn',
      );
      expect(usersService.createUser).toHaveBeenCalled();
    });

    it('should throw ConflictException when email is already registered', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'user@sun-asterisk.vn',
      });

      await expect(
        authService.register({
          email: 'user@sun-asterisk.vn',
          username: 'sun_dev',
          password: 'Password@123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return accessToken when credentials are valid', async () => {
      const hashedPassword = await bcrypt.hash('Password@123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'user@sun-asterisk.vn',
        password: hashedPassword,
      });

      const result = await authService.login({
        email: 'user@sun-asterisk.vn',
        password: 'Password@123',
      });

      expect(result).toEqual({ accessToken: 'mock-signed-jwt-token' });
      expect(jwtService.signAsync).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when email does not exist', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'notfound@sun-asterisk.vn',
          password: 'Password@123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when password is incorrect', async () => {
      const hashedPassword = await bcrypt.hash('Password@123', 10);
      usersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'user@sun-asterisk.vn',
        password: hashedPassword,
      });

      await expect(
        authService.login({
          email: 'user@sun-asterisk.vn',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should save token jti into Redis blacklist', async () => {
      const result = await authService.logout('mock-jti-uuid', 1800000000);

      expect(redisService.setBlacklistToken).toHaveBeenCalled();
      expect(result).toEqual({ message: 'messages.auth.logged_out' });
    });
  });

  describe('getCurrentUser', () => {
    it('should return user profile without password', async () => {
      const mockDate = new Date();
      usersService.findById.mockResolvedValue({
        id: 1,
        email: 'user@sun-asterisk.vn',
        username: 'sun_dev',
        createdAt: mockDate,
        updatedAt: mockDate,
      });

      const result = await authService.getCurrentUser(1);

      expect(result.id).toBe(1);
      expect(result.email).toBe('user@sun-asterisk.vn');
      expect((result as any).password).toBeUndefined();
    });

    it('should throw UnauthorizedException if user record is missing', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(authService.getCurrentUser(999)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
