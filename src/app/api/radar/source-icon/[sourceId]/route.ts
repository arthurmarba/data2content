import { NextResponse } from "next/server";
import { sourceIconOrigin } from "@/app/lib/campaignRadar/sourceIcon";

export const runtime = "nodejs";
// Ícone muda uma vez por ano; a borda guarda por uma semana e serve o antigo
// enquanto revalida. Assim a lista de publis não espera rede nenhuma.
const CACHE = "public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000";
const TIMEOUT_MS = 4000;
const MAX_BYTES = 200_000;

/** Um pixel transparente: ícone ausente não pode virar imagem quebrada na lista. */
const EMPTY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAABzenr0AAAAC0lEQVR4AWMAAAAAAgABc3UBGAAAAABJRU5ErkJggg==",
  "base64",
);

function empty() {
  return new NextResponse(EMPTY_PNG as unknown as BodyInit, {
    headers: { "Content-Type": "image/png", "Cache-Control": CACHE },
  });
}

async function fetchIcon(origin: string) {
  for (const path of ["/favicon.ico", "/favicon.png", "/apple-touch-icon.png"]) {
    try {
      const response = await fetch(`${origin}${path}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        redirect: "follow",
        headers: { accept: "image/*" },
      });
      if (!response.ok) continue;
      const type = response.headers.get("content-type") || "";
      if (!type.startsWith("image/")) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_BYTES) continue;
      return { buffer, type };
    } catch {
      continue;
    }
  }
  return null;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ sourceId: string }> },
) {
  const { sourceId } = await context.params;
  const origin = sourceIconOrigin(sourceId);
  if (!origin) return empty();

  const icon = await fetchIcon(origin);
  if (!icon) return empty();

  return new NextResponse(icon.buffer as unknown as BodyInit, {
    headers: { "Content-Type": icon.type, "Cache-Control": CACHE },
  });
}
