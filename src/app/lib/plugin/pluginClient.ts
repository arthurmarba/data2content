// O chat de onde a pessoa chegou: ChatGPT ou Claude.
//
// Tudo que o site faz para quem vem de um plugin (volta depois da assinatura,
// conexão do Instagram, medição) passa por aqui. Seguro para cliente e servidor.

export type PluginClient = "chatgpt" | "claude";

export const PLUGIN_CLIENT_LABEL: Record<PluginClient, string> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
};

/** O que a pessoa pediu no chat quando bateu no limite. Leva direto à parte certa do site. */
export type PluginIntent = "mapa" | "pautas" | "analise" | "inspiracoes" | "collabs" | "roteiro";

const PLUGIN_INTENTS = new Set<PluginIntent>(["mapa", "pautas", "analise", "inspiracoes", "collabs", "roteiro"]);

export function parsePluginClient(value: unknown): PluginClient | null {
  return value === "chatgpt" || value === "claude" ? value : null;
}

export function parsePluginIntent(value: unknown): PluginIntent | null {
  return typeof value === "string" && PLUGIN_INTENTS.has(value as PluginIntent) ? (value as PluginIntent) : null;
}

export function pluginReadyPath(client: PluginClient): string {
  return client === "claude" ? "/dashboard/claude/ready" : "/dashboard/chatgpt/ready";
}

export type PluginInstagramNextTarget = "chatgpt-plugin" | "claude-plugin";

export function pluginInstagramNextTarget(client: PluginClient): PluginInstagramNextTarget {
  return client === "claude" ? "claude-plugin" : "chatgpt-plugin";
}

export function pluginClientFromNextTarget(value: unknown): PluginClient | null {
  if (value === "chatgpt-plugin") return "chatgpt";
  if (value === "claude-plugin") return "claude";
  return null;
}

/**
 * Evento de funil por chat. O do ChatGPT também alimenta o pixel de anúncios da
 * OpenAI; quem vem do Claude não pode entrar nessa conta.
 */
export function pluginFunnelEventName(client: PluginClient): "chatgpt_funnel_event" | "claude_funnel_event" {
  return client === "claude" ? "claude_funnel_event" : "chatgpt_funnel_event";
}

/** Contexto de paywall de cada chat (copy e medição próprias). */
export function pluginPaywallContext(client: PluginClient): "chatgpt_intelligence" | "claude_intelligence" {
  return client === "claude" ? "claude_intelligence" : "chatgpt_intelligence";
}

const CLAUDE_DEFAULT_RETURN_URL = "https://claude.ai/new";

/**
 * Para onde o botão "voltar" leva. No ChatGPT só vale a URL pública do plugin:
 * a home genérica largaria a pessoa sem a Data2Content. No Claude o conector
 * fica ligado na conta, então uma conversa nova já tem a Data2Content.
 */
export function resolvePluginReturnUrl(client: PluginClient, configured: unknown): string | null {
  const fallback = client === "claude" ? CLAUDE_DEFAULT_RETURN_URL : null;
  if (typeof configured !== "string" || !configured.trim()) return fallback;
  try {
    const url = new URL(configured.trim());
    if (url.protocol !== "https:") return fallback;
    if (client === "chatgpt") {
      const isGenericChatGptHome =
        (url.hostname === "chatgpt.com" || url.hostname === "www.chatgpt.com")
        && url.pathname === "/"
        && !url.search
        && !url.hash;
      if (isGenericChatGptHome) return null;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}
