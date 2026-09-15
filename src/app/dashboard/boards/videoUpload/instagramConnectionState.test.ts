import { resolveInstagramConnectionState } from "./instagramConnectionState";

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

describe("resolveInstagramConnectionState", () => {
  it("é desconectado sem conexão", () => {
    expect(resolveInstagramConnectionState(null)).toBe("disconnected");
    expect(resolveInstagramConnectionState({ isInstagramConnected: false })).toBe("disconnected");
  });

  it("é conectado com token válido", () => {
    expect(
      resolveInstagramConnectionState({
        isInstagramConnected: true,
        instagramAccessToken: "token",
        instagramAccessTokenExpiresAt: FUTURE,
      }),
    ).toBe("connected");
  });

  it("expira quando o token vence, some ou a sincronização falha", () => {
    expect(
      resolveInstagramConnectionState({ isInstagramConnected: true, instagramAccessTokenExpiresAt: PAST }),
    ).toBe("expired");
    expect(
      resolveInstagramConnectionState({ isInstagramConnected: true, instagramAccessToken: null }),
    ).toBe("expired");
    expect(
      resolveInstagramConnectionState({
        isInstagramConnected: true,
        instagramAccessToken: "token",
        instagramSyncErrorMsg: "token inválido",
      }),
    ).toBe("expired");
  });

  it("não acusa queda por erro de estatísticas de um post ou limite de frequência", () => {
    const connected = { isInstagramConnected: true, instagramAccessToken: "token", instagramAccessTokenExpiresAt: FUTURE };
    expect(
      resolveInstagramConnectionState({
        ...connected,
        instagramSyncErrorMsg:
          "A sincronização teve problemas. Detalhe principal: fetchMediaInsights - Insights mídia 18096012725383893: Erro interno ao buscar insights de mídia: Falha na requisição (Erro 400): (#100) The Media Insights API does not support",
      }),
    ).toBe("connected");
    expect(resolveInstagramConnectionState({ ...connected, instagramSyncErrorMsg: "Application request limit reached (#4)" })).toBe("connected");
    expect(resolveInstagramConnectionState({ ...connected, instagramSyncErrorMsg: "Error validating access token: Session has expired" })).toBe("expired");
  });

  it("ignora data inválida em vez de acusar queda", () => {
    expect(
      resolveInstagramConnectionState({
        isInstagramConnected: true,
        instagramAccessToken: "token",
        instagramAccessTokenExpiresAt: "não é data",
      }),
    ).toBe("connected");
  });
});
