import * as path from 'path';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';

export function configureApp(app: NestExpressApplication): void {
  const configService = app.get(ConfigService);
  const uploadDir = configService.get<string>('UPLOAD_DIR', 'public/uploads');

  app.useStaticAssets(path.resolve(process.cwd(), uploadDir), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
