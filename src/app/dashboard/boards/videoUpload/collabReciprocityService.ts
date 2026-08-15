import { Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import CollabInterest from "@/app/models/CollabInterest";

export interface IncomingCollabInterest {
  creatorId: string;
  territoryNorm: string;
}

/**
 * Interesses recebidos continuam privados. O matcher usa somente a identidade
 * e o território para garantir que o outro lado tenha a oportunidade real de
 * avaliar a mesma dupla, sem informar que alguém já disse "sim".
 */
export async function getIncomingCollabInterests(
  viewerUserId: string,
): Promise<IncomingCollabInterest[]> {
  if (!Types.ObjectId.isValid(viewerUserId)) return [];
  try {
    await connectToDatabase();
    const now = new Date();
    const docs = await CollabInterest.find({
      partner: new Types.ObjectId(viewerUserId),
      decision: "interested",
      matchedAt: null,
      pautaTerritoryNorm: { $nin: [null, ""] },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    })
      .sort({ updatedAt: -1 })
      .select("user pautaTerritoryNorm")
      .lean<Array<{ user: Types.ObjectId; pautaTerritoryNorm?: string | null }>>();

    const seen = new Set<string>();
    const result: IncomingCollabInterest[] = [];
    for (const doc of docs) {
      const creatorId = doc.user.toString();
      const territoryNorm = doc.pautaTerritoryNorm?.trim() ?? "";
      const key = `${creatorId}:${territoryNorm}`;
      if (!territoryNorm || seen.has(key)) continue;
      seen.add(key);
      result.push({ creatorId, territoryNorm });
    }
    return result;
  } catch {
    return [];
  }
}
