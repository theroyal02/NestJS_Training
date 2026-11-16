import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('User')
@Controller('api/user')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Return current user info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@CurrentUser() user: JwtPayload) {
    const profile = await this.usersService.findById(user.sub);
    return {
      id: profile?.id,
      email: profile?.email,
      username: profile?.username,
      bio: profile?.bio,
      image: profile?.image,
      createdAt: profile?.createdAt,
      updatedAt: profile?.updatedAt,
    };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'new_email@sun-asterisk.vn' },
        username: { type: 'string', example: 'new_username' },
        password: { type: 'string', example: 'NewPassword123' },
        bio: { type: 'string', example: 'Fullstack Developer' },
        image: { type: 'string', example: '/uploads/avatars/avatar.jpg' },
        avatar: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Update current user profile and optional avatar' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or image format' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 409, description: 'Email or username already in use' })
  async updateUser(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUserDto,
    @UploadedFile() avatarFile?: Express.Multer.File,
  ) {
    return this.usersService.updateUser(user.sub, dto, avatarFile, user);
  }
}
