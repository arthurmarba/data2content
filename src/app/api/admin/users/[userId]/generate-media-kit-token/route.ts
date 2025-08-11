// src/app/api/admin/users/[userId]/generate-media-kit-token/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import crypto from 'crypto';
import slugify from '@/utils/slugify';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { checkRateLimit } from '@/utils/rateLimit';
import { getAdminSession } from '@/lib/getAdminSession';
import { getClientIp } from '@/utils/getClientIp';

export const dynamic = 'force-dynamic';


function apiError(message: string, status: number) {
  logger.warn(`[generate-media-kit-token] ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  const TAG = '[api/admin/users/[userId]/generate-media-kit-token]';
  logger.info(`${TAG} Generating media kit token for user ${userId}`);

  const session = await getAdminSession(req);
  if (!session?.user || session.user.role !== 'admin') {
    return apiError('Acesso não autorizado.', 401);
  }

  if (!Types.ObjectId.isValid(userId)) {
    return apiError('User ID inválido.', 400);
  }

  const ip = getClientIp(req);
  const identifier = ip === 'unknown' ? userId : ip;
  const { allowed } = await checkRateLimit(`generate-media-kit:${identifier}`, 5, 3600);
  if (!allowed) {
    logger.warn(`${TAG} Rate limit exceeded for ${identifier}`);
    return apiError('Limite de requisições excedido.', 429);
  }

  await connectToDatabase();

  const user = await UserModel.findById(userId).select('name').lean();
  if (!user) {
    return apiError('Usuário não encontrado.', 404);
  }

  const baseSlug = slugify(user.name || 'usuario');
  let slug = baseSlug;
  const existing = await UserModel.findOne({ mediaKitSlug: slug });
  if (existing && existing._id.toString() !== userId) {
    slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const updated = await UserModel.findByIdAndUpdate(
        userId,
        { mediaKitSlug: slug },
        { new: true }
      );
      if (!updated) {
        return apiError('Usuário não encontrado.', 404);
      }
      const url = `${req.nextUrl.origin}/mediakit/${slug}`;
      logger.info(`${TAG} Slug generated for user ${userId}`);
      return NextResponse.json({ slug, url });
    } catch (err: any) {
      if (err.code === 11000 && attempt === 0) {
        slug = `${baseSlug}-${crypto.randomBytes(2).toString('hex')}`;
        continue;
      }
      logger.error(`${TAG} Error generating slug:`, err);
      return apiError('Erro ao gerar slug.', 500);
    }
  }

  return apiError('Erro ao gerar slug.', 500);
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  const TAG = '[api/admin/users/[userId]/generate-media-kit-token:GET]';
  logger.info(`${TAG} Fetching media kit token for user ${userId}`);

  const session = await getAdminSession(req);
  if (!session?.user || session.user.role !== 'admin') {
    return apiError('Acesso não autorizado.', 401);
  }

  if (!Types.ObjectId.isValid(userId)) {
    return apiError('User ID inválido.', 400);
  }

  await connectToDatabase();

  const user = await UserModel.findById(userId).select('mediaKitSlug').lean();
  if (!user) {
    return apiError('Usuário não encontrado.', 404);
  }

  const slug = user.mediaKitSlug;
  const url = slug ? `${req.nextUrl.origin}/mediakit/${slug}` : null;
  logger.info(`${TAG} Returning slug for user ${userId}`);
  return NextResponse.json({ slug, url });
}