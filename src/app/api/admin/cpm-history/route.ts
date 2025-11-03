import { NextRequest, NextResponse } from 'next/server';

import { connectToDatabase } from '@/app/lib/mongoose';
import CpmHistory from '@/app/models/CpmHistory';
import { authorizeAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await authorizeAdminRequest(req);
  if (!auth.authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const segmentParam = searchParams.get('segment')?.trim().toLowerCase() || null;
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10), 1), 100);
  const skip = (page - 1) * limit;

  await connectToDatabase();

  const query = segmentParam ? { segment: segmentParam } : {};

  const [items, total] = await Promise.all([
    CpmHistory.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    CpmHistory.countDocuments(query),
  ]);

  return NextResponse.json(
    {
      items,
      page,
      limit,
      total,
      hasMore: skip + items.length < total,
    },
    { status: 200 }
  );
}
