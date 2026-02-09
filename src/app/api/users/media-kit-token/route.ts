// src/app/api/users/media-kit-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { checkRateLimit } from '@/utils/rateLimit';
import { getClientIp } from '@/utils/getClientIp';
import {
  buildMediaKitPublicUrl,
  buildMediaKitSlugBase,
  ensureUniqueMediaKitSlug,
} from '@/app/lib/mediakit/slugService';

export const dynamic = 'force-dynamic';

function apiError(message: string, status: number) {
  logger.warn(`[user/media-kit-token] ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const TAG = '[api/users/media-kit-token:POST]';
  const session = (await getServerSession(authOptions)) as any;
  const sessionUser = session?.user as { id?: string; name?: string | null } | undefined;
  if (!sessionUser?.id) {
    return apiError('Não autenticado.', 401);
  }

  const ip = getClientIp(req);
  const identifier = ip === 'unknown' ? sessionUser.id : ip;
  const { allowed } = await checkRateLimit(`generate-media-kit:self:${identifier}`, 5, 3600);
  if (!allowed) {
    return apiError('Limite de requisições excedido.', 429);
  }

  await connectToDatabase();

  const user = await UserModel.findById(sessionUser.id).select('name mediaKitDisplayName mediaKitSlug').lean();
  if (!user) {
    return apiError('Usuário não encontrado.', 404);
  }

  if (user.mediaKitSlug) {
    const slug = String(user.mediaKitSlug);
    const url = buildMediaKitPublicUrl(req.nextUrl.origin, slug);
    return NextResponse.json({ slug, url });
  }

  try {
    const idSuffix = String(sessionUser.id).slice(-4).toLowerCase();
    const fallback = `usuario-${idSuffix}`;
    const slugBase = buildMediaKitSlugBase(
      user.mediaKitDisplayName || user.name || sessionUser.name || '',
      fallback
    );
    const slug = await ensureUniqueMediaKitSlug(slugBase, sessionUser.id);

    const updated = await UserModel.findByIdAndUpdate(
      sessionUser.id,
      { mediaKitSlug: slug },
      { new: true }
    );
    if (!updated) {
      return apiError('Usuário não encontrado.', 404);
    }

    const url = buildMediaKitPublicUrl(req.nextUrl.origin, slug);
    logger.info(`${TAG} Slug gerado para user ${sessionUser.id}: ${slug}`);
    return NextResponse.json({ slug, url });
  } catch (err: any) {
    logger.error(`${TAG} Erro ao gerar slug:`, err);
    return apiError('Erro ao gerar slug.', 500);
  }
}

export async function GET(req: NextRequest) {
  const TAG = '[api/users/media-kit-token:GET]';
  const session = (await getServerSession(authOptions)) as any;
  const sessionUser = session?.user as { id?: string } | undefined;
  if (!sessionUser?.id) {
    return apiError('Não autenticado.', 401);
  }

  await connectToDatabase();
  const user = await UserModel.findById(sessionUser.id).select('mediaKitSlug').lean();
  if (!user) {
    return apiError('Usuário não encontrado.', 404);
  }
  const slug = user.mediaKitSlug;
  const url = slug ? buildMediaKitPublicUrl(req.nextUrl.origin, String(slug)) : null;
  logger.info(`${TAG} Retornando slug atual para user ${sessionUser.id}: ${slug ?? 'null'}`);
  return NextResponse.json({ slug, url });
}
