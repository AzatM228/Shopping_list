import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, errorHandler } from '../src/api/server.js';
import { addItem, createList } from '../src/services/listService.js';
import { resetState } from '../src/storage/store.js';

const app = createApp();

const createMockResponse = () => {
  const res = { statusCode: 200, body: null };
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload) => {
    res.body = payload;
    return res;
  };
  return res;
};

beforeEach(() => {
  resetState();
});

describe('POST /api/lists', () => {
  it('создаёт список и возвращает 201 с id и кодом', async () => {
    const response = await request(app).post('/api/lists').send({ name: 'Пятница' });

    expect(response.status).toBe(201);
    expect(response.body.id).toBeTypeOf('string');
    expect(response.body.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(response.body.name).toBe('Пятница');
  });

  it('работает без тела запроса и без Content-Type', async () => {
    const response = await request(app).post('/api/lists');

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('Список покупок');
  });

  it('делает владельца участником списка', async () => {
    const response = await request(app)
      .post('/api/lists')
      .send({ name: 'Дача', owner: { id: 7, name: 'Хозяин' } });

    const state = await request(app).get(`/api/lists/${response.body.id}`);

    expect(state.body.participants).toEqual([{ id: '7', name: 'Хозяин' }]);
  });

  it('возвращает 400 с деталями при невалидном теле', async () => {
    const response = await request(app).post('/api/lists').send({ name: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
    expect(response.body.details[0].path).toBe('name');
  });

  it('возвращает 400 при невалидном владельце', async () => {
    const response = await request(app).post('/api/lists').send({ owner: { id: 1, name: '' } });
    expect(response.status).toBe(400);
  });

  it('не падает на битом JSON', async () => {
    const response = await request(app)
      .post('/api/lists')
      .set('Content-Type', 'application/json')
      .send('{ "name": ');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('BadRequest');
  });
});

describe('GET /api/lists/:id', () => {
  it('возвращает участников и покупки { name, qty, done }', async () => {
    const list = createList({ name: 'Пятница', owner: { id: '42', name: 'Тест' } });
    addItem(list.id, { name: 'Молоко', qty: 2 });
    addItem(list.id, { name: 'Хлеб', qty: 1 });

    const response = await request(app).get(`/api/lists/${list.id}`);

    expect(response.status).toBe(200);
    expect(response.body.participants).toHaveLength(1);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toMatchObject({ name: 'Молоко', qty: 2, done: false });
    expect(response.body.code).toBe(list.code);
  });

  it('возвращает 404 для неизвестного списка', async () => {
    const response = await request(app).get('/api/lists/00000000-0000-0000-0000-000000000000');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('NotFound');
  });

  it('возвращает 400 для некорректного id', async () => {
    const response = await request(app).get('/api/lists/%20');
    expect(response.status).toBe(400);
  });
});

describe('служебные маршруты и обработчик ошибок', () => {
  it('GET /health отвечает 200', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('неизвестный маршрут возвращает 404', async () => {
    const response = await request(app).get('/api/lists');
    expect(response.status).toBe(404);
  });

  it('errorHandler отдаёт 400 для клиентских ошибок', () => {
    const res = createMockResponse();
    errorHandler(Object.assign(new Error('Некорректный JSON'), { status: 400 }), {}, res, () => {});

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'BadRequest', message: 'Некорректный JSON' });
  });

  it('errorHandler скрывает детали серверных ошибок и логирует их', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = createMockResponse();

    errorHandler(new Error('boom'), {}, res, () => {});

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'InternalServerError', message: 'Внутренняя ошибка сервера' });
    expect(console.error).toHaveBeenCalled();
  });
});
