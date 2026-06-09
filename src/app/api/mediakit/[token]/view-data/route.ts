import { NextRequest, NextResponse } from 'next/server';

import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import PubliCalculation from '@/app/models/PubliCalculation';
import MediaKitPackageModel from '@/app/models/MediaKitPackage';
import AccountInsightModel from '@/app/models/AccountInsight';
import { resolveMediaKitToken } from '@/app/lib/mediakit/slugService';
import { isPlanActiveLike } from '@/utils/planStatus';
import { canonicalizeCategoryValues, type CategoryType } from '@/app/lib/classification';
import { canonicalizeV2CategoryValues } from '@/app/lib/classificationV2';
import { canonicalizeV25CategoryValues } from '@/app/lib/classificationV2_5';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';

// Sensitive fields stripped before returning user object publicly.
const STRIP_USER_FIELDS = new Set([
  'instagramAccessToken',
  'instagramRefreshToken',
  'password',
  'hashedPassword',
  '__v',
]);

function stripSensitiveUserFields(user: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(user)) {
    if (!STRIP_USER_FIELDS.has(k)) out[k] = v;
  }
  return out;
}

function normalizeProfileCandidate(raw?: string | null) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  return trimmed;
}

function logFail(resource: string, detail: string) {
  logger.warn(`[mediakit/view-data] Falha ao buscar ${resource}: ${detail}`);
}

async function fetchSummary(baseUrl: string, userId: string) {
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/users/${userId}/highlights/performance-summary`,
      { cache: 'no-store' },
    );
    if (!res.ok) { logFail('summary', String(res.status)); return null; }
    return await res.json();
  } catch (e) { logFail('summary', String(e)); return null; }
}

async function fetchTopPosts(baseUrl: string, userId: string) {
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/users/${userId}/videos/list?sortBy=views&limit=10`,
      { cache: 'no-store' },
    );
    if (!res.ok) { logFail('top posts', String(res.status)); return []; }
    const data = await res.json();
    return data.posts || [];
  } catch (e) { logFail('top posts', String(e)); return []; }
}

