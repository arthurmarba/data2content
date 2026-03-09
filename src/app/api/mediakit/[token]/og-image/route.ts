import React from 'react';
import { NextRequest } from 'next/server';
import { ImageResponse } from '@vercel/og';

import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';
import { resolveMediaKitToken } from '@/app/lib/mediakit/slugService';
import {
  buildMediaKitMetaDescription,
  formatCompactCount,
  formatIntegerCount,
  normalizePreviewUsername,
  toNonNegativeInt,
} from '@/app/lib/mediakit/socialPreview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const OG_CACHE_CONTROL = 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400';

function sanitizeOgText(raw: unknown, fallback = '') {
  if (typeof raw !== 'string') return fallback;
  const normalized = raw
    .replace(/\uFFFD/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function normalizeMetaValue(raw?: string | null) {
  if (typeof raw !== 'string') return null;
  const trimmed = sanitizeOgText(raw);
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
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`;
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

function toDataUri(body: Uint8Array, contentType: string) {
  return `data:${contentType};base64,${Buffer.from(body).toString('base64')}`;
}

function initialsFrom(displayName: string, username?: string | null) {
  const source = sanitizeOgText(displayName || username || 'MK', 'MK');
  const parts = source
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const initials = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
  return initials || 'MK';
}

function createOgImageResponse(options: {
  displayName: string;
  username?: string | null;
  followersCount?: number | null;
  mediaCount?: number | null;
  description?: string | null;
  avatarDataUri?: string | null;
}) {
  const displayName = sanitizeOgText(options.displayName, 'Criador');
  const normalizedUsername = normalizePreviewUsername(sanitizeOgText(options.username ?? null, '')) || null;
  const description = sanitizeOgText(options.description, `Mídia Kit oficial de ${displayName}`);
  const followersLabel = options.followersCount !== null && options.followersCount !== undefined
    ? `${formatCompactCount(options.followersCount)} seguidores`
    : 'Seguidores em atualização';
  const mediaLabel = options.mediaCount !== null && options.mediaCount !== undefined
    ? `${formatIntegerCount(options.mediaCount)} publicações`
    : 'Publicações em atualização';
  const initials = initialsFrom(displayName, normalizedUsername);

  const card = React.createElement(
    'div',
    {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(135deg, #0f172a 0%, #111827 50%, #1f2937 100%)',
        color: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        padding: '52px',
      },
    },
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: '-110px',
        right: '-120px',
        width: '420px',
        height: '420px',
        borderRadius: '9999px',
        background: 'rgba(56, 189, 248, 0.16)',
      },
    }),
    React.createElement('div', {
      style: {
        position: 'absolute',
        bottom: '-140px',
        left: '-70px',
        width: '360px',
        height: '360px',
        borderRadius: '9999px',
        background: 'rgba(16, 185, 129, 0.18)',
      },
    }),
    React.createElement(
      'div',
      {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '40px',
          borderRadius: '28px',
          border: '1px solid rgba(148, 163, 184, 0.4)',
          background: 'rgba(15, 23, 42, 0.62)',
          padding: '34px 38px',
        },
      },
      React.createElement(
        'div',
        {
          style: {
            width: '190px',
            height: '190px',
            borderRadius: '9999px',
            border: '4px solid rgba(148, 163, 184, 0.7)',
            overflow: 'hidden',
            background: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f8fafc',
            fontSize: '62px',
            fontWeight: 700,
            flexShrink: 0,
          },
        },
        options.avatarDataUri
          ? React.createElement('img', {
              src: options.avatarDataUri,
              alt: `Avatar de ${displayName}`,
              width: 190,
              height: 190,
              style: { width: '100%', height: '100%', objectFit: 'cover' },
            })
          : initials,
      ),
      React.createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '14px',
            width: '100%',
          },
        },
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              alignSelf: 'flex-start',
              borderRadius: '9999px',
              border: '1px solid rgba(56, 189, 248, 0.55)',
              background: 'rgba(14, 116, 144, 0.28)',
              color: '#bae6fd',
              padding: '8px 14px',
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '0.08em',
            },
          },
          'MÍDIA KIT DATA2CONTENT',
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexWrap: 'wrap',
            },
          },
          React.createElement(
            'span',
            {
              style: {
                fontSize: '52px',
                lineHeight: 1.05,
                fontWeight: 800,
                color: '#f8fafc',
              },
            },
            displayName,
          ),
          normalizedUsername
            ? React.createElement(
                'span',
                {
                  style: {
                    fontSize: '32px',
                    fontWeight: 700,
                    color: '#cbd5e1',
                  },
                },
                `@${normalizedUsername}`,
              )
            : null,
        ),
        React.createElement(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            },
          },
          React.createElement(
            'span',
            {
              style: {
                borderRadius: '9999px',
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(148, 163, 184, 0.45)',
                color: '#e2e8f0',
                fontSize: '28px',
                fontWeight: 600,
                padding: '8px 14px',
              },
            },
            followersLabel,
          ),
          React.createElement(
            'span',
            {
              style: {
                borderRadius: '9999px',
                background: 'rgba(30, 41, 59, 0.85)',
                border: '1px solid rgba(148, 163, 184, 0.45)',
                color: '#e2e8f0',
                fontSize: '28px',
                fontWeight: 600,
                padding: '8px 14px',
              },
            },
            mediaLabel,
          ),
        ),
        React.createElement(
          'span',
          {
            style: {
              color: '#cbd5e1',
              fontSize: '26px',
              lineHeight: 1.25,
              maxWidth: '760px',
            },
          },
          description,
        ),
        React.createElement(
          'span',
          {
            style: {
              marginTop: '4px',
              color: '#7dd3fc',
              fontSize: '24px',
              fontWeight: 700,
            },
          },
          'data2content.ai',
        ),
      ),
    ),
  );

  return new ImageResponse(card, {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    headers: {
      'Cache-Control': OG_CACHE_CONTROL,
    },
  });
}

async function resolveAvatarDataUri(user: any, origin: string) {
  const rawAvatar = await resolveAvatar(user);
  if (!rawAvatar) return null;

  const proxied = toProxyUrl(rawAvatar);
  if (!proxied) return null;

  const avatarUrl = withStrictProxy(toAbsoluteUrl(proxied, origin));
  const fetched = await fetchImage(avatarUrl);
  if (!fetched) return null;

  return toDataUri(fetched.body, fetched.contentType);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } },
) {
  await connectToDatabase();

  const fallbackResponse = createOgImageResponse({
    displayName: 'Criador Data2Content',
    description: 'Mídia Kit oficial com métricas e publicações de destaque.',
    followersCount: null,
    mediaCount: null,
  });

  const resolvedToken = await resolveMediaKitToken(params.token);
  if (!resolvedToken?.userId) {
    return fallbackResponse;
  }

  const user = await UserModel.findById(resolvedToken.userId)
    .select(
      'name mediaKitDisplayName username biography followers_count media_count profile_picture_url image instagram availableIgAccounts.profile_picture_url',
    )
    .lean();

  if (!user) {
    return fallbackResponse;
  }

  const displayName = sanitizeOgText((user as any)?.mediaKitDisplayName || (user as any)?.name || 'Criador', 'Criador');
  const username = normalizePreviewUsername(sanitizeOgText((user as any)?.username ?? null, '')) || null;
  const followersCount = toNonNegativeInt((user as any)?.followers_count);
  const mediaCount = toNonNegativeInt((user as any)?.media_count);
  const description = sanitizeOgText(buildMediaKitMetaDescription({
    displayName,
    username,
    followersCount,
    mediaCount,
    biography: (user as any)?.biography,
  }));

  const avatarDataUri = await resolveAvatarDataUri(user, req.nextUrl.origin);

  return createOgImageResponse({
    displayName,
    username,
    followersCount,
    mediaCount,
    description,
    avatarDataUri,
  });
}
