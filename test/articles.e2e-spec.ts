import { JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { Redis } from 'ioredis';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from 'vitest';
import {
  ARTICLE_BODY_MAX_LENGTH,
  ARTICLE_DESC_MAX_LENGTH,
  ARTICLE_TITLE_MAX_LENGTH,
} from '../src/articles/articles.constants.js';
import { ArticleFavorite } from '../src/database/entities/article-favorite.entity.js';
import { ArticleTag } from '../src/database/entities/article-tag.entity.js';
import { Article } from '../src/database/entities/article.entity.js';
import { Tag } from '../src/database/entities/tag.entity.js';
import {
  clearTestRedis,
  createE2eApp,
  truncateDatabase,
} from './helpers/e2e-database.helper.js';
import {
  blacklistTestToken,
  createFakeArticle,
  createFakeFavorite,
  createFakeFollow,
  createFakeUser,
  signUserToken,
} from './helpers/e2e-fake-data.helper.js';

describe('ArticlesController (e2e - C2 coverage)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;
  let redis: Redis;
  let jwtService: JwtService;

  beforeAll(async () => {
    const setup = await createE2eApp();
    app = setup.app;
    dataSource = setup.dataSource;
    redis = setup.redis;
    jwtService = app.get(JwtService);
  });

  afterEach(async () => {
    await truncateDatabase(dataSource);
    await clearTestRedis(redis);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/articles', () => {
    it('returns 401 when Authorization header is missing', async () => {
      await request(app.getHttpServer())
        .post('/api/articles')
        .send({ title: 'Title', description: 'Desc', body: 'Body' })
        .expect(401);
    });

    it('returns 401 when token is blacklisted (logged out)', async () => {
      const user = await createFakeUser(dataSource);
      const { token, jti } = await signUserToken(jwtService, user);
      await blacklistTestToken(redis, jti);

      await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Title', description: 'Desc', body: 'Body' })
        .expect(401);
    });

    const invalidCreatePayloads: Array<{
      name: string;
      payload: Record<string, unknown>;
    }> = [
      {
        name: 'missing title',
        payload: { description: 'Desc', body: 'Body' },
      },
      {
        name: 'whitespace-only title',
        payload: { title: '   ', description: 'Desc', body: 'Body' },
      },
      {
        name: 'title exceeding max length',
        payload: {
          title: 'a'.repeat(ARTICLE_TITLE_MAX_LENGTH + 1),
          description: 'Desc',
          body: 'Body',
        },
      },
      {
        name: 'missing description',
        payload: { title: 'Title', body: 'Body' },
      },
      {
        name: 'whitespace-only description',
        payload: { title: 'Title', description: '   ', body: 'Body' },
      },
      {
        name: 'description exceeding max length',
        payload: {
          title: 'Title',
          description: 'a'.repeat(ARTICLE_DESC_MAX_LENGTH + 1),
          body: 'Body',
        },
      },
      {
        name: 'missing body',
        payload: { title: 'Title', description: 'Desc' },
      },
      {
        name: 'whitespace-only body',
        payload: { title: 'Title', description: 'Desc', body: '   ' },
      },
      {
        name: 'body exceeding max length',
        payload: {
          title: 'Title',
          description: 'Desc',
          body: 'a'.repeat(ARTICLE_BODY_MAX_LENGTH + 1),
        },
      },
      {
        name: 'non-array tagList',
        payload: {
          title: 'Title',
          description: 'Desc',
          body: 'Body',
          tagList: 'nestjs',
        },
      },
      {
        name: 'unknown extra field rejected by forbidNonWhitelisted',
        payload: {
          title: 'Title',
          description: 'Desc',
          body: 'Body',
          extraField: 'hack',
        },
      },
    ];

    it.each(invalidCreatePayloads)(
      'returns 400 for invalid payload: $name',
      async ({ payload }) => {
        const user = await createFakeUser(dataSource);
        const { token } = await signUserToken(jwtService, user);

        await request(app.getHttpServer())
          .post('/api/articles')
          .set('Authorization', `Bearer ${token}`)
          .send(payload)
          .expect(400);
      },
    );

    it('returns 201 and persists article with deduplicated normalized tags in DB', async () => {
      const user = await createFakeUser(dataSource, { username: 'creator' });
      const { token } = await signUserToken(jwtService, user);

      const res = await request(app.getHttpServer())
        .post('/api/articles')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: '  How to Train Your Dragon  ',
          description: '  Ever wonder how?  ',
          body: 'It takes patience.',
          tagList: ['NestJS', 'nestjs', 'TypeORM', ''],
        })
        .expect(201);

      expect(res.body.article).toMatchObject({
        title: 'How to Train Your Dragon',
        description: 'Ever wonder how?',
        body: 'It takes patience.',
        tagList: ['nestjs', 'typeorm'],
        favorited: false,
        favoritesCount: 0,
        author: {
          username: 'creator',
          following: false,
        },
      });
      expect(res.body.article.slug).toMatch(/^how-to-train-your-dragon-/);

      const dbArticle = await dataSource
        .getRepository(Article)
        .findOneBy({ slug: res.body.article.slug });
      expect(dbArticle).not.toBeNull();

      const dbTags = await dataSource.getRepository(Tag).find();
      expect(dbTags.map((t) => t.name).sort()).toEqual(['nestjs', 'typeorm']);
    });
  });

  describe('GET /api/articles', () => {
    it('returns 200 with all articles ordered newest first for guest', async () => {
      const author = await createFakeUser(dataSource, { username: 'alice' });
      await createFakeArticle(dataSource, author.id, {
        title: 'Older Article',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      await createFakeArticle(dataSource, author.id, {
        title: 'Newer Article',
        createdAt: new Date('2026-02-01T00:00:00Z'),
      });

      const res = await request(app.getHttpServer())
        .get('/api/articles')
        .expect(200);

      expect(res.body.articlesCount).toBe(2);
      expect(res.body.articles.map((a: { title: string }) => a.title)).toEqual([
        'Newer Article',
        'Older Article',
      ]);
      expect(res.body.articles[0].favorited).toBe(false);
      expect(res.body.articles[0].author.following).toBe(false);
    });

    it('filters by tag and applies limit while articlesCount reflects total matching rows', async () => {
      const author = await createFakeUser(dataSource);
      await createFakeArticle(dataSource, author.id, {
        title: 'Nest Article 1',
        tagNames: ['nestjs'],
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      await createFakeArticle(dataSource, author.id, {
        title: 'Nest Article 2',
        tagNames: ['nestjs'],
        createdAt: new Date('2026-02-01T00:00:00Z'),
      });
      await createFakeArticle(dataSource, author.id, {
        title: 'React Article',
        tagNames: ['react'],
      });

      const res = await request(app.getHttpServer())
        .get('/api/articles?tag=nestjs&limit=1&offset=0')
        .expect(200);

      expect(res.body.articlesCount).toBe(2);
      expect(res.body.articles).toHaveLength(1);
      expect(res.body.articles[0].title).toBe('Nest Article 2');
    });

    it('filters by author username', async () => {
      const alice = await createFakeUser(dataSource, { username: 'alice' });
      const bob = await createFakeUser(dataSource, { username: 'bob' });
      await createFakeArticle(dataSource, alice.id, { title: 'Alice Post' });
      await createFakeArticle(dataSource, bob.id, { title: 'Bob Post' });

      const res = await request(app.getHttpServer())
        .get('/api/articles?author=alice')
        .expect(200);

      expect(res.body.articlesCount).toBe(1);
      expect(res.body.articles[0].title).toBe('Alice Post');
    });

    it('filters by favorited username and computes viewer favorited/following', async () => {
      const author = await createFakeUser(dataSource, { username: 'writer' });
      const viewer = await createFakeUser(dataSource, { username: 'reader' });
      const article = await createFakeArticle(dataSource, author.id, {
        title: 'Liked Post',
      });
      await createFakeArticle(dataSource, author.id, { title: 'Unliked Post' });
      await createFakeFavorite(dataSource, viewer.id, article.id);
      await createFakeFollow(dataSource, viewer.id, author.id);

      const { token } = await signUserToken(jwtService, viewer);

      const res = await request(app.getHttpServer())
        .get('/api/articles?favorited=reader')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.articlesCount).toBe(1);
      expect(res.body.articles[0]).toMatchObject({
        title: 'Liked Post',
        favorited: true,
        favoritesCount: 1,
        author: { username: 'writer', following: true },
      });
    });

    it.each([
      { query: 'limit=0', label: 'limit below 1' },
      { query: 'limit=101', label: 'limit above 100' },
      { query: 'offset=-1', label: 'negative offset' },
    ])('returns 400 when $label', async ({ query }) => {
      await request(app.getHttpServer())
        .get(`/api/articles?${query}`)
        .expect(400);
    });
  });

  describe('GET /api/articles/feed', () => {
    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer()).get('/api/articles/feed').expect(401);
    });

    it('returns empty feed when user follows nobody', async () => {
      const viewer = await createFakeUser(dataSource);
      const author = await createFakeUser(dataSource);
      await createFakeArticle(dataSource, author.id);

      const { token } = await signUserToken(jwtService, viewer);

      const res = await request(app.getHttpServer())
        .get('/api/articles/feed')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body).toEqual({ articles: [], articlesCount: 0 });
    });

    it('returns only articles from followed authors ordered newest first', async () => {
      const viewer = await createFakeUser(dataSource);
      const followed = await createFakeUser(dataSource, {
        username: 'followed_author',
      });
      const unfollowed = await createFakeUser(dataSource, {
        username: 'stranger',
      });

      await createFakeFollow(dataSource, viewer.id, followed.id);
      await createFakeArticle(dataSource, followed.id, {
        title: 'Followed Old',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });
      await createFakeArticle(dataSource, followed.id, {
        title: 'Followed New',
        createdAt: new Date('2026-02-01T00:00:00Z'),
      });
      await createFakeArticle(dataSource, unfollowed.id, {
        title: 'Stranger Post',
      });

      const { token } = await signUserToken(jwtService, viewer);

      const res = await request(app.getHttpServer())
        .get('/api/articles/feed?limit=1&offset=0')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.articlesCount).toBe(2);
      expect(res.body.articles).toHaveLength(1);
      expect(res.body.articles[0].title).toBe('Followed New');
      expect(res.body.articles[0].author.following).toBe(true);
    });
  });

  describe('GET /api/articles/:slug', () => {
    it('returns 404 in English by default when slug does not exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/articles/missing-slug')
        .expect(404);

      expect(res.body.message).toBe('Article not found');
    });

    it('returns 404 in Vietnamese when x-lang: vi header is sent', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/articles/missing-slug')
        .set('x-lang', 'vi')
        .expect(404);

      expect(res.body.message).toBe('Không tìm thấy bài viết');
    });

    it('returns 200 with following=false and favorited=false for logged-out (blacklisted) token', async () => {
      const author = await createFakeUser(dataSource, { username: 'author' });
      const viewer = await createFakeUser(dataSource, { username: 'viewer' });
      const article = await createFakeArticle(dataSource, author.id);
      await createFakeFollow(dataSource, viewer.id, author.id);
      await createFakeFavorite(dataSource, viewer.id, article.id);

      const { token, jti } = await signUserToken(jwtService, viewer);
      await blacklistTestToken(redis, jti);

      const res = await request(app.getHttpServer())
        .get(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.article.favorited).toBe(false);
      expect(res.body.article.favoritesCount).toBe(1);
      expect(res.body.article.author.following).toBe(false);
    });

    it('returns 200 with following=true and favorited=true for authenticated follower', async () => {
      const author = await createFakeUser(dataSource, { username: 'author' });
      const viewer = await createFakeUser(dataSource, { username: 'viewer' });
      const article = await createFakeArticle(dataSource, author.id, {
        tagNames: ['nestjs'],
      });
      await createFakeFollow(dataSource, viewer.id, author.id);
      await createFakeFavorite(dataSource, viewer.id, article.id);

      const { token } = await signUserToken(jwtService, viewer);

      const res = await request(app.getHttpServer())
        .get(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.article).toMatchObject({
        slug: article.slug,
        tagList: ['nestjs'],
        favorited: true,
        favoritesCount: 1,
        author: { username: 'author', following: true },
      });
    });
  });

  describe('PUT /api/articles/:slug', () => {
    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .put('/api/articles/any-slug')
        .send({ title: 'Updated' })
        .expect(401);
    });

    it('returns 404 when article does not exist', async () => {
      const user = await createFakeUser(dataSource);
      const { token } = await signUserToken(jwtService, user);

      await request(app.getHttpServer())
        .put('/api/articles/non-existent')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated' })
        .expect(404);
    });

    it('returns 403 when non-author tries to update and keeps DB record unchanged', async () => {
      const author = await createFakeUser(dataSource);
      const otherUser = await createFakeUser(dataSource);
      const article = await createFakeArticle(dataSource, author.id, {
        title: 'Original Title',
      });
      const { token } = await signUserToken(jwtService, otherUser);

      await request(app.getHttpServer())
        .put(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Hacked Title' })
        .expect(403);

      const dbArticle = await dataSource
        .getRepository(Article)
        .findOneBy({ id: article.id });
      expect(dbArticle?.title).toBe('Original Title');
    });

    it.each([
      { name: 'empty title', payload: { title: '   ' } },
      { name: 'empty description', payload: { description: '' } },
      { name: 'empty body', payload: { body: '   ' } },
    ])('returns 400 for invalid update payload: $name', async ({ payload }) => {
      const author = await createFakeUser(dataSource);
      const article = await createFakeArticle(dataSource, author.id);
      const { token } = await signUserToken(jwtService, author);

      await request(app.getHttpServer())
        .put(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload)
        .expect(400);
    });

    it('returns 200, updates fields, regenerates slug, and syncs tags in DB', async () => {
      const author = await createFakeUser(dataSource);
      const article = await createFakeArticle(dataSource, author.id, {
        title: 'Old Title',
        tagNames: ['oldtag'],
      });
      const { token } = await signUserToken(jwtService, author);

      const res = await request(app.getHttpServer())
        .put(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'New Updated Title',
          description: 'New description',
          tagList: ['newtag'],
        })
        .expect(200);

      expect(res.body.article.title).toBe('New Updated Title');
      expect(res.body.article.slug).toMatch(/^new-updated-title-/);
      expect(res.body.article.slug).not.toBe(article.slug);
      expect(res.body.article.tagList).toEqual(['newtag']);

      const links = await dataSource
        .getRepository(ArticleTag)
        .find({ where: { articleId: article.id }, relations: { tag: true } });
      expect(links.map((l) => l.tag.name)).toEqual(['newtag']);
    });
  });

  describe('DELETE /api/articles/:slug', () => {
    it('returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .delete('/api/articles/any-slug')
        .expect(401);
    });

    it('returns 404 when article does not exist', async () => {
      const user = await createFakeUser(dataSource);
      const { token } = await signUserToken(jwtService, user);

      await request(app.getHttpServer())
        .delete('/api/articles/non-existent')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('returns 403 when non-author tries to delete and keeps DB record intact', async () => {
      const author = await createFakeUser(dataSource);
      const otherUser = await createFakeUser(dataSource);
      const article = await createFakeArticle(dataSource, author.id);
      const { token } = await signUserToken(jwtService, otherUser);

      await request(app.getHttpServer())
        .delete(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);

      const dbArticle = await dataSource
        .getRepository(Article)
        .findOneBy({ id: article.id });
      expect(dbArticle).not.toBeNull();
    });

    it('returns 204 and deletes article from DB when author requests', async () => {
      const author = await createFakeUser(dataSource);
      const article = await createFakeArticle(dataSource, author.id, {
        tagNames: ['cleanup'],
      });
      const { token } = await signUserToken(jwtService, author);

      await request(app.getHttpServer())
        .delete(`/api/articles/${article.slug}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      const dbArticle = await dataSource
        .getRepository(Article)
        .findOneBy({ id: article.id });
      expect(dbArticle).toBeNull();
    });
  });

  describe('POST & DELETE /api/articles/:slug/favorite', () => {
    it('POST returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .post('/api/articles/any-slug/favorite')
        .expect(401);
    });

    it('POST returns 404 when article does not exist', async () => {
      const user = await createFakeUser(dataSource);
      const { token } = await signUserToken(jwtService, user);

      await request(app.getHttpServer())
        .post('/api/articles/missing/favorite')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('POST favorites article idempotently and persists in DB', async () => {
      const author = await createFakeUser(dataSource);
      const viewer = await createFakeUser(dataSource);
      const article = await createFakeArticle(dataSource, author.id);
      const { token } = await signUserToken(jwtService, viewer);

      const first = await request(app.getHttpServer())
        .post(`/api/articles/${article.slug}/favorite`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(first.body.article.favorited).toBe(true);
      expect(first.body.article.favoritesCount).toBe(1);

      // Idempotent second call
      const second = await request(app.getHttpServer())
        .post(`/api/articles/${article.slug}/favorite`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(second.body.article.favorited).toBe(true);
      expect(second.body.article.favoritesCount).toBe(1);

      const countInDb = await dataSource
        .getRepository(ArticleFavorite)
        .count({ where: { articleId: article.id, userId: viewer.id } });
      expect(countInDb).toBe(1);
    });

    it('DELETE returns 401 when unauthenticated', async () => {
      await request(app.getHttpServer())
        .delete('/api/articles/any-slug/favorite')
        .expect(401);
    });

    it('DELETE returns 404 when article does not exist', async () => {
      const user = await createFakeUser(dataSource);
      const { token } = await signUserToken(jwtService, user);

      await request(app.getHttpServer())
        .delete('/api/articles/missing/favorite')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });

    it('DELETE unfavorites article idempotently and removes record from DB', async () => {
      const author = await createFakeUser(dataSource);
      const viewer = await createFakeUser(dataSource);
      const article = await createFakeArticle(dataSource, author.id);
      await createFakeFavorite(dataSource, viewer.id, article.id);
      const { token } = await signUserToken(jwtService, viewer);

      const first = await request(app.getHttpServer())
        .delete(`/api/articles/${article.slug}/favorite`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(first.body.article.favorited).toBe(false);
      expect(first.body.article.favoritesCount).toBe(0);

      // Idempotent second call
      const second = await request(app.getHttpServer())
        .delete(`/api/articles/${article.slug}/favorite`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(second.body.article.favorited).toBe(false);
      expect(second.body.article.favoritesCount).toBe(0);

      const countInDb = await dataSource
        .getRepository(ArticleFavorite)
        .count({ where: { articleId: article.id, userId: viewer.id } });
      expect(countInDb).toBe(0);
    });
  });
});
