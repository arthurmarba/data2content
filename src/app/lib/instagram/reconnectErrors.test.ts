import {
  IG_RECONNECT_ERROR_CODES,
  inferReconnectErrorCodeFromMessage,
  reconnectFaqLinkForCode,
} from "./reconnectErrors";

describe("instagram/reconnectErrors", () => {
  it("maps no-page messages to NO_FACEBOOK_PAGE", () => {
    expect(
      inferReconnectErrorCodeFromMessage(
        "Nenhuma página do Facebook foi encontrada para esta conta."
      )
    ).toBe(IG_RECONNECT_ERROR_CODES.NO_FACEBOOK_PAGE);

    expect(
      inferReconnectErrorCodeFromMessage(
        "No pages found for this user"
      )
    ).toBe(IG_RECONNECT_ERROR_CODES.NO_FACEBOOK_PAGE);
  });

  it("maps business and linked-ig messages to granular reconnect codes", () => {
    expect(
      inferReconnectErrorCodeFromMessage(
        "Permissão `business_management` ausente para /me/businesses."
      )
    ).toBe(IG_RECONNECT_ERROR_CODES.NO_BUSINESS_ACCESS);

    expect(
      inferReconnectErrorCodeFromMessage(
        "Encontramos Páginas do Facebook, porém nenhuma possui uma conta profissional do Instagram vinculada."
      )
    ).toBe(IG_RECONNECT_ERROR_CODES.NO_LINKED_IG_ACCOUNT);
  });

  it("returns FAQ links based on reconnect error code", () => {
    expect(
      reconnectFaqLinkForCode(IG_RECONNECT_ERROR_CODES.PERMISSION_DENIED)
    ).toEqual({
      href: "/dashboard/instagram/faq#erros-permissoes",
      label: "Permissão negada (#10/#200) — abrir solução",
    });

    expect(
      reconnectFaqLinkForCode(IG_RECONNECT_ERROR_CODES.LINK_TOKEN_INVALID)
    ).toEqual({
      href: "/dashboard/instagram/faq#token-expirado",
      label: "Token expirado/inválido — abrir solução",
    });

    expect(
      reconnectFaqLinkForCode(IG_RECONNECT_ERROR_CODES.NO_FACEBOOK_PAGE)
    ).toEqual({
      href: "/dashboard/instagram/faq#criar-pagina",
      label: "Sem Página do Facebook — abrir solução",
    });

    expect(
      reconnectFaqLinkForCode(IG_RECONNECT_ERROR_CODES.UNKNOWN)
    ).toEqual({
      href: "/dashboard/instagram/faq#ajuda",
      label: "Ver ajuda — FAQ",
    });
  });
});
