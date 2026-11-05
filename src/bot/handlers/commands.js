import { DomainError } from '../../services/errors.js';
import {
  createList,
  getActiveList,
  joinList,
  setActiveList,
} from '../../services/listService.js';
import { SESSION_STEPS, clearSession, getSession } from '../fsm.js';
import { escapeHtml, renderItemsKeyboard, renderListText } from '../ui.js';

export const HELP_TEXT = [
  '<b>Доступные команды</b>',
  '/new_list — создать новый список покупок',
  '/join_list &lt;код&gt; — подключиться к списку по коду',
  '/items — показать покупки и кнопки управления',
  '/cancel — отменить текущий диалог',
  '/help — эта справка',
].join('\n');

const displayName = (from) => {
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
  return fullName || from.username || `user_${from.id}`;
};

/** Участник текущего апдейта в формате, который понимает listService. */
export const participantFromCtx = (ctx) => ({
  id: String(ctx.from.id),
  name: displayName(ctx.from),
});

const noActiveListMessage = [
  'У вас пока нет активного списка.',
  'Создайте новый: /new_list',
  'Или подключитесь к существующему: /join_list &lt;код&gt;',
].join('\n');

export async function handleStart(ctx) {
  const name = escapeHtml(displayName(ctx.from));
  await ctx.reply(`👋 Привет, <b>${name}</b>!\n\n${HELP_TEXT}`, { parse_mode: 'HTML' });
}

export async function handleHelp(ctx) {
  await ctx.reply(HELP_TEXT, { parse_mode: 'HTML' });
}

export async function handleNewList(ctx) {
  const list = createList({
    name: `Список — ${displayName(ctx.from)}`,
    owner: participantFromCtx(ctx),
  });

  setActiveList(ctx.chat.id, ctx.from.id, list.id);

  await ctx.reply(
    [
      '✅ Список создан!',
      `Код приглашения: <code>${list.code}</code>`,
      '',
      `Отправьте код другим участникам или используйте /join_list ${list.code}`,
    ].join('\n'),
    { parse_mode: 'HTML', ...renderItemsKeyboard(list) },
  );

  return list;
}

export async function handleJoinList(ctx) {
  const text = ctx.message?.text ?? '';
  const code = text.trim().split(/\s+/)[1];

  if (!code) {
    await ctx.reply('Использование: /join_list &lt;код&gt;\nНапример: /join_list ABC123', { parse_mode: 'HTML' });
    return null;
  }

  try {
    const { list, alreadyMember } = joinList({ code, user: participantFromCtx(ctx) });
    setActiveList(ctx.chat.id, ctx.from.id, list.id);

    const members = list.participants.map((member) => `• ${escapeHtml(member.name)}`).join('\n');
    const title = alreadyMember ? 'Вы уже в этом списке' : '✅ Вы подключились к списку';

    await ctx.reply(
      [`${title} <b>«${escapeHtml(list.name)}»</b>`, '', '👥 Участники:', members].join('\n'),
      { parse_mode: 'HTML', ...renderItemsKeyboard(list) },
    );

    return list;
  } catch (error) {
    if (error instanceof DomainError) {
      // Неверный код — сообщаем пользователю, бот продолжает работу.
      await ctx.reply('❌ Список с таким кодом не найден. Проверьте код и попробуйте снова.');
      return null;
    }
    throw error;
  }
}

export async function handleItems(ctx) {
  const list = getActiveList(ctx.chat.id, ctx.from.id);

  if (!list) {
    await ctx.reply(noActiveListMessage, { parse_mode: 'HTML' });
    return null;
  }

  await ctx.reply(renderListText(list), { parse_mode: 'HTML', ...renderItemsKeyboard(list) });
  return list;
}

export async function handleCancel(ctx) {
  const session = getSession(ctx.chat.id, ctx.from.id);

  if (session.step === SESSION_STEPS.IDLE) {
    await ctx.reply('Нечего отменять — активного диалога нет.');
    return;
  }

  clearSession(ctx.chat.id, ctx.from.id);
  await ctx.reply('Ок, отменил. Возвращайтесь: /items');
}
