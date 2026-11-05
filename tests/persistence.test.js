import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createList, getActiveList, getListByCode, setActiveList } from '../src/services/listService.js';
import { loadState, persistState } from '../src/storage/persistence.js';
import { resetState } from '../src/storage/store.js';

let workDir;
let dataFile;

beforeEach(async () => {
  resetState();
  workDir = await mkdtemp(join(tmpdir(), 'shopping-list-'));
  dataFile = join(workDir, 'data.json');
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('persistence', () => {
  it('ничего не делает, если файл не задан', async () => {
    expect(await persistState(null)).toBe(false);
    expect(await loadState(null)).toBe(false);
  });

  it('сохраняет и восстанавливает списки и активный список пользователя', async () => {
    const list = createList({ name: 'Дача', owner: { id: '1', name: 'Хозяин' } });
    setActiveList(10, 20, list.id);

    expect(await persistState(dataFile)).toBe(true);

    resetState();
    expect(await loadState(dataFile)).toBe(true);

    expect(getListByCode(list.code)).toMatchObject({ id: list.id, name: 'Дача' });
    expect(getActiveList(10, 20).id).toBe(list.id);
  });

  it('возвращает false, если файла ещё нет', async () => {
    expect(await loadState(join(workDir, 'missing.json'))).toBe(false);
  });

  it('пробрасывает ошибку при битом JSON', async () => {
    await writeFile(dataFile, '{ broken', 'utf8');
    await expect(loadState(dataFile)).rejects.toThrow();
  });
});
