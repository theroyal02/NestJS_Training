import {
  Inject,
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_BLACKLIST_PREFIX, REDIS_CLIENT } from './redis.constants.js';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async setBlacklistToken(jti: string, ttlSeconds: number): Promise<void> {
    try {
      const key = `${REDIS_BLACKLIST_PREFIX}${jti}`;
      await this.redis.set(key, '1', 'EX', Math.max(ttlSeconds, 1));
    } catch {
      throw new ServiceUnavailableException(
        'Redis cache service is currently unavailable',
      );
    }
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    try {
      const key = `${REDIS_BLACKLIST_PREFIX}${jti}`;
      const result = await this.redis.get(key);
      return Boolean(result);
    } catch {
      throw new ServiceUnavailableException(
        'Redis cache service is currently unavailable',
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
