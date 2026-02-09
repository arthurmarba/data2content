// @jest-environment node
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
const mockGetHistory = jest.fn();
const mockSetHistory = jest.fn();
const mockGetDialogue = jest.fn();
const mockUpdateDialogue = jest.fn();
const mockCallQuestion = jest.fn();
const mockGenSummary = jest.fn();
const mockAskLLM = jest.fn();
const mockCreateThread = jest.fn();
const mockPersistMessage = jest.fn();
const mockGenerateThreadTitle = jest.fn();
const mockRunPubliCalculator = jest.fn();
const mockRecommendWeeklySlots = jest.fn();
const mockGetThemesForSlot = jest.fn();
const mockGetBlockSampleCaptions = jest.fn();
const mockFetchTopCategories = jest.fn();
const mockGetTopPostsByMetric = jest.fn();
import { determineIntent } from '@/app/lib/intentService';
import { callOpenAIForQuestion, generateConversationSummary } from '@/app/lib/aiService';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock('@/app/lib/intentService', () => ({
  determineIntent: jest.fn(),
  normalizeText: (text: string) => text,
}));
jest.mock('@/app/lib/aiService', () => ({
  __esModule: true,
  callOpenAIForQuestion: (...args: any[]) => mockCallQuestion(...args),
  generateConversationSummary: (...args: any[]) => mockGenSummary(...args),
}));
jest.mock('@/app/lib/pricing/publiCalculator', () => ({
  __esModule: true,
  PRICING_MULTIPLIERS: {
    formato: { post: 1, reels: 1, stories: 1, pacote: 1 },
    exclusividade: { nenhuma: 1, '7d': 1, '15d': 1, '30d': 1 },
    usoImagem: { organico: 1, midiapaga: 1, global: 1 },
    complexidade: { simples: 1, roteiro: 1, profissional: 1 },
    autoridade: { padrao: 1, ascensao: 1, autoridade: 1, celebridade: 1 },
    sazonalidade: { normal: 1, alta: 1, baixa: 1 },
  },
  runPubliCalculator: (...args: any[]) => mockRunPubliCalculator(...args),
}));
jest.mock('@/utils/rateLimit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock('@/app/lib/dataService', () => ({
  fetchTopCategories: (...args: any[]) => mockFetchTopCategories(...args),
  getTopPostsByMetric: (...args: any[]) => mockGetTopPostsByMetric(...args),
}));
jest.mock('@/app/lib/chatTelemetry', () => ({
  ensureChatSession: jest.fn().mockResolvedValue({ _id: 'session1' }),
  logChatMessage: jest.fn().mockResolvedValue(null),
}));
jest.mock('@/app/lib/planner/recommender', () => ({
  recommendWeeklySlots: (...args: any[]) => mockRecommendWeeklySlots(...args),
}));
jest.mock('@/app/lib/planner/themes', () => ({
  getThemesForSlot: (...args: any[]) => mockGetThemesForSlot(...args),
}));
jest.mock('@/utils/getBlockSampleCaptions', () => ({
  getBlockSampleCaptions: (...args: any[]) => mockGetBlockSampleCaptions(...args),
}));

let chat: typeof import('./route').POST;
let sanitizeTables: typeof import('./route').sanitizeTables;
let scriptInternals: typeof import('./route').__scriptInternals;

const mockSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (UserModel as any).findById as jest.Mock;
const mockIntent = determineIntent as jest.Mock;
const testUserId = '507f1f77bcf86cd799439011';

const streamFromText = (text: string) => ({
  getReader: () => {
    let yielded = false;
    return {
      read: async () => {
        if (yielded) return { value: undefined, done: true };
        yielded = true;
        return { value: text, done: false };
      },
    };
  },
});

