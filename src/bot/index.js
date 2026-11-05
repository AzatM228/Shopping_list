import { Telegraf } from 'telegraf';
import { config } from '../config.js';
import { handleCallbackQuery } from './handlers/actions.js';
import {
  handleCancel,
  handleHelp,
  handleItems,
  handleJoinList,
  handleNewList,
  handleStart,
} from './handlers/commands.js';
import { handleText } from './handlers/text.js';

/** Регистрация всех обработчиков. Вынесено отдельно, чтобы бота было легко тестировать. */
export function registerHandlers(bot) {
  bot.start(handleStart);
  bot.help(handleHelp);
  bot.command('new_list', handleNewList);
  bot.command('join_list', handleJoinList);
  bot.command('items', handleItems);
  bot.command('cancel', handleCancel);
  bot.on('callback_query', handleCallbackQuery);
  bot.on('text', handleText);
  return bot;
}

/**
 * Создаёт бота. Токен читается из окружения — хардкод запрещён.
 * @param {string} [token]
 */
export function createBot(token = config.botToken) {
  if (!token) {
    throw new Error('BOT_TOKEN не задан. Укажите его в .env (см. .env.example).');
  }

  const bot = new Telegraf(token);
  registerHandlers(bot);

  bot.catch((error, ctx) => {
    console.error(`[bot] ошибка обработки "${ctx.updateType}":`, error.message);
  });

  return bot;
}
