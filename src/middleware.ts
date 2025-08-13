import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { guardPremiumRequest } from "@/app/lib/planGuard";

const AFFILIATE_COOKIE_NAME = "d2c_ref";

export async function middleware(req: NextRequest) {
  // Cria a resposta base que será usada em todo o fluxo.
  const response = NextResponse.next();

  // --- Lógica do Afiliado ---
  const refCode =
    req.nextUrl.searchParams.get("ref") || req.nextUrl.searchParams.get("aff");

  // Se um código de referência for encontrado na URL...
  if (refCode) {
    // Define o cookie na resposta que será retornada no final.
    response.cookies.set(AFFILIATE_COOKIE_NAME, refCode, {
      path: "/",
      httpOnly: true,
      maxAge:
        Number(process.env.AFFILIATE_ATTRIBUTION_WINDOW_DAYS || 90) *
        24 *
        60 *
        60,
      sameSite: "lax",
    });
  }

  // --- Lógica de Segurança (Premium Guard) ---
  const guardPrefixes = [
    "/api/whatsapp/generateCode",
    "/api/whatsapp/sendTips",
    "/api/whatsapp/verify",
    "/api/whatsapp/weeklyReport",
    "/api/ai",
  ];

  // A verificação de segurança agora roda INDEPENDENTEMENTE da lógica do afiliado.
  if (guardPrefixes.some((p) => req.nextUrl.pathname.startsWith(p))) {
    const guardResponse = await guardPremiumRequest(req);
    // Se o guard bloquear o acesso, retorna a resposta de bloqueio.
    if (guardResponse) {
      return guardResponse;
    }
  }

  // Se não houver bloqueio, retorna a resposta original (com o cookie, se aplicável).
  return response;
}

// Otimização: O matcher agora evita rodar em rotas de API não listadas,
// arquivos estáticos e imagens, melhorando a performance.
export const config = {
  matcher: [
    /*
     * Corresponde a todas as rotas, exceto as que começam com:
     * - _next/static (arquivos estáticos)
     * - _next/image (imagens otimizadas)
     * - favicon.ico (ícone do site)
     * - Rotas que contêm um ponto (provavelmente arquivos diretos)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)",
    // Inclui explicitamente as rotas de API que precisam ser protegidas.
    "/api/whatsapp/generateCode/:path*",
    "/api/whatsapp/sendTips/:path*",
    "/api/whatsapp/verify/:path*",
    "/api/whatsapp/weeklyReport/:path*",
    "/api/ai/:path*",
  ],
};
