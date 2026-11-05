import { z } from 'zod';

export const MAX_NAME_LENGTH = 120;
export const MAX_QTY = 100_000;
export const MIN_CODE_LENGTH = 4;
export const MAX_CODE_LENGTH = 16;

/** Участник списка. `id` приводим к строке, чтобы бот (number) и API (string) работали одинаково. */
export const participantSchema = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)),
  name: z.string().trim().min(1, 'Имя не может быть пустым').max(MAX_NAME_LENGTH),
});

export const createListSchema = z.object({
  name: z.string().trim().min(1, 'Название не может быть пустым').max(MAX_NAME_LENGTH).optional(),
  owner: participantSchema.optional(),
});

export const listIdSchema = z.string().trim().min(1, 'Некорректный идентификатор списка').max(64);

export const listCodeSchema = z
  .string()
  .trim()
  .min(MIN_CODE_LENGTH, `Код короче ${MIN_CODE_LENGTH} символов`)
  .max(MAX_CODE_LENGTH)
  .transform((code) => code.toUpperCase());

export const itemNameSchema = z
  .string()
  .trim()
  .min(1, 'Название не может быть пустым')
  .max(MAX_NAME_LENGTH, 'Слишком длинное название');

export const itemQtySchema = z.coerce
  .number()
  .positive('Количество должно быть больше 0')
  .max(MAX_QTY, `Максимум ${MAX_QTY}`);

export const addItemSchema = z.object({
  name: itemNameSchema,
  qty: itemQtySchema,
});

/** Приводит ошибку Zod к простому JSON-виду для ответа API. */
export const formatZodError = (error) =>
  error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
