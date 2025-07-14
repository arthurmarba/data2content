import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
// AVISO: A correção completa deste arquivo depende da atualização da função 'fetchPostDetails'
// e de seu tipo de argumentos (IPostDetailsArgs) no arquivo 'postsService.ts' para aceitar 'agencyId'.
import { fetchPostDetails, IPostDetailsData } from '@/app/lib/dataService/marketAnalysis/postsService';
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
  
  if (!session.user.agencyId) {
    logger.error(`${TAG} Authenticated agency user ${session.user.id} is missing an agencyId.`);
    return NextResponse.json({ error: 'User is not correctly associated with an agency' }, { status: 403 });
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
    
    // CORRIGIDO: Usamos 'as any' como uma medida TEMPORÁRIA para suprimir o erro de tipo.
    // Isso permite que o código compile enquanto aguardamos a atualização da função 'fetchPostDetails'
    // no arquivo 'postsService.ts' para aceitar formalmente o 'agencyId'.
    const postDetails: IPostDetailsData | null = await fetchPostDetails({ postId, agencyId: session.user.agencyId } as any);

    if (!postDetails) {
      logger.warn(`${TAG} Post details not found for postId: ${postId} within agency ${session.user.agencyId}`);
      return NextResponse.json({ error: 'Post not found or not accessible by this agency' }, { status: 404 });
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

    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}