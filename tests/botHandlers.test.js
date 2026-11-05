import { beforeEach, describe, expect, it } from 'vitest';
import { handleCallbackQuery } from '../src/bot/handlers/actions.js';
import {
  handleCancel,
  handleHelp,
  handleItems,
  handleJoinList,
  handleNewList,
  handleStart,
  participantFromCtx,
} from '../src/bot/handlers/commands.js';
import { handleText } from '../src/bot/handlers/text.js';
import { createBot, registerHandlers } from '../src/bot/index.js';
import { SESSION_STEPS, getSession, resetSessions, setSession } from '../src/bot/fsm.js';
import { addItem, createList, getActiveList, setActiveList } from '../src/services/listService.js';
import { resetState } from '../src/storage/store.js';
import { createMockContext, lastEdit, lastReply } from './helpers/mockContext.js';

beforeEach(() => {
  resetState();
  resetSessions();
});

describe('команды бота', () => {
  it('/start приветствует пользователя и показывает команды', async () => {
    const ctx = createMockContext();

    await handleStart(ctx);

    expect(ctx.calls.reply[0].text).toContain('Привет');
    expect(ctx.calls.reply[0].text).toContain('/new_list');
    expect(ctx.calls.reply[0].extra).toEqual({ parse_mode: 'HTML' });
  });

  it('/help отдаёт справку', async () => {
    const ctx = createMockContext();
    await handleHelp(ctx);
    expect(lastReply(ctx).text).toContain('/join_list');
  });

  it('/new_list создаёт список, делает создателя участником и присылает код', async () => {
    const ctx = createMockContext();

    const list = await handleNewList(ctx);

    expect(list.participants[0]).toEqual({ id: '42', name: 'Тест Покупатель' });
    expect(getActiveList(100, 42)).toBe(list);
    expect(lastReply(ctx).text).toContain(list.code);
    expect(lastReply(ctx).extra.reply_markup.inline_keyboard).toBeDefined();
  });

  it('имя пользователя берётся из username, если нет имени', () => {
    expect(participantFromCtx({ from: { id: 5, username: 'neo' } })).toEqual({ id: '5', name: 'neo' });
    expect(participantFromCtx({ from: { id: 5 } })).toEqual({ id: '5', name: 'user_5' });
  });

  it('/join_list без кода подсказывает формат', async () => {
    const ctx = createMockContext({ message: { text: '/join_list' } });

    await handleJoinList(ctx);

    expect(lastReply(ctx).text).toContain('Использование');
  });

  it('/join_list с неверным кодом сообщает об ошибке и не падает', async () => {
    const ctx = createMockContext({ message: { text: '/join_list ZZZZZZ' } });

    const result = await handleJoinList(ctx);

    expect(result).toBeNull();
    expect(lastReply(ctx).text).toContain('не найден');
  });

  it('/join_list подключает к списку и показывает участников', async () => {
    const list = createList({ name: 'Пятница', owner: { id: '1', name: 'Хозяин' } });
    const ctx = createMockContext({ message: { text: `/join_list ${list.code.toLowerCase()}` } });

    await handleJoinList(ctx);

    expect(getActiveList(100, 42)).toBe(list);
    expect(lastReply(ctx).text).toContain('Хозяин');
    expect(lastReply(ctx).text).toContain('Тест Покупатель');
  });

  it('/join_list повторно сообщает, что пользователь уже в списке', async () => {
    const list = createList({ owner: { id: '42', name: 'Тест Покупатель' } });
    const ctx = createMockContext({ message: { text: `/join_list ${list.code}` } });

    await handleJoinList(ctx);

    expect(lastReply(ctx).text).toContain('уже в этом списке');
  });

  it('/items без активного списка подсказывает, что делать', async () => {
    const ctx = createMockContext();

    const result = await handleItems(ctx);

    expect(result).toBeNull();
    expect(lastReply(ctx).text).toContain('нет активного списка');
  });

  it('/items показывает покупки со статусами и клавиатуру', async () => {
    const list = createList({ name: 'Пятница', owner: { id: '42', name: 'Тест' } });
    addItem(list.id, { name: 'Хлеб', qty: 1 });
    setActiveList(100, 42, list.id);
    const ctx = createMockContext();

    const result = await handleItems(ctx);

    expect(result).toBe(list);
    expect(lastReply(ctx).text).toContain('Хлеб');
    expect(lastReply(ctx).text).toContain('0/1');
    expect(lastReply(ctx).extra.reply_markup.inline_keyboard).toBeDefined();
  });

  it('/cancel без активного диалога сообщает, что отменять нечего', async () => {
    const ctx = createMockContext();
    await handleCancel(ctx);
    expect(lastReply(ctx).text).toContain('Нечего отменять');
  });

  it('/cancel сбрасывает диалог', async () => {
    const ctx = createMockContext();
    setSession(100, 42, { step: SESSION_STEPS.AWAIT_ITEM_NAME });

    await handleCancel(ctx);

    expect(getSession(100, 42).step).toBe(SESSION_STEPS.IDLE);
    expect(lastReply(ctx).text).toContain('отменил');
  });
});

