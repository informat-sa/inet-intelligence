import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  // CORS — allow Next.js frontend (any localhost port for dev)
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      // Allow any localhost / 127.0.0.1 port in development
      if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      // Allow explicitly configured WEB_URL in production
      const allowed = process.env.WEB_URL;
      if (allowed && origin === allowed) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Global prefix
  app.setGlobalPrefix('');

  const port = parseInt(process.env.PORT ?? '3001');
  await app.listen(port);

  const logger = new Logger('Bootstrap');
  logger.log(`🚀 I-NET Intelligence API running on http://localhost:${port}`);
  logger.log(`📊 Health: http://localhost:${port}/health`);
}

bootstrap();
