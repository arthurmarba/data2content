import { NextRequest, NextResponse } from 'next/server';
import { getAgencySession } from '@/lib/getAgencySession';
import AgencyModel from '@/app/models/Agency';
import { logger } from '@/app/lib/logger';

export const runtime = 'nodejs';
const SERVICE_TAG = '[api/agency/invite-code]';

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  try {
    const session = await getAgencySession(req);
    if (!session?.user?.agencyId) {
      logger.warn(`${TAG} unauthorized attempt`);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const agency = await AgencyModel.findById(session.user.agencyId)
      .select('inviteCode planStatus')
      .lean();
    if (!agency) {
      return NextResponse.json({ error: 'Agency not found' }, { status: 404 });
    }

    if (agency.planStatus !== 'active') {
      logger.warn(
        `${TAG} agency ${session.user.agencyId} attempted access with plan status ${agency.planStatus}`,
      );
      return NextResponse.json(
        { error: 'Plano da agência inativo. Assine para acessar o link de convite.' },
        { status: 403 },
      );
    }

    return NextResponse.json({ inviteCode: agency.inviteCode });
  } catch (err: any) {
    logger.error(`${TAG} unexpected error`, err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
