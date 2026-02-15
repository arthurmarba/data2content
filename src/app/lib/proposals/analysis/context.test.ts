/** @jest-environment node */

import mongoose from 'mongoose';

import { buildProposalAnalysisContext } from './context';
import PubliCalculation from '@/app/models/PubliCalculation';
import AdDeal from '@/app/models/AdDeal';
import BrandProposal from '@/app/models/BrandProposal';
import User from '@/app/models/User';
import { resolveProposalPricingCore } from '@/app/lib/proposals/analysis/pricingCore';

jest.mock('@/app/models/PubliCalculation', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock('@/app/models/AdDeal', () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));
jest.mock('@/app/models/BrandProposal', () => ({
  __esModule: true,
  default: { find: jest.fn(), countDocuments: jest.fn() },
}));
jest.mock('@/app/models/User', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock('@/app/lib/proposals/analysis/pricingCore', () => ({
  resolveProposalPricingCore: jest.fn(),
}));

function queryChain(value: any) {
  return {
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe('buildProposalAnalysisContext', () => {
  const proposalId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();

    (PubliCalculation as any).findOne.mockReturnValue(
      queryChain({
        _id: new mongoose.Types.ObjectId(),
        metrics: { reach: 12000, profileSegment: 'default', engagement: 3.5 },
        result: { justo: 1000, estrategico: 750, premium: 1400 },
        params: {},
      })
    );

    (AdDeal as any).find.mockReturnValue(
      queryChain([{ compensationValue: 900 }, { compensationValue: 1100 }])
    );

    (BrandProposal as any).find.mockReturnValue(
      queryChain([{ budget: 1200, deliverables: ['1 reel'] }, { budget: 1000, deliverables: ['1 post'] }])
    );
    (BrandProposal as any).countDocuments
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(8) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(2) });

    (User as any).findById.mockReturnValue(queryChain({ _id: userId, mediaKitSlug: 'creator-slug' }));

    (resolveProposalPricingCore as jest.Mock).mockResolvedValue({
      source: 'calculator_core_v1',
      calculatorJusto: 1350,
      calculatorEstrategico: 1012.5,
      calculatorPremium: 1890,
      confidence: 0.78,
      resolvedDefaults: ['complexity_default_roteiro'],
      limitations: [],
    });
  });

  it('usa preço monetário da calculadora sem multiplicar por alcance no calcTarget principal', async () => {
    const context = await buildProposalAnalysisContext({
      userId,
      proposal: {
        _id: proposalId,
        brandName: 'Marca X',
        campaignTitle: 'Campanha',
        campaignDescription: 'Desc',
        deliverables: ['1 reel'],
        budget: 1000,
        currency: 'BRL',
      },
      pricingCoreEnabled: true,
      brandRiskEnabled: true,
      calibrationEnabled: true,
    });

    expect(context.benchmarks.calcTarget).toBe(1350);
    expect(context.benchmarks.legacyCalcTarget).toBe(12000);
    expect(context.contextSignals).toContain('pricing_core_v1');
  });
});
