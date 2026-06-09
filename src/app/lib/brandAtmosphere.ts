/**
 * Atmosfera de marca compartilhada — landing + onboarding usam a MESMA camada
 * de fundo para que a transição entre eles seja percebida como um só mundo.
 *
 * Topo: sussurro emerald atrás do logo. Rodapé: "aurora" com as 3 cores dos
 * pilares do produto — narrativa/mapa (orange-500), pautas (emerald-500),
 * audiência/Instagram (sky-500) — subindo do fundo. Base neutra mantém a zona
 * de conteúdo branca e legível. Opacidades baixíssimas: invisível até reparar.
 *
 * Restrito a 3 cores (não as 7 dos cards) de propósito — três leem como um arco
 * quente→frio coeso; mais que isso vira arco-íris e quebra a calma.
 *
 * Uso: aplicar como `style={{ backgroundImage: BRAND_ATMOSPHERE_BG }}` em um
 * container de tela cheia (ex.: o shell da landing ou do onboarding).
 */
export const BRAND_ATMOSPHERE_BG = [
  // Topo — sussurro de marca atrás do logo
  "radial-gradient(70% 26% at 50% 12%, rgba(16,185,129,0.05), rgba(16,185,129,0) 70%)",
  // Rodapé esquerdo — narrativa / mapa (orange-500)
  "radial-gradient(58% 40% at 16% 100%, rgba(249,115,22,0.09), rgba(249,115,22,0) 72%)",
  // Rodapé direito — audiência / Instagram (sky-500)
  "radial-gradient(58% 40% at 84% 100%, rgba(14,165,233,0.09), rgba(14,165,233,0) 72%)",
  // Rodapé centro — pautas / próximo passo (emerald-500), âncora
  "radial-gradient(72% 46% at 50% 106%, rgba(16,185,129,0.11), rgba(16,185,129,0) 70%)",
  // Base neutra — mantém a zona de conteúdo branca e legível
  "radial-gradient(120% 48% at 50% 0%, #f6f7f9 0%, #ffffff 44%)",
].join(", ");
