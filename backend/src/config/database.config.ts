import { registerAs } from '@nestjs/config';

export default registerAs('database', () => {
  const password = process.env.DB_PASSWORD;
  if (!password) {
    throw new Error('DB_PASSWORD must be set in environment variables');
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password,
    database: process.env.DB_DATABASE || 'brick_factory_crm',
  };
});
