import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  // For now this is a mocked endpoint used for tests and development.
  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get('cursor');
  const items = [
    {
      id: cursor ? 'second' : 'first',
      currency: 'BRL',
      amountCents: 1000,
      status: 'pending',
      createdAt: new Date().toISOString(),
      availableAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      invoiceId: 'in_123',
    },
  ];
  const nextCursor = cursor ? null : 'next';
  return NextResponse.json({ items, nextCursor });
}
