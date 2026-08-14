import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MobileOnboardingFlow } from "./MobileOnboardingFlow";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";

jest.mock("@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry", () => ({
  trackMobileNarrativeEvent: jest.fn(),
}));

jest.mock("framer-motion", () => {
  const ReactMod = require("react");
  const stripAnimationProps = (props: Record<string, unknown>) => {
    const {
      initial, animate, exit, transition, variants,
      whileHover, whileTap, whileInView, layout, layoutId,
      ...rest
    } = props;
    return rest;
  };
  return {
    __esModule: true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      ReactMod.createElement(ReactMod.Fragment, null, children),
    motion: new Proxy({}, {
      get: (_target, tag: string) =>
        ReactMod.forwardRef((props: Record<string, unknown>, ref: unknown) =>
          ReactMod.createElement(tag, { ref, ...stripAnimationProps(props) }, (props as { children?: React.ReactNode }).children),
        ),
    }),
  };
});

const mockFetch = jest.fn();
global.fetch = mockFetch;

const seedSignal = {
  label: "Autonomia criativa com clareza",
  territorios: ["processo criativo", "negócios"],
  temas: ["posicionamento"],
  assets: ["bastidores"],
};

describe("MobileOnboardingFlow — tela única de Norte", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("mostra apenas a decisão de Norte antes do app", () => {
    render(<MobileOnboardingFlow open onComplete={jest.fn()} />);

    const dialog = screen.getByRole("dialog", { name: "Qual é o seu Norte?" });
    expect(dialog).toHaveClass("d2c-mobile-app", "ds-notebook");
    expect(screen.getByLabelText("Seu Norte")).toHaveClass("ds-field");
    expect(screen.getByRole("button", { name: "Criar meu primeiro mapa" })).toHaveClass("ds-button", "ds-button--primary");
    expect(screen.getByRole("button", { name: "Criar meu primeiro mapa" })).toBeDisabled();
    expect(screen.getAllByRole("button", { name: /Ajudo|Quero transformar|Crio para/ })).toEqual(
      expect.arrayContaining([expect.objectContaining({ className: expect.stringContaining("ds-button--quiet") })]),
    );
    expect(screen.queryByText(/reunião semanal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/assinar/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /conectar.*instagram/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /conectar.*instagram/i })).not.toBeInTheDocument();
  });

  it("salva somente o Norte e entrega o seed para revelação otimista no Perfil", async () => {
    const onComplete = jest.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, skipped: false, seedSignal }),
    } as Response);
    render(<MobileOnboardingFlow open onComplete={onComplete} />);

    const purpose = "Ajudo criadores independentes a encontrar clareza para comunicar seu valor.";
    fireEvent.change(screen.getByLabelText("Seu Norte"), { target: { value: purpose } });
    fireEvent.click(screen.getByRole("button", { name: "Criar meu primeiro mapa" }));

    expect(screen.getByText("Seu mapa está começando a tomar forma.")).toBeInTheDocument();
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({
      answers: { creatorPurpose: purpose },
      seedSignal,
      skipped: false,
    }));

    expect(JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      creatorPurpose: purpose,
    });
    expect(JSON.stringify(mockFetch.mock.calls[0][1])).not.toContain("whyYouCreate");
    expect(trackMobileNarrativeEvent).toHaveBeenCalledWith(
      "mobile_starter_map_created",
      expect.objectContaining({ actionType: "seed_ready" }),
    );
  });

  it("preserva o texto quando a API falha e permite tentar novamente", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, skipped: false, seedSignal }),
      } as Response);
    const onComplete = jest.fn();
    render(<MobileOnboardingFlow open onComplete={onComplete} />);

    const purpose = "Quero traduzir estratégia em passos possíveis para pequenos negócios.";
    fireEvent.change(screen.getByLabelText("Seu Norte"), { target: { value: purpose } });
    fireEvent.click(screen.getByRole("button", { name: "Criar meu primeiro mapa" }));

    await screen.findByText(/Seu texto continua aqui/i);
    expect(screen.getByLabelText("Seu Norte")).toHaveValue(purpose);

    fireEvent.click(screen.getByRole("button", { name: "Criar meu primeiro mapa" }));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("confirma explicitamente a entrada sem Norte e marca o onboarding como pulado", async () => {
    const onComplete = jest.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, skipped: true, seedSignal: null }),
    } as Response);
    render(<MobileOnboardingFlow open onComplete={onComplete} />);

    fireEvent.click(screen.getByRole("button", { name: "Entrar sem preencher" }));
    expect(screen.getByText(/seu mapa começará vazio/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Entrar mesmo assim" }));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith({
      answers: {},
      seedSignal: null,
      skipped: true,
    }));
    expect(JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string)).toEqual({ skip: true });
  });
});
