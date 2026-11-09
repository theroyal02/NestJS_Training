import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { describe, beforeEach, afterEach, it } from 'vitest';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
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

  it('GET /?lang=fr - unsupported language falls back to English', () => {
    return request(app.getHttpServer())
      .get('/?lang=fr')
      .expect(200)
      .expect('Hello World!');
  });
});
