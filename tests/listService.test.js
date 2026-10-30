import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError, ERROR_CODES } from '../src/services/errors.js';
import {
  addItem,
  clearActiveList,
  createList,
  getActiveList,
  getList,
  getListByCode,
  getListState,
  joinList,
  setActiveList,
  toggleItem,
} from '../src/services/listService.js';
import { resetState } from '../src/storage/store.js';

const owner = { id: '42', name: 'Тест Покупатель' };

const captureError = (fn) => {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error('Ожидалось исключение, но его не было');
};

beforeEach(() => {
  resetState();
});

describe('createList', () => {
  it('создаёт список с id, кодом приглашения и создателем-участником', () => {
    const list = createList({ name: 'Пятница', owner });

    expect(list.id).toBeTypeOf('string');
    expect(list.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(list.name).toBe('Пятница');
    expect(list.participants).toEqual([owner]);
    expect(list.items).toEqual([]);
  });

  it('использует имя по умолчанию, если название не передано', () => {
    expect(createList().name).toBe('Список покупок');
  });

  it('игнорирует некорректного владельца', () => {
    const list = createList({ owner: { id: '1', name: '   ' } });
    expect(list.participants).toEqual([]);
  });

  it('генерирует уникальные коды для разных списков', () => {
    const lists = Array.from({ length: 50 }, () => createList());
    expect(new Set(lists.map((list) => list.code)).size).toBe(lists.length);
  });
});

describe('getList / getListByCode / getListState', () => {
  it('находит список по id и по коду (регистр не важен)', () => {
    const list = createList({ name: 'Дача' });

    expect(getList(list.id)).toBe(list);
    expect(getListByCode(list.code.toLowerCase())).toBe(list);
    expect(getListState(list.id)).toMatchObject({ id: list.id, code: list.code, name: 'Дача' });
  });

  it('возвращает null/null-состояние для неизвестных данных', () => {
    expect(getList('нет-такого')).toBeNull();
    expect(getList(null)).toBeNull();
    expect(getListByCode('')).toBeNull();
    expect(getListByCode('ab')).toBeNull();
    expect(getListState('нет-такого')).toBeNull();
  });
});

describe('joinList', () => {
  it('подключает участника и не дублирует его при повторном входе', () => {
    const list = createList({ owner });

    const first = joinList({ code: list.code.toLowerCase(), user: { id: '7', name: 'Гость' } });
    expect(first.alreadyMember).toBe(false);
    expect(first.list.participants).toHaveLength(2);

    const second = joinList({ code: list.code, user: { id: '7', name: 'Гость' } });
    expect(second.alreadyMember).toBe(true);
    expect(second.list.participants).toHaveLength(2);
  });

  it('бросает LIST_NOT_FOUND при неверном коде', () => {
    const error = captureError(() => joinList({ code: 'ZZZZZZ', user: { id: '1', name: 'A' } }));
    expect(error).toBeInstanceOf(DomainError);
    expect(error.code).toBe(ERROR_CODES.LIST_NOT_FOUND);
  });

  it('бросает VALIDATION_ERROR при некорректных данных участника', () => {
    const list = createList();
    const error = captureError(() => joinList({ code: list.code, user: { id: '1', name: '' } }));
    expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(error.details.length).toBeGreaterThan(0);
  });
});

describe('addItem', () => {
  it('добавляет покупку, приводит количество к числу и обрезает имя', () => {
    const list = createList({ owner });
    const item = addItem(list.id, { name: '  Молоко  ', qty: '2' });

    expect(item).toMatchObject({ name: 'Молоко', qty: 2, done: false });
    expect(item.id).toBeTypeOf('string');
    expect(getListState(list.id).items).toHaveLength(1);
  });

  it('не изменяет снимок состояния при мутации результата', () => {
    const list = createList();
    addItem(list.id, { name: 'Хлеб', qty: 1 });

    const snapshot = getListState(list.id);
    snapshot.items[0].name = 'Изменено';
    expect(getListState(list.id).items[0].name).toBe('Хлеб');
  });

  it('бросает LIST_NOT_FOUND для неизвестного списка', () => {
    const error = captureError(() => addItem('нет-такого', { name: 'Хлеб', qty: 1 }));
    expect(error.code).toBe(ERROR_CODES.LIST_NOT_FOUND);
  });

  it('бросает VALIDATION_ERROR для невалидных данных', () => {
    const list = createList();

    expect(captureError(() => addItem(list.id, { name: 'Хлеб', qty: 0 })).code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(captureError(() => addItem(list.id, { name: 'Хлеб', qty: 'abc' })).code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(captureError(() => addItem(list.id, { name: '', qty: 1 })).code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(captureError(() => addItem(list.id, { name: 'Хлеб', qty: 999999 })).code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });
});

describe('toggleItem', () => {
  it('переключает статус «сделано»', () => {
    const list = createList();
    const item = addItem(list.id, { name: 'Сыр', qty: 1 });

    expect(toggleItem(list.id, item.id).done).toBe(true);
    expect(toggleItem(list.id, item.id).done).toBe(false);
  });

  it('бросает ITEM_NOT_FOUND и LIST_NOT_FOUND', () => {
    const list = createList();
    expect(captureError(() => toggleItem(list.id, 'нет-такой')).code).toBe(ERROR_CODES.ITEM_NOT_FOUND);
    expect(captureError(() => toggleItem('нет-такого', 'x')).code).toBe(ERROR_CODES.LIST_NOT_FOUND);
  });
});

describe('активный список пользователя', () => {
  it('хранится отдельно для каждой пары chatId:userId', () => {
    const list = createList({ name: 'Общий' });

    setActiveList(1, 10, list.id);
    setActiveList(1, 20, list.id);

    expect(getActiveList(1, 10)).toBe(list);
    expect(getActiveList(1, 20)).toBe(list);
    expect(getActiveList(2, 10)).toBeNull();

    clearActiveList(1, 10);
    expect(getActiveList(1, 10)).toBeNull();
  });
});
