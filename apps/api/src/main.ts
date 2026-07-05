import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json } from 'express';
import { AppModule } from './app.module';
import { StripeStyleExceptionFilter } from './common/errors';
import { corsOptions, validateRuntimeConfig } from './common/env';
import { PhosopLogger } from './common/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: new PhosopLogger() });
  validateRuntimeConfig();
  app.enableCors(corsOptions());
  app.setGlobalPrefix('v1');
  app.use(
    json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new StripeStyleExceptionFilter());
  const port = process.env.PORT ? Number(process.env.PORT) : 3333;
  await app.listen(port);
  console.log(`[phosop] API listening on :${port}`);
}

bootstrap();
