/**
 * @fileoverview API Endpoint for fetching data for creator comparison.
 * @version 1.0.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { fetchMultipleCreatorProfiles, ICreatorProfile } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[api/admin/dashboard/creators/compare]';
const MAX_CREATORS_TO_COMPARE_API = 5; // Align with or inform Zod schema

// Schema for request body validation
const requestBodySchema = z.object({
  creatorIds: z.array(z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: "Invalid Creator ID format provided in the array.",
  }))
  .min(1, { message: "creatorIds array cannot be empty." })
  .max(MAX_CREATORS_TO_COMPARE_API, { message: `Cannot compare more than ${MAX_CREATORS_TO_COMPARE_API} creators at a time.` })
});

// Simulated Admin Session Validation (reuse from other dashboard routes)
async function getAdminSession(req: NextRequest): Promise<{ user: { name: string } } | null> {
  // SIMULAÇÃO: Substitua pela sua lógica real de sessão (ex: next-auth)
  const session = { user: { name: 'Admin User' } };
  const isAdmin = true;
  if (!session || !isAdmin) {
    logger.warn(`${SERVICE_TAG} Admin session validation failed.`);
    return null;
  }
  return session;
}

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

/**
 * @handler POST
 * @description Handles POST requests to fetch profile data for multiple creators for comparison.
 * Validates admin session and the list of creator IDs in the request body.
 * Calls the `fetchMultipleCreatorProfiles` service function.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object containing an array of ICreatorProfile or an error.
 */
export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  logger.info(`${TAG} Received request for creator comparison data.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado. Sessão de administrador inválida.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const body = await req.json();
    const validationResult = requestBodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Invalid request body: ${errorMessage}`);
      return apiError(`Corpo da requisição inválido: ${errorMessage}`, 400);
    }

    const { creatorIds } = validationResult.data;

    logger.info(`${TAG} Calling fetchMultipleCreatorProfiles for ${creatorIds.length} creators.`);
    const profiles: ICreatorProfile[] = await fetchMultipleCreatorProfiles({ creatorIds });

    logger.info(`${TAG} Successfully fetched ${profiles.length} profiles for comparison.`);
    return NextResponse.json(profiles, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    }
    // Handle cases where fetchMultipleCreatorProfiles might throw specific errors not caught by Zod initially
    // e.g., if it threw an error for "No valid ObjectIds" instead of returning empty array internally.
    // For now, assuming service function handles empty/invalid lists gracefully or DatabaseError covers it.
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
