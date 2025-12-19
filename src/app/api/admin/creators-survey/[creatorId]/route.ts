import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/getAdminSession';
import { getCreatorSurveyById } from '@/lib/services/adminCreatorSurveyService';
import { logger } from '@/app/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { creatorId: string } }) {
  const TAG = '[api/admin/creators-survey/:id][GET]';
  try {
    const session = (await getAdminSession(req)) as { user?: { name?: string } } | null;
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const creatorId = params.creatorId;
    const detail = await getCreatorSurveyById(creatorId);
    if (!detail) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(detail, { status: 200 });
  } catch (err: any) {
    logger.error(`${TAG} failed`, err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
