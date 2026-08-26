import { NextRequest, NextResponse } from "next/server";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  authenticateAdminMcpRequest,
  buildMcpAdminWwwAuthenticateHeader,
  McpAuthError,
} from "@/app/lib/mcp/auth";
import { getMcpAdminAuthorization } from "@/app/lib/mcp/adminAuthorization";
import { createD2CAdminMcpServer } from "@/app/lib/mcp/adminServer";
import { isMcpAdminEnabled } from "@/app/lib/mcp/config";
import { logger } from "@/app/lib/logger";
import { checkRateLimitStrict } from "@/utils/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreHeaders() {
  return { "Cache-Control": "no-store" };
}

async function handleAdminMcpRequest(request: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  if (!isMcpAdminEnabled()) {
    return NextResponse.json(
      { error: "admin_mcp_disabled", message: "O MCP administrativo ainda não está habilitado." },
      { status: 503, headers: noStoreHeaders() },
    );
  }

  try {
    const identity = await authenticateAdminMcpRequest(request);
    const authorization = await getMcpAdminAuthorization(identity.userId);
    if (!authorization.authorized) {
      const status = authorization.reason === "authorization_unavailable" ? 503 : 403;
      throw new McpAuthError(
        "admin_required",
        status,
        status === 503
          ? "Não foi possível validar o acesso administrativo."
          : "Esta conta não possui acesso ao MCP administrativo.",
      );
    }

    const rateLimit = await checkRateLimitStrict(`mcp_admin:${identity.userId}`, 60, 60);
    if (!rateLimit.available) {
      return NextResponse.json(
        {
          error: "rate_limit_unavailable",
          message: "A proteção de limite administrativo está temporariamente indisponível.",
        },
        { status: 503, headers: { ...noStoreHeaders(), "Retry-After": "10" } },
      );
    }
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "rate_limit_exceeded", message: "Muitas solicitações administrativas. Tente novamente em instantes." },
        { status: 429, headers: { ...noStoreHeaders(), "Retry-After": "60" } },
      );
    }

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    const server = createD2CAdminMcpServer({ identity, authorization, requestId });
    await server.connect(transport);
    const response = await transport.handleRequest(request);

    logger.info("[mcp][admin_request_completed]", {
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
        headers["WWW-Authenticate"] = buildMcpAdminWwwAuthenticateHeader(error);
      }
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status, headers },
      );
    }

    logger.error("[mcp][admin_request_failed]", {
      requestId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "internal_error", message: "Não foi possível processar a solicitação MCP administrativa." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleAdminMcpRequest(request);
}

export async function POST(request: NextRequest) {
  return handleAdminMcpRequest(request);
}

export async function DELETE(request: NextRequest) {
  return handleAdminMcpRequest(request);
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
