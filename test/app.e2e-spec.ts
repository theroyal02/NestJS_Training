import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, it } from 'vitest';
import {
  createE2eApp,
  truncateDatabase,
} from './helpers/e2e-database.helper.js';

describe('AppController (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    const setup = await createE2eApp();
    app = setup.app;
    dataSource = setup.dataSource;
  });

  afterEach(async () => {
    await truncateDatabase(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / - default fallback returns English', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('GET /?lang=vi - query parameter returns Vietnamese', () => {
    return request(app.getHttpServer())
      .get('/?lang=vi')
      .expect(200)
      .expect('Xin chào thế giới!');
  });

  it('GET / - header Accept-Language: vi returns Vietnamese', () => {
    return request(app.getHttpServer())
      .get('/')
      .set('Accept-Language', 'vi')
      .expect(200)
      .expect('Xin chào thế giới!');
  });

  it('GET / - custom header x-lang: vi returns Vietnamese', () => {
    return request(app.getHttpServer())
      .get('/')
      .set('x-lang', 'vi')
      .expect(200)
      .expect('Xin chào thế giới!');
  });
});
