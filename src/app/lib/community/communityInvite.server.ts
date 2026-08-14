import "server-only";

/**
 * O convite VIP só pode ser resolvido no servidor, depois da autorização.
 * Mantemos a env pública antiga apenas como fallback de migração; nenhum
 * componente cliente deve importar este módulo ou receber o valor retornado.
 */
export function getCommunityWhatsAppUrl(): string {
  return (
    process.env.COMMUNITY_VIP_URL ||
    process.env.NEXT_PUBLIC_COMMUNITY_VIP_URL ||
    "https://chat.whatsapp.com/CKTT84ZHEouKyXoDxIJI4c"
  );
}
