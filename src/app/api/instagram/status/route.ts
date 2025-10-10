import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    await connectToDatabase();
    const user = await User.findById(session.user.id)
      .select(
        'isInstagramConnected instagramSyncErrorMsg instagramSyncErrorCode lastInstagramSyncAttempt lastInstagramSyncSuccess instagramReconnectNotifiedAt instagramDisconnectCount'
      )
      .lean();

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      isConnected: Boolean(user.isInstagramConnected),
      lastErrorCode: user.instagramSyncErrorCode ?? null,
      lastErrorMessage: user.instagramSyncErrorMsg ?? null,
      lastSyncAttempt: user.lastInstagramSyncAttempt ? new Date(user.lastInstagramSyncAttempt).toISOString() : null,
      lastSyncSuccess: typeof user.lastInstagramSyncSuccess === 'boolean' ? user.lastInstagramSyncSuccess : null,
      reconnectNotifiedAt: user.instagramReconnectNotifiedAt ? new Date(user.instagramReconnectNotifiedAt).toISOString() : null,
      disconnectCount: typeof user.instagramDisconnectCount === 'number' ? user.instagramDisconnectCount : 0,
    });
  } catch (error) {
    console.error('[api/instagram/status] failed', error);
    return NextResponse.json({ ok: false, error: 'Unable to retrieve Instagram status' }, { status: 503 });
  }
}
