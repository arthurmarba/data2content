import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

export const runtime = 'nodejs';

function serializeUser(doc: any) {
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
    biography: doc.biography ?? instagram.biography ?? null,
    profile_picture_url:
      doc.profile_picture_url ||
      instagram.profile_picture_url ||
      instagram.profilePictureUrl ||
      null,
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
      'name username handle email profile_picture_url biography headline mission valueProp title occupation city state country instagram instagramUsername followers_count mediaKitPricingPublished'
    )
    .lean()
    .exec();

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const payload = serializeUser(user);

  return NextResponse.json({ user: payload });
}
