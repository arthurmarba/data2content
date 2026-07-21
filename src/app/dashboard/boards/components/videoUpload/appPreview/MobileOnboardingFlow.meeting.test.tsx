import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileOnboardingFlow } from "./MobileOnboardingFlow";

jest.mock("framer-motion", () => {
  const ReactMod = require("react");
  const stripAnimationProps = (props: Record<string, unknown>) => {
    const { initial, animate, exit, transition, ...rest } = props;
    return rest;
  };
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: new Proxy({}, {
      get: (_target, tag: string) =>
        ReactMod.forwardRef((props: Record<string, unknown>, ref: unknown) =>
          ReactMod.createElement(tag, { ref, ...stripAnimationProps(props) }, (props as { children?: React.ReactNode }).children),
        ),
    }),
  };
});

const baseProps = {
  open: true,
  instagramConnected: false,
  accessState: "free_unused" as const,
  initialStep: "meeting_invite" as const,
  onComplete: jest.fn(),
  onUpgrade: jest.fn(),
};

describe("MobileOnboardingFlow — reunião e decisão do visitante", () => {
  beforeEach(() => {
    baseProps.onComplete.mockClear();
    baseProps.onUpgrade.mockClear();
  });

  it("mantém WhatsApp, agenda e acesso à reunião disponíveis na mesma tela", () => {
    render(<MobileOnboardingFlow {...baseProps} />);

    expect(screen.getByRole("heading", { name: "Você já pode assistir." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Receber avisos no WhatsApp/ })).toHaveAttribute(
      "href",
      "/api/dashboard/community/free-join",
    );
    expect(screen.getByRole("link", { name: /Salvar previsão na agenda/ })).toHaveAttribute(
      "href",
      "/api/community/meeting/calendar",
    );
    // A etapa não pode oferecer nenhum link que tire o visitante do onboarding
    // antes da escolha de participação — o acesso à reunião vive no Perfil.
    expect(screen.queryByRole("link", { name: /reunião/i })).toBeNull();
    expect(baseProps.onComplete).not.toHaveBeenCalled();
  });

  it("entra gratuitamente sem oferecer Instagram ao visitante", () => {
    render(<MobileOnboardingFlow {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar gratuitamente no app" }));

    expect(baseProps.onComplete).toHaveBeenCalledTimes(1);
    expect(baseProps.onUpgrade).not.toHaveBeenCalled();
    expect(screen.queryByText("Conectar Instagram")).not.toBeInTheDocument();
  });

  it("conclui o onboarding e abre a assinatura quando o visitante quer ser analisado", () => {
    render(<MobileOnboardingFlow {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: "Quero ser analisado no Pro" }));

    expect(baseProps.onComplete).toHaveBeenCalledTimes(1);
    expect(baseProps.onUpgrade).toHaveBeenCalledTimes(1);
  });

  it("não libera convite de Instagram para conta free que já usou a prévia", () => {
    render(<MobileOnboardingFlow {...baseProps} accessState="free_preview_used" />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar gratuitamente no app" }));

    expect(baseProps.onComplete).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Conectar Instagram")).not.toBeInTheDocument();
  });

  it("assinante recebe o grupo Pro e só então pode seguir para conectar Instagram", () => {
    render(<MobileOnboardingFlow {...baseProps} accessState="pro_needs_instagram" />);

    expect(screen.getByRole("link", { name: /Abrir grupo Pro no WhatsApp/ })).toHaveAttribute(
      "href",
      expect.stringContaining("chat.whatsapp.com"),
    );
    expect(screen.queryByRole("button", { name: "Quero ser analisado no Pro" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    expect(screen.getByText("Conectar Instagram")).toBeInTheDocument();
  });
});
