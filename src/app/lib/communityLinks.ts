// ─── Link canônico do grupo da comunidade no WhatsApp ─────────────────────────
// Fonte única do convite — o mesmo grupo que o e-mail de boas-vindas Pro, o
// resumo da home e a tela Comunidade apontam. Sobrescrevível por env pra trocar
// de grupo sem deploy de código.
export const COMMUNITY_WHATSAPP_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ||
  "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c";

// ─── Canal gratuito de avisos da reunião ──────────────────────────────────────
// Separado do grupo Pro: é só transmissão operacional (link da sala, mudanças e
// cancelamentos) para quem assiste de graça. Visitantes nunca caem no grupo de
// assinantes, onde acontece a confirmação de presença.
export const COMMUNITY_FREE_WHATSAPP_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_FREE_URL ||
  "https://chat.whatsapp.com/BAeBQZ8zuhQJOxXXJJaTnH";

/** Rota rastreável que registra o opt-in antes de mandar o visitante ao canal. */
export const COMMUNITY_FREE_JOIN_ROUTE = "/api/dashboard/community/free-join";
