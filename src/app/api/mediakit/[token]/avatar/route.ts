import { NextRequest } from 'next/server';

import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';
import { fetchBasicAccountData } from '@/app/lib/instagram/api/fetchers';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeAvatarCandidate(raw?: string | null) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  if (trimmed.toLowerCase().includes('default-profile.png')) return null;
  return trimmed;
}

function pickAvailableIgAvatar(user: any) {
  const accounts = user?.availableIgAccounts;
  if (!Array.isArray(accounts)) return null;

  const accountId = user?.instagramAccountId;
  const match = accountId ? accounts.find((account) => account?.igAccountId === accountId) : null;
  const matchCandidate = normalizeAvatarCandidate(match?.profile_picture_url ?? null);
  if (matchCandidate) return matchCandidate;

  for (const account of accounts) {
    const candidate = normalizeAvatarCandidate(account?.profile_picture_url ?? null);
    if (candidate) return candidate;
  }
  return null;
}

async function resolveAvatarCandidate(user: any) {
  const direct =
    normalizeAvatarCandidate(pickAvailableIgAvatar(user)) ||
    normalizeAvatarCandidate(user?.profile_picture_url ?? null) ||
    normalizeAvatarCandidate(user?.image ?? null) ||
    normalizeAvatarCandidate(user?.instagram?.profile_picture_url ?? null) ||
    normalizeAvatarCandidate(user?.instagram?.profilePictureUrl ?? null);

  if (direct) return direct;

  if (!user?._id) return null;
  const insight = await AccountInsightModel.findOne({
    user: user._id,
    'accountDetails.profile_picture_url': { $exists: true, $nin: [null, ''] },
  })
    .sort({ recordedAt: -1 })
    .select('accountDetails.profile_picture_url')
    .lean();

  return normalizeAvatarCandidate(insight?.accountDetails?.profile_picture_url ?? null);
}

function toAbsoluteUrl(url: string, origin: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
}

function toProxyUrl(url: string) {
  if (!/^https?:\/\//i.test(url)) return url;
  return `/api/proxy/thumbnail/${encodeURIComponent(url)}?strict=1`;
}

const IG_FETCH_HEADERS = {
  referer: 'https://www.instagram.com/',
  origin: 'https://www.instagram.com',
  'accept-language': 'en-US,en;q=0.9,pt-BR;q=0.8',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
  accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
  'cache-control': 'no-cache',
  pragma: 'no-cache',
};

function describeUrlForLog(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return 'invalid-url';
  }
}

async function fetchImage(url: string, headers?: HeadersInit) {
  const res = await fetch(url, {
    headers,
    redirect: 'follow',
    cache: 'no-store',
  });
  if (!res.ok) {
    return { ok: false as const, status: res.status };
  }
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = await res.arrayBuffer();
  return { ok: true as const, body: new Uint8Array(buffer), contentType };
}

async function tryFetchImage(url: string, label: string) {
  const withHeaders = await fetchImage(url, IG_FETCH_HEADERS);
  if (withHeaders.ok) return withHeaders;
  logger.warn('[mediakit-avatar] Image fetch failed with IG headers.', {
    label,
    status: withHeaders.status,
    url: describeUrlForLog(url),
  });

  const withoutHeaders = await fetchImage(url);
  if (withoutHeaders.ok) return withoutHeaders;
  logger.warn('[mediakit-avatar] Image fetch failed without headers.', {
    label,
    status: withoutHeaders.status,
    url: describeUrlForLog(url),
  });
  return null;
}

async function refreshAvatarFromGraph(user: any) {
  const accountId = user?.instagramAccountId;
  const accessToken = user?.instagramAccessToken;
  if (!accountId || !accessToken) return null;

  const result = await fetchBasicAccountData(accountId, accessToken);
  if (!result?.success || !result?.data?.profile_picture_url) return null;
  const nextUrl = normalizeAvatarCandidate(result.data.profile_picture_url);
  if (!nextUrl) return null;

  try {
    await UserModel.findByIdAndUpdate(user._id, {
      $set: { profile_picture_url: nextUrl, image: nextUrl },
    }).exec();
  } catch (error) {
    logger.warn('[mediakit-avatar] Failed to update user avatar from IG.', error);
  }

  return nextUrl;
}

function buildGraphAvatarUrl(accountId: string, accessToken: string) {
  const version = 'v22.0';
  return `https://graph.facebook.com/${version}/${accountId}/picture?type=large&access_token=${encodeURIComponent(accessToken)}`;
}

async function fetchGraphPictureUrl(accountId: string, accessToken: string) {
  const version = 'v22.0';
  const url = `https://graph.facebook.com/${version}/${accountId}/picture?type=large&redirect=false&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    logger.warn('[mediakit-avatar] Graph picture metadata fetch failed.', {
      status: res.status,
    });
    return null;
  }
  const data = await res.json();
  const pictureUrl = normalizeAvatarCandidate(data?.data?.url ?? null);
  if (!pictureUrl) return null;
  return pictureUrl;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  await connectToDatabase();

  const user = await UserModel.findOne({ mediaKitSlug: params.token })
    .select(
      'profile_picture_url image instagram availableIgAccounts.profile_picture_url instagramAccountId instagramAccessToken'
    )
    .lean();

  if (!user) {
    return new Response(null, { status: 404 });
  }

  const origin = req.nextUrl.origin;
  const accountId = user?.instagramAccountId;
  const accessToken = user?.instagramAccessToken;

  if (accountId && accessToken) {
    const refreshed = await refreshAvatarFromGraph(user);
    if (refreshed) {
      const refreshedUrl = toAbsoluteUrl(refreshed, origin);
      const proxyUrl = toProxyUrl(refreshedUrl);
      logger.info('[mediakit-avatar] Redirecting to refreshed avatar URL.', {
        source: 'graph-basic',
        url: proxyUrl,
      });
      return new Response(null, {
        status: 302,
        headers: {
          Location: proxyUrl,
          'Cache-Control': 'no-store',
        },
      });
    }
  }

  const candidate = await resolveAvatarCandidate(user);
  if (candidate) {
    const candidateUrl = toAbsoluteUrl(candidate, origin);
    const proxyUrl = toProxyUrl(candidateUrl);
    logger.info('[mediakit-avatar] Redirecting to stored avatar URL.', {
      source: 'db',
      url: proxyUrl,
    });
    return new Response(null, {
      status: 302,
      headers: {
        Location: proxyUrl,
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response(null, { status: 404 });
}
