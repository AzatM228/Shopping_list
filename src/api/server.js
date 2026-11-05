import express from 'express';
import process from 'node:process';
import { listsRouter } from './routes/lists.js';

/** 404 для неизвестных маршрутов. */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'NotFound',
    message: `Маршрут ${req.method} ${req.path} не найден`,
  });
}

/**
 * Единый обработчик ошибок (в Express 5 обязательно 4 аргумента).
 * Ошибки парсинга JSON приходят сюда же со status = 400 — сервер не падает.
 */
export function errorHandler(error, req, res, _next) {
  const status = Number(error?.status ?? error?.statusCode ?? 500);
  const isClientError = status >= 400 && status < 500;

  if (!isClientError) {
    console.error('[api] необработанная ошибка:', error);
  }

  res.status(isClientError ? status : 500).json({
    error: isClientError ? 'BadRequest' : 'InternalServerError',
    message: isClientError ? error.message : 'Внутренняя ошибка сервера',
  });
}

/** Создаёт express-приложение. body-parser не нужен: express.json() встроен в Express 5. */
export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/lists', listsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
