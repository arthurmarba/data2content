import {
  default as BillingSuccessPage,
  buildProfileActivationHref,
  isChatGptCheckoutFlow,
  normalizeBillingSuccessPostCheckoutIntent,
  resolveBillingSuccessAttemptId,
  sanitizeBillingSuccessReturnTo,
} from "./page";
import { act, render, waitFor } from "@testing-library/react";
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

  it("aceita returnTo interno para intenções de ativação", () => {
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
    expect(normalizeBillingSuccessPostCheckoutIntent("watch_recorded_meeting")).toBe("watch_recorded_meeting");
    expect(normalizeBillingSuccessPostCheckoutIntent("external_redirect")).toBeNull();
  });

  it("preserva a rota interna e adiciona o estado de ativação do Perfil", () => {
    expect(buildProfileActivationHref("/dashboard/boards/mobile-strategic-profile?from=checkout", "instagram")).toBe(
      "/dashboard/boards/mobile-strategic-profile?from=checkout&activation=instagram",
    );
    expect(buildProfileActivationHref("https://evil.example", "whatsapp")).toBe(
      "/dashboard/profile?activation=whatsapp",
    );
  });

  it("reconhece o checkout iniciado pelo perfil vindo do ChatGPT", () => {
    expect(isChatGptCheckoutFlow("/dashboard/profile?source=chatgpt", null)).toBe(true);
    expect(isChatGptCheckoutFlow("/dashboard/profile", "chatgpt_profile_upgrade")).toBe(true);
    expect(isChatGptCheckoutFlow("/dashboard/profile", "account_menu_upgrade")).toBe(false);
  });

  it("identifica tanto o Checkout hospedado quanto a assinatura do Payment Element", () => {
    expect(resolveBillingSuccessAttemptId(new URLSearchParams("session_id=cs_live_123"))).toBe(
      "cs_live_123",
    );
    expect(resolveBillingSuccessAttemptId(new URLSearchParams("sid=sub_live_123"))).toBe(
      "sub_live_123",
    );
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
        route: "/dashboard/profile?activation=instagram",
      }),
    );
    expect(push).toHaveBeenCalledWith("/dashboard/profile?activation=instagram");
    expect(JSON.stringify((trackMobileNarrativeEvent as jest.Mock).mock.calls)).not.toContain("//evil.example");
  });

  it("volta ao cartão da comunidade sem exigir Instagram primeiro", async () => {
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

    render(<BillingSuccessPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith(
      "/dashboard/boards/mobile-strategic-profile?activation=whatsapp",
    ));
  });

  it("depois do checkout do ChatGPT oferece a conexão opcional e retorna ao plugin", async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push });
    window.sessionStorage.setItem(
      "d2c.paywall.return",
      JSON.stringify({
        context: "planning",
        source: "chatgpt_profile_upgrade",
        returnTo: "/dashboard/profile?source=chatgpt",
        postCheckoutIntent: "connect_instagram",
      }),
    );

    render(<BillingSuccessPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith(
      "/dashboard/instagram/connect?source=chatgpt&next=chatgpt-plugin",
    ));
  });

  it("retorna à gravação escolhida depois da assinatura", async () => {
    const push = jest.fn();
    (useRouter as jest.Mock).mockReturnValue({ push });
    window.sessionStorage.setItem(
      "d2c.paywall.return",
      JSON.stringify({
        context: "recorded_meetings",
        returnTo: "/reunioes-gravadas?meeting=meeting-1",
        postCheckoutIntent: "watch_recorded_meeting",
      }),
    );

    render(<BillingSuccessPage />);

    await waitFor(() => expect(push).toHaveBeenCalledWith(
      "/reunioes-gravadas?meeting=meeting-1",
    ));
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