function makeRequest(body: any) {
  return new NextRequest('http://localhost/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: new Headers({ 'content-type': 'application/json' }),
  } as any);
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ANSWER_ENGINE_ENABLED = 'false';
  jest.isolateModules(() => {
    const stateServiceMock = require('../../../../../__mocks__/stateService.js');
    stateServiceMock.getConversationHistory = mockGetHistory;
    stateServiceMock.setConversationHistory = mockSetHistory;
    stateServiceMock.getDialogueState = mockGetDialogue;
    stateServiceMock.updateDialogueState = mockUpdateDialogue;
    stateServiceMock.createThread = mockCreateThread;
    stateServiceMock.persistMessage = mockPersistMessage;
    stateServiceMock.generateThreadTitle = mockGenerateThreadTitle;
    const aiOrchestratorMock = require('../../../../../__mocks__/aiOrchestrator.js');
    aiOrchestratorMock.askLLMWithEnrichedContext = (...args: any[]) => mockAskLLM(...args);
    aiOrchestratorMock.buildSurveyProfileSnippet = jest.fn(() => 'profile-snippet');
    const routeModule = require('./route');
    chat = routeModule.POST;
    sanitizeTables = routeModule.sanitizeTables;
    scriptInternals = routeModule.__scriptInternals;
  });
  mockSession.mockResolvedValue({ user: { id: testUserId, planStatus: 'active' } });
  mockConnect.mockResolvedValue(null);
  mockFindById.mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      _id: testUserId,
      name: 'Teste User',
      isInstagramConnected: true,
      planStatus: 'active',
    }),
  });
  mockGetHistory.mockResolvedValue([]);
  mockSetHistory.mockResolvedValue(null);
  mockGetDialogue.mockResolvedValue({ summaryTurnCounter: 0 });
  mockUpdateDialogue.mockResolvedValue(null);
  mockCreateThread.mockResolvedValue({ _id: 't1' });
  mockPersistMessage.mockResolvedValue('msg1');
  mockGenerateThreadTitle.mockResolvedValue(undefined);
  mockCallQuestion.mockResolvedValue('Genérico');
  mockGenSummary.mockResolvedValue('Resumo');
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'general' });
  mockAskLLM.mockResolvedValue({ stream: streamFromText('Resposta padrão') });
  mockFetchTopCategories.mockResolvedValue([]);
  mockGetTopPostsByMetric.mockResolvedValue([]);
  mockRecommendWeeklySlots.mockResolvedValue([]);
  mockGetThemesForSlot.mockResolvedValue({ keyword: 'tema', themes: [] });
  mockGetBlockSampleCaptions.mockResolvedValue([]);
  mockRunPubliCalculator.mockResolvedValue({
    metrics: { reach: 1000, engagement: 0.05, profileSegment: 'default' },
    params: {
      format: 'reels',
      exclusivity: 'nenhuma',
      usageRights: 'organico',
      complexity: 'simples',
      authority: 'padrao',
      seasonality: 'normal',
    },
    result: { estrategico: 100, justo: 200, premium: 300 },
    cpmApplied: 10,
    cpmSource: 'seed',
    avgTicket: null,
    totalDeals: 0,
    explanation: 'mock',
  });
});

it('retorna CTA de conectar IG quando não conectado', async () => {
  mockFindById.mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      _id: testUserId,
      name: 'Teste User',
      isInstagramConnected: false,
      planStatus: 'active',
    }),
  });

  const res = await chat(makeRequest({ query: 'Olá' }));
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(json.cta?.action).toBe('connect_instagram');
  expect(json.answer).toContain('Conecte seu Instagram');
});

it('bloqueia plano inativo com CTA de upgrade', async () => {
  mockSession.mockResolvedValue({ user: { id: testUserId, planStatus: 'inactive' } });
  mockFindById.mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      _id: testUserId,
      name: 'Teste User',
      isInstagramConnected: true,
      planStatus: 'inactive',
    }),
  });

  const res = await chat(makeRequest({ query: 'Olá' }));
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(json.cta?.action).toBe('go_to_billing');
  expect(json.answer).toMatch(/plano/i);
});

it('retorna pendingAction e currentTask para intenção complexa', async () => {
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'content_plan' });
  mockAskLLM.mockResolvedValue({ stream: streamFromText('Posso buscar esses dados?') });

  const res = await chat(makeRequest({ query: 'Preciso de plano de conteúdo' }));
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(json.pendingAction).toBeTruthy();
  expect(json.currentTask?.name).toBe('content_plan');
});

it('retorna mensagem amigável quando LLM falha', async () => {
  mockAskLLM.mockRejectedValue(new Error('fail'));

  const res = await chat(makeRequest({ query: 'Teste error' }));
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(String(json.answer)).toMatch(/problema técnico|tentar novamente/i);
});

it('mantém tabelas, mesmo que esparsas', () => {
  const input = [
    '| Item | Col1 | Col2 |',
    '| --- | --- | --- |',
    '| A | valor |  |',
    '| B |  |  |',
  ].join('\n');

  const sanitized = sanitizeTables(input);
  expect(sanitized).toEqual(input);
  expect(sanitized).not.toContain('- **A**');
});

