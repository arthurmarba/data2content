import mongoose, { Types } from "mongoose";
import { randomUUID } from "node:crypto";
import { connectToDatabase } from "@/app/lib/mongoose";
import McpAdminAuditEventModel, {
  type IMcpAdminAuditPeriod,
  type McpAdminAuditStatus,
} from "@/app/models/McpAdminAuditEvent";
import { logger } from "@/app/lib/logger";
import { getMcpAdminAuditRetentionDays } from "./config";

export class McpAdminAuditUnavailableError extends Error {
  constructor(message = "A trilha de auditoria administrativa está indisponível.") {
    super(message);
    this.name = "McpAdminAuditUnavailableError";
  }
}

export interface McpAdminAuditStartInput {
  requestId: string;
  actorUserId: string;
  targetCreatorIds?: string[];
  clientId?: string;
  tool: string;
  scopes: string[];
  period?: IMcpAdminAuditPeriod | null;
}

export interface McpAdminAuditCompletionInput {
  status: Exclude<McpAdminAuditStatus, "started">;
  durationMs: number;
  resultCount?: number | null;
  errorCode?: string | null;
}

function auditFailure(
  operation: "begin" | "complete",
  error: unknown,
  meta: Record<string, unknown>,
) {
  logger.error("[mcp][admin_audit_write_failed]", {
    operation,
    ...meta,
    error: error instanceof Error ? error.message : String(error),
  });
  return new McpAdminAuditUnavailableError();
}

export async function beginMcpAdminAuditEvent(input: McpAdminAuditStartInput): Promise<string> {
  if (!mongoose.isValidObjectId(input.actorUserId)) {
    throw auditFailure("begin", new Error("invalid_actor_user_id"), {
      requestId: input.requestId,
      tool: input.tool,
    });
  }

  const invocationId = randomUUID();
  const targets = [...new Set(input.targetCreatorIds ?? [])]
    .filter((value) => mongoose.isValidObjectId(value))
    .map((value) => new Types.ObjectId(value));
  const expiresAt = new Date(
    Date.now() + getMcpAdminAuditRetentionDays() * 24 * 60 * 60 * 1_000,
  );

  try {
    await connectToDatabase();
    await McpAdminAuditEventModel.create({
      invocationId,
      requestId: input.requestId,
      actorUserId: new Types.ObjectId(input.actorUserId),
      targetCreatorIds: targets,
      clientId: input.clientId || null,
      tool: input.tool,
      scopes: input.scopes,
      period: input.period ?? null,
      status: "started",
      durationMs: 0,
      resultCount: null,
      errorCode: null,
      expiresAt,
    });
    return invocationId;
  } catch (error) {
    throw auditFailure("begin", error, { requestId: input.requestId, tool: input.tool });
  }
}

export async function completeMcpAdminAuditEvent(
  invocationId: string,
  input: McpAdminAuditCompletionInput,
): Promise<void> {
  try {
    await connectToDatabase();
    const result = await McpAdminAuditEventModel.updateOne(
      { invocationId, status: "started" },
      {
        $set: {
          status: input.status,
          durationMs: Math.max(0, Math.round(input.durationMs)),
          resultCount: input.resultCount ?? null,
          errorCode: input.errorCode || null,
        },
      },
    );
    if (result.matchedCount !== 1) {
      throw new Error("audit_event_not_found_or_already_completed");
    }
  } catch (error) {
    throw auditFailure("complete", error, { invocationId });
  }
}
