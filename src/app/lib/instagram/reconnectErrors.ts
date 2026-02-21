export const IG_RECONNECT_ERROR_CODES = {
  TOKEN_INVALID: "TOKEN_INVALID",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  NO_FACEBOOK_PAGE: "NO_FACEBOOK_PAGE",
  NO_BUSINESS_ACCESS: "NO_BUSINESS_ACCESS",
  NO_LINKED_IG_ACCOUNT: "NO_LINKED_IG_ACCOUNT",
  NO_IG_ACCOUNT: "NO_IG_ACCOUNT",
  FACEBOOK_ALREADY_LINKED: "FACEBOOK_ALREADY_LINKED",
  LINK_TOKEN_INVALID: "LINK_TOKEN_INVALID",
  INVALID_IG_ACCOUNT_SELECTION: "INVALID_IG_ACCOUNT_SELECTION",
  NOT_CONNECTED: "NOT_CONNECTED",
  UNKNOWN: "UNKNOWN",
} as const;

export type InstagramReconnectErrorCode =
  (typeof IG_RECONNECT_ERROR_CODES)[keyof typeof IG_RECONNECT_ERROR_CODES];

export const IG_RECONNECT_ACTIONABLE_CODES = new Set<InstagramReconnectErrorCode>([
  IG_RECONNECT_ERROR_CODES.TOKEN_INVALID,
  IG_RECONNECT_ERROR_CODES.PERMISSION_DENIED,
  IG_RECONNECT_ERROR_CODES.NO_FACEBOOK_PAGE,
  IG_RECONNECT_ERROR_CODES.NO_BUSINESS_ACCESS,
  IG_RECONNECT_ERROR_CODES.NO_LINKED_IG_ACCOUNT,
  IG_RECONNECT_ERROR_CODES.NO_IG_ACCOUNT,
  IG_RECONNECT_ERROR_CODES.NOT_CONNECTED,
  IG_RECONNECT_ERROR_CODES.INVALID_IG_ACCOUNT_SELECTION,
  IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID,
  IG_RECONNECT_ERROR_CODES.FACEBOOK_ALREADY_LINKED,
]);

export function normalizeInstagramReconnectErrorCode(
  code?: string | null
): InstagramReconnectErrorCode {
  if (!code) return IG_RECONNECT_ERROR_CODES.UNKNOWN;
  const normalized = String(code).toUpperCase().trim();
  if (normalized in IG_RECONNECT_ERROR_CODES) {
    return normalized as InstagramReconnectErrorCode;
  }
  return IG_RECONNECT_ERROR_CODES.UNKNOWN;
}

export function inferReconnectErrorCodeFromMessage(
  message?: string | null
): InstagramReconnectErrorCode {
  if (!message) return IG_RECONNECT_ERROR_CODES.UNKNOWN;
  const value = message.toLowerCase();
  if (
    value.includes("nenhuma página") ||
    value.includes("no pages")
  ) {
    return IG_RECONNECT_ERROR_CODES.NO_FACEBOOK_PAGE;
  }
  if (
    (value.includes("business_management") && value.includes("permiss")) ||
    (value.includes("business manager") && value.includes("permiss")) ||
    value.includes("portfólio empresarial") ||
    value.includes("portfolio empresarial") ||
    value.includes("/me/businesses")
  ) {
    return IG_RECONNECT_ERROR_CODES.NO_BUSINESS_ACCESS;
  }
  if (
    value.includes("nenhuma possui uma conta profissional do instagram vinculada") ||
    value.includes("vincule seu ig à página") ||
    value.includes("vincule seu instagram à página") ||
    value.includes("conta profissional do instagram vinculada")
  ) {
    return IG_RECONNECT_ERROR_CODES.NO_LINKED_IG_ACCOUNT;
  }
  if (
    value.includes("no_ig_account") ||
    value.includes("nenhuma conta profissional") ||
    value.includes("não encontramos contas instagram") ||
    value.includes("sem contas")
  ) {
    return IG_RECONNECT_ERROR_CODES.NO_IG_ACCOUNT;
  }
  if (
    value.includes("permiss") ||
    value.includes("(#10)") ||
    value.includes("(#200)")
  ) {
    return IG_RECONNECT_ERROR_CODES.PERMISSION_DENIED;
  }
  if (
    value.includes("token") ||
    value.includes("oauth") ||
    value.includes("expired") ||
    value.includes("expirad")
  ) {
    return IG_RECONNECT_ERROR_CODES.TOKEN_INVALID;
  }
  if (value.includes("alreadylinked") || value.includes("já vinculad")) {
    return IG_RECONNECT_ERROR_CODES.FACEBOOK_ALREADY_LINKED;
  }
  return IG_RECONNECT_ERROR_CODES.UNKNOWN;
}

