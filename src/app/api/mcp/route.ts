import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpRequest, buildMcpWwwAuthenticateHeader, McpAuthError } from "@/app/lib/mcp/auth";
import { getMcpEntitlement } from "@/app/lib/mcp/entitlement";
import { createD2CMcpServer } from "@/app/lib/mcp/server";
import { getMcpUpgradeUrl } from "@/app/lib/mcp/config";
import { logger } from "@/app/lib/logger";
import { checkRateLimit } from "@/utils/rateLimit";
import {
  mcpResultAuditForPayload,
  mcpToolAuditForPayload,
  mcpToolNamesForPayload,
  missingMcpScopes,
  requiredScopesForMcpPayload,
} from "@/app/lib/mcp/toolAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let toolNames: string[] = [];
  let toolAudit: Array<Record<string, unknown>> = [];

  try {
    const identity = await authenticateMcpRequest(request);
    const rateLimit = await checkRateLimit(`mcp:${identity.userId}`, 120, 60);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rate_limit_exceeded", message: "Muitas solicitações MCP. Tente novamente em instantes." },
        {
          status: 429,
          headers: { ...noStoreHeaders(), "Retry-After": "60" },
        },
      );
    }
    const entitlement = await getMcpEntitlement(identity.userId);

    if (!entitlement.eligible) {
      const status = entitlement.reason === "entitlement_unavailable" ? 503 : 403;
      logger.warn("[mcp] Request blocked by subscription entitlement.", {
        requestId,
        reason: entitlement.reason,
        clientId: identity.clientId,
      });
      return NextResponse.json(
        {
          error: "subscription_required",
          reason: entitlement.reason,
          message: "O MCP da Data2Content está disponível apenas para assinantes ativos.",
          upgradeUrl: getMcpUpgradeUrl(),
        },
        { status, headers: noStoreHeaders() },
      );
    }

    if (request.method === "POST") {
      const payload = await request.clone().json().catch(() => null);
      toolNames = mcpToolNamesForPayload(payload);
      toolAudit = mcpToolAuditForPayload(payload);
      const requiredScopes = requiredScopesForMcpPayload(payload);
      const missingScopes = missingMcpScopes(identity.scopes, requiredScopes);
      if (missingScopes.length > 0) {
        throw new McpAuthError(
          "insufficient_scope",
          403,
          `Autorize ${missingScopes.join(", ")} para usar esta ferramenta.`,
          [...identity.scopes, ...missingScopes],
        );
      }
      if (toolNames.includes("generate_creator_script")) {
        const configuredLimit = Number(process.env.MCP_SCRIPT_GENERATION_HOURLY_LIMIT || 20);
        const hourlyLimit = Number.isFinite(configuredLimit)
          ? Math.max(1, Math.min(100, Math.floor(configuredLimit)))
          : 20;
        const generationRate = await checkRateLimit(
          `mcp:script_generation:${identity.userId}`,
          hourlyLimit,
          3600,
        );
        if (!generationRate.allowed) {
          return NextResponse.json(
            {
              error: "script_generation_rate_limit_exceeded",
              message: "Limite de geração de roteiros atingido. Tente novamente mais tarde.",
            },
            {
              status: 429,
              headers: { ...noStoreHeaders(), "Retry-After": "3600" },
            },
          );
        }
      }
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createD2CMcpServer({ identity, entitlement });
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    const resultAudit = toolNames.some((name) => ["analyze_content_period", "get_data_coverage"].includes(name))
      ? mcpResultAuditForPayload(await response.clone().json().catch(() => null))
      : [];

    logger.info("[mcp] Request completed.", {
      requestId,
      method: request.method,
      status: response.status,
      durationMs: Date.now() - startedAt,
      clientId: identity.clientId,
      tools: toolNames,
      toolAudit,
      resultAudit,
      scopes: identity.scopes,
    });

    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch (error) {
    if (error instanceof McpAuthError) {
      const headers: Record<string, string> = noStoreHeaders();
      if (error.status === 401 || error.status === 403) {
        headers["WWW-Authenticate"] = buildMcpWwwAuthenticateHeader(error);
      }
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status, headers },
      );
    }

    logger.error("[mcp] Unhandled request error.", {
      requestId,
      durationMs: Date.now() - startedAt,
      tools: toolNames,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "internal_error", message: "Não foi possível processar a solicitação MCP." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function POST(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleMcpRequest(request);
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Headers":
        "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "MCP-Protocol-Version, MCP-Session-Id, X-Request-Id",
      "Cache-Control": "no-store",
    },
  });
}
