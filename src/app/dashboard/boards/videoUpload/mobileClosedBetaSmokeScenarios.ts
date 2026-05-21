export type MobileClosedBetaSmokeScenarioId =
  | "free_unused"
  | "free_preview_used"
  | "pro_needs_instagram"
  | "pro_instagram_connected"
  | "pro_quota_reached"
  | "payment_pending"
  | "payment_action_needed"
  | "community_free_banner"
  | "community_pro_banner"
  | "mediakit_available"
  | "mediakit_needs_instagram"
  | "real_endpoint_blocked_for_common_user"
  | "real_endpoint_allowlist_success_mocked_or_fixture"
  | "post_checkout_connect_instagram"
  | "post_checkout_join_community";

export type MobileClosedBetaSmokeScenario = {
  id: MobileClosedBetaSmokeScenarioId;
  label: string;
  category: "profile" | "community" | "endpoint" | "checkout";
  href: string;
  expected: string;
};

const PREVIEW_ROUTE = "/dashboard/boards/mobile-strategic-profile-preview";
const COMMUNITY_ROUTE = "/planning/discover";

export function getMobileClosedBetaSmokeScenarios(): MobileClosedBetaSmokeScenario[] {
  return [
    {
      id: "free_unused",
      label: "Free sem leitura",
      category: "profile",
      href: `${PREVIEW_ROUTE}?state=account_only`,
      expected: "Perfil em construção",
    },
    {
      id: "free_preview_used",
      label: "Free com leitura usada",
      category: "profile",
      href: `${PREVIEW_ROUTE}?state=first_reading_free`,
      expected: "Leitura grátis usada",
    },
    {
      id: "pro_needs_instagram",
      label: "Pro sem Instagram",
      category: "profile",
      href: `${PREVIEW_ROUTE}?state=premium_without_instagram`,
      expected: "Conectar Instagram e Nova leitura secundaria",
    },
    {
      id: "pro_instagram_connected",
      label: "Pro com Instagram",
      category: "profile",
      href: `${PREVIEW_ROUTE}?state=instagram_optimized`,
      expected: "Nova leitura",
    },
    {
      id: "pro_quota_reached",
      label: "Pro 10/10 leituras",
      category: "profile",
      href: `${PREVIEW_ROUTE}?state=instagram_optimized&smoke=pro_quota_reached`,
      expected: "10/10 usadas",
    },
    {
      id: "payment_pending",
      label: "Pagamento pendente",
      category: "profile",
      href: `${PREVIEW_ROUTE}?state=account_only&smoke=payment_pending`,
      expected: "Continuar pagamento",
    },
    {
      id: "payment_action_needed",
      label: "Ação de pagamento",
      category: "profile",
      href: `${PREVIEW_ROUTE}?state=account_only&smoke=payment_action_needed`,
      expected: "Atualizar pagamento",
    },
    {
      id: "community_free_banner",
      label: "Comunidade Free",
      category: "community",
      href: `${COMMUNITY_ROUTE}?smoke=community_free_banner`,
      expected: "Consultoria em grupo",
    },
    {
      id: "community_pro_banner",
      label: "Comunidade Pro",
      category: "community",
      href: `${COMMUNITY_ROUTE}?smoke=community_pro_banner`,
      expected: "Grupo VIP liberado",
    },
    {
      id: "mediakit_available",
      label: "Mídia Kit disponível",
      category: "profile",
      href: `${PREVIEW_ROUTE}?state=media_kit_available`,
      expected: "Copiar link, Ver como marca, Abrir Mídia Kit",
    },
    {
      id: "mediakit_needs_instagram",
      label: "Mídia Kit pede Instagram",
      category: "profile",
      href: `${PREVIEW_ROUTE}?state=premium_without_instagram`,
      expected: "Conectar Instagram",
    },
    {
      id: "real_endpoint_blocked_for_common_user",
      label: "Endpoint real bloqueado",
      category: "endpoint",
      href: `${PREVIEW_ROUTE}?state=narrative_map_chapters&smoke=real_endpoint_blocked_for_common_user`,
      expected: "403 para usuário comum fora da allowlist",
    },
    {
      id: "real_endpoint_allowlist_success_mocked_or_fixture",
      label: "Endpoint real allowlist",
      category: "endpoint",
      href: `${PREVIEW_ROUTE}?state=narrative_map_chapters&smoke=real_endpoint_allowlist_success`,
      expected: "allowlist/admin-dev necessário antes do endpoint real",
    },
    {
      id: "post_checkout_connect_instagram",
      label: "Pós-checkout Instagram",
      category: "checkout",
      href: `${PREVIEW_ROUTE}?state=premium_without_instagram&postCheckoutIntent=connect_instagram`,
      expected: "Conectar Instagram",
    },
    {
      id: "post_checkout_join_community",
      label: "Pós-checkout Comunidade",
      category: "checkout",
      href: `${COMMUNITY_ROUTE}?postCheckoutIntent=join_community`,
      expected: "Entrar",
    },
  ];
}
