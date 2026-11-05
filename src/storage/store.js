/**
 * In-memory хранилище. Данные живут в процессе приложения:
 * при перезапуске состояние сбрасывается (для опционального сохранения см. persistence.js).
 */
export const state = {
  /** listId -> list */
  lists: new Map(),
  /** code -> listId */
  codeIndex: new Map(),
  /** `${chatId}:${userId}` -> listId */
  userList: new Map(),
};

export const chatUserKey = (chatId, userId) => `${chatId}:${userId}`;

export function resetState() {
  state.lists.clear();
  state.codeIndex.clear();
  state.userList.clear();
}
