import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchContentPerformanceByType } from '@/app/lib/dataService/marketAnalysis/segmentService';
import { DatabaseError } from '@/app/lib/errors';
// Removed: import { getAdminSession } from '@/app/lib/auth/auth';

const TAG = '/api/admin/dashboard/content/performance-by-type';

// Simulação de validação de sessão de Admin (ou use a real implementação se disponível)
async function getAdminSession(req?: NextRequest): Promise<{ user: { name: string; userId: string; role: string; } } | null> { // Added optional req and richer user type
  // TODO: Replace with actual session validation logic (e.g., using NextAuth.js getServerSession)
  // For the purpose of this API route, we need user.userId and user.role
  const session = { user: { name: 'Admin User', userId: 'admin123', role: 'ADMIN' } }; // Placeholder session
  const isAdmin = session.user.role === 'ADMIN'; // Placeholder admin check

  if (!session || !isAdmin) {
    logger.warn(`${TAG} Admin session validation failed (placeholder). User role: ${session?.user?.role}`);
    return null;
  }
  logger.info(`${TAG} Admin session validated (placeholder) for user: ${session.user.name}`);
  return session;
}

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
  const session = await getAdminSession(); // Or your actual session validation logic
  if (!session || session.user.role !== 'ADMIN') {
    logger.warn(`${TAG} Unauthorized access attempt.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  logger.info(`${TAG} Admin session validated for user: ${session.user.userId}`);

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
      details: error instanceof DatabaseError ? error.details : undefined,
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
