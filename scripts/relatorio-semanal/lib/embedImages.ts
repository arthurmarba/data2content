/**
 * embedImages.ts — baixa as capas e embute no próprio arquivo.
 *
 * POR QUE ISTO É NECESSÁRIO, e é um bug com data. As URLs de capa do Instagram são
 * ASSINADAS e expiram. Medido numa capa real do relatório da semana 29:
 *
 *     oe=6A726EB1  →  expira em 2026-08-04T22:58Z
 *
 * O PDF guarda o LINK, não a imagem. Então o deck nasce com as fotos e fica sem elas
 * poucos dias depois — quem abrisse o relatório na semana seguinte veria retângulos
 * vazios, e foi exatamente essa a queixa. É o mesmo problema do `media_url` que já
 * havia sido resolvido no caminho do Gemini e que passou batido no do render.
 *
 * A correção é baixar no momento do render e virar `data:` URI. O PDF cresce (uma capa
 * de reel dá ~15KB), e em troca ele é um arquivo completo: funciona offline, daqui a um
 * ano, sem depender de a Meta continuar servindo aquela URL.
 *
 * Falha em baixar não derruba o render — a capa fica vazia, como ficava antes.
 */

import type { WeeklyReportData } from "../../../src/app/lib/relatorio/types";

/** Acima disto a capa não é capa de reel; provavelmente é outra coisa. */
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const TIMEOUT_MS = 15_000;

async function fetchAsDataUri(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength === 0 || buffer.byteLength > MAX_IMAGE_BYTES) return null;
    const mime = response.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

export interface EmbedResult {
  report: WeeklyReportData;
  embedded: number;
  failed: number;
  bytes: number;
}

/**
 * Devolve uma CÓPIA do relatório com as capas trocadas por `data:` URI.
 *
 * Não muta o original: `report.json` continua guardando a URL, que é a informação
 * verdadeira sobre o post. O embutido é uma decisão do render, não do dado.
 */
export async function embedThumbnails(report: WeeklyReportData): Promise<EmbedResult> {
  const urls = new Set<string>();
  for (const territory of report.territories) {
    for (const video of territory.topVideos) {
      if (video.thumbnailUrl?.startsWith("http")) urls.add(video.thumbnailUrl);
    }
  }
  // Os destaques também têm capa desde que pararam de descartar o post vencedor. Sem
  // passar por aqui, o pódio nasceria com foto e a perderia em poucos dias — o mesmo
  // bug que já custou as imagens uma vez.
  for (const highlight of report.highlights) {
    if (highlight.post?.thumbnailUrl?.startsWith("http")) urls.add(highlight.post.thumbnailUrl);
    // A foto de perfil também é URL da Meta e expira igual.
    if (highlight.creatorAvatarUrl?.startsWith("http")) urls.add(highlight.creatorAvatarUrl);
  }

  const entries = await Promise.all(
    [...urls].map(async (url) => [url, await fetchAsDataUri(url)] as const),
  );
  const byUrl = new Map(entries.filter((e): e is [string, string] => e[1] !== null));

  const copy: WeeklyReportData = {
    ...report,
    highlights: report.highlights.map((highlight) => ({
      ...highlight,
      creatorAvatarUrl: highlight.creatorAvatarUrl
        ? (byUrl.get(highlight.creatorAvatarUrl) ?? null)
        : null,
      post: highlight.post
        ? {
            ...highlight.post,
            thumbnailUrl: highlight.post.thumbnailUrl
              ? (byUrl.get(highlight.post.thumbnailUrl) ?? null)
              : null,
          }
        : null,
    })),
    territories: report.territories.map((territory) => ({
      ...territory,
      topVideos: territory.topVideos.map((video) => ({
        ...video,
        thumbnailUrl: video.thumbnailUrl ? (byUrl.get(video.thumbnailUrl) ?? null) : null,
      })),
    })),
  };

  const bytes = [...byUrl.values()].reduce((sum, uri) => sum + uri.length, 0);
  return { report: copy, embedded: byUrl.size, failed: urls.size - byUrl.size, bytes };
}
