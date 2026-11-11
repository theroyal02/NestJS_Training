import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { RedisService } from '../redis/redis.service.js';
import { UsersService } from '../users/users.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

const BCRYPT_SALT_ROUNDS = 10;
const DEFAULT_TOKEN_LIFETIME_SECONDS = 3600;
const MS_IN_SECOND = 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly redisService: RedisService,
    private readonly i18n: I18nService,
  ) {}

  async register(dto: RegisterDto) {
    const lang = I18nContext.current()?.lang;
    const sanitizedEmail = dto.email.trim().toLowerCase();

    const existingUser = await this.usersService.findByEmail(sanitizedEmail);
    if (existingUser) {
      throw new ConflictException(
        this.i18n.t('messages.auth.email_exists', { lang }),
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const createdUser = await this.usersService.createUser({
      email: sanitizedEmail,
      username: dto.username.trim(),
      password: hashedPassword,
    });

    return {
      id: createdUser.id,
      email: createdUser.email,
      username: createdUser.username,
      createdAt: createdUser.createdAt,
    };
  }

  async login(dto: LoginDto) {
    const lang = I18nContext.current()?.lang;
    const sanitizedEmail = dto.email.trim().toLowerCase();

    const user = await this.usersService.findByEmail(sanitizedEmail);
    if (!user) {
      throw new UnauthorizedException(
        this.i18n.t('messages.auth.invalid_credentials', { lang }),
      );
    }

    const isPasswordMatched = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordMatched) {
      throw new UnauthorizedException(
        this.i18n.t('messages.auth.invalid_credentials', { lang }),
      );
    }

    const jti = randomUUID();
    const payload = {
      sub: user.id,
      email: user.email,
      jti,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: DEFAULT_TOKEN_LIFETIME_SECONDS,
    });

    return { accessToken };
  }

  async logout(jti: string, exp?: number) {
    const lang = I18nContext.current()?.lang;
    const currentSeconds = Math.floor(Date.now() / MS_IN_SECOND);
    const remainingTtl = exp
      ? Math.max(exp - currentSeconds, 1)
      : DEFAULT_TOKEN_LIFETIME_SECONDS;

    await this.redisService.setBlacklistToken(jti, remainingTtl);
    return {
      message: this.i18n.t('messages.auth.logged_out', { lang }),
    };
  }

  async getCurrentUser(userId: number) {
    const lang = I18nContext.current()?.lang;
    const user = await this.usersService.findById(userId);

    if (!user) {
      throw new UnauthorizedException(
        this.i18n.t('messages.auth.unauthorized', { lang }),
      );
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

