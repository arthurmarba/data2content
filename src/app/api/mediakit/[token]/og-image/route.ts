import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeMetaValue(raw?: string | null) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  return trimmed;
}

function pickAvailableIgAvatar(user: any) {
  if (!user?.availableIgAccounts || !Array.isArray(user.availableIgAccounts)) return null;
  for (const account of user.availableIgAccounts) {
    const candidate = normalizeMetaValue(account?.profile_picture_url ?? null);
    if (candidate) return candidate;
  }
  return null;
}

async function resolveAvatar(user: any) {
  const direct =
    normalizeMetaValue(user?.profile_picture_url) ||
    normalizeMetaValue(user?.image) ||
    normalizeMetaValue(user?.instagram?.profile_picture_url) ||
    normalizeMetaValue(user?.instagram?.profilePictureUrl) ||
    normalizeMetaValue(pickAvailableIgAvatar(user));

  if (direct) return direct;
  if (!user?._id) return null;

  const insight = await AccountInsightModel.findOne({
    user: user._id,
    'accountDetails.profile_picture_url': { $exists: true, $nin: [null, ''] },
  })
    .sort({ recordedAt: -1 })
    .select('accountDetails.profile_picture_url')
    .lean();

  return normalizeMetaValue(insight?.accountDetails?.profile_picture_url ?? null);
}

function toProxyUrl(raw?: string | null) {
  if (!raw) return null;
  if (raw.startsWith('/api/proxy/thumbnail/')) return raw;
  if (/^https?:\/\//i.test(raw)) {
    return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
  }
  return raw;
}

function toAbsoluteUrl(url: string, origin: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin}${url.startsWith('/') ? url : '/' + url}`;
}

function withStrictProxy(url: string) {
  if (!url.includes('/api/proxy/thumbnail/')) return url;
  return url.includes('?') ? `${url}&strict=1` : `${url}?strict=1`;
}

async function fetchImage(url: string) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = await res.arrayBuffer();
  return { body: new Uint8Array(buffer), contentType };
}

async function loadFallbackImage() {
  const fallbackPath = path.join(process.cwd(), 'public', 'images', 'default-profile.png');
  try {
    const buffer = await fs.promises.readFile(fallbackPath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new Response(null, { status: 404 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  await connectToDatabase();

  const user = await UserModel.findOne({ mediaKitSlug: params.token })
    .select('profile_picture_url image instagram availableIgAccounts.profile_picture_url')
    .lean();

  if (!user) {
    return loadFallbackImage();
  }

  const rawAvatar = await resolveAvatar(user);
  if (!rawAvatar) {
    return loadFallbackImage();
  }

  const proxied = toProxyUrl(rawAvatar);
  if (!proxied) {
    return loadFallbackImage();
  }

  const origin = req.nextUrl.origin;
  const avatarUrl = withStrictProxy(toAbsoluteUrl(proxied, origin));
  const fetched = await fetchImage(avatarUrl);
  if (!fetched) {
    return loadFallbackImage();
  }

  return new Response(fetched.body, {
    headers: {
      'Content-Type': fetched.contentType,
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
