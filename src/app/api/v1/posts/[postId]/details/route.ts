import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { fetchPostDetails } from '@/app/lib/dataService/marketAnalysis/postsService';
import { DatabaseError } from '@/app/lib/errors';

const TAG = '/api/v1/posts/[postId]/details';

const pathParamsSchema = z.object({
  postId: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: 'Invalid MongoDB ObjectId format for postId.',
  }),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { postId: string } }
) {
  logger.info(`${TAG} Request received for postId: ${params.postId}`);

  const validationResult = pathParamsSchema.safeParse(params);
  if (!validationResult.success) {
    logger.warn(`${TAG} Invalid postId: ${params.postId}`, validationResult.error.flatten());
    return NextResponse.json(
      { error: 'Invalid postId format', details: validationResult.error.flatten() },
      { status: 400 }
    );
  }

  const { postId } = validationResult.data;
  logger.info(`${TAG} Path parameter validated: ${postId}`);

  try {
    logger.info(`${TAG} Calling fetchPostDetails service for postId: ${postId}`);
    const postDetails = await fetchPostDetails({ postId });

    if (!postDetails) {
      logger.warn(`${TAG} Post details not found for postId: ${postId}`);
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const { user, rawData, source, classificationStatus, classificationError, createdAt, updatedAt, __v, collabCreator, ...publicData } = postDetails as any;

    logger.info(`${TAG} Successfully fetched post details for postId: ${postId}`);
    return NextResponse.json(publicData, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Error in request handler for postId ${postId}:`, {
      message: error.message,
      stack: error.stack,
    });

    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
