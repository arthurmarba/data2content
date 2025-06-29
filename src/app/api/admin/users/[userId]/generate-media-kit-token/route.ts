import { NextRequest, NextResponse } from 'next/server';
import { Types } from 'mongoose';
import crypto from 'crypto';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export const dynamic = 'force-dynamic';

async function getAdminSession(req: NextRequest): Promise<{ user: { name: string; role?: string } } | null> {
  const session = await getServerSession(authOptions, req);
  if (!session || session.user?.role !== 'admin') return null;
  return session as any;
}

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 3;
const rateLimitMap = new Map<string, { count: number; expires: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || entry.expires < now) {
    rateLimitMap.set(key, { count: 1, expires: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

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
  if (!session) {
    return apiError('Acesso não autorizado.', 401);
  }

  if (!checkRateLimit(userId)) {
    return apiError('Limite de requisições excedido.', 429);
  }

  if (!Types.ObjectId.isValid(userId)) {
    return apiError('User ID inválido.', 400);
  }

  await connectToDatabase();

  const token = crypto.randomBytes(16).toString('hex');
  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { mediaKitToken: token },
    { new: true }
  );

  if (!updated) {
    return apiError('Usuário não encontrado.', 404);
  }

  const url = `${req.nextUrl.origin}/mediakit/${token}`;
  logger.info(`${TAG} Token generated for user ${userId}`);

  return NextResponse.json({ token, url });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  const { userId } = params;
  const TAG = '[api/admin/users/[userId]/generate-media-kit-token:GET]';
  logger.info(`${TAG} Fetching media kit token for user ${userId}`);

  const session = await getAdminSession(req);
  if (!session) {
    return apiError('Acesso não autorizado.', 401);
  }

  if (!Types.ObjectId.isValid(userId)) {
    return apiError('User ID inválido.', 400);
  }

  await connectToDatabase();

  const user = await UserModel.findById(userId).select('mediaKitToken').lean();
  if (!user) {
    return apiError('Usuário não encontrado.', 404);
  }

  const token = user.mediaKitToken;
  const url = token ? `${req.nextUrl.origin}/mediakit/${token}` : null;
  logger.info(`${TAG} Returning token for user ${userId}`);
  return NextResponse.json({ token, url });
}