it('extractScriptBrief reduz confiança em pedido genérico', () => {
  const brief = scriptInternals.extractScriptBrief('Crie um roteiro de conteúdo para que eu possa postar', null as any);
  expect(brief.topic).toBe('');
  expect(brief.confidence).toBeLessThan(0.62);
  expect(brief.ambiguityReasons).toContain('generic_creation_prompt');
});

it('extractScriptBrief aumenta confiança quando tema está explícito', () => {
  const brief = scriptInternals.extractScriptBrief('Crie um roteiro sobre orçamento doméstico para mulheres autônomas', null as any);
  expect(brief.topic).toMatch(/orçamento doméstico/i);
  expect(brief.confidence).toBeGreaterThanOrEqual(0.62);
});

it('evaluateScriptQualityV2 detecta eco semântico e baixa acionabilidade', () => {
  const score = scriptInternals.evaluateScriptQualityV2(
    [
      { time: '00-03s', visual: 'crie um roteiro de conteúdo para eu postar amanhã', audio: 'crie um roteiro de conteúdo para eu postar amanhã' },
      { time: '03-20s', visual: 'crie um roteiro de conteúdo para eu postar amanhã', audio: 'crie um roteiro de conteúdo para eu postar amanhã' },
      { time: '20-30s', visual: 'final', audio: 'ok' },
    ],
    'crie um roteiro de conteúdo para eu postar amanhã',
    false
  );
  expect(score.semanticEchoRatio).toBeGreaterThan(0.5);
  expect(score.actionabilityScore).toBeLessThan(0.7);
  expect(scriptInternals.shouldRewriteByQualityV2(score)).toBe(true);
});

it('aplica contrato completo no modo roteirista com inspiração contextual', async () => {
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'script_request' });
  mockAskLLM.mockResolvedValue({
    stream: streamFromText([
      '[ROTEIRO]',
      '**Título Sugerido:** Roteiro para vendas',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Cena 1 | Fala 1 |',
      '| 03-15s | Cena 2 | Fala 2 |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: Legenda base',
      '[/LEGENDA]',
    ].join('\n')),
    historyPromise: Promise.resolve([
      {
        role: 'function',
        name: 'fetchCommunityInspirations',
        content: JSON.stringify({
          matchType: 'exact',
          usedFilters: {
            proposal: 'tutorial',
            context: 'educational',
            narrativeQuery: 'gancho sobre erro comum e correção',
          },
          inspirations: [
            {
              id: 'insp1',
              originalInstagramPostUrl: 'https://www.instagram.com/reel/ABC123xyz/',
              proposal: 'tutorial',
              context: 'educational',
              format: 'reel',
              tone: 'educational',
              contentSummary: 'Mostra erro comum, depois ajuste prático com CTA.',
              matchReasons: ['match exato de proposta/contexto', 'narrativa similar (erro, ajuste)'],
              narrativeScore: 0.64,
            },
          ],
        }),
      } as any,
    ]),
  });

  const res = await chat(makeRequest({ query: 'crie um roteiro para vender mentoria no reels' }));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.pendingAction).toBeNull();
  expect(json.answer).toContain('[ROTEIRO]');
  expect(json.answer).toContain('[LEGENDA]');
  expect(json.answer).toContain('**Por que essa inspiração:**');
  expect(json.answer).toContain('[INSPIRATION_JSON]');
  expect(json.answer).toContain('V2:');
  expect(json.answer).toContain('V3:');
  expect(json.answerEvidence?.intent_group).toBe('planning');
});

it('salva preferência narrativa quando usuário dá feedback explícito', async () => {
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'script_request' });
  mockAskLLM.mockResolvedValue({
    stream: streamFromText([
      '[ROTEIRO]',
      '**Título Sugerido:** Ajuste de narrativa',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Cena 1 | Fala 1 |',
      '| 03-20s | Cena 2 | Fala 2 |',
      '| 20-30s | Cena 3 | CTA |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: Legenda',
      '[/LEGENDA]',
    ].join('\n')),
    historyPromise: Promise.resolve([]),
  });

  const res = await chat(makeRequest({ query: 'curti essa narrativa, mantenha esse estilo nos próximos roteiros' }));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.answer).toContain('[ROTEIRO]');
  expect(mockUpdateDialogue).toHaveBeenCalled();
  const lastCall = mockUpdateDialogue.mock.calls[mockUpdateDialogue.mock.calls.length - 1];
  const dialoguePatch = lastCall?.[1];
  expect(dialoguePatch?.scriptPreferences?.narrativePreference).toBe('prefer_similar');
});

