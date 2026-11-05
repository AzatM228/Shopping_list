import process from 'node:process';
import { createApp } from './api/server.js';
import { createBot } from './bot/index.js';
import { config } from './config.js';
import { loadState } from './storage/persistence.js';

async function bootstrap() {
  await loadState();

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`[api] сервер запущен: http://localhost:${config.port}`);
  });

  let bot = null;

  if (config.botToken) {
    bot = createBot(config.botToken);
    await bot.launch();
    console.log('[bot] запущен в режиме long polling');
  } else {
    console.warn('[bot] BOT_TOKEN не задан — бот отключён, доступен только API');
  }

  const shutdown = (signal) => {
    console.log(`[app] получен ${signal}, завершаем работу`);
    bot?.stop(signal);
    server.close(() => process.exit(0));
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((error) => {
  console.error('[app] не удалось запустить приложение:', error);
  process.exit(1);
});
