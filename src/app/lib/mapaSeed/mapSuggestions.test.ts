import { reconcileMapSuggestions } from './mapSuggestions';
import type { IMapaData } from '@/app/models/MapaSeed';
const map: IMapaData = { narrativa_central: 'Missão atual', tom: 'Direto', territorios: ['a', 'b', 'c', 'd', 'e', 'f'], temas: [], assets: [], narrativas_adjacentes: [], formatos: [], maturidade: 'seed', fonte: ['instagram'] };
const locks = { narrativeLocked: true, toneLocked: true };
const propose = (current = map, revision = 'r1', ids = ['post1']) => reconcileMapSuggestions(current, current, { narrativa_central: 'Nova missão', territorios: ['novo'] }, locks, { revision, evidence: ids.map(id => ({ id })), source: 'instagram' });
describe('propostas de revisão do mapa', () => {
  it('preserva o núcleo confirmado e guarda o sétimo território', () => {
    const result = propose();
    expect(result.narrativa_central).toBe(map.narrativa_central);
    expect(result.territorios).toHaveLength(6);
    expect(result.suggestions).toEqual(expect.arrayContaining([expect.objectContaining({ section: 'territorios', value: 'novo', state: 'pending' })]));
  });
  it('mesma extração repetida não aumenta confiança', () => {
    const first = propose();
    const second = propose(first);
    expect(second.suggestions?.find(item => item.section === 'narrativa_central')).toMatchObject({ state: 'observing', revisions: ['r1'] });
    expect(propose(first, 'r2').suggestions?.find(item => item.section === 'narrativa_central')?.state).toBe('observing');
  });
  it('nova leitura com post novo gera proposta sem remover confirmação', () => {
    const result = propose(propose(), 'r2', ['post1', 'post2']);
    expect(result.narrativa_central).toBe(map.narrativa_central);
    expect(result.suggestions?.find(item => item.section === 'narrativa_central')?.state).toBe('pending');
  });
  it('recusa e chip removido não reaparecem', () => {
    const first = propose();
    first.suggestions!.forEach(item => { item.state = 'dismissed'; });
    expect(propose(first, 'r3', ['post3']).suggestions?.every(item => item.state === 'dismissed')).toBe(true);
    const result = propose({ ...map, dismissedChips: [{ section: 'territorios', label: 'novo' }] });
    expect(result.suggestions?.some(item => item.section === 'territorios')).toBe(false);
  });
  it('inferência sem confirmação também espera duas leituras', () => {
    const empty = { ...map, narrativa_central: '' };
    const first = reconcileMapSuggestions(empty, { ...empty, narrativa_central: 'Nova missão' }, { narrativa_central: 'Nova missão' }, undefined, { source: 'instagram', revision: 'a', evidence: [{ id: 'a' }] });
    expect(first.narrativa_central).toBe('');
    const second = reconcileMapSuggestions(first, first, { narrativa_central: 'Nova missão' }, undefined, { source: 'instagram', revision: 'b', evidence: [{ id: 'b' }] });
    expect(second.narrativa_central).toBe('Nova missão');
  });
  it('uma frase existente fica preservada mesmo se a confirmação chegar durante a leitura', () => {
    const first = reconcileMapSuggestions(map, map, { narrativa_central: 'Nova missão' }, undefined, { source: 'instagram', revision: 'a', evidence: [{ id: 'a' }] });
    const next = reconcileMapSuggestions(first, first, { narrativa_central: 'Nova missão' }, undefined, { source: 'instagram', revision: 'b', evidence: [{ id: 'b' }] });
    expect(next.narrativa_central).toBe(map.narrativa_central);
    expect(next.suggestions?.[0]?.state).toBe('pending');
  });
});