it('solicita 1 detalhe quando o pedido de roteiro é genérico', async () => {
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'script_request' });
  mockGetTopPostsByMetric.mockResolvedValue([
    {
      _id: 'post1',
      description: '3 erros de orçamento doméstico que te fazem perder dinheiro',
      postLink: 'https://www.instagram.com/reel/AAA111/',
      format: 'reel',
      proposal: ['tutorial'],
      context: ['finance'],
      stats: { shares: 120, saved: 90, comments: 33, likes: 420, reach: 5800, video_views: 6300, total_interactions: 663 },
      postDate: new Date('2025-12-10T00:00:00.000Z'),
    },
  ]);
  mockAskLLM.mockResolvedValue({
    stream: streamFromText([
      '[ROTEIRO]',
      '**Título Sugerido:** Crie um roteiro de conteúdo para que eu possa postar',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Cena 1 | Fala 1 |',
      '| 03-20s | Cena 2 | Fala 2 |',
      '| 20-30s | Cena 3 | CTA |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: Legenda',
      '[/LEGENDA]',
    ].join('\n')),
    historyPromise: Promise.resolve([]),
  });

  const res = await chat(makeRequest({ query: 'Crie um roteiro de conteúdo para que eu possa postar' }));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.answer).toContain('Qual tema específico você quer abordar neste roteiro?');
  expect(json.answer).toContain('[BUTTON: Informar tema específico]');
  expect(json.answer).toContain('[BUTTON: Pode usar meu nicho atual]');
  expect(json.answer).not.toContain('[ROTEIRO]');
});

it('usa pauta do calendário/histórico quando o pedido traz tema claro', async () => {
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'script_request' });
  mockRecommendWeeklySlots.mockResolvedValue([
    {
      dayOfWeek: 2,
      blockStartHour: 18,
      format: 'reel',
      categories: {
        context: ['finance'],
        proposal: ['tutorial'],
        reference: ['daily_life'],
        tone: 'educational',
      },
    },
  ]);
  mockGetThemesForSlot.mockResolvedValue({
    keyword: 'orçamento',
    themes: [
      '3 erros de orçamento doméstico que te fazem perder dinheiro',
      'como organizar orçamento sem planilha complicada',
      'o ajuste simples para sobrar dinheiro no fim do mês',
    ],
  });
  mockGetBlockSampleCaptions.mockResolvedValue([
    'Erro comum: gastar sem categorias e perder controle do orçamento.',
    'Passo a passo simples para fechar o mês no azul.',
    'Ajuste prático que aumenta sua sobra semanal.',
  ]);
  mockAskLLM.mockResolvedValue({
    stream: streamFromText([
      '[ROTEIRO]',
      '**Título Sugerido:** Roteiro para orçamento doméstico',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Close no rosto e texto: erro de orçamento doméstico | Se você quer melhorar seu orçamento doméstico, comece por este ajuste |',
      '| 03-20s | Mostre o erro comum no orçamento doméstico | Esse erro derruba retenção |',
      '| 20-30s | Final com CTA | Salve e compartilhe |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: Legenda base',
      '[/LEGENDA]',
    ].join('\n')),
    historyPromise: Promise.resolve([]),
  });

  const res = await chat(makeRequest({ query: 'crie um roteiro sobre orçamento doméstico para eu postar amanhã' }));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.answer).toContain('[ROTEIRO]');
  expect(json.answer).not.toMatch(/preciso de contexto/i);
  expect(json.answer).toMatch(/orçamento doméstico|orcamento domestico/i);
});

