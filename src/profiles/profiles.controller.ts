import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import type { ProfileResponse } from './interfaces/profile-response.interface.js';
import { ProfilesService } from './profiles.service.js';

@ApiTags('Profiles')
@Controller('api/profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':username')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get profile of a user by username' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async getProfile(
    @Param('username') username: string,
    @CurrentUser() currentUser?: JwtPayload,
  ): Promise<{ profile: ProfileResponse }> {
    return this.profilesService.getProfile(username, currentUser?.sub);
  }

  @Post(':username/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Follow a user' })
  @ApiResponse({ status: 200, description: 'Followed user successfully' })
  @ApiResponse({ status: 400, description: 'Cannot follow yourself' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async followUser(
    @Param('username') username: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ profile: ProfileResponse }> {
    return this.profilesService.followUser(username, currentUser.sub);
  }

  @Delete(':username/follow')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unfollow a user' })
  @ApiResponse({ status: 200, description: 'Unfollowed user successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async unfollowUser(
    @Param('username') username: string,
    @CurrentUser() currentUser: JwtPayload,
  ): Promise<{ profile: ProfileResponse }> {
    return this.profilesService.unfollowUser(username, currentUser.sub);
  }
}
