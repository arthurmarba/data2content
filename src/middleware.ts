import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/app/lib/logger';
import type { PlanStatus } from '@/types/enums';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const status = token?.planStatus as PlanStatus | undefined;

  if (status === 'active') {
    return NextResponse.next();
  }

  const userId = token?.id ?? 'anonymous';
  logger.warn(`[middleware/plan] Blocked request for user ${userId} with status ${status}`);
  return NextResponse.json(
    { error: 'Seu acesso está inativo. Verifique sua assinatura para continuar.' },
    { status: 403 }
  );
}

export const config = {
  matcher: ['/api/whatsapp/generateCode/:path*', '/api/ai/:path*'],
};
