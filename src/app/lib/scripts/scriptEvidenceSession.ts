import { createHash, randomUUID } from "node:crypto";
import { Types } from "mongoose";
import ScriptEvidenceSession from "@/app/models/ScriptEvidenceSession";
import { connectToDatabase } from "@/app/lib/mongoose";
import type { CreatorScriptEvidencePack } from "./creatorScriptEvidencePack";

export const scriptTextHash = (text: string) => createHash("sha256").update(text.trim()).digest("hex");
export async function rememberScriptEvidence(params: {
  userId: string; pack: CreatorScriptEvidencePack; mode: "client" | "internal";
  content?: string; provider?: string; clientRequestId?: string;
}) {
  await connectToDatabase();
  const clientRequestId = params.clientRequestId || `mcp-${randomUUID()}`;
  await ScriptEvidenceSession.create({
    userId: new Types.ObjectId(params.userId), clientRequestId,
    packId: params.pack.receipt.packId || scriptTextHash(JSON.stringify(params.pack)),
    pack: params.pack, mode: params.mode, provider: params.provider || null,
    draftHash: params.content ? scriptTextHash(params.content) : null,
    draftContent: params.content?.slice(0,20000) || null,
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  return clientRequestId;
}
export async function readScriptEvidenceSession(userId: string, clientRequestId: string) {
  if (!Types.ObjectId.isValid(userId) || !/^mcp-[0-9a-f-]{36}$/i.test(clientRequestId)) throw new Error("invalid_evidence_session");
  await connectToDatabase();
  return ScriptEvidenceSession.findOne({ userId: new Types.ObjectId(userId), clientRequestId, expiresAt: { $gt: new Date() } }).lean();
}
export async function scriptProvenanceForSave(userId: string, clientRequestId: string, content: string) {
  const session = await readScriptEvidenceSession(userId, clientRequestId);
  if (!session) return { status: "unverified", reason: "Pacote ausente ou expirado; nenhuma origem inferida." };
  const pack = session.pack as CreatorScriptEvidencePack;
  return {
    status: "recorded", packId: session.packId, mode: session.mode, provider: session.provider,
    request: pack.request, receipt: pack.receipt,
    references: pack.winningExemplars.map(e => ({ contentId: e.contentId, source: e.source, role: e.role, metrics: e.metrics, quality: e.quality })),
    originalDraftHash: session.draftHash,
    approvedDraftHash: scriptTextHash(content),
    originalContent: session.draftContent,
    approvedContent: content.slice(0,20000),
    editedAfterGeneration: session.draftHash ? session.draftHash !== scriptTextHash(content) : null,
    preparedAt: session.createdAt,
  };
}
