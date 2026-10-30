/**
 * Собственный менеджер состояний (FSM) для пошаговых диалогов бота.
 *
 * Ключ — `chatId:userId`, поэтому сценарии разных пользователей
 * (и разных чатов одного пользователя) не пересекаются.
 * Состояние живёт в памяти процесса и сбрасывается при перезапуске.
 */

export const SESSION_STEPS = Object.freeze({
  IDLE: 'idle',
  AWAIT_ITEM_NAME: 'await_item_name',
  AWAIT_ITEM_QTY: 'await_item_qty',
});

const sessions = new Map();

const buildKey = (chatId, userId) => `${chatId}:${userId}`;

const idleSession = () => ({ step: SESSION_STEPS.IDLE, data: {} });

export function getSession(chatId, userId) {
  return sessions.get(buildKey(chatId, userId)) ?? idleSession();
}

export function setSession(chatId, userId, { step = SESSION_STEPS.IDLE, data = {} } = {}) {
  const session = { step, data: { ...data } };
  sessions.set(buildKey(chatId, userId), session);
  return session;
}

/** Меняет шаг и/или домешивает данные к уже накопленным в сценарии. */
export function updateSession(chatId, userId, { step, data } = {}) {
  const current = getSession(chatId, userId);
  return setSession(chatId, userId, {
    step: step ?? current.step,
    data: { ...current.data, ...data },
  });
}

export function clearSession(chatId, userId) {
  sessions.delete(buildKey(chatId, userId));
}

export function resetSessions() {
  sessions.clear();
}
