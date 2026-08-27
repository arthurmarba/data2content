import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import UserModel from "@/app/models/User";

export class McpCreatorNorthValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McpCreatorNorthValidationError";
  }
}

export function normalizeMcpCreatorNorth(value: unknown): string {
  if (typeof value !== "string") {
    throw new McpCreatorNorthValidationError("O Norte deve ser enviado como texto.");
  }
  const normalized = value.trim();
  if (normalized.length < 15) {
    throw new McpCreatorNorthValidationError("Descreva seu Norte em pelo menos 15 caracteres.");
  }
  if (normalized.length > 400) {
    throw new McpCreatorNorthValidationError("O Norte deve ter no máximo 400 caracteres.");
  }
  return normalized;
}

export async function saveMcpCreatorNorth(userId: string, value: unknown) {
  if (!mongoose.isValidObjectId(userId)) return null;
  const creatorNorth = normalizeMcpCreatorNorth(value);
  const updatedAt = new Date();

  await connectToDatabase();
  const user = await UserModel.findByIdAndUpdate(
    userId,
    {
      $set: {
        "onboardingAnswers.creatorPurpose": creatorNorth,
        onboardingCompletedAt: updatedAt,
        isNewUserForOnboarding: false,
      },
    },
    { new: true },
  )
    .select("_id")
    .lean();

  if (!user) return null;

  let seedSignal: unknown = null;
  try {
    const { seedMapaSeedFromPurpose } = await import("@/app/lib/mapaSeed/seedMapaSeedFromPurpose");
    seedSignal = await seedMapaSeedFromPurpose(userId, creatorNorth);
  } catch (error) {
    logger.warn("[mcp][creator_north_seed_failed]", {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    schemaVersion: "creator_north_v1" as const,
    creatorNorth,
    updatedAt: updatedAt.toISOString(),
    seedSignal,
    next: {
      tool: "research_inspiration_content" as const,
      instruction:
        "Use o Norte como tema para buscar padrões agregados da comunidade e então produza a primeira resposta contextualizada.",
    },
  };
}
