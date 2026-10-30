import { Markup } from 'telegraf';

/** Telegram принимает ограниченное число кнопок — показываем разумный максимум. */
export const MAX_ITEMS_IN_KEYBOARD = 50;

export const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

export const formatQty = (qty) => (Number.isInteger(qty) ? String(qty) : String(Number(qty.toFixed(2))));

/** Текстовое представление списка (HTML parse_mode). */
export function renderListText(list) {
  const members = list.participants.map((member) => escapeHtml(member.name)).join(', ') || '—';
  const doneCount = list.items.filter((item) => item.done).length;

  const lines = [
    `🛒 <b>${escapeHtml(list.name)}</b>`,
    `Код приглашения: <code>${list.code}</code>`,
    '',
    `👥 Участники (${list.participants.length}): ${members}`,
    '',
  ];

  if (list.items.length === 0) {
    lines.push('Список пуст. Нажмите «➕ Добавить покупку».');
  } else {
    lines.push(`📋 Покупки (${doneCount}/${list.items.length}):`);
    for (const item of list.items) {
      lines.push(`${item.done ? '✅' : '⬜️'} ${escapeHtml(item.name)} — ${formatQty(item.qty)}`);
    }
  }

  return lines.join('\n');
}

/** Inline-клавиатура: отметка «сделано» + управление. */
export function renderItemsKeyboard(list) {
  const rows = list.items.slice(0, MAX_ITEMS_IN_KEYBOARD).map((item) => [
    Markup.button.callback(
      `${item.done ? '✅' : '⬜️'} ${item.name} (${formatQty(item.qty)})`.slice(0, 60),
      `toggle:${list.id}:${item.id}`,
    ),
  ]);

  rows.push([
    Markup.button.callback('➕ Добавить покупку', `add:${list.id}`),
    Markup.button.callback('🔄 Обновить', `refresh:${list.id}`),
  ]);

  return Markup.inlineKeyboard(rows);
}

/** Клавиатура для шага диалога добавления покупки. */
export const flowKeyboard = () => Markup.inlineKeyboard([[Markup.button.callback('✖️ Отмена', 'cancel:')]]);
