import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/getAdminSession';
import { logger } from '@/app/lib/logger';
import { listOpenCreatorSurveyResponses } from '@/lib/services/adminCreatorSurveyService';
import { AdminCreatorSurveyOpenResponseParams } from '@/types/admin/creatorSurvey';

export const dynamic = 'force-dynamic';

const arrayTransform = z
  .string()
  .optional()
  .transform((val) => (val ? val.split(',').map((v) => v.trim()).filter(Boolean) : undefined));

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(30),
  question: z.string().optional(),
  q: z.string().optional(),
  search: z.string().optional(),
  userId: z.string().optional(),
  username: z.string().optional(),
  stage: arrayTransform,
  pains: arrayTransform,
  hardestStage: arrayTransform,
  monetizationStatus: arrayTransform,
  nextPlatform: arrayTransform,
  niches: arrayTransform,
  brandTerritories: arrayTransform,
  accountReasons: arrayTransform,
  followersMin: z.coerce.number().optional(),
  followersMax: z.coerce.number().optional(),
  mediaMin: z.coerce.number().optional(),
  mediaMax: z.coerce.number().optional(),
  country: arrayTransform,
  city: arrayTransform,
  gender: arrayTransform,
  engagementMin: z.coerce.number().optional(),
  engagementMax: z.coerce.number().optional(),
  reachMin: z.coerce.number().optional(),
  reachMax: z.coerce.number().optional(),
  growthMin: z.coerce.number().optional(),
  growthMax: z.coerce.number().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const TAG = '[api/admin/creators-survey/open-responses][GET]';
  try {
    const session = await getAdminSession(req);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parseResult = querySchema.safeParse(Object.fromEntries(searchParams.entries()));
    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.message }, { status: 400 });
    }

    const filters: AdminCreatorSurveyOpenResponseParams = {
      ...parseResult.data,
      stage: parseResult.data.stage as any,
      pains: parseResult.data.pains as any,
      hardestStage: parseResult.data.hardestStage as any,
      monetizationStatus: parseResult.data.monetizationStatus as any,
      nextPlatform: parseResult.data.nextPlatform as any,
      niches: parseResult.data.niches as any,
      brandTerritories: parseResult.data.brandTerritories as any,
      accountReasons: parseResult.data.accountReasons as any,
      country: parseResult.data.country as any,
      city: parseResult.data.city as any,
      gender: parseResult.data.gender as any,
    };

    const data = await listOpenCreatorSurveyResponses(filters);
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    logger.error(`${TAG} failed`, err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
