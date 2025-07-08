import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchPlatformSummary } from '@/app/lib/dataService/marketAnalysis/dashboardService';
import { DatabaseError } from '@/app/lib/errors';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';


const TAG = '/api/admin/dashboard/platform-summary';

// Zod schema for optional query parameters
const querySchema = z.object({
  startDate: z.string().datetime({ message: "Invalid start date format. Expected ISO 8601 string." }).optional(),
  endDate: z.string().datetime({ message: "Invalid end date format. Expected ISO 8601 string." }).optional(),
}).superRefine((data, ctx) => {
  if (data.startDate && !data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "endDate is required if startDate is provided.",
      path: ["endDate"],
    });
  }
  if (!data.startDate && data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "startDate is required if endDate is provided.",
      path: ["startDate"],
    });
  }
  if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "endDate cannot be earlier than startDate.",
      path: ["endDate"],
    });
  }
});

export async function GET(req: NextRequest) {
  logger.info(`${TAG} Request received`);

  // 1. Admin Session Validation
  const session = await getServerSession(authOptions);
  
  if (!session || !session.user || session.user.role !== 'admin') {
    logger.warn(`${TAG} Unauthorized access attempt.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  logger.info(`${TAG} Admin session validated for user: ${session.user.id}`);


  // 2. Validate Query Parameters
  const { searchParams } = new URL(req.url);
  const queryParamsFromUrl = {
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
  };

  // Remove undefined fields before validation if they are truly optional and not just empty strings
  const definedQueryParams: any = {};
  if (queryParamsFromUrl.startDate) definedQueryParams.startDate = queryParamsFromUrl.startDate;
  if (queryParamsFromUrl.endDate) definedQueryParams.endDate = queryParamsFromUrl.endDate;

  const validationResult = querySchema.safeParse(definedQueryParams);

  if (!validationResult.success) {
    logger.warn(`${TAG} Invalid query parameters:`, validationResult.error.flatten());
    return NextResponse.json({ error: 'Invalid query parameters', details: validationResult.error.flatten() }, { status: 400 });
  }

  let dateRange;
  if (validationResult.data.startDate && validationResult.data.endDate) {
    dateRange = {
      startDate: new Date(validationResult.data.startDate),
      endDate: new Date(validationResult.data.endDate),
    };
  }

  logger.info(`${TAG} Query parameters validated. Date range: ${dateRange ? JSON.stringify(dateRange) : 'Not provided'}`);

  try {
    // 3. Call Service Function
    logger.info(`${TAG} Calling fetchPlatformSummary service`);
    const summaryData = await fetchPlatformSummary({ dateRange }); // Pass dateRange (which might be undefined)
    logger.info(`${TAG} Successfully fetched platform summary data.`);

    // 4. Return Data
    return NextResponse.json(summaryData, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Error in request handler:`, {
      message: error.message,
      stack: error.stack,
    });

    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
