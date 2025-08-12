import { cookies } from 'next/headers';

export function resolveAffiliateCode(req: Request, bodyCode?: string) {
  const url = new URL(req.url);
  const param = url.searchParams.get('ref') || url.searchParams.get('aff');
  const cookie = cookies().get('d2c_ref')?.value || null;
  const code = bodyCode?.trim() || param || cookie || null;
  const source = bodyCode?.trim() ? 'typed' : (param ? 'url' : (cookie ? 'cookie' : null));
  return { code, source } as { code: string | null, source: 'typed' | 'url' | 'cookie' | null };
}

export function setAffiliateCookie(code: string, days = Number(process.env.AFFILIATE_ATTRIBUTION_WINDOW_DAYS || 90)) {
  const maxAge = days * 24 * 60 * 60; // seconds
  cookies().set('d2c_ref', code, { maxAge, httpOnly: false, sameSite: 'lax' });
}

export function centsMulPct(cents: number, pct: number) {
  return Math.round(cents * (pct / 100));
}
