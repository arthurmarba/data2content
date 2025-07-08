import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchContentPerformanceByType } from '@/app/lib/dataService/marketAnalysis/segmentService';
import { DatabaseError } from '@/app/lib/errors';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const TAG = '/api/admin/dashboard/content/performance-by-type';

// Zod schema for query parameters
const querySchema = z.object({
  startDate: z.string().datetime({ message: "Invalid start date format. Expected ISO 8601 string." }),
  endDate: z.string().datetime({ message: "Invalid end date format. Expected ISO 8601 string." }),
}).refine(data => new Date(data.startDate) <= new Date(data.endDate), {
  message: "End date cannot be earlier than start date.",
  path: ["endDate"], // Path to link the error to
});

export async function GET(req: NextRequest) {
  logger.info(`${TAG} Request received`);

  // 1. Admin Session Validation
  const session = await getServerSession(authOptions);
  
  // Verificação mais robusta da sessão e do papel do usuário
  if (!session || !session.user || session.user.role !== 'admin') {
    logger.warn(`${TAG} Unauthorized access attempt.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Ajustado para usar 'id' que está definido no seu tipo de sessão
  logger.info(`${TAG} Admin session validated for user: ${session.user.id}`);


  // 2. Validate Query Parameters
  const { searchParams } = new URL(req.url);
  const queryParams = {
    startDate: searchParams.get('startDate'),
    endDate: searchParams.get('endDate'),
  };

  const validationResult = querySchema.safeParse(queryParams);

  if (!validationResult.success) {
    logger.warn(`${TAG} Invalid query parameters:`, validationResult.error.flatten());
    return NextResponse.json({ error: 'Invalid query parameters', details: validationResult.error.flatten() }, { status: 400 });
  }

  const { startDate, endDate } = validationResult.data;
  const dateRange = {
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  };

  logger.info(`${TAG} Query parameters validated: ${JSON.stringify(dateRange)}`);

  try {
    // 3. Call Service Function
    logger.info(`${TAG} Calling fetchContentPerformanceByType service`);
    const performanceData = await fetchContentPerformanceByType({ dateRange });
    logger.info(`${TAG} Successfully fetched content performance data. Count: ${performanceData.length}`);

    // 4. Return Data
    return NextResponse.json(performanceData, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Error in request handler:`, {
      message: error.message,
      stack: error.stack,
    });

    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
    } else if (error.message.includes('Invalid date format') || error.message.includes('Date range with startDate and endDate must be provided')) {
      // This case might be caught by Zod or by service function's initial checks
      return NextResponse.json({ error: 'Bad Request', details: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
