// Oferta na conexão do Claude — desligada até a aprovação no diretório.
//
// A política do diretório da Anthropic não proíbe mostrar planos no login (a da
// OpenAI proíbe; por isso é só para o Claude). A regra da D2C é mostrar valor
// antes: só aparece para conta gratuita que já tem narrativa, uma vez por
// pessoa, e nunca bloqueia a conexão.
//
// O código OAuth só é emitido quando a pessoa clica em "Continuar no Claude":
// o pedido de consentimento fica aberto por até 30 minutos, o bastante para ver
// os planos e voltar sem que a conexão expire.

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import McpOAuthConsentRequestModel from "@/app/models/McpOAuthConsentRequest";
import UserModel from "@/app/models/User";
import { getMcpAccountState } from "../accountState";
import { isMcpAdminResource } from "../config";
import { surfaceFromClientRegistration } from "../clientSurface";
import { loadMcpCreatorMap } from "../creatorMap";
import { hashOpaqueOAuthToken, safeOAuthStringEqual } from "./crypto";

const OFFER_WINDOW_MS = 30 * 60 * 1000;

export function isClaudeConnectOfferEnabled(): boolean {
  return process.env.MCP_CLAUDE_CONNECT_OFFER_ENABLED?.trim() === "1";
}

export function connectOfferPath(token: string): string {
  return `/mcp/conectado?${new URLSearchParams({ request: token }).toString()}`;
}

async function readOpenConsent(token: string) {
  if (!token || token.length > 200) return null;
  await connectToDatabase();
  return McpOAuthConsentRequestModel.findOne({
    requestHash: hashOpaqueOAuthToken(token),
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).lean();
}

/**
 * Decide, no clique em "Autorizar", se a pessoa passa pela oferta antes de
 * voltar ao Claude. Qualquer dúvida ou falha segue o login de sempre.
 */
export async function prepareClaudeConnectOffer(
  token: string,
  userId: string,
  now = new Date(),
): Promise<{ show: false } | { show: true; path: string }> {
  if (!isClaudeConnectOfferEnabled() || !Types.ObjectId.isValid(userId)) return { show: false };
  try {
    const consent = await readOpenConsent(token);
    if (!consent || !safeOAuthStringEqual(String(consent.userId), userId)) return { show: false };
    if (isMcpAdminResource(consent.resource)) return { show: false };
    const client = surfaceFromClientRegistration({ clientName: consent.clientName, redirectUris: [consent.redirectUri] });
    if (client !== "claude") return { show: false };

    const [accountState, map] = await Promise.all([
      getMcpAccountState(userId),
      loadMcpCreatorMap(userId).catch(() => null),
    ]);
    if (!accountState.accountAvailable || accountState.accessLevel !== "free") return { show: false };
    if (!map?.narrative) return { show: false };

    // Uma vez por pessoa: só quem ganha esta gravação vê a oferta.
    const marked = await UserModel.updateOne(
      { _id: new Types.ObjectId(userId), pluginConnectOfferSeenAt: { $exists: false } },
      { $set: { pluginConnectOfferSeenAt: now } },
    );
    if (!marked.modifiedCount) return { show: false };

    await McpOAuthConsentRequestModel.updateOne(
      { _id: consent._id, consumedAt: null },
      { $set: { expiresAt: new Date(now.getTime() + OFFER_WINDOW_MS) } },
    );
    return { show: true, path: connectOfferPath(token) };
  } catch (error) {
    logger.warn("[mcp][connect_offer_skipped]", {
      error: error instanceof Error ? error.name : "unknown_error",
    });
    return { show: false };
  }
}

export interface ClaudeConnectOfferView {
  narrative: string | null;
  territories: string[];
  narrativeIsFirm: boolean;
  accessLevel: "free" | "pro";
}

/** Dados da página de oferta. Pedido vencido ou de outra conta devolve null. */
export async function loadClaudeConnectOffer(token: string, userId: string): Promise<ClaudeConnectOfferView | null> {
  if (!Types.ObjectId.isValid(userId)) return null;
  const consent = await readOpenConsent(token);
  if (!consent || !safeOAuthStringEqual(String(consent.userId), userId)) return null;
  const [accountState, map] = await Promise.all([
    getMcpAccountState(userId),
    loadMcpCreatorMap(userId).catch(() => null),
  ]);
  return {
    narrative: map?.narrative ?? null,
    territories: map?.territories.slice(0, 4) ?? [],
    narrativeIsFirm: map?.narrativeIsFirm ?? false,
    accessLevel: accountState.accessLevel,
  };
}
