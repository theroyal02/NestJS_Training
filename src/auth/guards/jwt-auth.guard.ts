import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { RedisService } from '../../redis/redis.service.js';
import { AUTH_BEARER_SCHEME } from '../auth.constants.js';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface.js';
import { JwtPayload } from '../interfaces/jwt-payload.interface.js';

export type { AuthenticatedRequest, JwtPayload };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly i18n: I18nService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const lang = I18nContext.current()?.lang;
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException(
        this.i18n.t('messages.auth.missing_token', { lang }),
      );
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(
        this.i18n.t('messages.auth.invalid_token', { lang }),
      );
    }

    if (!payload?.jti) {
      throw new UnauthorizedException(
        this.i18n.t('messages.auth.invalid_token', { lang }),
      );
    }

    const isRevoked = await this.redisService.isTokenBlacklisted(payload.jti);
    if (isRevoked) {
      throw new UnauthorizedException(
        this.i18n.t('messages.auth.token_revoked', { lang }),
      );
    }

    request.user = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith(AUTH_BEARER_SCHEME)) {
      return null;
    }
    return authHeader.substring(AUTH_BEARER_SCHEME.length).trim();
  }
}
