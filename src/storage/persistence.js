import { readFile, writeFile } from 'node:fs/promises';
import { config } from '../config.js';
import { state } from './store.js';

/**
 * Опциональное сохранение состояния в файл (fs/promises).
 * Работает только если задан DATA_FILE — иначе функции ничего не делают.
 */

export async function persistState(file = config.dataFile) {
  if (!file) {
    return false;
  }

  const payload = JSON.stringify(
    {
      lists: [...state.lists.values()],
      userList: Object.fromEntries(state.userList),
    },
    null,
    2,
  );

  await writeFile(file, payload, 'utf8');
  return true;
}

export async function loadState(file = config.dataFile) {
  if (!file) {
    return false;
  }

  let raw;
  try {
    raw = await readFile(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  const parsed = JSON.parse(raw);

  state.lists.clear();
  state.codeIndex.clear();
  state.userList.clear();

  for (const list of parsed.lists ?? []) {
    state.lists.set(list.id, list);
    state.codeIndex.set(list.code, list.id);
  }

  for (const [key, listId] of Object.entries(parsed.userList ?? {})) {
    state.userList.set(key, listId);
  }

  return true;
}
