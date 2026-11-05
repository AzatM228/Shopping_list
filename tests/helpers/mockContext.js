/** Мини-заглушка Telegraf Context для unit-тестов хендлеров (без сети). */
export function createMockContext(overrides = {}) {
  const calls = { reply: [], edit: [], answer: [] };

  const ctx = {
    calls,
    chat: { id: 100, type: 'private' },
    from: { id: 42, first_name: 'Тест', last_name: 'Покупатель' },
    message: { text: 'привет' },
    callbackQuery: { data: '', message: { message_id: 1 } },
    reply: async (text, extra) => {
      calls.reply.push({ text, extra });
      return { message_id: 1 };
    },
    editMessageText: async (text, extra) => {
      calls.edit.push({ text, extra });
      return { message_id: 1 };
    },
    answerCbQuery: async (text) => {
      calls.answer.push(text);
      return true;
    },
  };

  return Object.assign(ctx, overrides);
}

export const lastReply = (ctx) => ctx.calls.reply.at(-1) ?? null;

export const lastEdit = (ctx) => ctx.calls.edit.at(-1) ?? null;

export const replyTexts = (ctx) => ctx.calls.reply.map((entry) => entry.text).join('\n');
