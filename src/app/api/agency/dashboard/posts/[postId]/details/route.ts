import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { fetchPostDetails, IPostDetailsData } from '@/app/lib/dataService/marketAnalysis/postsService'; // Assuming IPostDetailsData is exported
import { DatabaseError } from '@/app/lib/errors';
import { getAgencySession } from '@/lib/getAgencySession';

const TAG = '/api/agency/dashboard/posts/[postId]/details';

// Zod schema for path parameter
const pathParamsSchema = z.object({
  postId: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: "Invalid MongoDB ObjectId format for postId.",
  }),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } } // Next.js dynamic route params
) {
  logger.info(`${TAG} Request received for postId: ${params.postId}`);

  // 1. Agency Session Validation
  const session = await getAgencySession(req);

  if (!session || !session.user) {
    logger.warn(`${TAG} Unauthorized access attempt for postId: ${params.postId}`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  logger.info(`${TAG} Agency session validated for user: ${session.user.id}, postId: ${params.postId}`);

  // 2. Validate Path Parameter
  const validationResult = pathParamsSchema.safeParse(params);

  if (!validationResult.success) {
    logger.warn(`${TAG} Invalid postId: ${params.postId}`, validationResult.error.flatten());
    return NextResponse.json({ error: 'Invalid postId format', details: validationResult.error.flatten() }, { status: 400 });
  }

  const { postId } = validationResult.data;
  logger.info(`${TAG} Path parameter validated: ${postId}`);

  try {
    // 3. Call Service Function
    logger.info(`${TAG} Calling fetchPostDetails service for postId: ${postId}`);
    const postDetails: IPostDetailsData | null = await fetchPostDetails({ postId, agencyId: session.user.agencyId });

    if (!postDetails) {
      logger.warn(`${TAG} Post details not found for postId: ${postId}`);
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    logger.info(`${TAG} Successfully fetched post details for postId: ${postId}`);

    // 4. Return Data
    return NextResponse.json(postDetails, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Error in request handler for postId ${postId}:`, {
      message: error.message,
      stack: error.stack,
    });

    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
    }
    // Add any other specific error type checks if needed from the service layer

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
