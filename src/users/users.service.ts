import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { I18nService } from 'nestjs-i18n';
import { DataSource, Not, Repository } from 'typeorm';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { BCRYPT_SALT_ROUNDS } from '../auth/auth.constants.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { RedisService } from '../redis/redis.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly attachmentsService: AttachmentsService,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
    private readonly i18n: I18nService,
  ) {}

  async checkEmailExists(
    email: string,
    excludeUserId?: number,
  ): Promise<boolean> {
    if (excludeUserId) {
      return this.usersRepository.exists({
        where: { email, id: Not(excludeUserId) },
      });
    }
    return this.usersRepository.exists({ where: { email } });
  }

  async checkUsernameExists(
    username: string,
    excludeUserId?: number,
  ): Promise<boolean> {
    if (excludeUserId) {
      return this.usersRepository.exists({
        where: { username, id: Not(excludeUserId) },
      });
    }
    return this.usersRepository.exists({ where: { username } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async createUser(userData: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(userData);
    return this.usersRepository.save(user);
  }

  async getCurrentUser(userId: number) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException(this.i18n.t('messages.users.user_not_found'));
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      bio: user.bio,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateUser(
    userId: number,
    dto: UpdateUserDto,
    avatarFile?: Express.Multer.File,
    tokenPayload?: JwtPayload,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({ where: { id: userId } });
      if (!user) {
        throw new NotFoundException(
          this.i18n.t('messages.users.user_not_found'),
        );
      }

      if (dto.email && dto.email !== user.email) {
        const emailTaken = await userRepo.exists({
          where: { email: dto.email, id: Not(userId) },
        });
        if (emailTaken) {
          throw new ConflictException(
            this.i18n.t('messages.users.email_in_use'),
          );
        }
        user.email = dto.email.trim().toLowerCase();
      }

      if (dto.username && dto.username !== user.username) {
        const usernameTaken = await userRepo.exists({
          where: { username: dto.username, id: Not(userId) },
        });
        if (usernameTaken) {
          throw new ConflictException(
            this.i18n.t('messages.users.username_in_use'),
          );
        }
        user.username = dto.username.trim();
      }

      if (dto.bio !== undefined) {
        user.bio = dto.bio;
      }

      if (dto.image !== undefined) {
        user.image = dto.image;
      }

      if (avatarFile) {
        const attachment = await this.attachmentsService.saveUserAvatar(
          avatarFile,
          userId,
          manager,
        );
        user.image = attachment.url;
      }

      let isPasswordChanged = false;
      if (dto.password) {
        user.password = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
        user.passwordChangedAt = new Date();
        isPasswordChanged = true;
      }

      const savedUser = await userRepo.save(user);

      if (isPasswordChanged && tokenPayload?.jti) {
        await this.redisService.setBlacklistToken(
          tokenPayload.jti,
          tokenPayload.exp
            ? tokenPayload.exp - Math.floor(Date.now() / 1000)
            : 3600,
        );
      }

      return {
        id: savedUser.id,
        email: savedUser.email,
        username: savedUser.username,
        bio: savedUser.bio,
        image: savedUser.image,
        createdAt: savedUser.createdAt,
        updatedAt: savedUser.updatedAt,
      };
    });
  }
}
