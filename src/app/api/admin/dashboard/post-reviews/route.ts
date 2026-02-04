import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { DatabaseError } from '@/app/lib/errors';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  fetchPostReviewByPostId,
  fetchPostReviews,
  upsertPostReview,
  deletePostReview,
} from '@/app/lib/dataService/marketAnalysis/postReviewsService';

const SERVICE_TAG = '[api/admin/dashboard/post-reviews]';
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  postId: z.string().optional(),
  status: z.enum(['do', 'dont', 'almost']).optional(),
  context: z.string().optional(),
  proposal: z.string().optional(),
  creatorContext: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  sortBy: z.enum(['updatedAt', 'createdAt', 'postDate', 'total_interactions']).optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

const bodySchema = z.object({
  postId: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid postId format.',
  }),
  status: z.enum(['do', 'dont', 'almost']),
  note: z.string().trim().max(5000).optional().default(''),
});

async function requireAdminSession() {
  const session = (await getServerSession(authOptions)) as any;
  if (!session || !session.user || session.user.role !== 'admin') {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  try {
    const session = await requireAdminSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validation = querySchema.safeParse(queryParams);
    if (!validation.success) {
      const errorMessage = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json({ error: `Parâmetros inválidos: ${errorMessage}` }, { status: 400 });
    }

    const { postId, ...filters } = validation.data;
    if (postId) {
      if (!Types.ObjectId.isValid(postId)) {
        return NextResponse.json({ error: 'PostId inválido.' }, { status: 400 });
      }
      const review = await fetchPostReviewByPostId(postId);
      return NextResponse.json({ review }, { status: 200 });
    }

    const result = await fetchPostReviews(filters);
    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Error:`, error);
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  try {
    const session = await requireAdminSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const validation = bodySchema.safeParse(body);
    if (!validation.success) {
      const errorMessage = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json({ error: `Parâmetros inválidos: ${errorMessage}` }, { status: 400 });
    }

    const { postId, status, note } = validation.data;
    const review = await upsertPostReview({
      postId,
      status,
      note,
      reviewedBy: session.user.id ?? null,
    });

    return NextResponse.json({ review }, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Error:`, error);
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[DELETE]`;
  try {
    const session = await requireAdminSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');

    if (!postId || !Types.ObjectId.isValid(postId)) {
      return NextResponse.json({ error: 'PostId inválido ou ausente.' }, { status: 400 });
    }

    await deletePostReview(postId);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Error:`, error);
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
