import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AcceptLanguageResolver,
  HeaderResolver,
  I18nModule,
  QueryResolver,
} from 'nestjs-i18n';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ArticlesModule } from './articles/articles.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { ArticleFavorite } from './database/entities/article-favorite.entity.js';
import { ArticleTag } from './database/entities/article-tag.entity.js';
import { Article } from './database/entities/article.entity.js';
import { Attachment } from './database/entities/attachment.entity.js';
import { Comment } from './database/entities/comment.entity.js';
import { Follow } from './database/entities/follow.entity.js';
import { Tag } from './database/entities/tag.entity.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { RedisModule } from './redis/redis.module.js';
import { User } from './users/entities/user.entity.js';
import { UsersModule } from './users/users.module.js';

const DEFAULT_DB_PORT = 5432;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.example'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<number>('DB_PORT', DEFAULT_DB_PORT)),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'password123'),
        database: configService.get<string>('DB_NAME', 'sun_nestjs_db'),
        entities: [
          User,
          Follow,
          Attachment,
          Article,
          Tag,
          ArticleTag,
          ArticleFavorite,
          Comment,
        ],
        synchronize: false,
      }),
    }),
    I18nModule.forRoot({
      fallbackLanguage: 'en',
      loaderOptions: {
        path: path.join(import.meta.dirname, 'i18n/'),
        fileFormat: 'json',
      },
      resolvers: [
        new QueryResolver(['lang', 'l']),
        new HeaderResolver(['x-custom-lang', 'x-lang']),
        new AcceptLanguageResolver(),
      ],
    }),
    RedisModule,
    UsersModule,
    AuthModule,
    AttachmentsModule,
    ProfilesModule,
    ArticlesModule,
    CommentsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
