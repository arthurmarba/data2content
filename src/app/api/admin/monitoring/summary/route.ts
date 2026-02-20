import { NextResponse } from 'next/server';
import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import {
  MONTHLY_PRICE,
  ANNUAL_MONTHLY_PRICE,
  AGENCY_GUEST_MONTHLY_PRICE,
  AGENCY_GUEST_ANNUAL_MONTHLY_PRICE,
  AGENCY_MONTHLY_PRICE,
} from '@/config/pricing.config';
export const dynamic = 'force-dynamic';

const SUMMARY_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.ADMIN_MONITORING_SUMMARY_CACHE_TTL_MS ?? 30_000);
  return Number.isFinite(parsed) && parsed >= 5_000 ? Math.floor(parsed) : 30_000;
})();

let summaryCache: { expiresAt: number; payload: Record<string, any> } | null = null;

export async function GET() {
  const now = Date.now();
  if (summaryCache && summaryCache.expiresAt > now) {
    return NextResponse.json(summaryCache.payload);
  }

  await connectToDatabase();

  const [activeAgencies, userMetricsAgg] = await Promise.all([
    AgencyModel.countDocuments({ planStatus: 'active' }),
    UserModel.aggregate([
      {
        $group: {
          _id: null,
          usersCount: {
            $sum: { $cond: [{ $eq: ['$role', 'user'] }, 1, 0] },
          },
          guestsCount: {
            $sum: { $cond: [{ $eq: ['$role', 'guest'] }, 1, 0] },
          },
          activeUsersMonthly: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$planStatus', 'active'] },
                    { $eq: ['$planType', 'monthly'] },
                    { $eq: ['$role', 'user'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          activeUsersAnnual: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$planStatus', 'active'] },
                    { $eq: ['$planType', 'annual'] },
                    { $eq: ['$role', 'user'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          activeGuestsMonthly: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$planStatus', 'active'] },
                    { $eq: ['$planType', 'monthly'] },
                    { $eq: ['$role', 'guest'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          activeGuestsAnnual: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$planStatus', 'active'] },
                    { $eq: ['$planType', 'annual'] },
                    { $eq: ['$role', 'guest'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);
  const userMetrics = userMetricsAgg[0] || {
    usersCount: 0,
    guestsCount: 0,
    activeUsersMonthly: 0,
    activeUsersAnnual: 0,
    activeGuestsMonthly: 0,
    activeGuestsAnnual: 0,
  };

  const agencyMrr = activeAgencies * AGENCY_MONTHLY_PRICE;
  const creatorMrr =
    userMetrics.activeUsersMonthly * MONTHLY_PRICE +
    userMetrics.activeUsersAnnual * ANNUAL_MONTHLY_PRICE +
    userMetrics.activeGuestsMonthly * AGENCY_GUEST_MONTHLY_PRICE +
    userMetrics.activeGuestsAnnual * AGENCY_GUEST_ANNUAL_MONTHLY_PRICE;

  const payload = {
    activeAgencies,
    creators: { users: userMetrics.usersCount, guests: userMetrics.guestsCount },
    mrr: {
      agencies: agencyMrr,
      creators: creatorMrr,
      total: agencyMrr + creatorMrr,
    },
  };

  summaryCache = {
    payload,
    expiresAt: now + SUMMARY_CACHE_TTL_MS,
  };

  return NextResponse.json(payload);
}
