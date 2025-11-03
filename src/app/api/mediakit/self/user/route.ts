import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';

import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

export const runtime = 'nodejs';

function serializeUser(doc: any) {
  if (!doc) return null;
  const instagram = doc.instagram || {};

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
    instagramUsername: doc.instagramUsername ?? instagram.username ?? null,
    instagram: {
      username: instagram.username ?? null,
      biography: instagram.biography ?? null,
      profile_picture_url:
        instagram.profile_picture_url || instagram.profilePictureUrl || null,
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
      'name username handle email profile_picture_url biography headline mission valueProp title occupation city state country instagram instagramUsername'
    )
    .lean()
    .exec();

  if (!user) {
    return NextResponse.json({ error: 'Usuário não encontrado.' }, { status: 404 });
  }

  const payload = serializeUser(user);

  return NextResponse.json({ user: payload });
}
