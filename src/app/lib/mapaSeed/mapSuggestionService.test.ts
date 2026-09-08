/** @jest-environment node */
import { decideMapSuggestion } from './mapSuggestionService';
import { reconcileMapSuggestions } from './mapSuggestions';
import type { IMapaData } from '@/app/models/MapaSeed';

const mockFind = jest.fn();
const mockConfirmation = jest.fn();
const mockSave = jest.fn();
const mockSession = { withTransaction: async (work: () => Promise<void>) => work(), endSession: jest.fn() };
jest.mock('mongoose', () => ({ __esModule: true, default: { startSession: async () => mockSession } }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/MapaSeed', () => ({ __esModule: true, default: { findOne: (...args: unknown[]) => mockFind(...args) } }));
jest.mock('@/app/models/CreatorMapConfirmations', () => ({ __esModule: true, default: { updateOne: (...args: unknown[]) => mockConfirmation(...args) } }));

const base: IMapaData = { narrativa_central: 'Missão atual', tom: 'Calmo', territorios: [], temas: [], assets: [], narrativas_adjacentes: [], formatos: [], maturidade: 'seed', fonte: [] };
function document() {
  const mapa = reconcileMapSuggestions(base, base, { narrativa_central: 'Nova missão' }, { narrativeLocked: true, toneLocked: true }, { source: 'instagram', revision: 'r1', evidence: [{ id: 'p1' }] });
  return { mapa, save: mockSave, markModified: jest.fn(), toObject() { return { mapa: this.mapa }; } };
}
beforeEach(() => { jest.clearAllMocks(); });

it('aceita a frase exata e confirma dentro da mesma transação', async () => {
  const doc = document(); const suggestion = doc.mapa.suggestions![0]!;
  mockFind.mockReturnValue({ session: async () => doc });
  const result = await decideMapSuggestion('criador', { id: suggestion.id, action: 'accept', value: 'Minha versão', expectedUpdatedAt: suggestion.updatedAt });
  expect(result.narrativa_central).toBe('Minha versão');
  expect(mockFind).toHaveBeenCalledWith({ userId: 'criador' });
  expect(mockConfirmation.mock.calls[0][1].$set['narrative.confirmedValue']).toBe('Minha versão');
  expect(mockConfirmation.mock.calls[0][2].session).toBe(mockSession);
  expect(mockSave).toHaveBeenCalledWith({ session: mockSession });
});

it('recusa decisão sobre narrativa editada enquanto a proposta estava aberta', async () => {
  const doc = document(); const suggestion = doc.mapa.suggestions![0]!;
  doc.mapa.narrativa_central = 'Edição mais nova';
  mockFind.mockReturnValue({ session: async () => doc });
  await expect(decideMapSuggestion('criador', { id: suggestion.id, action: 'accept', expectedUpdatedAt: suggestion.updatedAt })).rejects.toMatchObject({ status: 409 });
  expect(mockSave).not.toHaveBeenCalled();
  expect(mockConfirmation).not.toHaveBeenCalled();
});

it('manter a atual registra recusa sem alterar o núcleo', async () => {
  const doc = document(); const suggestion = doc.mapa.suggestions![0]!;
  mockFind.mockReturnValue({ session: async () => doc });
  const result = await decideMapSuggestion('criador', { id: suggestion.id, action: 'dismiss', expectedUpdatedAt: suggestion.updatedAt });
  expect(result.narrativa_central).toBe('Missão atual');
  expect(result.suggestions![0]!.state).toBe('dismissed');
  expect(mockConfirmation).not.toHaveBeenCalled();
});
