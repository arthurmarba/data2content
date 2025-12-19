import { NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import type { ProcessRequestBody } from './types';

export async function handleUserMessage(_payload: ProcessRequestBody) {
  const tag = '[UserMessageHandler][disabled]';
  logger.warn(`${tag} Handler desativado (redirect_only ou feature legacy desligada).`);
  return NextResponse.json({ disabled: true, reason: 'whatsapp_process_response_disabled' }, { status: 410 });
}
