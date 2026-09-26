import { fireEvent, render, screen } from "@testing-library/react";

import { ProfileNextStepField, resolveNextStepFieldState } from "./ProfileNextStepField";

const handlers = () => ({ onUpgrade: jest.fn(), onConnectInstagram: jest.fn(), onDefineNorth: jest.fn() });

describe("campo da situação da conta", () => {
  describe("qual pendência aparece", () => {
    const base = { hasActivePro: true, hasStarterMap: true, instagramConnectionState: "connected" as const };

    it("pagamento com problema vem antes de tudo, até de Instagram caído", () => {
      expect(resolveNextStepFieldState({ ...base, accessState: "payment_action_needed", instagramConnectionState: "expired" })).toBe("billing");
      expect(resolveNextStepFieldState({ ...base, accessState: "payment_pending" })).toBe("billing");
    });

    it("assinante com conexão caída reconecta; assinante que nunca conectou conecta", () => {
      expect(resolveNextStepFieldState({ ...base, accessState: "pro_instagram_connected", instagramConnectionState: "expired" })).toBe("reconnect_instagram");
      expect(resolveNextStepFieldState({ ...base, accessState: "pro_needs_instagram", instagramConnectionState: "disconnected" })).toBe("connect_instagram");
    });

    it("quem não assina (ou deixou de assinar) é convidado ao Pro", () => {
      expect(resolveNextStepFieldState({ ...base, accessState: "free_preview_used", hasActivePro: false, instagramConnectionState: "disconnected" })).toBe("subscribe");
    });

    it("conta em dia vira confirmação", () => {
      expect(resolveNextStepFieldState({ ...base, accessState: "pro_instagram_connected" })).toBe("connected");
    });
  });

  describe("o que cada botão faz", () => {
    it("pagamento: leva à página do plano, que abre o portal do Stripe ou retoma o checkout", () => {
      const h = handlers();
      render(<ProfileNextStepField state="billing" {...h} />);
      const link = screen.getByRole("link", { name: "Atualizar pagamento" });
      expect(link.getAttribute("href")).toBe("/dashboard/billing");
      // Não abre a janela de assinatura: lá o botão de assinar fica travado para essa pessoa.
      fireEvent.click(link);
      expect(h.onUpgrade).not.toHaveBeenCalled();
    });

    it("assinatura: abre a janela do Pro", () => {
      const h = handlers();
      render(<ProfileNextStepField state="subscribe" {...h} />);
      fireEvent.click(screen.getByRole("button", { name: "Ativar o Pro" }));
      expect(h.onUpgrade).toHaveBeenCalledWith("narrative_map");
      expect(screen.getByText(/contexto no Claude/)).toBeTruthy();
    });

    it("primeira conexão e reconexão do Instagram", () => {
      const first = handlers();
      const { unmount } = render(<ProfileNextStepField state="connect_instagram" {...first} />);
      fireEvent.click(screen.getByRole("button", { name: "Conectar Instagram" }));
      expect(first.onConnectInstagram).toHaveBeenCalledTimes(1);
      unmount();

      const again = handlers();
      render(<ProfileNextStepField state="reconnect_instagram" {...again} />);
      expect(screen.getByRole("heading", { name: "Sua leitura parou de atualizar." })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Reconectar Instagram" }));
      expect(again.onConnectInstagram).toHaveBeenCalledTimes(1);
    });

    it("conta em dia: só a confirmação, sem botão", () => {
      render(<ProfileNextStepField state="connected" {...handlers()} />);
      expect(screen.getByText("Instagram conectado")).toBeTruthy();
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
