import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/getAdminSession';
import { logger } from '@/app/lib/logger';
import { exportCreatorSurveyResponses } from '@/lib/services/adminCreatorSurveyService';
import { AdminCreatorSurveyFilters } from '@/types/admin/creatorSurvey';

export const dynamic = 'force-dynamic';

const arrayTransform = z
  .string()
  .optional()
  .transform((val) => (val ? val.split(',').map((v) => v.trim()).filter(Boolean) : undefined));

const querySchema = z.object({
  format: z.enum(['csv', 'json']).optional().default('csv'),
  scope: z.enum(['all', 'filtered']).optional().default('filtered'),
  includeHistory: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
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
  columns: arrayTransform,
});

function toCsv(rows: any[]) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (val: any) => {
    if (val === null || val === undefined) return '';
    const str = typeof val === 'string' ? val : String(val);
    const escaped = str.replace(/"/g, '""');
    return `"${escaped}"`;
  };
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(',')),
  ];
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  const TAG = '[api/admin/creators-survey/export][GET]';
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

  const { format, scope, columns, includeHistory, ...rawFilters } = parseResult.data;

  const filters: AdminCreatorSurveyFilters =
    scope === 'all'
      ? {}
      : {
            ...rawFilters,
            stage: rawFilters.stage as any,
            pains: rawFilters.pains as any,
            hardestStage: rawFilters.hardestStage as any,
            monetizationStatus: rawFilters.monetizationStatus as any,
            nextPlatform: rawFilters.nextPlatform as any,
            niches: rawFilters.niches as any,
            brandTerritories: rawFilters.brandTerritories as any,
            accountReasons: rawFilters.accountReasons as any,
            country: rawFilters.country as any,
            city: rawFilters.city as any,
            gender: rawFilters.gender as any,
          };

  const rows = await exportCreatorSurveyResponses(filters, columns, includeHistory);

    if (format === 'json') {
      return NextResponse.json({ rows }, { status: 200 });
    }

    const csv = toCsv(rows);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="creators-survey.csv"',
      },
    });
  } catch (err: any) {
    logger.error(`${TAG} failed`, err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
