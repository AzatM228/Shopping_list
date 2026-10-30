import { DomainError } from '../../services/errors.js';
import { addItem, getList, getListState } from '../../services/listService.js';
import { itemNameSchema, itemQtySchema } from '../../validators/schemas.js';
import { SESSION_STEPS, clearSession, getSession, updateSession } from '../fsm.js';
import { escapeHtml, formatQty, renderItemsKeyboard, renderListText } from '../ui.js';

const UNKNOWN_MESSAGE = [
  'Не понял сообщение 🤔',
  'Доступные команды: /new_list, /join_list, /items, /help',
].join('\n');

const askQuantity = async (ctx, chatId, userId, text) => {
  const parsed = itemNameSchema.safeParse(text);

  if (!parsed.success) {
    await ctx.reply('Некорректное название (до 120 символов). Отправьте название или /cancel для отмены.');
    return;
  }

  updateSession(chatId, userId, { step: SESSION_STEPS.AWAIT_ITEM_QTY, data: { itemName: parsed.data } });
  await ctx.reply(`Шаг 2/2 — сколько «${parsed.data}»? Отправьте число больше 0.`);
};

const saveItem = async (ctx, chatId, userId, session, text) => {
  const { listId, itemName } = session.data ?? {};
  const list = getList(listId);

  if (!list) {
    clearSession(chatId, userId);
    await ctx.reply('⚠️ Список больше недоступен. Создайте новый: /new_list');
    return;
  }

  const parsedQty = itemQtySchema.safeParse(text.replace(',', '.'));

  if (!parsedQty.success) {
    await ctx.reply('Нужно число больше 0 (например, 2 или 1.5). Попробуйте снова или /cancel.');
    return;
  }

  const item = addItem(list.id, { name: itemName, qty: parsedQty.data });
  clearSession(chatId, userId);

  const snapshot = getListState(list.id);
  await ctx.reply(
    `✅ Добавлено: ${escapeHtml(item.name)} — ${formatQty(item.qty)}\n\n${renderListText(snapshot)}`,
    { parse_mode: 'HTML', ...renderItemsKeyboard(snapshot) },
  );
};

/**
 * Обработчик текстовых сообщений.
 * Вне активного FSM-сценария не падает, а подсказывает команды.
 */
export async function handleText(ctx) {
  const text = (ctx.message?.text ?? '').trim();

  // Команды обрабатывают command-хендлеры, здесь их игнорируем.
  if (!text || text.startsWith('/')) {
    return;
  }

  const chatId = ctx.chat.id;
  const userId = ctx.from.id;
  const session = getSession(chatId, userId);

  try {
    switch (session.step) {
      case SESSION_STEPS.AWAIT_ITEM_NAME:
        await askQuantity(ctx, chatId, userId, text);
        return;
      case SESSION_STEPS.AWAIT_ITEM_QTY:
        await saveItem(ctx, chatId, userId, session, text);
        return;
      default:
        await ctx.reply(UNKNOWN_MESSAGE);
    }
  } catch (error) {
    if (error instanceof DomainError) {
      clearSession(chatId, userId);
      await ctx.reply(`⚠️ ${error.message}`);
      return;
    }
    throw error;
  }
}
