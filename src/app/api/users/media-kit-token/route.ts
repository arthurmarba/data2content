// src/app/api/users/media-kit-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import slugify from '@/utils/slugify';
import { logger } from '@/app/lib/logger';
import { checkRateLimit } from '@/utils/rateLimit';
import { getClientIp } from '@/utils/getClientIp';

export const dynamic = 'force-dynamic';

function apiError(message: string, status: number) {
  logger.warn(`[user/media-kit-token] ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  const TAG = '[api/users/media-kit-token:POST]';
  const session = await getServerSession(authOptions);
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

  const user = await UserModel.findById(sessionUser.id).select('name mediaKitSlug').lean();
  if (!user) {
    return apiError('Usuário não encontrado.', 404);
  }

  const baseSlug = slugify(user.name || sessionUser.name || 'usuario');
  let slug = baseSlug;
  const existing = await UserModel.findOne({ mediaKitSlug: slug }).select('_id');
  if (existing && existing._id.toString() !== sessionUser.id) {
    slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const updated = await UserModel.findByIdAndUpdate(
        sessionUser.id,
        { mediaKitSlug: slug },
        { new: true }
      );
      if (!updated) {
        return apiError('Usuário não encontrado.', 404);
      }
      const url = `${req.nextUrl.origin}/mediakit/${slug}`;
      logger.info(`${TAG} Slug gerado para user ${sessionUser.id}: ${slug}`);
      return NextResponse.json({ slug, url });
    } catch (err: any) {
      if (err.code === 11000 && attempt === 0) {
        slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
        continue;
      }
      logger.error(`${TAG} Erro ao gerar slug:`, err);
      return apiError('Erro ao gerar slug.', 500);
    }
  }

  return apiError('Erro ao gerar slug.', 500);
}

export async function GET(req: NextRequest) {
  const TAG = '[api/users/media-kit-token:GET]';
  const session = await getServerSession(authOptions);
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
  const url = slug ? `${req.nextUrl.origin}/mediakit/${slug}` : null;
  logger.info(`${TAG} Retornando slug atual para user ${sessionUser.id}: ${slug ?? 'null'}`);
  return NextResponse.json({ slug, url });
}

