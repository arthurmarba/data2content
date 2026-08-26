import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { authenticateMcpRequest, buildMcpWwwAuthenticateHeader, McpAuthError } from "@/app/lib/mcp/auth";
import { getMcpEntitlement } from "@/app/lib/mcp/entitlement";
import { createD2CMcpServer } from "@/app/lib/mcp/server";
import { getMcpUpgradeUrl } from "@/app/lib/mcp/config";
import { logger } from "@/app/lib/logger";
import { checkRateLimit } from "@/utils/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

async function handleMcpRequest(request: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

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

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createD2CMcpServer({ identity, entitlement });
    await server.connect(transport);
    const response = await transport.handleRequest(request);

    logger.info("[mcp] Request completed.", {
      requestId,
      method: request.method,
      status: response.status,
      durationMs: Date.now() - startedAt,
      clientId: identity.clientId,
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
