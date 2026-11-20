import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  BadRequestException,
  Injectable,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Attachment } from '../database/entities/attachment.entity.js';
import { User } from '../users/entities/user.entity.js';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  ATTACHABLE_TYPE,
  AVATAR_SUBDIR,
  AVATAR_URL_PREFIX,
  MAX_AVATAR_SIZE_BYTES,
  MIME_EXTENSION_MAP,
} from './attachments.constants.js';

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
  ) {}

  async uploadAvatar(file: Express.Multer.File, userId: number) {
    const attachment = await this.saveUserAvatar(file, userId);
    return {
      id: attachment.id,
      url: attachment.url,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      fileSize: attachment.fileSize,
    };
  }

  async saveUserAvatar(
    file: Express.Multer.File,
    userId: number,
    manager?: EntityManager,
  ): Promise<Attachment> {
    const mimeType = this.validateAndDetectMime(file);
    const ext = MIME_EXTENSION_MAP[mimeType] || 'jpg';
    const id = crypto.randomUUID();
    const fileName = `${id}.${ext}`;
    const relativeFilePath = path.join(AVATAR_SUBDIR, fileName);
    const absoluteUploadDir = path.resolve(process.cwd(), AVATAR_SUBDIR);
    const absoluteFilePath = path.resolve(absoluteUploadDir, fileName);

    await fs.mkdir(absoluteUploadDir, { recursive: true });
    await fs.writeFile(absoluteFilePath, file.buffer);

    const publicUrl = `${AVATAR_URL_PREFIX}/${fileName}`;
    const oldFilesToDelete: string[] = [];

    const executeTransaction = async (
      em: EntityManager,
    ): Promise<Attachment> => {
      const repo = em.getRepository(Attachment);
      const userRepo = em.getRepository(User);

      const oldAttachments = await repo.find({
        where: {
          attachableType: ATTACHABLE_TYPE.USER,
          attachableId: String(userId),
        },
      });

      const newAttachment = repo.create({
        id,
        attachableId: String(userId),
        attachableType: ATTACHABLE_TYPE.USER,
        url: publicUrl,
        fileName: this.sanitizeFileName(file.originalname, ext),
        filePath: relativeFilePath,
        fileType: mimeType,
        fileSize: file.size,
      });

      const savedAttachment = await repo.save(newAttachment);
      await userRepo.update(userId, { image: publicUrl });

      if (oldAttachments.length > 0) {
        await repo.delete(oldAttachments.map((a) => a.id));
        for (const old of oldAttachments) {
          oldFilesToDelete.push(old.filePath);
        }
      }

      return savedAttachment;
    };

    try {
      let saved: Attachment;
      if (manager) {
        saved = await executeTransaction(manager);
      } else {
        saved = await this.dataSource.transaction(async (em) => {
          return executeTransaction(em);
        });
      }

      for (const oldPath of oldFilesToDelete) {
        await this.deleteFileSafely(oldPath);
      }

      return saved;
    } catch (error) {
      await this.deleteFileSafely(relativeFilePath);
      throw error;
    }
  }

  async deleteFileSafely(filePath: string): Promise<void> {
    try {
      const absolutePath = path.resolve(process.cwd(), filePath);
      await fs.unlink(absolutePath);
    } catch (error) {
      this.logger.warn(
        `Failed to delete local attachment: ${filePath}`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private validateAndDetectMime(file: Express.Multer.File): string {
    if (!file || !file.buffer) {
      throw new BadRequestException(
        this.i18n.t('messages.attachments.file_required'),
      );
    }

    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        this.i18n.t('messages.attachments.file_too_large'),
      );
    }

    const detected = this.detectImageMime(file.buffer);
    if (!detected || !ALLOWED_IMAGE_MIME_TYPES.includes(detected)) {
      throw new BadRequestException(
        this.i18n.t('messages.attachments.invalid_file_type'),
      );
    }

    return detected;
  }

  private detectImageMime(buffer: Buffer): string | null {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return 'image/jpeg';
    }
    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return 'image/png';
    }
    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return 'image/webp';
    }
    return null;
  }

  private sanitizeFileName(originalName: string, ext: string): string {
    const base = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
    return base || `avatar.${ext}`;
  }
}
