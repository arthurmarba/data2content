/** @jest-environment node */
import { editorialIssues, distinctStories, type EditorialIdea } from './quality';
import { compatibleMode, discoveryState, eligible } from './eligibility';
import { creativeEvidence } from './evidence';
import { quotaWindow } from './jobs';
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
const base: EditorialIdea = { title: 'Dois pratos com a mesma compra', territory: 'Cozinha', angle: 'Compare dois pratos feitos com a mesma compra e mostre o custo de cada prato.', hook: 'Dois pratos: qual aproveita melhor a compra?', scriptBlueprint: { version: 1, visualPremise: 'Dois pratos na bancada', openingMode: 'fala', estimatedDurationSeconds: 45, scenes: [
  { beat: 'abertura', visual: 'Mostre os dois pratos', spokenIntent: 'Compare o custo dos pratos' },
  { beat: 'contexto', visual: 'Mostre a compra na bancada', spokenIntent: 'Explique o custo de cada prato' },
  { beat: 'fechamento', visual: 'Aproxime os pratos', spokenIntent: 'Pergunte qual prato aproveita melhor a compra' },
], recordingChecklist: [] } as any };
const account = { role: 'user', planStatus: 'active', collabDiscoveryOptIn: true, collabDiscoveryOptInDate: new Date(), username: 'criadora' };
const cases: Array<[string, () => unknown, unknown]> = [
 ['mapa pronto', () => editorialIssues(base, ['Cozinha'], 'Economizar sem perder sabor'), []],
 ['narrativa ausente', () => editorialIssues(base, ['Cozinha'], '').includes('map_mismatch'), true],
 ['território ausente', () => editorialIssues(base, [], 'Economizar').includes('map_mismatch'), true],
 ['território divergente', () => editorialIssues(base, ['Finanças'], 'Economizar').includes('map_mismatch'), true],
 ['prefixo ambíguo', () => editorialIssues({ ...base, territory: 'Coz' }, ['Cozinha'], 'Economizar').includes('map_mismatch'), true],
 ['acentos equivalentes', () => editorialIssues({ ...base, territory: 'Alimentação' }, ['alimentacao'], 'Economizar').includes('map_mismatch'), false],
 ['direção genérica', () => editorialIssues({ ...base, angle: 'Fale sobre rotina' }, ['Cozinha'], 'Economizar').includes('generic_direction'), true],
 ['sem storyboard', () => editorialIssues({ ...base, scriptBlueprint: null }, ['Cozinha'], 'Economizar').includes('unfilmable'), true],
 ['sem fechamento', () => editorialIssues({ ...base, scriptBlueprint: { ...base.scriptBlueprint!, scenes: base.scriptBlueprint!.scenes.slice(0, 2) } }, ['Cozinha'], 'Economizar').includes('missing_delivery'), true],
 ['gancho sem entrega', () => editorialIssues({ ...base, hook: 'Investimentos multiplicam dividendos extraordinários' }, ['Cozinha'], 'Economizar').includes('unsupported_hook'), true],
 ['promessa de viral', () => editorialIssues({ ...base, angle: 'Este prato vai viralizar' }, ['Cozinha'], 'Economizar').includes('unsupported_promise'), true],
 ['garantia indevida', () => editorialIssues({ ...base, hook: 'Sucesso garantido na compra' }, ['Cozinha'], 'Economizar').includes('unsupported_promise'), true],
 ['ideia repetida com título novo', () => distinctStories([{ ...base, title: 'Compra que rende' }], [base]).length, 0],
 ['duplicata na rodada', () => distinctStories([base, { ...base, title: 'Outro título' }], []).length, 1],
 ['exploração distinta', () => distinctStories([{ ...base, angle: 'Congele ervas frescas em formas pequenas', hook: 'Ervas frescas: como congelar?' }], [base]).length, 1],
 ['conta válida sem avatar', () => eligible(account), true],
 ['pausa prevalece', () => eligible({ ...account, collabDiscoveryStatus: 'paused' }), false],
 ['flag falsa não vira consentimento', () => discoveryState({ ...account, collabDiscoveryOptIn: false }), 'unknown'],
 ['opt-in sem data', () => eligible({ ...account, collabDiscoveryOptInDate: undefined }), false],
 ['assinatura expirada', () => eligible({ ...account, planStatus: 'non_renewing', currentPeriodEnd: '2020-01-01' }), false],
 ['cancelamento ainda válido', () => eligible({ ...account, cancelAtPeriodEnd: true, currentPeriodEnd: '2099-01-01' }), true],
 ['sem contato', () => eligible({ ...account, username: '' }), false],
 ['contato inválido', () => eligible({ ...account, username: 'https://example.com' }), false],
 ['remoto padrão', () => compatibleMode(account, account), 'remoto'],
 ['presencial precisa compatibilidade', () => compatibleMode({ ...account, collabDiscoveryMode: 'presencial' }, account), null],
 ['ambos prioriza remoto', () => compatibleMode({ ...account, collabDiscoveryMode: 'ambos' }, account), 'remoto'],
 ['mesma cidade não autoriza presencial', () => compatibleMode({ ...account, location: { city: 'Rio', state: 'RJ' } }, { ...account, location: { city: 'Rio', state: 'RJ' } }), 'remoto'],
 ['métricas sem cenas', () => creativeEvidence(Array.from({ length: 12 }, (_, i) => ({ _id: String(i), postDate: new Date().toISOString(), stats: { reach: 10000 } } as any))).confidence, 'low'],
 ['uma leitura não vira padrão', () => creativeEvidence([{ _id: '1', postDate: new Date().toISOString(), sceneElements: { version: 'v1' } } as any]).confidence, 'low'],
 ['dezembro renova em janeiro seguinte', () => quotaWindow(new Date('2026-12-15')).end.toISOString(), '2027-01-01T00:00:00.000Z'],
];
describe('referência de 30 cenários: integridade editorial e condições de recomendação', () => { test.each(cases)('%s', (_name, run, expected) => expect(run()).toEqual(expected)); });
