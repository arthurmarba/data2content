import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/getAdminSession';
import { logger } from '@/app/lib/logger';
import { updateCreatorSurveyNotes } from '@/lib/services/adminCreatorSurveyService';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  adminNotes: z.string().max(5000).optional().default(''),
});

export async function PATCH(req: NextRequest, { params }: { params: { creatorId: string } }) {
  const TAG = '[api/admin/creators-survey/:id/notes][PATCH]';
  try {
    const session = (await getAdminSession(req)) as { user?: { name?: string } } | null;
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    await updateCreatorSurveyNotes(params.creatorId, parsed.data.adminNotes);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    logger.error(`${TAG} failed`, err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
