import * as path from 'path';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useStaticAssets(path.join(process.cwd(), 'public/uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Sun* NestJS Training API')
    .setDescription(
      'NestJS REST API documentation with Swagger, i18n & JWT Authentication',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('App', 'Core status checks')
    .addTag('Authentication', 'User registration, login, logout and profile')
    .addTag('User', 'Current user management')
    .addTag('Profiles', 'User profile and follow/unfollow operations')
    .addTag('Attachments', 'File upload and attachment management')
    .addTag('Articles', 'Article CRUD, feed, and favorites')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(port);
  logger.log(`Application is running on: http://localhost:${port}`);
  logger.log(`Swagger OpenAPI documentation: http://localhost:${port}/api`);
}

await bootstrap();
