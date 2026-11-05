import { DomainError } from '../../services/errors.js';
import { getList, getListState, toggleItem } from '../../services/listService.js';
import { SESSION_STEPS, clearSession, setSession } from '../fsm.js';
import { flowKeyboard, renderItemsKeyboard, renderListText } from '../ui.js';

/** Отвечает на callback_query, чтобы убрать «часики». Истёкшие запросы просто игнорируем. */
const answerSilently = async (ctx, text) => {
  try {
    await ctx.answerCbQuery(text);
  } catch {
    // Telegram может вернуть ошибку «query is too old» — это не повод падать.
  }
};

/** Редактирует сообщение бота; если контент не изменился — ошибка Telegram, её игнорируем. */
const safeEdit = async (ctx, text, extra = {}) => {
  try {
    await ctx.editMessageText(text, extra);
    return true;
  } catch (error) {
    const description = error?.description ?? error?.message ?? '';
    if (/message is not modified/i.test(description)) {
      return false;
    }
    // Сообщение могло быть удалено или устареть — отправляем новое.
    await ctx.reply(text, extra);
    return false;
  }
};

const renderListMessage = async (ctx, list) => {
  const snapshot = getListState(list.id);
  await safeEdit(ctx, renderListText(snapshot), {
    parse_mode: 'HTML',
    ...renderItemsKeyboard(snapshot),
  });
};

const startAddItemFlow = async (ctx, chatId, userId, listId) => {
  const list = getList(listId);
  if (!list) {
    await ctx.reply('⚠️ Список не найден. Создайте новый: /new_list');
    return;
  }

  setSession(chatId, userId, { step: SESSION_STEPS.AWAIT_ITEM_NAME, data: { listId: list.id } });

  await ctx.reply(
    `Добавляем покупку в список «${list.name}».\n\nШаг 1/2 — отправьте название покупки или /cancel для отмены.`,
    flowKeyboard(),
  );
};

const toggleFromCallback = async (ctx, listId, itemId) => {
  toggleItem(listId, itemId);
  await renderListMessage(ctx, { id: listId });
};

const refreshFromCallback = async (ctx, listId) => {
  if (!getList(listId)) {
    await ctx.reply('⚠️ Список не найден. Создайте новый: /new_list');
    return;
  }
  await renderListMessage(ctx, { id: listId });
};

const cancelFromCallback = async (ctx, chatId, userId) => {
  clearSession(chatId, userId);
  await safeEdit(ctx, 'Добавление покупки отменено. Используйте /items, чтобы вернуться к списку.', {
    reply_markup: { inline_keyboard: [] },
  });
};

/**
 * Единая точка входа для callback_query.
 * Формат callback_data: `action:listId[:itemId]`.
 */
export async function handleCallbackQuery(ctx) {
  const [action = '', listId = '', itemId = ''] = (ctx.callbackQuery?.data ?? '').split(':');
  const chatId = ctx.chat.id;
  const userId = ctx.from.id;

  await answerSilently(ctx);

  try {
    switch (action) {
      case 'add':
        await startAddItemFlow(ctx, chatId, userId, listId);
        break;
      case 'toggle':
        await toggleFromCallback(ctx, listId, itemId);
        break;
      case 'refresh':
        await refreshFromCallback(ctx, listId);
        break;
      case 'cancel':
        await cancelFromCallback(ctx, chatId, userId);
        break;
      default:
        await ctx.reply('Неизвестное действие кнопки.');
    }
  } catch (error) {
    if (error instanceof DomainError) {
      await ctx.reply(`⚠️ ${error.message}`);
      return;
    }
    throw error;
  }
}
