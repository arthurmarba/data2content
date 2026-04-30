import { NextRequest } from 'next/server';

import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';
import { fetchBasicAccountData } from '@/app/lib/instagram/api/fetchers';
import { refreshLongLivedUserAccessToken } from '@/app/lib/instagram/api/auth';
import { logger } from '@/app/lib/logger';
import { resolveMediaKitToken } from '@/app/lib/mediakit/slugService';

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
  const prefersProviderFallback = !user?.isInstagramConnected || !user?.instagramAccountId;
  const direct =
    (prefersProviderFallback
      ? normalizeAvatarCandidate(user?.providerImage ?? null) ||
        normalizeAvatarCandidate(user?.image ?? null) ||
        normalizeAvatarCandidate(user?.profile_picture_url ?? null) ||
        normalizeAvatarCandidate(user?.instagram?.profile_picture_url ?? null) ||
        normalizeAvatarCandidate(user?.instagram?.profilePictureUrl ?? null) ||
        normalizeAvatarCandidate(pickAvailableIgAvatar(user))
      : normalizeAvatarCandidate(pickAvailableIgAvatar(user)) ||
        normalizeAvatarCandidate(user?.profile_picture_url ?? null) ||
        normalizeAvatarCandidate(user?.image ?? null) ||
        normalizeAvatarCandidate(user?.providerImage ?? null) ||
        normalizeAvatarCandidate(user?.instagram?.profile_picture_url ?? null) ||
        normalizeAvatarCandidate(user?.instagram?.profilePictureUrl ?? null));

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

function isLikelyInstagramCdnUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('cdninstagram.com') || host.includes('fbcdn.net');
  } catch {
    return false;
  }
}

function buildFallbackAvatarSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="Avatar">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#f4f4f5"/>
      <stop offset="100%" stop-color="#e4e4e7"/>
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="128" fill="url(#g)"/>
  <circle cx="128" cy="102" r="42" fill="#d4d4d8"/>
  <path d="M56 214c10-44 38-68 72-68s62 24 72 68" fill="#d4d4d8"/>