export function mapNextAuthErrorToReconnectCode(
  errorParam?: string | null
): InstagramReconnectErrorCode {
  const normalized = String(errorParam || "").trim();
  if (!normalized) return IG_RECONNECT_ERROR_CODES.UNKNOWN;
  if (normalized === "FacebookAlreadyLinked") {
    return IG_RECONNECT_ERROR_CODES.FACEBOOK_ALREADY_LINKED;
  }
  if (normalized === "FacebookLinkFailed" || normalized === "FacebookLinkRequired") {
    return IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID;
  }
  return IG_RECONNECT_ERROR_CODES.UNKNOWN;
}

export function reconnectErrorMessageForCode(code: InstagramReconnectErrorCode): string {
  switch (code) {
    case IG_RECONNECT_ERROR_CODES.PERMISSION_DENIED:
      return "Permissão necessária não concedida no Facebook. Reconecte e aprove todas as permissões.";
    case IG_RECONNECT_ERROR_CODES.TOKEN_INVALID:
      return "Seu token de acesso expirou ou foi invalidado. Reconecte sua conta.";
    case IG_RECONNECT_ERROR_CODES.NO_FACEBOOK_PAGE:
      return "Nenhuma Página do Facebook foi encontrada para esta conta. Crie ou assuma administração de uma Página.";
    case IG_RECONNECT_ERROR_CODES.NO_BUSINESS_ACCESS:
      return "A Meta não retornou acesso ao Portfólio Empresarial (Business). Aprove as permissões e selecione o Business correto.";
    case IG_RECONNECT_ERROR_CODES.NO_LINKED_IG_ACCOUNT:
      return "Encontramos Página/Business, mas não achamos Instagram profissional vinculado à Página selecionada.";
    case IG_RECONNECT_ERROR_CODES.NO_IG_ACCOUNT:
      return "Nenhuma conta profissional do Instagram foi encontrada para o Facebook autenticado.";
    case IG_RECONNECT_ERROR_CODES.FACEBOOK_ALREADY_LINKED:
      return "Esta conta do Facebook já está vinculada a outro usuário da plataforma.";
    case IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID:
      return "Não foi possível validar o vínculo de segurança. Reinicie a conexão do Instagram.";
    case IG_RECONNECT_ERROR_CODES.INVALID_IG_ACCOUNT_SELECTION:
      return "A conta Instagram escolhida não pertence às contas autorizadas deste usuário.";
    case IG_RECONNECT_ERROR_CODES.NOT_CONNECTED:
      return "Sua conta do Instagram não está conectada.";
    case IG_RECONNECT_ERROR_CODES.UNKNOWN:
    default:
      return "Não foi possível concluir a reconexão do Instagram.";
  }
}

export type ReconnectFaqLink = {
  href: string;
  label: string;
};

export function reconnectFaqLinkForCode(
  code: InstagramReconnectErrorCode
): ReconnectFaqLink {
  switch (code) {
    case IG_RECONNECT_ERROR_CODES.PERMISSION_DENIED:
      return {
        href: "/dashboard/instagram/faq#erros-permissoes",
        label: "Permissão negada (#10/#200) — abrir solução",
      };
    case IG_RECONNECT_ERROR_CODES.TOKEN_INVALID:
    case IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID:
      return {
        href: "/dashboard/instagram/faq#token-expirado",
        label: "Token expirado/inválido — abrir solução",
      };
    case IG_RECONNECT_ERROR_CODES.FACEBOOK_ALREADY_LINKED:
      return {
        href: "/dashboard/instagram/faq#conta-vinculada",
        label: "Conta já vinculada — abrir solução",
      };
    case IG_RECONNECT_ERROR_CODES.NO_FACEBOOK_PAGE:
      return {
        href: "/dashboard/instagram/faq#criar-pagina",
        label: "Sem Página do Facebook — abrir solução",
      };
    case IG_RECONNECT_ERROR_CODES.NO_BUSINESS_ACCESS:
      return {
        href: "/dashboard/instagram/faq#permissoes",
        label: "Sem acesso ao Business — abrir solução",
      };
    case IG_RECONNECT_ERROR_CODES.NO_LINKED_IG_ACCOUNT:
      return {
        href: "/dashboard/instagram/faq#vincular-ig-pagina",
        label: "Instagram não vinculado à Página — abrir solução",
      };
    case IG_RECONNECT_ERROR_CODES.NO_IG_ACCOUNT:
      return {
        href: "/dashboard/instagram/faq#ig-profissional",
        label: "Conta IG não encontrada — abrir solução",
      };
    default:
      return {
        href: "/dashboard/instagram/faq#ajuda",
        label: "Ver ajuda — FAQ",
      };
  }
}
