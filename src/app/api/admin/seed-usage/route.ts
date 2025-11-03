import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

import { connectToDatabase } from '@/app/lib/mongoose';
import PubliCalculation from '@/app/models/PubliCalculation';
import { logger } from '@/app/lib/logger';
import { authorizeAdminRequest } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await authorizeAdminRequest(req);
  if (!auth.authorized) {
    logger.warn('[admin][seed-usage] unauthorized access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await connectToDatabase();

  const [totalCalculations, seedCalculations] = await Promise.all([
    PubliCalculation.countDocuments(),
    PubliCalculation.countDocuments({ cpmSource: 'seed' }),
  ]);

  const dynamicCalculations = Math.max(totalCalculations - seedCalculations, 0);
  const seedUsagePercent =
    totalCalculations > 0 ? Math.round((seedCalculations / totalCalculations) * 1000) / 10 : 0;

  if (totalCalculations > 0 && seedUsagePercent < 20) {
    const message = `[CPM_MONITOR] seedUsagePercent=${seedUsagePercent}`;
    logger.info(message);
    Sentry.captureMessage(message, 'info');
  }

  return NextResponse.json(
    {
      totalCalculations,
      seedCalculations,
      dynamicCalculations,
      seedUsagePercent,
    },
    { status: 200 }
  );
}