</svg>`;
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
      $set: { profile_picture_url: nextUrl },
    }).exec();
  } catch (error) {
    logger.warn('[mediakit-avatar] Failed to update user avatar from IG.', error);
  }

  return nextUrl;
}

async function refreshInstagramTokenIfNeeded(user: any) {
  const accessToken = user?.instagramAccessToken;
  if (!user?._id || !accessToken) return user;

  const expiresAt = user?.instagramAccessTokenExpiresAt
    ? new Date(user.instagramAccessTokenExpiresAt)
    : null;
  const thresholdMs = 10 * 24 * 60 * 60 * 1000;
  const shouldRefresh = !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() - Date.now() < thresholdMs;
  if (!shouldRefresh) return user;

  const refreshed = await refreshLongLivedUserAccessToken(accessToken);
  if (!refreshed.success || !refreshed.accessToken) {
    logger.warn('[mediakit-avatar] Silent Instagram token refresh failed. Falling back to stored/provider avatar.', {
      userId: String(user._id),
      error: refreshed.error,
    });
    return user;
  }

  try {
    await UserModel.findByIdAndUpdate(user._id, {
      $set: {
        instagramAccessToken: refreshed.accessToken,
        instagramAccessTokenExpiresAt: refreshed.expiresAt ?? null,
      },
    }).exec();
  } catch (error) {
    logger.warn('[mediakit-avatar] Failed to persist refreshed Instagram token.', error);
  }

  return {
    ...user,
    instagramAccessToken: refreshed.accessToken,
    instagramAccessTokenExpiresAt: refreshed.expiresAt ?? user.instagramAccessTokenExpiresAt,
  };
}

function pushCandidate(
  candidates: Array<{ label: string; url: string }>,
  seen: Set<string>,
  label: string,
  raw?: string | null,
  options?: { allowInstagramCdn?: boolean },
) {
  const candidate = normalizeAvatarCandidate(raw);
  if (!candidate || seen.has(candidate)) return;
  if (options?.allowInstagramCdn === false && isLikelyInstagramCdnUrl(candidate)) return;
  seen.add(candidate);
  candidates.push({ label, url: candidate });
}

async function buildAvatarCandidates(user: any) {
  const candidates: Array<{ label: string; url: string }> = [];
  const seen = new Set<string>();

  const refreshedGraphAvatar =
    user?.instagramAccountId && user?.instagramAccessToken
      ? await refreshAvatarFromGraph(user)
      : null;

  if (user?.isInstagramConnected || user?.instagramAccountId) {
    pushCandidate(candidates, seen, 'graph-basic', refreshedGraphAvatar, { allowInstagramCdn: true });
    pushCandidate(candidates, seen, 'provider-image', user?.providerImage, { allowInstagramCdn: false });
    pushCandidate(candidates, seen, 'account-image', user?.image, { allowInstagramCdn: false });
    pushCandidate(candidates, seen, 'available-ig-account', pickAvailableIgAvatar(user), { allowInstagramCdn: false });
    pushCandidate(candidates, seen, 'stored-instagram', user?.profile_picture_url, { allowInstagramCdn: false });
  } else {
    pushCandidate(candidates, seen, 'provider-image', user?.providerImage, { allowInstagramCdn: false });
    pushCandidate(candidates, seen, 'account-image', user?.image, { allowInstagramCdn: false });
    pushCandidate(candidates, seen, 'stored-instagram', user?.profile_picture_url, { allowInstagramCdn: false });
    pushCandidate(candidates, seen, 'available-ig-account', pickAvailableIgAvatar(user), { allowInstagramCdn: false });
  }

  const insightAvatar = await resolveAvatarCandidate({
    ...user,
    profile_picture_url: null,
    image: null,
    providerImage: null,
    availableIgAccounts: null,
  });
  pushCandidate(candidates, seen, 'account-insight', insightAvatar, { allowInstagramCdn: false });
  pushCandidate(candidates, seen, 'legacy-account-image', user?.image, { allowInstagramCdn: true });
  pushCandidate(candidates, seen, 'legacy-stored-instagram', user?.profile_picture_url, { allowInstagramCdn: true });
  pushCandidate(candidates, seen, 'legacy-available-ig-account', pickAvailableIgAvatar(user), { allowInstagramCdn: true });
  pushCandidate(candidates, seen, 'legacy-account-insight', insightAvatar, { allowInstagramCdn: true });

  return candidates;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  await connectToDatabase();

  const resolvedToken = await resolveMediaKitToken(params.token);
  if (!resolvedToken?.userId) {
    return new Response(null, { status: 404 });
  }

  const user = await UserModel.findById(resolvedToken.userId)
    .select(
      'name profile_picture_url image providerImage instagram isInstagramConnected availableIgAccounts.igAccountId availableIgAccounts.profile_picture_url instagramAccountId instagramAccessToken instagramAccessTokenExpiresAt'
    )
    .lean();

  if (!user) {
    return new Response(null, { status: 404 });
  }

  const origin = req.nextUrl.origin;
  const tokenRefreshedUser = await refreshInstagramTokenIfNeeded(user);
  const candidates = await buildAvatarCandidates(tokenRefreshedUser);

  for (const candidate of candidates) {
    const candidateUrl = toAbsoluteUrl(candidate.url, origin);
    const fetched = await tryFetchImage(candidateUrl, candidate.label);
    if (!fetched) continue;

    logger.info('[mediakit-avatar] Serving avatar image.', {
      source: candidate.label,
      url: describeUrlForLog(candidateUrl),
    });

    return new Response(fetched.body, {
      status: 200,
      headers: {
        'Content-Type': fetched.contentType,
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  }

  return new Response(buildFallbackAvatarSvg(), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