async function fetchKpis(baseUrl: string, userId: string) {
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/users/${userId}/kpis/periodic-comparison?comparisonPeriod=last_30d_vs_previous_30d`,
      { cache: 'no-store' },
    );
    if (!res.ok) { logFail('kpis', String(res.status)); return null; }
    return await res.json();
  } catch (e) { logFail('kpis', String(e)); return null; }
}

async function fetchDemographics(baseUrl: string, userId: string) {
  try {
    const res = await fetch(`${baseUrl}/api/demographics/${userId}`, { cache: 'no-store' });
    if (!res.ok) { logFail('demographics', String(res.status)); return null; }
    return await res.json();
  } catch (e) { logFail('demographics', String(e)); return null; }
}

async function fetchEngagementTrend(baseUrl: string, userId: string) {
  try {
    const res = await fetch(
      `${baseUrl}/api/v1/users/${userId}/trends/reach-engagement?timePeriod=last_30_days&granularity=daily`,
      { cache: 'no-store' },
    );
    if (!res.ok) { logFail('engagement trend', String(res.status)); return null; }
    return await res.json();
  } catch (e) { logFail('engagement trend', String(e)); return null; }
}

function normalizeCategoryField(
  value: unknown,
  type: CategoryType | 'contentIntent' | 'narrativeForm' | 'contentSignals' | 'stance' | 'proofStyle' | 'commercialMode',
): string[] {
  if (type === 'contentIntent') return canonicalizeV2CategoryValues(value, 'contentIntent', { includeUnknown: true });
  if (type === 'narrativeForm') return canonicalizeV2CategoryValues(value, 'narrativeForm', { includeUnknown: true });
  if (type === 'contentSignals') return canonicalizeV2CategoryValues(value, 'contentSignal', { includeUnknown: true });
  if (type === 'stance') return canonicalizeV25CategoryValues(value, 'stance', { includeUnknown: true });
  if (type === 'proofStyle') return canonicalizeV25CategoryValues(value, 'proofStyle', { includeUnknown: true });
  if (type === 'commercialMode') return canonicalizeV25CategoryValues(value, 'commercialMode', { includeUnknown: true });
  return canonicalizeCategoryValues(value, type, { includeUnknown: true });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } },
) {
  try {
    await connectToDatabase();

    const resolvedToken = await resolveMediaKitToken(params.token);
    if (!resolvedToken) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const user = await UserModel.findById(resolvedToken.userId).lean();
    if (!user) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Best-effort: try to get fresh avatar from the latest insight snapshot (no external API call).
    const latestInsight = await AccountInsightModel.findOne({
      user: (user as any)._id,
      'accountDetails.profile_picture_url': { $exists: true, $nin: [null, ''] },
    })
      .sort({ recordedAt: -1 })
      .select('accountDetails.profile_picture_url')
      .lean();
    const insightAvatar = normalizeProfileCandidate(
      latestInsight?.accountDetails?.profile_picture_url ?? null,
    );

    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host') || 'localhost:3000';
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
    const userId = (user as any)._id.toString();

    let [summary, videos, kpis, demographics, engagementTrend, latestCalculation, packages] =
      await Promise.all([
        fetchSummary(baseUrl, userId),
        fetchTopPosts(baseUrl, userId),
        fetchKpis(baseUrl, userId),
        fetchDemographics(baseUrl, userId),
        fetchEngagementTrend(baseUrl, userId),
        PubliCalculation.findOne({ userId: (user as any)._id }).sort({ createdAt: -1 }).lean().exec(),
        MediaKitPackageModel.find({ userId: (user as any)._id })
          .sort({ order: 1, createdAt: 1 })
          .lean()
          .exec(),
      ]);

    let compatibleVideos = (videos || []).map((video: any) => ({
      ...video,
      format: normalizeCategoryField(video.format, 'format'),
      proposal: normalizeCategoryField(video.proposal, 'proposal'),
      context: normalizeCategoryField(video.context, 'context'),
      tone: normalizeCategoryField(video.tone, 'tone'),
      references: normalizeCategoryField(video.references, 'reference'),
      contentIntent: normalizeCategoryField(video.contentIntent, 'contentIntent'),
      narrativeForm: normalizeCategoryField(video.narrativeForm, 'narrativeForm'),
      contentSignals: normalizeCategoryField(video.contentSignals, 'contentSignals'),
      stance: normalizeCategoryField(video.stance, 'stance'),
      proofStyle: normalizeCategoryField(video.proofStyle, 'proofStyle'),
      commercialMode: normalizeCategoryField(video.commercialMode, 'commercialMode'),
    }));

    const plainUser = stripSensitiveUserFields(JSON.parse(JSON.stringify(user)));

    // Avatar fallback chain (no external API call; avoids the slow resolveFreshInstagramAvatar).
    const prefersProviderFallback =
      !((plainUser as any)?.isInstagramConnected || (plainUser as any)?.instagramAccountId);
    const hasAvatarCandidate = prefersProviderFallback
      ? normalizeProfileCandidate((plainUser as any)?.providerImage) ||
        normalizeProfileCandidate((plainUser as any)?.image) ||
        normalizeProfileCandidate((plainUser as any)?.profile_picture_url)
      : normalizeProfileCandidate((plainUser as any)?.profile_picture_url) ||
        normalizeProfileCandidate((plainUser as any)?.image) ||
        normalizeProfileCandidate((plainUser as any)?.providerImage);
    if (!hasAvatarCandidate && insightAvatar) {
      (plainUser as any).profile_picture_url = insightAvatar;
    }

    const displayName = (plainUser as any)?.mediaKitDisplayName || (plainUser as any)?.name || null;
    if (displayName) (plainUser as any).name = displayName;
    if (
      typeof (plainUser as any).followersCount !== 'number' &&
      typeof (plainUser as any).followers_count === 'number'
    ) {
      (plainUser as any).followersCount = (plainUser as any).followers_count;
    }

    const planStatus = (plainUser as any)?.planStatus ?? null;
    const ownerHasPremiumAccess = isPlanActiveLike(planStatus);

    let premiumAccessConfig: { canViewCategories: boolean; visibilityMode?: string } | undefined;
    if (!ownerHasPremiumAccess) {
      summary = null;
      compatibleVideos = compatibleVideos.map((video: any) => ({
        ...video,
        format: [], proposal: [], context: [], tone: [], references: [],
        contentIntent: [], narrativeForm: [], contentSignals: [],
        stance: [], proofStyle: [], commercialMode: [],
      }));
      premiumAccessConfig = { canViewCategories: false, visibilityMode: 'hide' };
    }

    const pricingPublished = Boolean((plainUser as any)?.mediaKitPricingPublished);
    const pricing = latestCalculation
      ? {
          estrategico: typeof latestCalculation?.result?.estrategico === 'number' ? latestCalculation.result.estrategico : 0,
          justo: typeof latestCalculation?.result?.justo === 'number' ? latestCalculation.result.justo : 0,
          premium: typeof latestCalculation?.result?.premium === 'number' ? latestCalculation.result.premium : 0,
          cpm: typeof latestCalculation?.cpmApplied === 'number' ? latestCalculation.cpmApplied : null,
          reach: typeof latestCalculation?.metrics?.reach === 'number' ? latestCalculation.metrics.reach : null,
          engagement: typeof latestCalculation?.metrics?.engagement === 'number' ? latestCalculation.metrics.engagement : null,
          calculationId: latestCalculation?._id?.toString?.() ?? null,
          createdAt: latestCalculation?.createdAt ? new Date(latestCalculation.createdAt).toISOString() : null,
        }
      : null;

    const normalizedPackages = Array.isArray(packages)
      ? packages.map((pkg: any) => ({
          ...pkg,
          _id: pkg?._id?.toString?.() ?? pkg?._id,
          id: pkg?._id?.toString?.() ?? pkg?.id,
          deliverables: Array.isArray(pkg?.deliverables) ? pkg.deliverables : [],
          price: typeof pkg?.price === 'number' ? pkg.price : 0,
          currency: pkg?.currency || 'BRL',
          createdAt: pkg?.createdAt ? new Date(pkg.createdAt).toISOString() : undefined,
          updatedAt: pkg?.updatedAt ? new Date(pkg.updatedAt).toISOString() : undefined,
        }))
      : [];

    const payload = {
      user: plainUser,
      summary,
      videos: compatibleVideos,
      kpis,
      demographics,
      engagementTrend,
      pricing: pricingPublished ? pricing : null,
      pricingPublished,
      packages: normalizedPackages,
      mediaKitSlug: resolvedToken.canonicalSlug,
      premiumAccess: premiumAccessConfig,
    };

    return NextResponse.json(payload, {
      headers: {
        // Cache 5 min at CDN/edge; serve stale up to 10 min while revalidating.
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    logger.error(`[mediakit/view-data] Erro inesperado: ${err}`);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
