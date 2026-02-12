import mongoose from 'mongoose';
import { subDays } from 'date-fns';

import BrandProposal from '@/app/models/BrandProposal';
import PubliCalculation from '@/app/models/PubliCalculation';
import AdDeal from '@/app/models/AdDeal';
import User from '@/app/models/User';
import { normalizeCurrencyCode } from '@/utils/currency';

import type { ProposalAnalysisContext } from './types';

interface BuildProposalAnalysisContextInput {
  userId: string;
  creatorName?: string;
  creatorHandle?: string;
  proposal: any;
}

const ANALYSIS_PERIOD_DAYS = 180;
const SIMILAR_PROPOSALS_LIMIT = 200;
const SIMILAR_PROPOSALS_TOP = 20;

function resolveAppBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'https://app.data2content.ai').trim();
  return raw.replace(/\/+$/, '');
}

function buildMediaKitPublicUrl(mediaKitSlug: unknown): string | null {
  if (typeof mediaKitSlug !== 'string') return null;
  const slug = mediaKitSlug.trim();
  if (!slug) return null;
  return `${resolveAppBaseUrl()}/mediakit/${slug}`;
}

function normalizeDeliverables(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter((item): item is string => item.length > 0);
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[middle - 1];
    const right = sorted[middle];
    if (typeof left !== 'number' || typeof right !== 'number') return null;
    return (left + right) / 2;
  }
  return sorted[middle] ?? null;
}

function overlapScore(reference: string[], candidate: string[]): number {
  if (reference.length === 0 || candidate.length === 0) return 0;
  const referenceSet = new Set(reference);
  const candidateSet = new Set(candidate);

  let intersectionCount = 0;
  for (const item of referenceSet) {
    if (candidateSet.has(item)) intersectionCount += 1;
  }

  const unionCount = new Set([...referenceSet, ...candidateSet]).size;
  if (unionCount === 0) return 0;
  return intersectionCount / unionCount;
}

function toRounded(value: number | null): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  return Math.round(value * 100) / 100;
}

