import * as fs from 'fs/promises';
import * as path from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import type { Redis } from 'ioredis';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { REDIS_CLIENT } from '../../src/redis/redis.constants.js';

export function assertTestDatabase(dataSource: DataSource): void {
  const dbName = String(dataSource.options.database || '');
  if (!dbName.endsWith('_test') && dbName !== 'sun_nestjs_test') {
    throw new Error(
      `Refusing to truncate non-test database: "${dbName}". Expected *_test or sun_nestjs_test.`,
    );
  }
}

export function assertTestRedis(): void {
  const redisDb = Number(process.env.REDIS_DB ?? 0);
  if (redisDb === 0 || Number.isNaN(redisDb)) {
    throw new Error(
      `Refusing to flush Redis DB 0. Set REDIS_DB to a non-zero test index in .env.test.`,
    );
  }
}

export function assertTestUploadDir(uploadDir: string): void {
  if (!uploadDir || !uploadDir.toLowerCase().includes('test')) {
    throw new Error(
      `Refusing to delete non-test upload directory: "${uploadDir}".`,
    );
  }
}

export async function createE2eApp(): Promise<{
  app: NestExpressApplication;
  dataSource: DataSource;
  redis: Redis;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  const dataSource = app.get(DataSource);
  assertTestDatabase(dataSource);
  await dataSource.runMigrations();

  const redis = app.get<Redis>(REDIS_CLIENT);
  return { app, dataSource, redis };
}

export async function truncateDatabase(dataSource: DataSource): Promise<void> {
  assertTestDatabase(dataSource);
  const entities = dataSource.entityMetadatas;
  if (entities.length === 0) return;

  const tableNames = entities
    .map((entity) => `"${entity.tableName}"`)
    .join(', ');
  await dataSource.query(
    `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE`,
  );
}

export async function clearTestRedis(redis: Redis): Promise<void> {
  assertTestRedis();
  if (redis.status === 'wait') {
    await redis.connect();
  }
  await redis.flushdb();
}

export async function clearTestUploads(): Promise<void> {
  const uploadDir = process.env.UPLOAD_DIR || '';
  assertTestUploadDir(uploadDir);
  await fs.rm(path.resolve(process.cwd(), uploadDir), {
    recursive: true,
    force: true,
  });
}
