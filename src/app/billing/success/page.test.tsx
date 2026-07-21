import {
  default as BillingSuccessPage,
  normalizeBillingSuccessPostCheckoutIntent,
  sanitizeBillingSuccessReturnTo,
} from "./page";
import { act, render } from "@testing-library/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";

jest.mock("next/navigation", () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/lib/track", () => ({
  track: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry", () => ({
  trackMobileNarrativeEvent: jest.fn(),
}));

describe("billing success postCheckoutIntent helpers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.sessionStorage.clear();
    (useSearchParams as jest.Mock).mockReturnValue(new URLSearchParams("session_id=cs_test"));
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    (useSession as jest.Mock).mockReturnValue({
      update: jest.fn().mockResolvedValue({
        user: { id: "user_1", planInterval: "month", instagramConnected: false },
      }),
    });
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: "active", instagram: { connected: false } }),
    } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    window.sessionStorage.clear();
  });

  it("aceita returnTo interno para connect_instagram e join_community", () => {
    expect(sanitizeBillingSuccessReturnTo("/dashboard/boards/mobile-strategic-profile")).toBe(
      "/dashboard/boards/mobile-strategic-profile",
    );
    expect(sanitizeBillingSuccessReturnTo("/planning/discover?postCheckoutIntent=join_community")).toBe(
      "/planning/discover?postCheckoutIntent=join_community",
    );
  });

  it("rejeita returnTo externo", () => {
    expect(sanitizeBillingSuccessReturnTo("https://evil.example")).toBeNull();
    expect(sanitizeBillingSuccessReturnTo("//evil.example")).toBeNull();
    expect(sanitizeBillingSuccessReturnTo("dashboard/boards/mobile-strategic-profile")).toBeNull();
  });

  it("normaliza apenas intents conhecidos", () => {
    expect(normalizeBillingSuccessPostCheckoutIntent("connect_instagram")).toBe("connect_instagram");
    expect(normalizeBillingSuccessPostCheckoutIntent("join_community")).toBe("join_community");
    expect(normalizeBillingSuccessPostCheckoutIntent("external_redirect")).toBeNull();
  });

  it("registra intent visto/consumido e redireciona sem aceitar rota externa", async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push });
    window.sessionStorage.setItem(
      "d2c.paywall.return",
      JSON.stringify({
        context: "narrative_map",
        returnTo: "//evil.example",
        postCheckoutIntent: "connect_instagram",
      }),
    );

    render(<BillingSuccessPage />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(trackMobileNarrativeEvent).toHaveBeenCalledWith(
      "mobile_post_checkout_intent_seen",
      expect.objectContaining({
        postCheckoutIntent: "connect_instagram",
        paywallContext: "narrative_map",
      }),
    );
    expect(trackMobileNarrativeEvent).toHaveBeenCalledWith(
      "mobile_post_checkout_intent_consumed",
      expect.objectContaining({
        postCheckoutIntent: "connect_instagram",
        route: "/dashboard/instagram/connect?next=narrative-map",
      }),
    );
    expect(push).toHaveBeenCalledWith("/dashboard/instagram/connect?next=narrative-map");
    expect(JSON.stringify((trackMobileNarrativeEvent as jest.Mock).mock.calls)).not.toContain("//evil.example");
  });

  it("mostra as boas-vindas Pro (grupo antes do Instagram) no funil da reunião", async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push });
    window.sessionStorage.setItem(
      "d2c.paywall.return",
      JSON.stringify({
        context: "narrative_map",
        returnTo: "/dashboard/boards/mobile-strategic-profile",
        postCheckoutIntent: "join_community",
      }),
    );

    const { findByRole, getByRole } = render(<BillingSuccessPage />);

    await findByRole("heading", { name: /Bem-vindo ao D2C Pro/i });
    expect(getByRole("link", { name: /Entrar no grupo de assinantes/i })).toBeTruthy();
    expect(getByRole("link", { name: /Conectar meu Instagram/i })).toBeTruthy();
    // Não pode haver redirect automático: o assinante precisa ver o grupo primeiro.
    expect(push).not.toHaveBeenCalled();
  });

  it("não oferece conexão do Instagram enquanto o pagamento não for confirmado", async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, status: "pending", instagram: { connected: false } }),
    } as any);
    window.sessionStorage.setItem(
      "d2c.paywall.return",
      JSON.stringify({
        context: "narrative_map",
        returnTo: "/dashboard/boards/mobile-strategic-profile",
        postCheckoutIntent: "connect_instagram",
      }),
    );

    const { findByRole, queryByRole } = render(<BillingSuccessPage />);

    await findByRole("heading", { name: /Estamos confirmando seu pagamento/i });
    expect(queryByRole("link", { name: /Conectar meu Instagram/i })).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });
});
