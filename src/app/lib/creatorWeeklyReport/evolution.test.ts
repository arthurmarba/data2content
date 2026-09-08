import { buildProfileEvolution, selectSubjectCover } from './evolution';
import { lastClosedWeek } from '@/app/lib/relatorio/weekWindow';
import type { CreatorWeeklyReportMetricInput } from './engine';
const now = new Date('2026-09-08T12:00:00Z');
const week = lastClosedWeek(now);
const post = (id: string, date: string, scene = true): CreatorWeeklyReportMetricInput => ({
  _id: id, instagramMediaId: id, postDate: date, createdAt: date, type: 'REEL', classificationStatus: 'completed',
  sceneElements: scene ? { version: 'v4', analyzedAt: '2026-08-25T21:00:00Z', subjects: [id], openingLine: id } : null,
});
const build = (metrics: CreatorWeeklyReportMetricInput[], extra = {}) => buildProfileEvolution({ metrics, week, now, ...extra });

describe('evolução do perfil', () => {
  it('sete posts sem cena continuam atrasados mesmo com histórico lido', () => {
    const old = Array.from({ length: 54 }, (_, i) => post(`antigo${i}`, '2026-08-20T12:00:00Z'));
    const recent = Array.from({ length: 7 }, (_, i) => post(`novo${i}`, '2026-09-03T12:00:00Z', false));
    const result = build([...old, ...recent]);
    expect(result.windows.week).toMatchObject({ imported: 7, analyzed: 0, pending: 7 });
    expect(result.status).toBe('delayed');
    expect(build([...old, ...recent], { providerPaused: true }).status).toBe('unavailable');
  });
  it('sincronização de números não altera a data da análise', () => {
    const metric = post('a', '2026-08-20T12:00:00Z');
    expect(build([{ ...metric, updatedAt: now }]).lastAnalyzedAt).toBe(build([metric]).lastAnalyzedAt);
    expect(build([{ ...metric, sceneElements: { version: 'v4' } }]).lastAnalyzedAt).toBeNull();
  });
  it('inclui leitura da semana corrente e preserva o corte semanal', () => {
    const result = build([post('novo', '2026-09-07T12:00:00Z')]);
    expect(result.windows.week.imported).toBe(0);
    expect(result.windows.recent.imported).toBe(1);
    expect(result.subjects[0]?.label).toBe('novo');
  });
  it('reserva espaço para novidade sem usar a capa para inferir ausência', () => {
    const metrics = Array.from({ length: 12 }, (_, i) => post(`antigo${i}`, '2026-08-20T12:00:00Z'));
    const result = build([...metrics, post('novo', '2026-09-07T12:00:00Z')]);
    expect(result.subjects).toHaveLength(6);
    expect(result.subjects.map(item => item.label)).toContain('novo');
    expect(result.allObservedSubjects).toHaveLength(13);
    expect(result.allObservedSubjects).toContain('antigo11');
  });
  it('não conta duplicatas como repetição nem junta assuntos por prefixo', () => {
    const a = post('a', '2026-09-07T12:00:00Z');
    a.sceneElements!.subjects = ['Fé', 'fé', 'Café'];
    const result = build([a, a]);
    expect(result.windows.recent.imported).toBe(1);
    expect(result.subjects).toHaveLength(2);
    expect(result.subjects.every(subject => subject.postIds.length === 1)).toBe(true);
  });
  it('foto tem título visual sem ser lacuna de fala', () => {
    const metric = { ...post('foto', '2026-09-07T12:00:00Z'), type: 'IMAGE', sceneElements: { version: 'v4', screenTitle: 'Título visual' } };
    const result = build([metric]);
    expect(result.windows.recent.openings).toMatchObject({ eligible: 0, pending: 0, notApplicable: 1 });
    expect(result.recentOpenings[0]?.source).toBe('visual');
  });
  it('diferencia leitura incompatível de processamento completo', () => {
    const result = build([post('x', '2026-09-01T12:00:00Z', false)], { states: [{ _id: 'x', state: 'unsupported' }] });
    expect(result.status).toBe('partial');
    expect(result.windows.recent).toMatchObject({ pending: 0, unsupported: 1, analyzed: 0 });
  });
  it('não apresenta assuntos antigos como recentes em conta inativa', () => {
    const result = build([post('antigo', '2026-07-01T12:00:00Z')]);
    expect(result.status).toBe('empty');
    expect(result.subjects).toEqual([]);
    expect(result.windows.history.analyzed).toBe(1);
  });
  it('seleção não depende da ordem de entrada dos assuntos', () => {
    const subjects = build([post('a', '2026-08-20T12:00:00Z'), post('b', '2026-09-07T12:00:00Z')]).subjects;
    expect(selectSubjectCover(subjects, 1)[0]?.label).toBe('b');
  });
  it('não chama retorno de assunto antigo de novidade nem duplica a mesma mídia', () => {
    const recent = post('novo', '2026-09-07T12:00:00Z');
    recent.sceneElements!.subjects = ['Rotina'];
    const old = post('antigo', '2026-07-20T12:00:00Z');
    old.sceneElements!.subjects = ['Rotina'];
    const result = build([old, recent, { ...recent, _id: 'outra_metrica' }]);
    expect(result.windows.history.imported).toBe(2);
    expect(result.subjects[0]?.recent).toBe(false);
    expect(result.subjects[0]?.postIds).toHaveLength(1);
  });
  it('só compara mecanismos entre períodos com cobertura suficiente', () => {
    const metrics = Array.from({ length: 12 }, (_, i) => post(String(i), i < 6 ? '2026-09-01T12:00:00Z' : '2026-08-01T12:00:00Z'));
    expect(build(metrics).openingComparison).toMatchObject({ available: true, recentPosts: 6, previousPosts: 6 });
    expect(build([...metrics, ...Array.from({ length: 8 }, (_, i) => post(`pendente${i}`, '2026-09-02T12:00:00Z', false))]).openingComparison?.available).toBe(false);
  });
});
