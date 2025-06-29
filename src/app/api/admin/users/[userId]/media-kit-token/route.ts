import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { getAdminSession } from '@/lib/getAdminSession';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';


function apiError(message: string, status: number) {
  logger.warn(`[media-kit-token] ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  const TAG = '[api/admin/users/[userId]/media-kit-token:DELETE]';
  logger.info(`${TAG} Revoking media kit token for user ${userId}`);

  const session = await getAdminSession(req);
  if (!session) {
    return apiError('Acesso não autorizado.', 401);
  }

  if (!Types.ObjectId.isValid(userId)) {
    return apiError('User ID inválido.', 400);
  }

  await connectToDatabase();

  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { $unset: { mediaKitSlug: '' } },
    { new: true }
  );

  if (!updated) {
    return apiError('Usuário não encontrado.', 404);
  }

  logger.info(`${TAG} Token revoked for user ${userId}`);
  return NextResponse.json({ success: true });
}
