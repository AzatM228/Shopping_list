export const ERROR_CODES = Object.freeze({
  LIST_NOT_FOUND: 'LIST_NOT_FOUND',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
});

/** Ожидаемая (доменная) ошибка: её безопасно показывать пользователю. */
export class DomainError extends Error {
  constructor(code, message, details = []) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
