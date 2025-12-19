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
jest.mock('@/app/lib/stateService', () => ({
  __esModule: true,
  getConversationHistory: () => mockGetHistory(),
  setConversationHistory: (...args: any[]) => mockSetHistory(...args),
  getDialogueState: () => mockGetDialogue(),
  updateDialogueState: (...args: any[]) => mockUpdateDialogue(...args),
  createThread: (...args: any[]) => mockCreateThread(...args),
  persistMessage: (...args: any[]) => mockPersistMessage(...args),
  generateThreadTitle: (...args: any[]) => mockGenerateThreadTitle(...args),
}));
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import { determineIntent } from '@/app/lib/intentService';
import { callOpenAIForQuestion, generateConversationSummary } from '@/app/lib/aiService';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock('@/app/lib/aiOrchestrator', () => ({
  __esModule: true,
  askLLMWithEnrichedContext: (...args: any[]) => mockAskLLM(...args),
}));
jest.mock('@/app/lib/intentService', () => ({
  determineIntent: jest.fn(),
  normalizeText: (text: string) => text,
}));
jest.mock('@/app/lib/aiService', () => ({
  __esModule: true,
  callOpenAIForQuestion: (...args: any[]) => mockCallQuestion(...args),
  generateConversationSummary: (...args: any[]) => mockGenSummary(...args),
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
let stateServiceMocked: any;

const mockSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (UserModel as any).findById as jest.Mock;
const mockIntent = determineIntent as jest.Mock;

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
  jest.isolateModules(() => {
    stateServiceMocked = require('@/app/lib/stateService');
    stateServiceMocked.getConversationHistory = mockGetHistory;
    stateServiceMocked.setConversationHistory = mockSetHistory;
    stateServiceMocked.getDialogueState = mockGetDialogue;
    stateServiceMocked.updateDialogueState = mockUpdateDialogue;
    stateServiceMocked.createThread = mockCreateThread;
    stateServiceMocked.persistMessage = mockPersistMessage;
    stateServiceMocked.generateThreadTitle = mockGenerateThreadTitle;
    const routeModule = require('./route');
    chat = routeModule.POST;
    sanitizeTables = routeModule.sanitizeTables;
  });
  mockSession.mockResolvedValue({ user: { id: 'u1', planStatus: 'active' } });
  mockConnect.mockResolvedValue(null);
  mockFindById.mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      _id: 'u1',
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
});

it('retorna CTA de conectar IG quando não conectado', async () => {
  mockFindById.mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      _id: 'u1',
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
  mockSession.mockResolvedValue({ user: { id: 'u1', planStatus: 'inactive' } });
  mockFindById.mockReturnValue({
    lean: jest.fn().mockResolvedValue({
      _id: 'u1',
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
