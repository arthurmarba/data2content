import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

async function getAdminSession(req: NextRequest) {
  const session = await getServerSession(authOptions, req);
  if (!session || session.user?.role !== 'admin') return null;
  return session as any;
}

function apiError(message: string, status: number) {
  logger.warn(`[revoke-media-kit-token] ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  const TAG = '[api/admin/users/[userId]/revoke-media-kit-token]';
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
    { $unset: { mediaKitToken: '' } },
    { new: true }
  );

  if (!updated) {
    return apiError('Usuário não encontrado.', 404);
  }

  logger.info(`${TAG} Token revoked for user ${userId}`);
  return NextResponse.json({ success: true });
}