export async function buildProposalAnalysisContext(
  input: BuildProposalAnalysisContextInput
): Promise<ProposalAnalysisContext> {
  const { userId, creatorName, creatorHandle, proposal } = input;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const currency = normalizeCurrencyCode(proposal.currency) ?? 'BRL';
  const currentDeliverables = normalizeDeliverables(proposal.deliverables);
  const offeredBudget = typeof proposal.budget === 'number' && Number.isFinite(proposal.budget) ? proposal.budget : null;
  const sinceDate = subDays(new Date(), ANALYSIS_PERIOD_DAYS);

  const dealMatch: Record<string, unknown> = {
    userId: userObjectId,
    compensationValue: { $gt: 0 },
    createdAt: { $gte: sinceDate },
  };

  if (currency === 'BRL') {
    dealMatch.$or = [
      { compensationCurrency: { $exists: false } },
      { compensationCurrency: { $eq: null } },
      { compensationCurrency: { $eq: '' } },
      { compensationCurrency: 'BRL' },
    ];
  } else {
    dealMatch.compensationCurrency = currency;
  }

  const [latestCalculation, deals, candidateSimilarProposals, totalProposalCount, acceptedProposalCount, creatorProfile] =
    await Promise.all([
      PubliCalculation.findOne({ userId }).sort({ createdAt: -1 }).lean().exec(),
      AdDeal.find(dealMatch).sort({ createdAt: -1 }).limit(400).select({ compensationValue: 1 }).lean().exec(),
      BrandProposal.find({
        userId,
        _id: { $ne: proposal._id },
        currency,
        budget: { $type: 'number', $gt: 0 },
      })
        .sort({ createdAt: -1 })
        .limit(SIMILAR_PROPOSALS_LIMIT)
        .select({ budget: 1, deliverables: 1 })
        .lean()
        .exec(),
      BrandProposal.countDocuments({ userId }).exec(),
      BrandProposal.countDocuments({ userId, status: 'aceito' }).exec(),
      User.findById(userId).select({ mediaKitSlug: 1 }).lean().exec(),
    ]);

  const calcJusto =
    typeof latestCalculation?.result?.justo === 'number' && Number.isFinite(latestCalculation.result.justo)
      ? latestCalculation.result.justo
      : null;

  const calcReach =
    typeof latestCalculation?.metrics?.reach === 'number' && Number.isFinite(latestCalculation.metrics.reach)
      ? latestCalculation.metrics.reach
      : null;

  const calcTarget =
    currency === 'BRL' && calcJusto !== null
      ? calcReach && calcReach > 0
        ? (calcJusto * calcReach) / 1000
        : calcJusto
      : null;

  const dealValues = deals
    .map((deal: any) => (typeof deal?.compensationValue === 'number' ? deal.compensationValue : null))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0);
  const dealTarget = median(dealValues);

  type SimilarScore = { budget: number; score: number };
  const scoredProposals: SimilarScore[] = candidateSimilarProposals
    .map((item: any) => {
      const budget = typeof item?.budget === 'number' ? item.budget : null;
      if (budget === null || !Number.isFinite(budget) || budget <= 0) return null;
      const candidateDeliverables = normalizeDeliverables(item?.deliverables);
      const score = overlapScore(currentDeliverables, candidateDeliverables);
      return { budget, score };
    })
    .filter((item): item is SimilarScore => item !== null)
    .filter((item) => (currentDeliverables.length === 0 ? true : item.score > 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, SIMILAR_PROPOSALS_TOP);

  const similarProposalTarget = median(scoredProposals.map((item) => item.budget));
  const closeRate = totalProposalCount > 0 ? acceptedProposalCount / totalProposalCount : null;

  const contextSignals: string[] = [];
  if (offeredBudget !== null) contextSignals.push('has_budget');
  if (calcTarget !== null) contextSignals.push('has_latest_calculation');
  if (dealTarget !== null) contextSignals.push('has_deal_benchmark');
  if (similarProposalTarget !== null) contextSignals.push('has_similar_proposals');
  if (closeRate !== null) contextSignals.push('has_close_rate');

  return {
    creator: {
      id: userId,
      name: creatorName,
      handle: creatorHandle,
    },
    proposal: {
      id: String(proposal._id),
      brandName: proposal.brandName,
      campaignTitle: proposal.campaignTitle ?? undefined,
      campaignDescription: proposal.campaignDescription ?? undefined,
      deliverables: currentDeliverables,
      offeredBudget,
      currency,
      mediaKitPublicUrl: buildMediaKitPublicUrl(proposal.mediaKitSlug || creatorProfile?.mediaKitSlug),
    },
    latestCalculation: latestCalculation
      ? {
          justo: toRounded(calcJusto),
          estrategico:
            typeof latestCalculation.result?.estrategico === 'number'
              ? toRounded(latestCalculation.result.estrategico)
              : null,
          premium:
            typeof latestCalculation.result?.premium === 'number'
              ? toRounded(latestCalculation.result.premium)
              : null,
          segment:
            typeof latestCalculation.metrics?.profileSegment === 'string'
              ? latestCalculation.metrics.profileSegment
              : null,
          engagement:
            typeof latestCalculation.metrics?.engagement === 'number'
              ? toRounded(latestCalculation.metrics.engagement)
              : null,
          reach: calcReach !== null ? Math.round(calcReach) : null,
        }
      : null,
    benchmarks: {
      calcTarget: toRounded(calcTarget),
      dealTarget: toRounded(dealTarget),
      similarProposalTarget: toRounded(similarProposalTarget),
      closeRate: closeRate !== null ? Math.round(closeRate * 10000) / 10000 : null,
      dealCountLast180d: dealValues.length,
      similarProposalCount: scoredProposals.length,
      totalProposalCount,
    },
    contextSignals,
  };
}
