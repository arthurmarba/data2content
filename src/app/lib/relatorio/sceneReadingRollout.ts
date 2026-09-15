import { connectToDatabase } from "@/app/lib/mongoose";
import Policy from "@/app/models/SceneReadingPolicy";
import Operation from "@/app/models/GeminiOperation";
import { governanceHash } from "../llm/geminiGovernance";
import { LEGACY_SCENE_FORMAT, COMPACT_SCENE_FORMAT, type SceneResponseFormat } from "./compactSceneFormat";

export function chooseSceneFormat(key: string, percent: number): SceneResponseFormat {
  if (![0, 10, 50, 100].includes(percent)) return LEGACY_SCENE_FORMAT;
  return parseInt(governanceHash(key).slice(0, 8), 16) % 100 < percent ? COMPACT_SCENE_FORMAT : LEGACY_SCENE_FORMAT;
}
export async function resolveSceneFormat(creatorId: string, contentKey: string): Promise<SceneResponseFormat> {
  await connectToDatabase();
  const id = governanceHash([creatorId, contentKey, "cena"]);
  const operation = await Operation.findById(id).select("responseFormat").lean();
  if (operation) return operation.responseFormat === COMPACT_SCENE_FORMAT ? COMPACT_SCENE_FORMAT : LEGACY_SCENE_FORMAT;
  const assigned = await Policy.findById(id).lean();
  if (assigned?.format) return assigned.format;
  const rollout = await Policy.findById("rollout").lean();
  const format = chooseSceneFormat(id, rollout?.compactPercent ?? 0);
  try {
    const pinned = await Policy.findOneAndUpdate({ _id: id }, { $setOnInsert: { format } }, { upsert: true, new: true }).lean();
    return pinned!.format!;
  } catch (error: any) {
    if (error?.code !== 11000) throw error;
    const winner = await Policy.findById(id).lean();
    if (!winner?.format) throw error;
    return winner.format;
  }
}
