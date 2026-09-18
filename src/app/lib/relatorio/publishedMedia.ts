export type PublishedMediaItem = { position: number; type: "IMAGE" | "VIDEO"; url: string | null };
const GRAPH_VERSION = process.env.INSTAGRAM_API_VERSION || "v20.0";

/** Rebusca a mídia fresca. A URL salva no Metric expira. */
export async function freshPublishedMedia(
  mediaId: string,
  token: string,
): Promise<{ mediaType: string | null; mediaUrl: string | null; imageUrls: string[]; items: PublishedMediaItem[] }> {
  const fields = encodeURIComponent(
    "id,media_type,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}",
  );
  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}?fields=${fields}&access_token=${token}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) {
      // Sem o motivo do Graph, limite de requisições e mídia removida viram a mesma
      // linha no log — e foi isso que travou o diagnóstico do primeiro lote (18/09/2026).
      const detalhe = typeof response.text === "function"
        ? await response.text().then(
            (texto) => String(JSON.parse(texto)?.error?.message ?? texto).slice(0, 160),
          ).catch(() => "")
        : "";
      throw new Error(`Instagram HTTP ${response.status}${detalhe ? `: ${detalhe}` : ""}`);
    }
    const json = (await response.json()) as {
      media_type?: string;
      media_url?: string;
      thumbnail_url?: string;
      children?: { data?: Array<{ media_type?: string; media_url?: string; thumbnail_url?: string }> };
      error?: unknown;
    };
    if (json.error) throw new Error("Instagram token ou mídia indisponível");
    const children = [...(json.children?.data ?? [])];
    // Mantém a ordem inclusive quando a API pagina os filhos.
    let after = (json.children as any)?.paging?.cursors?.after;
    let hasNext = Boolean((json.children as any)?.paging?.next);
    const seen = new Set<string>();
    while (json.media_type === "CAROUSEL_ALBUM" && hasNext) {
      if (!after || seen.has(after)) throw new Error("Paginação incompleta do carrossel.");
      seen.add(after);
      const pageUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}/children`);
      pageUrl.search = new URLSearchParams({ fields: "media_type,media_url,thumbnail_url", after, access_token: token }).toString();
      const pageResponse = await fetch(pageUrl, { signal: AbortSignal.timeout(20000) });
      if (!pageResponse.ok) throw new Error(`Instagram HTTP ${pageResponse.status}`);
      const page = await pageResponse.json();
      if (page.error || !Array.isArray(page.data)) throw new Error("Paginação incompleta do carrossel.");
      children.push(...page.data);
      after = page.paging?.cursors?.after;
      hasNext = Boolean(page.paging?.next);
    }
    const source = json.media_type === "CAROUSEL_ALBUM" ? children : [json];
    const items: PublishedMediaItem[] = source.map((item, index) => ({
      position: index + 1,
      type: item.media_type === "VIDEO" ? "VIDEO" : "IMAGE",
      url: item.media_url || null,
    }));
    const imageUrls = json.media_type === "CAROUSEL_ALBUM"
      ? children.flatMap((child) => {
          const url = child.media_type === "VIDEO"
            ? child.thumbnail_url || null
            : child.media_url || child.thumbnail_url || null;
          return url ? [url] : [];
        })
      : json.media_type === "IMAGE"
        ? [json.media_url || json.thumbnail_url].filter((value): value is string => Boolean(value))
        : [];
    return {
      mediaType: typeof json.media_type === "string" ? json.media_type : null,
      mediaUrl: typeof json.media_url === "string" ? json.media_url : null,
      imageUrls,
      items,
    };
  } catch (error) {
    throw error;
  }
}

