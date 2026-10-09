/** @jest-environment node */
import { askJev, resetJevForTests } from './jev';

const question = { publi: { type: 'noul' as const, instructions: 'É publi?' } };
const ok = (answers: unknown) => new Response(JSON.stringify({ model: 'jev-1.13.0', answers }), { status: 200 });
const fetchMock = jest.fn();

beforeEach(() => {
  resetJevForTests();
  fetchMock.mockReset();
  global.fetch = fetchMock as any;
  process.env.TYPESAFE_API_KEY = 'apik_teste';
});
afterAll(() => { delete process.env.TYPESAFE_API_KEY; });

test('sem chave, não chama e devolve null', async () => {
  delete process.env.TYPESAFE_API_KEY;
  expect(await askJev({ legenda: 'x' }, question)).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
});

test('manda versão fixa, estado e perguntas, e repete uma vez quando o serviço pede calma', async () => {
  fetchMock.mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '0' } }))
    .mockResolvedValueOnce(ok({ publi: { type: 'noul', noul: 0.9 } }));
  expect(await askJev({ legenda: 'x' }, question)).toEqual({ publi: { type: 'noul', noul: 0.9 } });
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body).toEqual({ model: 'jev-1.13.0', state: { legenda: 'x' }, questions: question });
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer apik_teste');
});

test('depois de três falhas seguidas, para de chamar', async () => {
  fetchMock.mockRejectedValue(new Error('timeout'));
  for (let i = 0; i < 3; i++) expect(await askJev({ legenda: 'x' }, question)).toBeNull();
  expect(await askJev({ legenda: 'x' }, question)).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(3);
});

test('limita os pedidos ao mesmo tempo', async () => {
  let open = 0; let peak = 0;
  fetchMock.mockImplementation(async () => {
    open++; peak = Math.max(peak, open);
    await new Promise(resolve => setTimeout(resolve, 5));
    open--;
    return ok({ publi: { type: 'noul', noul: 0.1 } });
  });
  await Promise.all(Array.from({ length: 60 }, () => askJev({ legenda: 'x' }, question)));
  expect(fetchMock).toHaveBeenCalledTimes(60);
  expect(peak).toBe(24);
});
