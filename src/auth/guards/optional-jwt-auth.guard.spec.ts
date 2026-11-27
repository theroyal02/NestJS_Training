import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RedisService } from '../../redis/redis.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard.js';

describe('OptionalJwtAuthGuard', () => {
  let guard: OptionalJwtAuthGuard;

  beforeEach(() => {
    const jwtService = { verifyAsync: vi.fn() } as unknown as JwtService;
    const redisService = {
      isTokenBlacklisted: vi.fn(),
    } as unknown as RedisService;
    const i18nService = { t: vi.fn() } as unknown as I18nService;
    guard = new OptionalJwtAuthGuard(jwtService, redisService, i18nService);
  });

  const createMockContext = (user?: unknown): ExecutionContext => {
    const request: Record<string, unknown> = user ? { user } : {};
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('should return true and keep request.user undefined when token is invalid or revoked', async () => {
    vi.spyOn(JwtAuthGuard.prototype, 'canActivate').mockRejectedValueOnce(
      new UnauthorizedException('Token revoked'),
    );
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(context.switchToHttp().getRequest().user).toBeUndefined();
  });

  it('should return true and preserve request.user when token is valid', async () => {
    const validUser = { sub: 1, email: 'test@example.com' };
    vi.spyOn(JwtAuthGuard.prototype, 'canActivate').mockImplementationOnce(
      async (ctx) => {
        ctx.switchToHttp().getRequest().user = validUser;
        return true;
      },
    );
    const context = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(context.switchToHttp().getRequest().user).toEqual(validUser);
  });
});
