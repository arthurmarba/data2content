import { NextRequest } from 'next/server';

export function getClientIp(req: NextRequest) {
  const fwd = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';
  return fwd.split(',')[0]?.trim() || 'unknown';
}
