import { randomUUID } from 'node:crypto';
import { persistState } from '../storage/persistence.js';
import { chatUserKey, state } from '../storage/store.js';
import { generateItemId, generateListCode } from '../utils/id.js';
import { addItemSchema, formatZodError, listCodeSchema, participantSchema } from '../validators/schemas.js';
import { DomainError, ERROR_CODES } from './errors.js';

export const DEFAULT_LIST_NAME = 'Список покупок';

/** Сохранение в файл — необязательный побочный эффект, ошибки не должны ломать бизнес-операцию. */
const persist = () => {
  persistState().catch((error) => {
    console.error('[persistence] не удалось сохранить состояние:', error.message);
  });
};

const buildUniqueCode = () => {
  let code = generateListCode();
  while (state.codeIndex.has(code)) {
    code = generateListCode();
  }
  return code;
};

const addParticipant = (list, participant) => {
  if (list.participants.some((member) => member.id === participant.id)) {
    return false;
  }
  list.participants.push({ id: participant.id, name: participant.name });
  return true;
};

/**
 * Создаёт список. Создатель (если передан) сразу становится участником.
 * @param {{ name?: string, owner?: { id: string|number, name: string } }} input
 */
export function createList({ name, owner } = {}) {
  const list = {
    id: randomUUID(),
    code: buildUniqueCode(),
    name: name ?? DEFAULT_LIST_NAME,
    createdAt: new Date().toISOString(),
    participants: [],
    items: [],
  };

  state.lists.set(list.id, list);
  state.codeIndex.set(list.code, list.id);

  if (owner) {
    const parsedOwner = participantSchema.safeParse(owner);
    if (parsedOwner.success) {
      addParticipant(list, parsedOwner.data);
    }
  }

  persist();
  return list;
}

/** @returns {object|null} живой объект списка из хранилища */
export function getList(listId) {
  if (!listId) {
    return null;
  }
  return state.lists.get(listId) ?? null;
}

export function getListByCode(code) {
  const parsedCode = listCodeSchema.safeParse(code);
  if (!parsedCode.success) {
    return null;
  }
  const listId = state.codeIndex.get(parsedCode.data);
  return listId ? state.lists.get(listId) ?? null : null;
}

/**
 * Подключает пользователя к списку по коду.
 * @throws {DomainError} LIST_NOT_FOUND | VALIDATION_ERROR
 */
export function joinList({ code, user }) {
  const list = getListByCode(code);
  if (!list) {
    throw new DomainError(ERROR_CODES.LIST_NOT_FOUND, 'Список с таким кодом не найден');
  }

  const parsedUser = participantSchema.safeParse(user);
  if (!parsedUser.success) {
    throw new DomainError(ERROR_CODES.VALIDATION_ERROR, 'Некорректные данные участника', formatZodError(parsedUser.error));
  }

  const added = addParticipant(list, parsedUser.data);
  if (added) {
    persist();
  }

  return { list, alreadyMember: !added };
}

/**
 * Добавляет покупку в список.
 * @throws {DomainError} LIST_NOT_FOUND | VALIDATION_ERROR
 */
export function addItem(listId, input) {
  const list = getList(listId);
  if (!list) {
    throw new DomainError(ERROR_CODES.LIST_NOT_FOUND, 'Список не найден');
  }

  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(ERROR_CODES.VALIDATION_ERROR, 'Некорректные данные покупки', formatZodError(parsed.error));
  }

  const item = {
    id: generateItemId(),
    name: parsed.data.name,
    qty: parsed.data.qty,
    done: false,
    createdAt: new Date().toISOString(),
  };

  list.items.push(item);
  persist();
  return item;
}

/**
 * Переключает статус «сделано» у покупки.
 * @throws {DomainError} LIST_NOT_FOUND | ITEM_NOT_FOUND
 */
export function toggleItem(listId, itemId) {
  const list = getList(listId);
  if (!list) {
    throw new DomainError(ERROR_CODES.LIST_NOT_FOUND, 'Список не найден');
  }

  const item = list.items.find((entry) => entry.id === itemId);
  if (!item) {
    throw new DomainError(ERROR_CODES.ITEM_NOT_FOUND, 'Покупка не найдена');
  }

  item.done = !item.done;
  persist();
  return item;
}

/** Снимок состояния списка для API (без внутренних ссылок на хранилище). */
export function getListState(listId) {
  const list = getList(listId);
  if (!list) {
    return null;
  }

  return {
    id: list.id,
    code: list.code,
    name: list.name,
    createdAt: list.createdAt,
    participants: list.participants.map((member) => ({ ...member })),
    items: list.items.map((item) => ({ ...item })),
  };
}

/** Запоминает «активный» список для конкретного чата и пользователя. */
export function setActiveList(chatId, userId, listId) {
  state.userList.set(chatUserKey(chatId, userId), listId);
  return getActiveList(chatId, userId);
}

export function getActiveList(chatId, userId) {
  const listId = state.userList.get(chatUserKey(chatId, userId));
  return listId ? state.lists.get(listId) ?? null : null;
}

export function clearActiveList(chatId, userId) {
  state.userList.delete(chatUserKey(chatId, userId));
}