it('repara roteiro quando a IA ecoa a pergunta do usuário nas falas', async () => {
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'script_request' });
  mockRecommendWeeklySlots.mockResolvedValue([
    {
      dayOfWeek: 2,
      blockStartHour: 18,
      format: 'reel',
      categories: {
        context: ['finance'],
        proposal: ['tutorial'],
        reference: ['daily_life'],
        tone: 'educational',
      },
    },
  ]);
  mockGetThemesForSlot.mockResolvedValue({
    keyword: 'orçamento',
    themes: ['3 erros de orçamento doméstico que te fazem perder dinheiro'],
  });
  mockGetBlockSampleCaptions.mockResolvedValue([
    'Erro comum em orçamento doméstico.',
  ]);
  mockAskLLM.mockResolvedValue({
    stream: streamFromText([
      '[ROTEIRO]',
      '**Título Sugerido:** Roteiro sobre orçamento doméstico',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Close em orçamento doméstico para eu postar amanhã | Se você quer melhorar em orçamento doméstico para eu postar amanhã |',
      '| 03-20s | Mostre em orçamento doméstico para eu postar amanhã | Mostre em orçamento doméstico para eu postar amanhã agora |',
      '| 20-30s | Final em orçamento doméstico para eu postar amanhã | Se isso ajudou em orçamento doméstico para eu postar amanhã |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: orçamento doméstico para eu postar amanhã',
      '[/LEGENDA]',
    ].join('\n')),
    historyPromise: Promise.resolve([]),
  });

  const res = await chat(makeRequest({ query: 'crie um roteiro sobre orçamento doméstico para eu postar amanhã' }));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.answer).toContain('[ROTEIRO]');
  expect(json.answer).not.toMatch(/orçamento doméstico para eu postar amanhã/i);
  expect(json.answer).toMatch(/passo 1|erro comum|benef[ií]cio/i);
});

it('usa top posts do criador como fallback de inspiração quando comunidade não está disponível', async () => {
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'script_request' });
  mockGetTopPostsByMetric.mockResolvedValue([
    {
      _id: 'post1',
      description: 'Erro comum no orçamento doméstico e ajuste em 2 passos',
      postLink: 'https://www.instagram.com/reel/FALLBK1/',
      format: 'reel',
      proposal: ['tutorial'],
      context: ['finance'],
      stats: { shares: 210, saved: 150, comments: 42, likes: 700, reach: 9100, video_views: 9800, total_interactions: 1102 },
      postDate: new Date('2025-12-11T00:00:00.000Z'),
    },
    {
      _id: 'post2',
      description: 'Como fechar o mês no azul sem planilha complexa',
      postLink: 'https://www.instagram.com/reel/FALLBK2/',
      format: 'reel',
      proposal: ['tutorial'],
      context: ['finance'],
      stats: { shares: 180, saved: 130, comments: 30, likes: 640, reach: 8700, video_views: 9400, total_interactions: 980 },
      postDate: new Date('2025-12-09T00:00:00.000Z'),
    },
  ]);
  mockAskLLM.mockResolvedValue({
    stream: streamFromText([
      '[ROTEIRO]',
      '**Título Sugerido:** Crie um roteiro para amanhã',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Cena 1 | Fala 1 |',
      '| 03-20s | Cena 2 | Fala 2 |',
      '| 20-30s | Cena 3 | CTA |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: Legenda base',
      '[/LEGENDA]',
    ].join('\n')),
    historyPromise: Promise.resolve([]),
  });

  const res = await chat(makeRequest({ query: 'crie um roteiro sobre orçamento doméstico para eu postar amanhã' }));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.answer).toContain('[INSPIRATION_JSON]');
  expect(json.answer).toContain('"source": "user_top_posts"');
  expect(json.answer).toContain('**Fonte da Inspiração:** Top posts do criador');
  expect(json.answer).toContain('**Base de Engajamento:**');
});

it('aplica estrutura de humor quando o pedido é de roteiro humorístico', async () => {
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'humor_script_request' });
  mockAskLLM.mockResolvedValue({
    stream: streamFromText([
      '[ROTEIRO]',
      '**Título Sugerido:** Crie um roteiro de humor para hoje',
      '**Formato Ideal:** Reels | **Duração Estimada:** 30s',
      '| Tempo | Visual (o que aparece) | Fala (o que dizer) |',
      '| :--- | :--- | :--- |',
      '| 00-03s | Crie um roteiro de humor para hoje | Crie um roteiro de humor para hoje |',
      '| 03-20s | Crie um roteiro de humor para hoje | Crie um roteiro de humor para hoje |',
      '| 20-30s | Crie um roteiro de humor para hoje | Crie um roteiro de humor para hoje |',
      '[/ROTEIRO]',
      '',
      '[LEGENDA]',
      'V1: Crie um roteiro de humor para hoje',
      '[/LEGENDA]',
    ].join('\n')),
    historyPromise: Promise.resolve([]),
  });

  const res = await chat(makeRequest({ query: 'crie um roteiro de humor sobre perrengue para gravar em casa' }));
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.answer).toContain('[ROTEIRO]');
  expect(json.answer).toMatch(/punchline|setup|conflito|reação/i);
  expect(json.answer).not.toMatch(/crie um roteiro de humor para hoje/i);
});
