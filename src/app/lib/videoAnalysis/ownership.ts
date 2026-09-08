import { createHash } from 'node:crypto';

/** Validação independente do banco, também protege sessões emitidas antes da migração. */
export function ownsVideoUpload(userId: string, sessionId: string, objectKey?: string): boolean {
  if (!userId || !/^video-temp-upload-session-[a-zA-Z0-9-]+$/.test(sessionId)) return false;
  const owner = createHash('sha256').update(userId).digest('hex').slice(0, 16);
  return ['mp4', 'mov', 'webm'].some(extension => objectKey === `temporary/video-narrative/${owner}/${sessionId}.${extension}`);
}
