import { Router } from 'express';
import { createList, getListState } from '../../services/listService.js';
import { createListSchema, formatZodError, listIdSchema } from '../../validators/schemas.js';

export const listsRouter = Router();

const validationError = (res, error) =>
  res.status(400).json({ error: 'ValidationError', details: formatZodError(error) });

/** POST /api/lists — создать список. */
listsRouter.post('/', (req, res) => {
  const parsed = createListSchema.safeParse(req.body ?? {});

  if (!parsed.success) {
    return validationError(res, parsed.error);
  }

  const list = createList(parsed.data);
  return res.status(201).json({ id: list.id, code: list.code, name: list.name });
});

/** GET /api/lists/:id — состояние списка: участники и покупки. */
listsRouter.get('/:id', (req, res) => {
  const parsedId = listIdSchema.safeParse(req.params.id);

  if (!parsedId.success) {
    return validationError(res, parsedId.error);
  }

  const list = getListState(parsedId.data);

  if (!list) {
    return res.status(404).json({ error: 'NotFound', message: 'Список не найден' });
  }

  return res.json(list);
});
