import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { I18nService } from 'nestjs-i18n';
import { Repository } from 'typeorm';
import { Follow } from '../database/entities/follow.entity.js';
import { User } from '../users/entities/user.entity.js';
import type { ProfileResponse } from './interfaces/profile-response.interface.js';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Follow)
    private readonly followRepository: Repository<Follow>,
    private readonly i18n: I18nService,
  ) {}

  async getProfile(
    username: string,
    currentUserId?: number,
  ): Promise<{ profile: ProfileResponse }> {
    const targetUser = await this.findUserByUsername(username);

    let isFollowing = false;
    if (currentUserId && currentUserId !== targetUser.id) {
      isFollowing = await this.followRepository.exists({
        where: {
          followerId: currentUserId,
          followingId: targetUser.id,
        },
      });
    }

    return this.buildProfileResponse(targetUser, isFollowing);
  }

  async followUser(
    username: string,
    currentUserId: number,
  ): Promise<{ profile: ProfileResponse }> {
    const targetUser = await this.findUserByUsername(username);

    if (targetUser.id === currentUserId) {
      throw new BadRequestException(
        this.i18n.t('messages.profiles.cannot_follow_self'),
      );
    }

    const alreadyFollowing = await this.followRepository.exists({
      where: {
        followerId: currentUserId,
        followingId: targetUser.id,
      },
    });

    if (!alreadyFollowing) {
      const follow = this.followRepository.create({
        followerId: currentUserId,
        followingId: targetUser.id,
      });
      await this.followRepository.save(follow);
    }

    return this.buildProfileResponse(targetUser, true);
  }

  async unfollowUser(
    username: string,
    currentUserId: number,
  ): Promise<{ profile: ProfileResponse }> {
    const targetUser = await this.findUserByUsername(username);

    await this.followRepository.delete({
      followerId: currentUserId,
      followingId: targetUser.id,
    });

    return this.buildProfileResponse(targetUser, false);
  }

  private async findUserByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new NotFoundException(
        this.i18n.t('messages.profiles.profile_not_found'),
      );
    }
    return user;
  }

  private buildProfileResponse(
    user: User,
    following: boolean,
  ): { profile: ProfileResponse } {
    return {
      profile: {
        username: user.username,
        bio: user.bio,
        image: user.image,
        following,
      },
    };
  }
}
