import { NextRequest, NextResponse } from "next/server";
import {
  approveMcpConsent,
  createMcpConsentRequest,
  denyMcpConsent,
} from "@/app/lib/mcp/oauth/service";
import { getMcpAppBaseUrl } from "@/app/lib/mcp/config";
import { McpOAuthError } from "@/app/lib/mcp/oauth/validation";
import { readMcpOAuthSessionUserId } from "@/app/lib/mcp/oauth/session";
import { oauthErrorResponse } from "../http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function loginRedirect(request: NextRequest): NextResponse {
  const login = new URL("/login", getMcpAppBaseUrl());
  // O login aceita somente destinos internos relativos. Enviar `request.url`
  // (absoluta) fazia o normalizador de segurança cair no dashboard e quebrava
  // a continuação do OAuth para usuários ainda deslogados.
  login.searchParams.set(
    "callbackUrl",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  login.searchParams.set("mcp", "1");
  return NextResponse.redirect(login);
}

export async function GET(request: NextRequest) {
  try {
    const userId = await readMcpOAuthSessionUserId(request.cookies);
    if (!userId) return loginRedirect(request);

    const params = request.nextUrl.searchParams;
    const consentToken = await createMcpConsentRequest(
      {
        responseType: params.get("response_type"),
        clientId: params.get("client_id"),
        redirectUri: params.get("redirect_uri"),
        scope: params.get("scope"),
        state: params.get("state"),
        resource: params.get("resource"),
        codeChallenge: params.get("code_challenge"),
        codeChallengeMethod: params.get("code_challenge_method"),
      },
      userId,
    );
    const consentUrl = new URL("/mcp/authorize", getMcpAppBaseUrl());
    consentUrl.searchParams.set("request", consentToken);
    return NextResponse.redirect(consentUrl);
  } catch (error) {
    return oauthErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await readMcpOAuthSessionUserId(request.cookies);
    if (!userId) throw new McpOAuthError("access_denied", 401, "Faça login para autorizar.");
    const form = await request.formData();
    const token = form.get("request");
    const decision = form.get("decision");
    if (typeof token !== "string" || (decision !== "approve" && decision !== "deny")) {
      throw new McpOAuthError("invalid_request", 400, "Resposta de consentimento inválida.");
    }
    const destination = decision === "approve"
      ? await approveMcpConsent(token, userId)
      : await denyMcpConsent(token, userId);
    return NextResponse.redirect(destination, 303);
  } catch (error) {
    return oauthErrorResponse(error);
  }
}
