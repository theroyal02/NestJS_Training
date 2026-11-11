import { Test, TestingModule } from '@nestjs/testing';
import { describe, beforeEach, it, expect } from 'vitest';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: {
            getGreeting: () => 'Hello World!',
          },
        },
      ],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
  });

  describe('getGreeting', () => {
    it('should return default greeting string', () => {
      expect(appController.getGreeting()).toBe('Hello World!');
    });
  });
});
