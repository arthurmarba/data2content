/** @jest-environment node */
import { NextRequest } from 'next/server';
import mongoose from 'mongoose';

import { POST } from './route';
import BrandProposal from '@/app/models/BrandProposal';
import PubliCalculation from '@/app/models/PubliCalculation';
import AdDeal from '@/app/models/AdDeal';
import { connectToDatabase } from '@/app/lib/mongoose';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { buildProposalAnalysisContext } from '@/app/lib/proposals/analysis/context';
import { runDeterministicProposalAnalysis } from '@/app/lib/proposals/analysis/engine';
import { generateLlmEnhancedAnalysis } from '@/app/lib/proposals/analysis/llm';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/resolveAuthOptions', () => ({ resolveAuthOptions: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/BrandProposal', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock('@/app/models/PubliCalculation', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));
jest.mock('@/app/models/AdDeal', () => ({
  __esModule: true,
  default: { aggregate: jest.fn() },
}));
jest.mock('@/app/lib/planGuard', () => ({ ensurePlannerAccess: jest.fn() }));
jest.mock('@/app/lib/proposals/analysis/context', () => ({ buildProposalAnalysisContext: jest.fn() }));
jest.mock('@/app/lib/proposals/analysis/engine', () => ({ runDeterministicProposalAnalysis: jest.fn() }));
jest.mock('@/app/lib/proposals/analysis/featureFlag', () => ({ isCampaignsPricingCoreV1Enabled: jest.fn() }));
jest.mock('@/app/lib/pricing/featureFlag', () => ({
  isPricingBrandRiskV1Enabled: jest.fn(),
  isPricingCalibrationV1Enabled: jest.fn(),
}));
jest.mock('@/app/lib/proposals/analysis/llm', () => ({ generateLlmEnhancedAnalysis: jest.fn() }));
jest.mock('@/app/lib/aiOrchestrator', () => ({ generateProposalAnalysisMessage: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock('@sentry/nextjs', () => ({ captureMessage: jest.fn(), captureException: jest.fn() }));

const getServerSession = require('next-auth/next').getServerSession as jest.Mock;
const resolveAuthOptions = require('@/app/api/auth/resolveAuthOptions').resolveAuthOptions as jest.Mock;
const connectDbMock = connectToDatabase as jest.Mock;
const ensureAccessMock = ensurePlannerAccess as jest.Mock;
const brandProposalModel = BrandProposal as any;
const publiCalculationModel = PubliCalculation as any;
const adDealModel = AdDeal as any;
const buildContextMock = buildProposalAnalysisContext as jest.Mock;
const deterministicMock = runDeterministicProposalAnalysis as jest.Mock;
const llmMock = generateLlmEnhancedAnalysis as jest.Mock;
const pricingCoreFlagMock = require('@/app/lib/proposals/analysis/featureFlag')
  .isCampaignsPricingCoreV1Enabled as jest.Mock;
const pricingBrandRiskFlagMock = require('@/app/lib/pricing/featureFlag')
  .isPricingBrandRiskV1Enabled as jest.Mock;
const pricingCalibrationFlagMock = require('@/app/lib/pricing/featureFlag')
  .isPricingCalibrationV1Enabled as jest.Mock;

const PROPOSAL_ID = new mongoose.Types.ObjectId().toString();
const USER_ID = new mongoose.Types.ObjectId().toString();

function makeRequest() {
  return new NextRequest(`http://localhost/api/proposals/${PROPOSAL_ID}/analyze`, {
    method: 'POST',
  });
}

function mockFindByIdOnce(payload: any) {
  return {
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(payload),
  };
}

describe('POST /api/proposals/[id]/analyze', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PROPOSAL_ANALYSIS_V2_ENABLED = 'true';

    getServerSession.mockResolvedValue({
      user: { id: USER_ID, name: 'Creator', instagramUsername: 'creator' },
    });
    resolveAuthOptions.mockResolvedValue({});

    ensureAccessMock.mockResolvedValue({ ok: true, normalizedStatus: 'active', source: 'session' });
    connectDbMock.mockResolvedValue(undefined);
    pricingCoreFlagMock.mockResolvedValue(true);
    pricingBrandRiskFlagMock.mockResolvedValue(true);
    pricingCalibrationFlagMock.mockResolvedValue(true);

    brandProposalModel.findById.mockReturnValue(
      mockFindByIdOnce({
        _id: new mongoose.Types.ObjectId(PROPOSAL_ID),
        userId: USER_ID,
        brandName: 'Marca X',
        campaignTitle: 'Campanha X',
        campaignDescription: 'Desc',
        deliverables: ['Reel'],
        budget: 1000,
        currency: 'BRL',
      })
    );
    brandProposalModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    publiCalculationModel.findOne.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(null),
    });
    adDealModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([]),
    });

    buildContextMock.mockResolvedValue({
      creator: { id: USER_ID, name: 'Creator', handle: 'creator' },
      proposal: {
        id: PROPOSAL_ID,
        brandName: 'Marca X',
        campaignTitle: 'Campanha X',
        campaignDescription: 'Desc',
        deliverables: ['reel'],
        offeredBudget: 1000,
        currency: 'BRL',
      },
      latestCalculation: null,
      benchmarks: {
        calcTarget: 1000,
        legacyCalcTarget: 950,
        dealTarget: 1000,
        similarProposalTarget: 1000,
        closeRate: 0.2,
        dealCountLast180d: 4,
        similarProposalCount: 3,
        totalProposalCount: 10,
      },
      pricingCore: {
        source: 'calculator_core_v1',
        calculatorJusto: 1000,
        calculatorEstrategico: 750,
        calculatorPremium: 1400,
        confidence: 0.8,
        resolvedDefaults: [],
        limitations: [],
      },
      contextSignals: ['has_budget'],
    });

    deterministicMock.mockReturnValue({
      verdict: 'aceitar',
      suggestionType: 'aceitar',
      suggestedValue: 1000,
      analysis: 'analysis',
      replyDraft: 'reply',
      targetValue: 1000,
      analysisV2: {
        verdict: 'aceitar',
        confidence: { score: 0.8, label: 'alta' },
        pricing: {
          currency: 'BRL',
          offered: 1000,
          target: 1000,
          anchor: 1200,
          floor: 1000,
          gapPercent: 0,
        },
        rationale: ['r1'],
        playbook: ['p1'],
        cautions: ['c1'],
      },
    });

    llmMock.mockResolvedValue({
      payload: {
        analysis: 'analysis llm',
        replyDraft: 'reply llm',
        rationale: ['r1 llm'],
        playbook: ['p1 llm'],
        cautions: ['c1 llm'],
      },
      fallbackUsed: false,
      model: 'gpt-4o-mini',
    });
  });

  it('retorna 401 sem sessão', async () => {
    getServerSession.mockResolvedValueOnce(null);

    const res = await POST(makeRequest(), { params: { id: PROPOSAL_ID } });

    expect(res.status).toBe(401);
  });

  it('retorna 402 para plano sem acesso', async () => {
    ensureAccessMock.mockResolvedValueOnce({ ok: true, normalizedStatus: null, source: 'session' });

    const res = await POST(makeRequest(), { params: { id: PROPOSAL_ID } });

    expect(res.status).toBe(402);
  });

  it('retorna 403 quando proposta pertence a outro usuário', async () => {
    brandProposalModel.findById.mockReturnValueOnce(
      mockFindByIdOnce({
        _id: new mongoose.Types.ObjectId(PROPOSAL_ID),
        userId: 'another-user',
      })
    );

    const res = await POST(makeRequest(), { params: { id: PROPOSAL_ID } });

    expect(res.status).toBe(403);
  });

  it('retorna payload com analysisV2 e meta', async () => {
    const res = await POST(makeRequest(), { params: { id: PROPOSAL_ID } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.analysis).toBe('analysis llm');
    expect(body.replyDraft).toBe('reply llm');
    expect(body.analysisV2.verdict).toBe('aceitar');
    expect(body.analysisV2.rationale).toEqual(['r1 llm']);
    expect(body.meta.model).toBe('gpt-4o-mini');
    expect(body.meta.fallbackUsed).toBe(false);
    expect(body.pricingSource).toBe('calculator_core_v1');
    expect(body.pricingConsistency).toBe('alta');
    expect(body.limitations).toEqual([]);
    expect(brandProposalModel.updateOne).toHaveBeenCalledTimes(1);
    expect(brandProposalModel.updateOne).toHaveBeenCalledWith(
      { _id: expect.any(mongoose.Types.ObjectId) },
      expect.objectContaining({
        $set: expect.objectContaining({
          latestAnalysis: expect.objectContaining({
            analysis: 'analysis llm',
            replyDraft: 'reply llm',
            suggestionType: 'aceitar',
            suggestedValue: 1000,
            pricingSource: 'calculator_core_v1',
            pricingConsistency: 'alta',
            version: '2.0.0',
          }),
        }),
      })
    );
  });

  it('marca fallbackUsed=true quando LLM entra em fallback', async () => {
    llmMock.mockResolvedValueOnce({
      payload: {
        analysis: 'analysis deterministic',
        replyDraft: 'reply deterministic',
        rationale: ['r1'],
        playbook: ['p1'],
        cautions: ['c1'],
      },
      fallbackUsed: true,
      model: 'gpt-4o-mini',
    });

    const res = await POST(makeRequest(), { params: { id: PROPOSAL_ID } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.meta.fallbackUsed).toBe(true);
  });

  it('retorna 500 com errorStage=context quando contexto falha', async () => {
    buildContextMock.mockRejectedValueOnce(new Error('context failed'));

    const res = await POST(makeRequest(), { params: { id: PROPOSAL_ID } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.errorStage).toBe('context');
  });

  it('usa caminho legado quando kill switch está desligado', async () => {
    process.env.PROPOSAL_ANALYSIS_V2_ENABLED = 'false';

    const res = await POST(makeRequest(), { params: { id: PROPOSAL_ID } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.analysis).toBe('string');
    expect(typeof body.replyDraft).toBe('string');
    expect(body.analysisV2).toBeUndefined();
    expect(body.meta).toBeUndefined();
    expect(buildContextMock).not.toHaveBeenCalled();
    expect(deterministicMock).not.toHaveBeenCalled();
    expect(llmMock).not.toHaveBeenCalled();
  });
});
