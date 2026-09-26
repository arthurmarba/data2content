// De qual chat vem a conexão MCP.
//
// O funil depende disso: o link de perfil, a volta depois da assinatura e a
// medição precisam saber se a pessoa está no ChatGPT ou no Claude. Antes todo
// link dizia `source=chatgpt`, e quem vinha do Claude terminava numa tela
// "volte ao ChatGPT".
//
// O registro do cliente OAuth é a fonte: o Claude se registra como "Claude"
// com retorno em claude.ai; o ChatGPT como "ChatGPT" com retorno em chatgpt.com.

import { connectToDatabase } from "@/app/lib/mongoose";
import McpOAuthClientModel from "@/app/models/McpOAuthClient";
import type { PluginClient } from "@/app/lib/plugin/pluginClient";

export type McpClientSurface = PluginClient;

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { surface: McpClientSurface; expiresAt: number }>();

function hostOf(uri: string): string {
  try {
    return new URL(uri).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** Decide a superfície pelo registro do cliente. Sem sinal claro, fica ChatGPT, o comportamento anterior. */
export function surfaceFromClientRegistration(registration: {
  clientName?: string | null;
  redirectUris?: string[] | null;
}): McpClientSurface {
  const hosts = (registration.redirectUris ?? []).map(hostOf);
  if (hosts.some((host) => host === "claude.ai" || host.endsWith(".claude.ai") || host === "claude.com" || host.endsWith(".claude.com"))) {
    return "claude";
  }
  if (hosts.some((host) => host === "chatgpt.com" || host.endsWith(".chatgpt.com") || host.endsWith(".openai.com"))) {
    return "chatgpt";
  }
  return /claude|anthropic/i.test(registration.clientName ?? "") ? "claude" : "chatgpt";
}

export async function resolveMcpClientSurface(clientId: string | null | undefined): Promise<McpClientSurface> {
  if (!clientId) return "chatgpt";
  const cached = cache.get(clientId);
  if (cached && cached.expiresAt > Date.now()) return cached.surface;
  try {
    await connectToDatabase();
    const registration = await McpOAuthClientModel.findOne({ clientId })
      .select("clientName redirectUris")
      .lean<{ clientName?: string; redirectUris?: string[] } | null>();
    const surface = registration ? surfaceFromClientRegistration(registration) : "chatgpt";
    cache.set(clientId, { surface, expiresAt: Date.now() + CACHE_TTL_MS });
    return surface;
  } catch {
    // Falha na consulta não pode derrubar a conversa: segue com o padrão antigo.
    return "chatgpt";
  }
}
