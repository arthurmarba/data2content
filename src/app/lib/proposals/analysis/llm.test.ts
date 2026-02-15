/** @jest-environment node */

import { generateLlmEnhancedAnalysis } from './llm';
import type { DeterministicAnalysisResult, ProposalAnalysisContext } from './types';

const mockCreate = jest.fn();

jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args: any[]) => mockCreate(...args),
      },
    },
  }));
});

jest.mock('@/app/lib/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

function makeContext(): ProposalAnalysisContext {
  return {
    creator: { id: 'user-1', name: 'Creator', handle: '@creator' },
    proposal: {
      id: 'proposal-1',
      brandName: 'Marca X',
      campaignTitle: 'Campanha XPTO',
      campaignDescription: 'desc',
      deliverables: ['reel'],
      offeredBudget: 1000,
      currency: 'BRL',
      mediaKitPublicUrl: 'https://app.data2content.ai/mediakit/creator-x',
    },
    latestCalculation: {
      justo: 1000,
      estrategico: 1200,
      premium: 1400,
      segment: 'default',
      engagement: 3.1,
      reach: 10000,
    },
    benchmarks: {
      calcTarget: 1000,
      legacyCalcTarget: 950,
      dealTarget: 1050,
      similarProposalTarget: 980,
      closeRate: 0.3,
      dealCountLast180d: 10,
      similarProposalCount: 6,
      totalProposalCount: 30,
    },
    pricingCore: {
      source: 'calculator_core_v1',
      calculatorJusto: 1000,
      calculatorEstrategico: 750,
      calculatorPremium: 1400,
      confidence: 0.81,
      resolvedDefaults: [],
      limitations: [],
    },
    contextSignals: ['has_budget', 'has_latest_calculation'],
  };
}

function makeDeterministic(): DeterministicAnalysisResult {
  return {
    verdict: 'ajustar',
    suggestionType: 'ajustar',
    suggestedValue: 1100,
    analysis: 'analysis deterministic',
    replyDraft: 'reply deterministic',
    targetValue: 1000,
    analysisV2: {
      verdict: 'ajustar',
      confidence: { score: 0.8, label: 'alta' },
      pricing: {
        currency: 'BRL',
        offered: 900,
        target: 1000,
        anchor: 1200,
        floor: 1000,
        gapPercent: -10,
      },
      rationale: ['r1'],
      playbook: ['p1'],
      cautions: ['c1'],
    },
  };
}

describe('generateLlmEnhancedAnalysis', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'gpt-4o-mini';
  });

  it('retorna payload da LLM quando JSON válido é recebido', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              analysis: 'Diagnóstico final curto e acionável com dados reais.',
              replyDraft: 'Oi marca, segue proposta final alinhada ao escopo e cronograma.',
              rationale: ['O orçamento está abaixo do target.'],
              playbook: ['Abrir negociação com âncora e fechar no target.'],
              cautions: ['Evitar desconto sem reduzir escopo.'],
            }),
          },
        },
      ],
    });

    const result = await generateLlmEnhancedAnalysis({
      context: makeContext(),
      deterministic: makeDeterministic(),
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.payload.analysis).toContain('Diagnóstico');
    expect(result.payload.replyDraft).toContain('Oi marca');
    expect(result.payload.replyDraft).toContain('https://app.data2content.ai/mediakit/creator-x');
    expect(result.payload.replyDraft).toContain('\n\n');
    expect(result.payload.playbook[0]).toContain('valor inicial de referencia');
  });

  it('normaliza jargões técnicos para linguagem simples', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              analysis: 'O target está bom e o gap está positivo versus benchmark.',
              replyDraft: 'Podemos negociar com BATNA clara, baseline de preço e âncora objetiva.',
              rationale: ['Target alinhado com benchmark.'],
              playbook: ['Abrir pelo target, sem concessão unilateral e reduzir o gap.'],
              cautions: ['Sem benchmark suficiente.'],
            }),
          },
        },
      ],
    });

    const result = await generateLlmEnhancedAnalysis({
      context: makeContext(),
      deterministic: makeDeterministic(),
    });

    expect(result.fallbackUsed).toBe(false);
    expect(result.payload.analysis).not.toMatch(/\btarget\b/i);
    expect(result.payload.analysis).not.toMatch(/\bgap\b/i);
    expect(result.payload.analysis).not.toMatch(/\bbenchmark\b/i);
    expect(result.payload.replyDraft).not.toMatch(/\bBATNA\b/i);
    expect(result.payload.replyDraft).not.toMatch(/\bbaseline\b/i);
    expect(result.payload.replyDraft).not.toMatch(/\bâncora\b/i);
    expect(result.payload.playbook[0]).not.toMatch(/\bconcessão\b/i);
    expect(result.payload.playbook[0]).toContain('valor recomendado');
    expect(result.payload.replyDraft).toContain('mídia kit público');
    expect(result.payload.replyDraft).toContain('\n\n');
  });

  it('envia instruções de negociação sênior no prompt', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              analysis: 'Diagnóstico final curto e acionável com dados reais.',
              replyDraft: 'Oi marca, segue proposta final alinhada ao escopo e cronograma.',
              rationale: ['O orçamento está abaixo do target.'],
              playbook: ['Abrir negociação com âncora e fechar no target.'],
              cautions: ['Evitar desconto sem reduzir escopo.'],
            }),
          },
        },
      ],
    });

    await generateLlmEnhancedAnalysis({
      context: makeContext(),
      deterministic: makeDeterministic(),
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0]?.[0];
    const messages = callArgs?.messages ?? [];
    const systemMessage = messages.find((m: any) => m.role === 'system')?.content ?? '';
    const userMessage = messages.find((m: any) => m.role === 'user')?.content ?? '';

    expect(systemMessage).toContain('negociador sênior');
    expect(systemMessage).toContain('concessão');
    expect(systemMessage).toContain('criador leigo');
    expect(userMessage).toContain('tacticalFocus');
    expect(userMessage).toContain('concessoes condicionais');
    expect(userMessage).toContain('Evite termos tecnicos');
    expect(userMessage).toContain('mediaKitPublicUrl');
  });

  it('usa fallback quando JSON da LLM vem inválido', async () => {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'saida invalida' } }],
    });

    const deterministic = makeDeterministic();

    const result = await generateLlmEnhancedAnalysis({
      context: makeContext(),
      deterministic,
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.payload.analysis).toBe(deterministic.analysis);
    expect(result.payload.replyDraft).toContain(deterministic.replyDraft);
    expect(result.payload.replyDraft).toContain('https://app.data2content.ai/mediakit/creator-x');
    expect(result.payload.replyDraft).toContain('\n\n');
  });

  it('usa fallback quando chamada da LLM falha', async () => {
    mockCreate.mockRejectedValueOnce(new Error('timeout'));

    const deterministic = makeDeterministic();

    const result = await generateLlmEnhancedAnalysis({
      context: makeContext(),
      deterministic,
      timeoutMs: 1,
    });

    expect(result.fallbackUsed).toBe(true);
    expect(result.payload.rationale).toEqual(deterministic.analysisV2.rationale);
  });
});
