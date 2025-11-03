import { NextRequest } from 'next/server';

import { getAdminSession } from '@/lib/getAdminSession';

export type AdminAuthResult =
  | { authorized: true; method: 'token' | 'session' }
  | { authorized: false };

export async function authorizeAdminRequest(req: NextRequest): Promise<AdminAuthResult> {
  const headerToken =
    req.headers.get('authorization') ?? req.headers.get('upstash-forward-authorization') ?? undefined;
  const adminToken = process.env.ADMIN_TOKEN;

  if (adminToken && headerToken === `Bearer ${adminToken}`) {
    return { authorized: true, method: 'token' };
  }

  const session = await getAdminSession(req);
  if (session) {
    return { authorized: true, method: 'session' };
  }

  return { authorized: false };
}
