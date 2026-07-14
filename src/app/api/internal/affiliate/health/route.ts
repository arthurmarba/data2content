import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date();
  await connectToDatabase();
  const pendingDueUsers = await User.countDocuments({
    commissionLog: { $elemMatch: { status: 'pending', availableAt: { $lte: now } } },
  });

  return NextResponse.json(
    {
      ok: pendingDueUsers === 0,
      pendingDueUsers,
      checkedAt: now.toISOString(),
    },
    { status: pendingDueUsers === 0 ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
