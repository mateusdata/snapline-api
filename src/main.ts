
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { initializeSwagger } from './config/ swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  initializeSwagger(app);

  app.useGlobalPipes(new ValidationPipe({ transform: true, forbidNonWhitelisted: true }));
  const port = process.env.PORT ?? 3000;

  await app.listen(process.env.PORT ?? 3000, () => {
    Logger.log(`Application is running on: http://localhost:${port}/api`, 'Bootstrap');
    Logger.log(`Swagger UI available at: http://localhost:${port}/api/docs`, 'Bootstrap');
  });
}
bootstrap();