describe('FSM-диалог добавления покупки', () => {
  const list = () => createList({ name: 'Пятница', owner: { id: '42', name: 'Тест' } });

  it('пошагово добавляет покупку: название -> количество', async () => {
    const activeList = list();
    setSession(100, 42, { step: SESSION_STEPS.AWAIT_ITEM_NAME, data: { listId: activeList.id } });

    const nameCtx = createMockContext({ message: { text: 'Молоко' } });
    await handleText(nameCtx);

    expect(lastReply(nameCtx).text).toContain('Шаг 2/2');
    expect(getSession(100, 42)).toMatchObject({
      step: SESSION_STEPS.AWAIT_ITEM_QTY,
      data: { listId: activeList.id, itemName: 'Молоко' },
    });

    const qtyCtx = createMockContext({ message: { text: '2,5' } });
    await handleText(qtyCtx);

    expect(lastReply(qtyCtx).text).toContain('Добавлено');
    expect(getSession(100, 42).step).toBe(SESSION_STEPS.IDLE);
    expect(activeList.items[0]).toMatchObject({ name: 'Молоко', qty: 2.5, done: false });
  });

  it('не принимает слишком длинное название', async () => {
    const activeList = list();
    setSession(100, 42, { step: SESSION_STEPS.AWAIT_ITEM_NAME, data: { listId: activeList.id } });
    const ctx = createMockContext({ message: { text: 'о'.repeat(150) } });

    await handleText(ctx);

    expect(lastReply(ctx).text).toContain('Некорректное название');
    expect(getSession(100, 42).step).toBe(SESSION_STEPS.AWAIT_ITEM_NAME);
  });

  it('не принимает нечисловое количество и 0', async () => {
    const activeList = list();
    setSession(100, 42, {
      step: SESSION_STEPS.AWAIT_ITEM_QTY,
      data: { listId: activeList.id, itemName: 'Молоко' },
    });

    const badCtx = createMockContext({ message: { text: 'abc' } });
    await handleText(badCtx);
    expect(lastReply(badCtx).text).toContain('Нужно число больше 0');

    const zeroCtx = createMockContext({ message: { text: '0' } });
    await handleText(zeroCtx);
    expect(lastReply(zeroCtx).text).toContain('Нужно число больше 0');

    expect(activeList.items).toHaveLength(0);
    expect(getSession(100, 42).step).toBe(SESSION_STEPS.AWAIT_ITEM_QTY);
  });

  it('сообщает, если список исчез во время диалога', async () => {
    setSession(100, 42, {
      step: SESSION_STEPS.AWAIT_ITEM_QTY,
      data: { listId: 'несуществующий', itemName: 'Молоко' },
    });
    const ctx = createMockContext({ message: { text: '1' } });

    await handleText(ctx);

    expect(lastReply(ctx).text).toContain('больше недоступен');
    expect(getSession(100, 42).step).toBe(SESSION_STEPS.IDLE);
  });

  it('вне сценария отвечает подсказкой, а команды не перехватывает', async () => {
    const idleCtx = createMockContext({ message: { text: 'привет' } });
    await handleText(idleCtx);
    expect(lastReply(idleCtx).text).toContain('Не понял сообщение');

    const commandCtx = createMockContext({ message: { text: '/items' } });
    await handleText(commandCtx);
    expect(commandCtx.calls.reply).toHaveLength(0);

    const emptyCtx = createMockContext({ message: undefined });
    await handleText(emptyCtx);
    expect(emptyCtx.calls.reply).toHaveLength(0);
  });
});

