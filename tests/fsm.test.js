import { beforeEach, describe, expect, it } from 'vitest';
import {
  SESSION_STEPS,
  clearSession,
  getSession,
  resetSessions,
  setSession,
  updateSession,
} from '../src/bot/fsm.js';

beforeEach(() => {
  resetSessions();
});

describe('FSM-менеджер состояний', () => {
  it('по умолчанию возвращает idle-состояние', () => {
    expect(getSession(1, 1)).toEqual({ step: SESSION_STEPS.IDLE, data: {} });
  });

  it('хранит состояние изолированно по chatId + userId', () => {
    setSession(1, 1, { step: SESSION_STEPS.AWAIT_ITEM_NAME, data: { listId: 'A' } });
    setSession(1, 2, { step: SESSION_STEPS.AWAIT_ITEM_QTY, data: { listId: 'B' } });

    expect(getSession(1, 1).step).toBe(SESSION_STEPS.AWAIT_ITEM_NAME);
    expect(getSession(1, 2).step).toBe(SESSION_STEPS.AWAIT_ITEM_QTY);
    expect(getSession(2, 1).step).toBe(SESSION_STEPS.IDLE);
  });

  it('updateSession домешивает данные и меняет шаг', () => {
    setSession(1, 1, { step: SESSION_STEPS.AWAIT_ITEM_NAME, data: { listId: 'A' } });
    const updated = updateSession(1, 1, { step: SESSION_STEPS.AWAIT_ITEM_QTY, data: { itemName: 'Молоко' } });

    expect(updated.step).toBe(SESSION_STEPS.AWAIT_ITEM_QTY);
    expect(updated.data).toEqual({ listId: 'A', itemName: 'Молоко' });
  });

  it('updateSession без аргументов сохраняет текущий шаг', () => {
    setSession(3, 3, { step: SESSION_STEPS.AWAIT_ITEM_QTY, data: { listId: 'C' } });
    expect(updateSession(3, 3).step).toBe(SESSION_STEPS.AWAIT_ITEM_QTY);
  });

  it('clearSession сбрасывает диалог пользователя', () => {
    setSession(1, 1, { step: SESSION_STEPS.AWAIT_ITEM_NAME });
    clearSession(1, 1);
    expect(getSession(1, 1).step).toBe(SESSION_STEPS.IDLE);
  });

  it('setSession без аргументов создаёт idle-состояние', () => {
    expect(setSession(9, 9)).toEqual({ step: SESSION_STEPS.IDLE, data: {} });
  });
});
