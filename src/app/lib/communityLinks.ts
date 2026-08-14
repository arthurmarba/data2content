// ─── Canal gratuito de avisos da reunião ──────────────────────────────────────
// Separado do grupo Pro: é só transmissão operacional (link da sala, mudanças e
// cancelamentos) para quem assiste de graça. Visitantes nunca caem no grupo de
// assinantes, onde acontece a confirmação de presença.
export const COMMUNITY_FREE_WHATSAPP_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_FREE_URL ||
  "https://chat.whatsapp.com/BAeBQZ8zuhQJOxXXJJaTnH";

/** Rota rastreável que registra o opt-in antes de mandar o visitante ao canal. */
export const COMMUNITY_FREE_JOIN_ROUTE = "/api/dashboard/community/free-join";

/** Rota autenticada que registra a abertura do convite do grupo Pro. */
export const COMMUNITY_PRO_JOIN_ROUTE = "/api/dashboard/community/pro-join";
