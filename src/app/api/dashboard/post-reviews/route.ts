import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { DatabaseError } from '@/app/lib/errors';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fetchPostReviews } from '@/app/lib/dataService/marketAnalysis/postReviewsService';

const SERVICE_TAG = '[api/dashboard/post-reviews]';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
    status: z.enum(['do', 'dont', 'almost']).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export async function GET(req: NextRequest) {
    const TAG = `${SERVICE_TAG}[GET]`;
    try {
        const session = (await getServerSession(authOptions)) as any;
        if (!session || !session.user || !session.user.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const queryParams = Object.fromEntries(searchParams.entries());
        const validation = querySchema.safeParse(queryParams);
        if (!validation.success) {
            return NextResponse.json({ error: 'Parâmetros inválidos.' }, { status: 400 });
        }

        const { status, page, limit } = validation.data;

        const result = await fetchPostReviews({
            userId: session.user.id,
            status,
            page,
            limit,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
        });

        return NextResponse.json(result, { status: 200 });
    } catch (error: any) {
        logger.error(`${TAG} Error:`, error);
        if (error instanceof DatabaseError) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
