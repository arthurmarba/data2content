import { NextRequest, NextResponse } from "next/server";
import { optOutOfPluginWeeklyEmail } from "@/app/lib/plugin/weeklyEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, body: string, status: number) {
  return new NextResponse(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>` +
      `<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#171717;margin:0;padding:48px 16px;">` +
      `<div style="max-width:420px;margin:0 auto;background:#f5f5f4;border-radius:24px;padding:28px;">` +
      `<h1 style="font-size:22px;margin:0 0 10px;">${title}</h1><p style="font-size:15px;line-height:1.6;color:#52525b;margin:0;">${body}</p></div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } },
  );
}

/** Saída de um clique do e-mail semanal do plugin, sem login. */
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("u") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  const done = await optOutOfPluginWeeklyEmail(userId, token).catch(() => false);
  return done
    ? page("Pronto", "Você não vai mais receber o e-mail semanal da Data2Content. Seu mapa e suas pautas continuam no seu perfil.", 200)
    : page("Link inválido", "Não conseguimos confirmar este link. Responda qualquer e-mail da Data2Content pedindo para sair da lista.", 400);
}
