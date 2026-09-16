import { campaignRadarSourceRegistry } from "./sourceRegistry";

/**
 * O ícone da plataforma sai do domínio dela, mas é servido por nós: o navegador
 * de quem usa o app não avisa quarenta e cinco sites que alguém está olhando as
 * publis. A porta do criador (`creatorEntryUrl`) é o domínio certo — o
 * `publicCheckUrl` às vezes aponta para sitemap, linktree ou feed JSON.
 */
export function sourceIconOrigin(sourceId: string): string | null {
  const entry = campaignRadarSourceRegistry.find((source) => source.sourceId === sourceId);
  if (!entry) return null;
  for (const candidate of [entry.creatorEntryUrl, entry.publicCheckUrl]) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch {
      continue;
    }
  }
  return null;
}
