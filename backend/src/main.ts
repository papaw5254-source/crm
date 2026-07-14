import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { runPreflightMigrations } from './database/preflight-migrations';

async function bootstrap() {
  await runPreflightMigrations();

  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger only in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle("G'isht Zavodi CRM API")
      .setDescription("Complete API documentation for Brick Factory CRM system")
      .setVersion('1.0')
      .addBearerAuth()
      .addTag('auth', 'Authentication endpoints')
      .addTag('users', 'User management (Admin only)')
      .addTag('stock', 'Stock management')
      .addTag('inventory', 'Inventory income (Kirim)')
      .addTag('sales', 'Sales management (Chiqim)')
      .addTag('debtors', 'Debtors management (Qarzdorlar)')
      .addTag('expenses', 'Expenses management (Xarajatlar)')
      .addTag('reports', 'Reports and analytics')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
    console.log(`📚 Swagger docs: http://localhost:${process.env.PORT || 3000}/api/docs`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`\n🚀 G'isht Zavodi CRM Backend: http://localhost:${port}/api`);
}

bootstrap();