describe('inline-кнопки (callback_query)', () => {
  it('кнопка «Добавить» запускает FSM-сценарий', async () => {
    const list = createList({ owner: { id: '42', name: 'Тест' } });
    const ctx = createMockContext({ callbackQuery: { data: `add:${list.id}`, message: { message_id: 1 } } });

    await handleCallbackQuery(ctx);

    expect(ctx.calls.answer).toHaveLength(1);
    expect(getSession(100, 42)).toMatchObject({
      step: SESSION_STEPS.AWAIT_ITEM_NAME,
      data: { listId: list.id },
    });
    expect(lastReply(ctx).text).toContain('Шаг 1/2');
  });

  it('кнопка «Добавить» на неизвестном списке не падает', async () => {
    const ctx = createMockContext({ callbackQuery: { data: 'add:нет-такого', message: { message_id: 1 } } });

    await handleCallbackQuery(ctx);

    expect(lastReply(ctx).text).toContain('Список не найден');
  });

  it('кнопка отметки меняет статус покупки и обновляет сообщение', async () => {
    const list = createList({ owner: { id: '42', name: 'Тест' } });
    const item = addItem(list.id, { name: 'Молоко', qty: 2 });
    const ctx = createMockContext({
      callbackQuery: { data: `toggle:${list.id}:${item.id}`, message: { message_id: 1 } },
    });

    await handleCallbackQuery(ctx);

    expect(item.done).toBe(true);
    expect(lastEdit(ctx).text).toContain('✅ Молоко');
  });

  it('отметка несуществующей покупки возвращает понятную ошибку', async () => {
    const list = createList();
    const ctx = createMockContext({
      callbackQuery: { data: `toggle:${list.id}:нет-такой`, message: { message_id: 1 } },
    });

    await handleCallbackQuery(ctx);

    expect(lastReply(ctx).text).toContain('Покупка не найдена');
  });

  it('кнопка «Обновить» перерисовывает сообщение', async () => {
    const list = createList({ owner: { id: '42', name: 'Тест' } });
    addItem(list.id, { name: 'Хлеб', qty: 1 });
    const ctx = createMockContext({ callbackQuery: { data: `refresh:${list.id}`, message: { message_id: 1 } } });

    await handleCallbackQuery(ctx);

    expect(lastEdit(ctx).text).toContain('Хлеб');
  });

  it('молча игнорирует «message is not modified»', async () => {
    const list = createList({ owner: { id: '42', name: 'Тест' } });
    const ctx = createMockContext({
      callbackQuery: { data: `refresh:${list.id}`, message: { message_id: 1 } },
      editMessageText: async () => {
        throw new Error('Bad Request: message is not modified: specified new message content');
      },
    });

    await handleCallbackQuery(ctx);

    expect(ctx.calls.reply).toHaveLength(0);
  });

  it('отправляет новое сообщение, если редактирование невозможно', async () => {
    const list = createList({ owner: { id: '42', name: 'Тест' } });
    const ctx = createMockContext({
      callbackQuery: { data: `refresh:${list.id}`, message: { message_id: 1 } },
      editMessageText: async () => {
        throw new Error('Bad Request: message to edit not found');
      },
    });

    await handleCallbackQuery(ctx);

    expect(lastReply(ctx).text).toContain('Список');
  });

  it('кнопка «Обновить» на неизвестном списке не падает', async () => {
    const ctx = createMockContext({ callbackQuery: { data: 'refresh:нет-такого', message: { message_id: 1 } } });

    await handleCallbackQuery(ctx);

    expect(lastReply(ctx).text).toContain('Список не найден');
  });

  it('кнопка «Отмена» сбрасывает диалог', async () => {
    setSession(100, 42, { step: SESSION_STEPS.AWAIT_ITEM_NAME });
    const ctx = createMockContext({ callbackQuery: { data: 'cancel:', message: { message_id: 1 } } });

    await handleCallbackQuery(ctx);

    expect(getSession(100, 42).step).toBe(SESSION_STEPS.IDLE);
    expect(lastEdit(ctx).text).toContain('отменено');
  });

  it('неизвестное действие сообщает об ошибке', async () => {
    const ctx = createMockContext({ callbackQuery: { data: 'unknown', message: { message_id: 1 } } });

    await handleCallbackQuery(ctx);

    expect(lastReply(ctx).text).toContain('Неизвестное действие');
  });

  it('ошибка answerCbQuery (устаревший запрос) не роняет обработчик', async () => {
    const list = createList({ owner: { id: '42', name: 'Тест' } });
    const ctx = createMockContext({
      callbackQuery: { data: `refresh:${list.id}`, message: { message_id: 1 } },
      answerCbQuery: async () => {
        throw new Error('query is too old');
      },
    });

    await handleCallbackQuery(ctx);

    expect(lastEdit(ctx).text).toContain('Список');
  });
});

describe('создание бота', () => {
  it('требует токен', () => {
    expect(() => createBot('')).toThrow(/BOT_TOKEN/);
  });

  it('создаёт Telegraf-бота с зарегистрированными обработчиками', () => {
    const bot = createBot('123456:TEST-TOKEN');

    expect(typeof bot.launch).toBe('function');
    expect(typeof bot.catch).toBe('function');
    expect(registerHandlers(bot)).toBe(bot);
  });
});
