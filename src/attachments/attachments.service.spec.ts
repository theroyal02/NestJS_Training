import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Attachment } from '../database/entities/attachment.entity.js';
import { User } from '../users/entities/user.entity.js';
import { AttachmentsService } from './attachments.service.js';

vi.mock('fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
}));

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let attachmentRepository: {
    find: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let userRepository: {
    update: ReturnType<typeof vi.fn>;
  };
  let i18nService: {
    t: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    attachmentRepository = {
      find: vi.fn(),
      create: vi.fn((dto) => dto),
      save: vi.fn((entity) => Promise.resolve(entity)),
      delete: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    userRepository = {
      update: vi.fn().mockResolvedValue({ affected: 1 }),
    };
    i18nService = {
      t: vi.fn((key: string) => key),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentsService,
        {
          provide: getRepositoryToken(Attachment),
          useValue: attachmentRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: I18nService,
          useValue: i18nService,
        },
      ],
    }).compile();

    service = module.get<AttachmentsService>(AttachmentsService);
  });

  describe('saveUserAvatar', () => {
    it('should throw BadRequestException if file is missing', async () => {
      await expect(
        service.saveUserAvatar(undefined as never, 1),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw PayloadTooLargeException if file exceeds 5MB', async () => {
      const largeFile = {
        buffer: Buffer.from('large'),
        size: 6 * 1024 * 1024,
      } as Express.Multer.File;

      await expect(service.saveUserAvatar(largeFile, 1)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it('should throw BadRequestException if magic bytes do not match allowed image types', async () => {
      const invalidFile = {
        buffer: Buffer.from('this is plain text not image'),
        size: 30,
        originalname: 'test.txt',
      } as Express.Multer.File;

      await expect(service.saveUserAvatar(invalidFile, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should successfully save valid JPEG avatar and update user image', async () => {
      const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x11, 0x22]);
      const file = {
        buffer: validJpegBuffer,
        size: validJpegBuffer.length,
        originalname: 'avatar.jpg',
      } as Express.Multer.File;

      attachmentRepository.find.mockResolvedValue([]);

      const result = await service.saveUserAvatar(file, 1);

      expect(result.url).toContain('/uploads/avatars/');
      expect(result.fileType).toBe('image/jpeg');
      expect(userRepository.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ image: result.url }),
      );
    });
  });
});
