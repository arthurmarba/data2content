import { Types } from "mongoose";

import { connectToDatabase } from "@/app/lib/mongoose";
import {
  critiqueCreatorScriptV3,
  generateCreatorScriptV3,
} from "@/app/lib/scripts/creatorScriptGenerationV3";
import type { CreatorScriptGoal } from "@/app/lib/scripts/creatorScriptEvidencePack";
import {
  getCreatorScriptDnaV3,
  sanitizeCreatorScriptDnaForMcp,
} from "@/app/lib/scripts/creatorScriptDnaV3";
import { buildScriptIntelligenceContext } from "@/app/lib/scripts/intelligenceContext";
import ScriptEntry from "@/app/models/ScriptEntry";

export async function getMcpCreatorContentDna(userId: string) {
  const profile = await getCreatorScriptDnaV3({ userId });
  return sanitizeCreatorScriptDnaForMcp(profile);
}

export async function generateMcpCreatorScript(params: {
  userId: string;
  prompt: string;
  title?: string;
  goal?: CreatorScriptGoal;
  targetDurationSeconds?: number | null;
}) {
  const intelligenceContext = await buildScriptIntelligenceContext({
    userId: params.userId,
    prompt: params.prompt,
  });
  const result = await generateCreatorScriptV3({
    userId: params.userId,
    prompt: params.prompt,
    title: params.title,
    goal: params.goal,
    targetDurationSeconds: params.targetDurationSeconds,
    intelligenceContext,
  });

  return {
    schemaVersion: "creator_script_generation_v3",
    generatedAt: new Date().toISOString(),
    title: result.title,
    content: result.content,
    estimatedDurationSeconds: result.estimatedDurationSeconds,
    targetDurationSeconds: result.targetDurationSeconds,
    provider: result.provider,
    model: result.model,
    validation: {
      passed: result.validation.passed,
      durationWithinTolerance: result.validation.durationWithinTolerance,
      verbatimOverlapDetected: Boolean(result.validation.verbatimOverlap),
      technicalScore: result.validation.technicalScore,
      warnings: result.validation.warnings,
    },
    evidenceReceipt: result.evidenceReceipt,
    responseContract: {
      preserveScriptVerbatim: true,
      saveRequiresExplicitUserRequest: true,
      rules: [
        "Apresente o roteiro gerado sem reescrever silenciosamente o texto.",
        "Explique limitações quando evidenceReceipt.status não for complete.",
        "Só use save_generated_script após pedido explícito do usuário.",
      ],
    },
  };
}

export async function critiqueMcpCreatorScript(params: {
  userId: string;
  content: string;
  prompt?: string;
  targetDurationSeconds?: number | null;
}) {
  const result = await critiqueCreatorScriptV3(params);
  return {
    ...result,
    responseContract: {
      rules: [
        "Trate o diagnóstico como aderência ao histórico do próprio creator, não como garantia de performance.",
        "Não invente evidências ausentes do evidenceReceipt.",
      ],
    },
  };
}

export async function saveMcpGeneratedScript(params: {
  userId: string;
  title: string;
  content: string;
  clientRequestId: string;
}) {
  if (!Types.ObjectId.isValid(params.userId)) throw new Error("invalid_user_id");
  await connectToDatabase();
  const userId = new Types.ObjectId(params.userId);
  const existing = await ScriptEntry.findOne({
    userId,
    clientRequestId: params.clientRequestId,
  }).lean<{ _id: Types.ObjectId; title: string; createdAt: Date }>();
  if (existing) {
    return {
      schemaVersion: "saved_script_v1",
      id: String(existing._id),
      title: existing.title,
      createdAt: new Date(existing.createdAt).toISOString(),
      created: false,
      idempotentReplay: true,
    };
  }

  try {
    const script = await ScriptEntry.create({
      userId,
      clientRequestId: params.clientRequestId,
      title: params.title,
      content: params.content,
      source: "ai",
      linkType: "standalone",
    });
    return {
      schemaVersion: "saved_script_v1",
      id: String(script._id),
      title: script.title,
      createdAt: script.createdAt.toISOString(),
      created: true,
      idempotentReplay: false,
    };
  } catch (error: unknown) {
    if ((error as { code?: number })?.code !== 11000) throw error;
    const replay = await ScriptEntry.findOne({ userId, clientRequestId: params.clientRequestId })
      .lean<{ _id: Types.ObjectId; title: string; createdAt: Date }>();
    if (!replay) throw error;
    return {
      schemaVersion: "saved_script_v1",
      id: String(replay._id),
      title: replay.title,
      createdAt: new Date(replay.createdAt).toISOString(),
      created: false,
      idempotentReplay: true,
    };
  }
}
