/** @jest-environment node */

import { runDeterministicProposalAnalysis } from './engine';
import type { ProposalAnalysisContext } from './types';

function makeContext(overrides?: Partial<ProposalAnalysisContext>): ProposalAnalysisContext {
  return {
    creator: { id: 'user-1', name: 'Creator', handle: 'creator' },
    proposal: {
      id: 'proposal-1',
      brandName: 'Marca X',
      campaignTitle: 'Campanha X',
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
      engagement: 3.2,
      reach: 10000,
    },
    benchmarks: {
      calcTarget: 1000,
      dealTarget: 1000,
      similarProposalTarget: 1000,
      closeRate: 0.25,
      dealCountLast180d: 8,
      similarProposalCount: 5,
      totalProposalCount: 12,
    },
    contextSignals: [
      'has_budget',
      'has_latest_calculation',
      'has_deal_benchmark',
      'has_similar_proposals',
      'has_close_rate',
    ],
    ...overrides,
  };
}

describe('runDeterministicProposalAnalysis', () => {
  it('classifica como aceitar_com_extra quando oferta está >=18% acima do target', () => {
    const result = runDeterministicProposalAnalysis(
      makeContext({
        proposal: {
          ...makeContext().proposal,
          offeredBudget: 1250,
        },
      })
    );

    expect(result.verdict).toBe('aceitar_com_extra');
    expect(result.analysisV2.pricing.gapPercent).toBe(25);
  });

  it('classifica como aceitar quando oferta está na faixa de -10% a +18%', () => {
    const result = runDeterministicProposalAnalysis(
      makeContext({
        proposal: {
          ...makeContext().proposal,
          offeredBudget: 940,
        },
      })
    );

    expect(result.verdict).toBe('aceitar');
    expect(result.analysisV2.pricing.gapPercent).toBe(-6);
  });

  it('classifica como ajustar quando oferta está entre -30% e -10%', () => {
    const result = runDeterministicProposalAnalysis(
      makeContext({
        proposal: {
          ...makeContext().proposal,
          offeredBudget: 800,
        },
      })
    );

    expect(result.verdict).toBe('ajustar');
    expect(result.analysisV2.pricing.gapPercent).toBe(-20);
  });

  it('classifica como ajustar_escopo quando oferta está abaixo de -30%', () => {
    const result = runDeterministicProposalAnalysis(
      makeContext({
        proposal: {
          ...makeContext().proposal,
          offeredBudget: 650,
        },
      })
    );

    expect(result.verdict).toBe('ajustar_escopo');
    expect(result.analysisV2.pricing.gapPercent).toBe(-35);
  });

  it('classifica como coletar_orcamento quando proposta vem sem budget', () => {
    const result = runDeterministicProposalAnalysis(
      makeContext({
        proposal: {
          ...makeContext().proposal,
          offeredBudget: null,
        },
      })
    );

    expect(result.verdict).toBe('coletar_orcamento');
    expect(result.suggestedValue).toBeNull();
  });

  it('mantém operação quando não há cálculo recente e moeda não BRL', () => {
    const result = runDeterministicProposalAnalysis(
      makeContext({
        proposal: {
          ...makeContext().proposal,
          currency: 'USD',
          offeredBudget: 900,
        },
        benchmarks: {
          ...makeContext().benchmarks,
          calcTarget: null,
          dealTarget: null,
          similarProposalTarget: null,
        },
      })
    );

    expect(result.verdict).toBe('ajustar');
    expect(result.analysisV2.pricing.target).toBeNull();
  });

  it('calcula confiança alta quando há sinais fortes e baixa com sinais fracos', () => {
    const high = runDeterministicProposalAnalysis(makeContext());
    expect(high.analysisV2.confidence.label).toBe('alta');

    const low = runDeterministicProposalAnalysis(
      makeContext({
        proposal: {
          ...makeContext().proposal,
          offeredBudget: 1000,
          deliverables: [],
        },
        benchmarks: {
          ...makeContext().benchmarks,
          calcTarget: null,
          dealTarget: null,
          similarProposalTarget: null,
          closeRate: null,
          similarProposalCount: 0,
        },
      })
    );

    expect(low.analysisV2.confidence.label).toBe('baixa');
  });

  it('inclui link do mídia kit no replyDraft com explicação de métricas', () => {
    const result = runDeterministicProposalAnalysis(makeContext());
    expect(result.replyDraft).toContain('https://app.data2content.ai/mediakit/creator-x');
    expect(result.replyDraft).toContain('métricas em tempo real');
  });
});
