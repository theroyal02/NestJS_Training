import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants.js';
import { RedisService } from './redis.service.js';

const DEFAULT_REDIS_PORT = 6379;

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: Number(
            configService.get<number>('REDIS_PORT', DEFAULT_REDIS_PORT),
          ),
          lazyConnect: true,
          retryStrategy: (times: number) => {
            if (times > 3) return null;
            return Math.min(times * 100, 2000);
          },
        });
      },
    },
    RedisService,
  ],
  exports: [RedisService],
})
export class RedisModule {}
