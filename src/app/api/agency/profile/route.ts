import { NextRequest, NextResponse } from 'next/server';
import { getAgencySession } from '@/lib/getAgencySession';
import AgencyModel from '@/app/models/Agency';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';
const SERVICE_TAG = '[api/agency/profile]';

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  try {
    const session = await getAgencySession(req);
    if (!session?.user?.agencyId) {
      logger.warn(`${TAG} unauthorized attempt`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agency = await AgencyModel.findById(session.user.agencyId)
      .select('name')
      .lean();
    if (!agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    return NextResponse.json({ name: agency.name });
  } catch (err: any) {
    logger.error(`${TAG} unexpected error`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
