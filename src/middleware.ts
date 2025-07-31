import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guardPremiumRequest } from '@/app/lib/planGuard';

export async function middleware(req: NextRequest) {
  const guardResponse = await guardPremiumRequest(req);
  if (guardResponse) {
    return guardResponse;
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/whatsapp/generateCode/:path*', '/api/ai/:path*'],
};
