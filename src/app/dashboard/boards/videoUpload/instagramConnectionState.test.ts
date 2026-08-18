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
