import crypto from 'crypto';
import { Types } from 'mongoose';

import UserModel from '@/app/models/User';
import MediaKitSlugAlias from '@/app/models/MediaKitSlugAlias';
import slugify from '@/utils/slugify';

type ResolveMediaKitTokenResult = {
  userId: string;
  canonicalSlug: string;
  matchedByAlias: boolean;
};

const MAX_BASE_SLUG_LENGTH = 70;

function normalizeSlug(raw?: string | null) {
  if (typeof raw !== 'string') return '';
  return slugify(raw).trim().toLowerCase();
}

function shortUserSuffix(userId: string) {
  const compact = userId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return compact.slice(-4) || '0000';
}

export function buildMediaKitSlugBase(name: string, fallback: string): string {
  const fromName = normalizeSlug(name);
  if (fromName) return fromName.slice(0, MAX_BASE_SLUG_LENGTH);

  const fromFallback = normalizeSlug(fallback);
  if (fromFallback) return fromFallback.slice(0, MAX_BASE_SLUG_LENGTH);

  return 'usuario';
}

export function buildMediaKitPublicUrl(origin: string, slug: string): string {
  const cleanOrigin = (origin || '').trim().replace(/\/+$/, '');
  const safeSlug = normalizeSlug(slug);
  return `${cleanOrigin}/mediakit/${safeSlug}`;
}

export async function ensureUniqueMediaKitSlug(base: string, userId: string): Promise<string> {
  const fallback = `usuario-${shortUserSuffix(userId)}`;
  const normalizedBase = buildMediaKitSlugBase(base, fallback);

  let candidate = normalizedBase;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const [existingUser, existingAlias] = await Promise.all([
      UserModel.findOne({ mediaKitSlug: candidate }).select('_id').lean(),
      MediaKitSlugAlias.findOne({ slug: candidate }).select('_id').lean(),
    ]);

    const takenByAnotherUser = Boolean(existingUser && String(existingUser._id) !== String(userId));
    const takenByAlias = Boolean(existingAlias);
    if (!takenByAnotherUser && !takenByAlias) {
      return candidate;
    }

    const suffix = crypto.randomBytes(2).toString('hex');
    candidate = `${normalizedBase}-${suffix}`;
  }

  throw new Error('Não foi possível gerar um slug único para o mídia kit.');
}

export async function resolveMediaKitToken(token: string): Promise<ResolveMediaKitTokenResult | null> {
  const normalizedToken = normalizeSlug(token);
  if (!normalizedToken) return null;

  const user = await UserModel.findOne({ mediaKitSlug: normalizedToken })
    .select('_id mediaKitSlug')
    .lean();
  if (user?._id && user.mediaKitSlug) {
    return {
      userId: String(user._id),
      canonicalSlug: String(user.mediaKitSlug),
      matchedByAlias: false,
    };
  }

  const alias = await MediaKitSlugAlias.findOne({ slug: normalizedToken })
    .select('user canonicalSlug')
    .lean();
  if (!alias?.user) return null;

  const userByAlias = await UserModel.findById(alias.user)
    .select('_id mediaKitSlug')
    .lean();
  if (!userByAlias?._id || !userByAlias.mediaKitSlug) return null;

  const canonicalSlug = String(userByAlias.mediaKitSlug);
  return {
    userId: String(userByAlias._id),
    canonicalSlug,
    matchedByAlias: normalizedToken !== canonicalSlug,
  };
}

export async function updateMediaKitSlugWithAlias(options: {
  userId: string | Types.ObjectId;
  previousSlug?: string | null;
  nextSlug: string;
}) {
  const userId = String(options.userId);
  const previousSlug = normalizeSlug(options.previousSlug ?? '');
  const nextSlug = normalizeSlug(options.nextSlug);

  if (!nextSlug) {
    throw new Error('Slug canônico inválido.');
  }

  await MediaKitSlugAlias.updateMany(
    { user: options.userId },
    { $set: { canonicalSlug: nextSlug } },
  ).exec();

  if (previousSlug && previousSlug !== nextSlug) {
    await MediaKitSlugAlias.findOneAndUpdate(
      { slug: previousSlug },
      {
        slug: previousSlug,
        user: new Types.ObjectId(userId),
        canonicalSlug: nextSlug,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).exec();
  }
}
