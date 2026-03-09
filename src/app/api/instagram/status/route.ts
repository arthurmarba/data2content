import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from '@/app/lib/mongoTransient';
import User, { type IAvailableInstagramAccount, type IUser } from '@/app/models/User';

export const dynamic = 'force-dynamic';
const TRANSIENT_SESSION_FALLBACK = Symbol('instagram-status-transient-session-fallback');

type InstagramStatusUser = Pick<
  IUser,
  | 'isInstagramConnected'
  | 'instagramSyncErrorMsg'
  | 'instagramSyncErrorCode'
  | 'lastInstagramSyncAttempt'
  | 'lastInstagramSyncSuccess'
  | 'instagramReconnectNotifiedAt'
  | 'instagramDisconnectCount'
  | 'instagramAccountId'
  | 'availableIgAccounts'
  | 'instagramReconnectState'
>;

function buildSessionFallbackPayload(session: any) {
  const sessionUser = session?.user ?? {};
  return {
    ok: true,
    isConnected: Boolean(sessionUser.instagramConnected),
    lastErrorCode: sessionUser.igConnectionErrorCode ?? null,
    lastErrorMessage: sessionUser.igConnectionError ?? null,
    lastSyncAttempt:
      typeof sessionUser.lastInstagramSyncAttempt === 'string'
        ? sessionUser.lastInstagramSyncAttempt
        : null,
    lastSyncSuccess:
      typeof sessionUser.lastInstagramSyncSuccess === 'boolean'
        ? sessionUser.lastInstagramSyncSuccess
        : null,
    reconnectNotifiedAt:
      typeof sessionUser.instagramReconnectNotifiedAt === 'string'
        ? sessionUser.instagramReconnectNotifiedAt
        : null,
    reconnectState: sessionUser.instagramReconnectState ?? 'idle',
    disconnectCount:
      typeof sessionUser.instagramDisconnectCount === 'number'
        ? sessionUser.instagramDisconnectCount
        : 0,
    username: sessionUser.instagramUsername ?? null,
    profilePictureUrl: null,
    pageName: null,
  };
}

export async function GET(_req: NextRequest) {
  let session: any = null;
  let sessionFallbackPayload = buildSessionFallbackPayload(null);
  try {
    session = (await getServerSession(authOptions)) as any;
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    sessionFallbackPayload = buildSessionFallbackPayload(session);

    const user = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return User.findById(session.user.id)
          .select(
            'isInstagramConnected instagramSyncErrorMsg instagramSyncErrorCode lastInstagramSyncAttempt lastInstagramSyncSuccess instagramReconnectNotifiedAt instagramDisconnectCount instagramAccountId availableIgAccounts instagramReconnectState'
          )
          .lean<InstagramStatusUser | null>();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn('[api/instagram/status] Transient Mongo error. Retry.', {
            userId: session.user.id,
            retryCount,
            error: getErrorMessage(error),
          });
        },
      }
    ).catch((error) => {
      if (isTransientMongoError(error)) {
        logger.warn('[api/instagram/status] Falling back to session payload after transient Mongo error.', {
          userId: session.user.id,
          error: getErrorMessage(error),
        });
        return TRANSIENT_SESSION_FALLBACK;
      }
      throw error;
    });

    if (typeof user === 'symbol') {
      return NextResponse.json(sessionFallbackPayload);
    }

    if (!user) {
      return NextResponse.json(sessionFallbackPayload);
    }

    const resolvedUser = user as InstagramStatusUser;

    const connectedAccount = (resolvedUser.availableIgAccounts as IAvailableInstagramAccount[] | null | undefined)?.find(
      (acc) => acc.igAccountId === resolvedUser.instagramAccountId
    );

    return NextResponse.json({
      ok: true,
      isConnected: Boolean(resolvedUser.isInstagramConnected),
      lastErrorCode: resolvedUser.instagramSyncErrorCode ?? null,
      lastErrorMessage: resolvedUser.instagramSyncErrorMsg ?? null,
      lastSyncAttempt: resolvedUser.lastInstagramSyncAttempt ? new Date(resolvedUser.lastInstagramSyncAttempt).toISOString() : null,
      lastSyncSuccess: typeof resolvedUser.lastInstagramSyncSuccess === 'boolean' ? resolvedUser.lastInstagramSyncSuccess : null,
      reconnectNotifiedAt: resolvedUser.instagramReconnectNotifiedAt ? new Date(resolvedUser.instagramReconnectNotifiedAt).toISOString() : null,
      reconnectState: resolvedUser.instagramReconnectState ?? 'idle',
      disconnectCount: typeof resolvedUser.instagramDisconnectCount === 'number' ? resolvedUser.instagramDisconnectCount : 0,
      username: connectedAccount?.username ?? null,
      profilePictureUrl: connectedAccount?.profile_picture_url ?? null,
      pageName: connectedAccount?.pageName ?? null,
    });
  } catch (error) {
    logger.error('[api/instagram/status] failed', error);
    return NextResponse.json(sessionFallbackPayload);
  }
}
