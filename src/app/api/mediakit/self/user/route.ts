import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import AccountInsightModel from '@/app/models/AccountInsight';

export const runtime = 'nodejs';

function normalizeAvatarCandidate(raw?: string | null) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
  return trimmed;
}

function pickAvailableIgAvatar(doc: any) {
  const accounts = doc?.availableIgAccounts;
  if (!Array.isArray(accounts)) return null;

  const accountId = doc?.instagramAccountId;
  const match = accountId ? accounts.find((account) => account?.igAccountId === accountId) : null;
  const matchCandidate = normalizeAvatarCandidate(match?.profile_picture_url ?? null);
  if (matchCandidate) return matchCandidate;

  for (const account of accounts) {
    const candidate = normalizeAvatarCandidate(account?.profile_picture_url ?? null);
    if (candidate) return candidate;
  }
  return null;
}

function resolveAvatarFromDoc(doc: any) {
  const instagram = doc?.instagram || {};
  return (
    normalizeAvatarCandidate(doc?.profile_picture_url ?? null) ||
    normalizeAvatarCandidate(doc?.image ?? null) ||
    normalizeAvatarCandidate(instagram.profile_picture_url ?? null) ||
    normalizeAvatarCandidate(instagram.profilePictureUrl ?? null) ||
    pickAvailableIgAvatar(doc)
  );
}

async function resolveAvatar(doc: any) {
  const direct = resolveAvatarFromDoc(doc);
  if (direct) return direct;
  if (!doc?._id) return null;

  const insight = await AccountInsightModel.findOne({
    user: doc._id,
    'accountDetails.profile_picture_url': { $exists: true, $nin: [null, ''] },
  })
    .sort({ recordedAt: -1 })
    .select('accountDetails.profile_picture_url')
    .lean();

  return normalizeAvatarCandidate(insight?.accountDetails?.profile_picture_url ?? null);
}

function serializeUser(doc: any, resolvedAvatar?: string | null) {
  if (!doc) return null;
  const instagram = doc.instagram || {};
  const resolvedFollowers =
    typeof doc.followers_count === 'number'
      ? doc.followers_count
      : typeof instagram.followers_count === 'number'
        ? instagram.followers_count
        : typeof instagram.followersCount === 'number'
          ? instagram.followersCount
          : null;

  return {
    _id: doc._id?.toString?.() || doc._id,
    name: doc.name ?? null,
    username: doc.username ?? null,
    handle: doc.handle ?? null,
    email: doc.email ?? null,
    headline: doc.headline ?? null,
    mission: doc.mission ?? null,
    valueProp: doc.valueProp ?? null,
    title: doc.title ?? null,
    occupation: doc.occupation ?? null,
    city: doc.city ?? null,
    state: doc.state ?? null,
    country: doc.country ?? null,
    mediaKitDisplayName: doc.mediaKitDisplayName ?? null,
    biography: doc.biography ?? instagram.biography ?? null,
    profile_picture_url: resolvedAvatar ?? null,
    mediaKitSlug: doc.mediaKitSlug ?? null,
    followers_count: resolvedFollowers,
    followersCount: resolvedFollowers,
    mediaKitPricingPublished: Boolean(doc.mediaKitPricingPublished),
    instagramUsername: doc.instagramUsername ?? instagram.username ?? null,
    instagram: {
      username: instagram.username ?? null,
      biography: instagram.biography ?? null,
      profile_picture_url:
        instagram.profile_picture_url || instagram.profilePictureUrl || null,
      followers_count: typeof instagram.followers_count === 'number'
        ? instagram.followers_count
        : typeof instagram.followersCount === 'number'
          ? instagram.followersCount
          : null,
      followersCount: typeof instagram.followersCount === 'number'
        ? instagram.followersCount
        : typeof instagram.followers_count === 'number'
          ? instagram.followers_count
          : null,
    },
  };
}

export async function GET() {
  const session = (await getServerSession(authOptions as any)) as
    | { user?: { id?: string | null } }
    | null
    | undefined;

  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(userId)
    .select(
      'name mediaKitDisplayName username handle email profile_picture_url image mediaKitSlug biography headline mission valueProp title occupation city state country instagram instagramUsername followers_count mediaKitPricingPublished instagramAccountId availableIgAccounts.profile_picture_url'
    )
    .lean()
    .exec();

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const resolvedAvatar = await resolveAvatar(user);
  const payload = serializeUser(user, resolvedAvatar);

  return NextResponse.json({ user: payload });
}

export async function PATCH(req: Request) {
  const session = (await getServerSession(authOptions as any)) as
    | { user?: { id?: string | null } }
    | null
    | undefined;

  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 });
  }

  let body: any = null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const rawName =
    typeof body?.mediaKitDisplayName === 'string'
      ? body.mediaKitDisplayName
      : typeof body?.displayName === 'string'
        ? body.displayName
        : typeof body?.name === 'string'
          ? body.name
          : '';

  const normalizedName = rawName.replace(/\s+/g, ' ').trim();
  if (normalizedName.length && (normalizedName.length < 2 || normalizedName.length > 80)) {
    return NextResponse.json(
      { error: 'Use entre 2 e 80 caracteres no nome exibido.' },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const user = await User.findById(userId)
    .select('mediaKitDisplayName name username handle email profile_picture_url image mediaKitSlug instagram instagramUsername followers_count instagramAccountId availableIgAccounts.profile_picture_url')
    .exec();

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  user.mediaKitDisplayName = normalizedName.length ? normalizedName : null;
  await user.save();

  const resolvedAvatar = await resolveAvatar(user.toObject());
  const payload = serializeUser(user.toObject(), resolvedAvatar);
  return NextResponse.json({ user: payload });
}
