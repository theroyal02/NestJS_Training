import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AppService } from './app.service.js';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get localized greeting',
    description:
      'Retrieves a hello world greeting translated according to resolved locale.',
  })
  @ApiQuery({
    name: 'lang',
    required: false,
    enum: ['en', 'vi'],
    description:
      'Language code for translation (supported: en, vi; fallback to en).',
    example: 'en',
  })
  @ApiResponse({
    status: 200,
    description: 'Localized greeting string.',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  getGreeting(): string {
    return this.appService.getGreeting();
  }
}
