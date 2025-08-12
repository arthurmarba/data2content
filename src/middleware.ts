import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guardPremiumRequest } from '@/app/lib/planGuard';

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const ref = url.searchParams.get('ref') || url.searchParams.get('aff');
  if (ref) {
    const res = NextResponse.next();
    res.cookies.set('d2c_ref', ref, {
      maxAge: Number(process.env.AFFILIATE_ATTRIBUTION_WINDOW_DAYS || 90) * 24 * 60 * 60,
    });
    return res;
  }

  const guardPrefixes = [
    '/api/whatsapp/generateCode',
    '/api/whatsapp/sendTips',
    '/api/whatsapp/verify',
    '/api/whatsapp/weeklyReport',
    '/api/ai',
  ];
  if (guardPrefixes.some((p) => url.pathname.startsWith(p))) {
    const guardResponse = await guardPremiumRequest(req);
    if (guardResponse) {
      return guardResponse;
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: '/:path*',
};
