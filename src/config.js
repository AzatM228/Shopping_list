import { existsSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

/**
 * Загрузка переменных окружения без сторонних зависимостей:
 * используется нативная поддержка .env в Node.js (>= 20.12).
 */
const envFilePath = fileURLToPath(new URL('../.env', import.meta.url));

if (existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}

const toPositiveInt = (rawValue, fallback) => {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: toPositiveInt(process.env.PORT, 3000),
  botToken: process.env.BOT_TOKEN ?? '',
  dataFile: process.env.DATA_FILE || null,
};

export const isProduction = config.nodeEnv === 'production';
