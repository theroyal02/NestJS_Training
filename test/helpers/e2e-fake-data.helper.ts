import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { generateSlug } from '../../src/articles/helpers/slug.helper.js';
import { ArticleFavorite } from '../../src/database/entities/article-favorite.entity.js';
import { ArticleTag } from '../../src/database/entities/article-tag.entity.js';
import { Article } from '../../src/database/entities/article.entity.js';
import { Comment } from '../../src/database/entities/comment.entity.js';
import { Follow } from '../../src/database/entities/follow.entity.js';
import { Tag } from '../../src/database/entities/tag.entity.js';
import { REDIS_BLACKLIST_PREFIX } from '../../src/redis/redis.constants.js';
import { User } from '../../src/users/entities/user.entity.js';

let userSequence = 0;

export async function createFakeUser(
  dataSource: DataSource,
  overrides: Partial<User> = {},
): Promise<User> {
  userSequence += 1;
  const repo = dataSource.getRepository(User);
  const plainPassword = overrides.password || 'Password123!';
  const hashedPassword = await bcrypt.hash(plainPassword, 4);

  const user = repo.create({
    email: overrides.email || `user_${userSequence}@test.sun-asterisk.vn`,
    username: overrides.username || `test_user_${userSequence}`,
    password: hashedPassword,
    bio: overrides.bio !== undefined ? overrides.bio : 'Test user bio',
    image:
      overrides.image !== undefined
        ? overrides.image
        : 'https://example.com/avatar.png',
    ...overrides,
  });
  // Keep hashed password unless raw override was explicitly hashed
  user.password = hashedPassword;

  return repo.save(user);
}

export async function signUserToken(
  jwtService: JwtService,
  user: User,
  jti: string = crypto.randomUUID(),
): Promise<{ token: string; jti: string }> {
  const token = await jwtService.signAsync({
    sub: user.id,
    email: user.email,
    jti,
  });
  return { token, jti };
}

export async function blacklistTestToken(
  redis: Redis,
  jti: string,
  ttlSeconds = 3600,
): Promise<void> {
  if (redis.status === 'wait') {
    await redis.connect();
  }
  await redis.set(`${REDIS_BLACKLIST_PREFIX}${jti}`, '1', 'EX', ttlSeconds);
}

export async function createFakeFollow(
  dataSource: DataSource,
  followerId: number,
  followingId: number,
): Promise<Follow> {
  const repo = dataSource.getRepository(Follow);
  return repo.save(repo.create({ followerId, followingId }));
}

export async function createFakeArticle(
  dataSource: DataSource,
  authorId: number,
  overrides: Partial<Article> & { tagNames?: string[] } = {},
): Promise<Article> {
  const articleRepo = dataSource.getRepository(Article);
  const title = overrides.title || 'Sample Test Article';

  const article = articleRepo.create({
    slug: overrides.slug || generateSlug(title),
    title,
    description: overrides.description || 'Sample test description',
    body: overrides.body || 'Sample test body content',
    authorId,
    createdAt: overrides.createdAt,
  });
  const saved = await articleRepo.save(article);

  if (overrides.tagNames && overrides.tagNames.length > 0) {
    const tagRepo = dataSource.getRepository(Tag);
    const articleTagRepo = dataSource.getRepository(ArticleTag);

    for (const rawName of overrides.tagNames) {
      const name = rawName.trim().toLowerCase();
      let tag = await tagRepo.findOne({ where: { name } });
      if (!tag) {
        tag = await tagRepo.save(tagRepo.create({ name }));
      }
      await articleTagRepo.save(
        articleTagRepo.create({ articleId: saved.id, tagId: tag.id }),
      );
    }
  }

  return saved;
}

export async function createFakeFavorite(
  dataSource: DataSource,
  userId: number,
  articleId: number,
): Promise<ArticleFavorite> {
  const repo = dataSource.getRepository(ArticleFavorite);
  return repo.save(repo.create({ userId, articleId }));
}

export async function createFakeComment(
  dataSource: DataSource,
  articleId: number,
  authorId: number,
  body = 'Sample comment body',
): Promise<Comment> {
  const repo = dataSource.getRepository(Comment);
  return repo.save(repo.create({ articleId, authorId, body }));
}
