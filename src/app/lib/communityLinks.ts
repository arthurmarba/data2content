// ─── Link canônico do grupo da comunidade no WhatsApp ─────────────────────────
// Fonte única do convite — o mesmo grupo que o e-mail de boas-vindas Pro, o
// resumo da home e a tela Comunidade apontam. Sobrescrevível por env pra trocar
// de grupo sem deploy de código.
export const COMMUNITY_WHATSAPP_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ||
  "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c";
