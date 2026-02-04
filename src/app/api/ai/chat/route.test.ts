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
jest.mock('@/app/lib/chatTelemetry', () => ({
  ensureChatSession: jest.fn().mockResolvedValue({ _id: 'session1' }),
  logChatMessage: jest.fn().mockResolvedValue(null),
}));

let chat: typeof import('./route').POST;
let sanitizeTables: typeof import('./route').sanitizeTables;

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
