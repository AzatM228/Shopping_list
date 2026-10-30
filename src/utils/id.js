import { customAlphabet } from 'nanoid';

// Алфавит без визуально похожих символов (0/O, 1/I/L) — код удобно диктовать.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ITEM_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Публичный код приглашения в список (6 символов, ~1e9 комбинаций). */
export const generateListCode = customAlphabet(CODE_ALPHABET, 6);

/** Внутренний идентификатор покупки — короткий, чтобы влезать в callback_data. */
export const generateItemId = customAlphabet(ITEM_ALPHABET, 10);
