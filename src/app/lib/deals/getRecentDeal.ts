import mongoose from 'mongoose';

import AdDeal from '@/app/models/AdDeal';
import Metric from '@/app/models/Metric';

export interface RecentDealSummary {
  value: number;
  reach: number | null;
  brandSegment: string | null;
  createdAt: string | null;
  relatedPostId?: mongoose.Types.ObjectId | null;
}

export async function getRecentDealForSegment(userId: string, segment: string): Promise<RecentDealSummary | null> {
  if (!mongoose.isValidObjectId(userId)) return null;

  const normalized = segment.trim().toLowerCase();
  if (!normalized) return null;

  const match: Record<string, unknown> = {
    userId: new mongoose.Types.ObjectId(userId),
    compensationType: 'Valor Fixo',
    compensationValue: { $gt: 0 },
    brandSegment: { $regex: new RegExp(`^${normalized}$`, 'i') },
  };

  const deal = await AdDeal.findOne(match)
    .sort({ createdAt: -1 })
    .select({ compensationValue: 1, brandSegment: 1, createdAt: 1, relatedPostId: 1 })
    .lean()
    .exec();

  if (!deal) return null;

  let reach: number | null = null;
  if (deal.relatedPostId) {
    const metric = await Metric.findById(deal.relatedPostId)
      .select({ 'stats.reach': 1, 'stats.impressions': 1 })
      .lean()
      .exec();
    const reachCandidate =
      (typeof metric?.stats?.reach === 'number' && Number.isFinite(metric.stats.reach) ? metric.stats.reach : null) ??
      (typeof metric?.stats?.impressions === 'number' && Number.isFinite(metric.stats.impressions)
        ? metric.stats.impressions
        : null);
    if (typeof reachCandidate === 'number' && reachCandidate > 0) {
      reach = Math.round(reachCandidate);
    }
  }

  const value = typeof deal.compensationValue === 'number' ? Math.round(deal.compensationValue * 100) / 100 : 0;

  return {
    value,
    reach,
    brandSegment: (deal.brandSegment ?? normalized) || null,
    createdAt: deal.createdAt ? deal.createdAt.toISOString() : null,
    relatedPostId: deal.relatedPostId ?? null,
  };
}
