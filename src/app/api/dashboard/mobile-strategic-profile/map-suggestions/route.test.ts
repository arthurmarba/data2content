/** @jest-environment node */
import { GET, POST } from './route';
import { getServerSession } from 'next-auth/next';
import { decideMapSuggestion, MapSuggestionError } from '@/app/lib/mapaSeed/mapSuggestionService';
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/resolveAuthOptions', () => ({ resolveAuthOptions: async () => ({}) }));
jest.mock('@/app/lib/mapaSeed/mapSuggestionService', () => ({
  decideMapSuggestion: jest.fn(), readMapSuggestions: jest.fn(),
  MapSuggestionError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
beforeEach(() => jest.clearAllMocks());
it('exige sessão para ler e decidir', async () => {
  (getServerSession as jest.Mock).mockResolvedValue(null);
  expect((await GET()).status).toBe(401);
  expect((await POST(new Request('http://localhost', { method: 'POST', body: '{}' }))).status).toBe(401);
  expect(decideMapSuggestion).not.toHaveBeenCalled();
});
it('usa a conta da sessão e devolve conflito sem expor erro interno', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'dona-do-mapa' } });
  (decideMapSuggestion as jest.Mock).mockRejectedValue(new MapSuggestionError('A sugestão mudou.', 409));
  const response = await POST(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ userId: 'outra-conta', id: 'sugestao' }) }));
  expect((decideMapSuggestion as jest.Mock).mock.calls[0][0]).toBe('dona-do-mapa');
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ message: 'A sugestão mudou.' });
});
