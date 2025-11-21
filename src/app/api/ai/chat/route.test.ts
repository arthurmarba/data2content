// @jest-environment node
import { NextRequest } from 'next/server';
import { POST as chat } from './route';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import * as stateService from '@/app/lib/stateService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import { determineIntent } from '@/app/lib/intentService';
import { callOpenAIForQuestion, generateConversationSummary } from '@/app/lib/aiService';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock('@/app/lib/stateService', () => ({
  getConversationHistory: jest.fn(),
  setConversationHistory: jest.fn(),
  getDialogueState: jest.fn(),
  updateDialogueState: jest.fn(),
}));
jest.mock('@/app/lib/aiOrchestrator', () => ({ askLLMWithEnrichedContext: jest.fn() }));
jest.mock('@/app/lib/intentService', () => ({
  determineIntent: jest.fn(),
  normalizeText: (text: string) => text,
}));
jest.mock('@/app/lib/aiService', () => ({
  callOpenAIForQuestion: jest.fn(),
  generateConversationSummary: jest.fn(),
}));

const mockSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (UserModel as any).findById as jest.Mock;
const mockGetHistory = stateService.getConversationHistory as jest.Mock;
const mockSetHistory = stateService.setConversationHistory as jest.Mock;
const mockGetDialogue = stateService.getDialogueState as jest.Mock;
const mockUpdateDialogue = stateService.updateDialogueState as jest.Mock;
const mockLLM = askLLMWithEnrichedContext as jest.Mock;
const mockIntent = determineIntent as jest.Mock;
const mockCallQuestion = callOpenAIForQuestion as jest.Mock;
const mockGenSummary = generateConversationSummary as jest.Mock;

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
  mockCallQuestion.mockResolvedValue('Genérico');
  mockGenSummary.mockResolvedValue('Resumo');
  mockIntent.mockResolvedValue({ type: 'intent_determined', intent: 'general' });
  mockLLM.mockResolvedValue({ stream: streamFromText('Resposta padrão') });
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
  mockLLM.mockResolvedValue({ stream: streamFromText('Posso buscar esses dados?') });

  const res = await chat(makeRequest({ query: 'Preciso de plano de conteúdo' }));
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(json.pendingAction).toBeTruthy();
  expect(json.currentTask?.name).toBe('content_plan');
});

it('retorna mensagem amigável quando LLM falha', async () => {
  mockLLM.mockRejectedValue(new Error('fail'));

  const res = await chat(makeRequest({ query: 'Teste error' }));
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(String(json.answer)).toMatch(/problema técnico|tentar novamente/i);
});
