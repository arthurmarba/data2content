import fs from "fs";
import path from "path";
import { fireEvent, render, screen } from "@testing-library/react";
import { MobileStrategicProfileMediaKitModal } from "./MobileStrategicProfileMediaKitModal";
import { buildMobileStrategicProfilePreviewFixture } from "./buildMobileStrategicProfilePreviewFixture";

const SOURCE_PATH = path.join(__dirname, "MobileStrategicProfileMediaKitModal.tsx");

function mediaKitProfile() {
  return buildMobileStrategicProfilePreviewFixture({ state: "media_kit_available" }).profile;
}

function connectRequiredProfile() {
  return buildMobileStrategicProfilePreviewFixture({ state: "account_only" }).profile;
}

function dialogText(): string {
  return screen.getByRole("dialog").textContent?.toLowerCase() ?? "";
}

describe("MobileStrategicProfileMediaKitModal", () => {
  it("does not appear by default", () => {
    render(<MobileStrategicProfileMediaKitModal profile={mediaKitProfile()} open={false} onClose={jest.fn()} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders available Media Kit content with creator identity and link", () => {
    render(<MobileStrategicProfileMediaKitModal profile={mediaKitProfile()} open onClose={jest.fn()} />);

    expect(screen.getByRole("dialog", { name: "Compartilhar Mídia Kit" })).toBeInTheDocument();
    expect(screen.getByText("Ana Creator")).toBeInTheDocument();
    expect(screen.getByText("@ana.creator")).toBeInTheDocument();
    expect(screen.getByText("/mediakit/ana-preview")).toBeInTheDocument();
    expect(screen.getByText("Mídia Kit ativo")).toBeInTheDocument();
  });

  it("renders local visual actions without clipboard, share API or navigation side effects", () => {
    const clipboard = { writeText: jest.fn() };
    const share = jest.fn();
    const open = jest.fn();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
    Object.defineProperty(navigator, "share", { configurable: true, value: share });
    window.open = open;

    render(<MobileStrategicProfileMediaKitModal profile={mediaKitProfile()} open onClose={jest.fn()} />);

    for (const label of ["Copiar link", "Compartilhar", "Ver como marca", "Abrir Mídia Kit"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }

    expect(clipboard.writeText).not.toHaveBeenCalled();
    expect(share).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it("closes with the close button", () => {
    const onClose = jest.fn();
    render(<MobileStrategicProfileMediaKitModal profile={mediaKitProfile()} open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("handles available bridge without a safe link", () => {
    const sourceProfile = mediaKitProfile();
    const profile = {
      ...sourceProfile,
      mediaKitBridge: {
        ...sourceProfile.mediaKitBridge,
        href: null,
      },
    };

    render(<MobileStrategicProfileMediaKitModal profile={profile} open onClose={jest.fn()} />);

    expect(screen.getByText("O link do Mídia Kit existente ainda não está disponível nesta preview.")).toBeInTheDocument();
    for (const label of ["Copiar link", "Compartilhar", "Ver como marca", "Abrir Mídia Kit"]) {
      expect(screen.getByRole("button", { name: label })).toBeDisabled();
    }
  });

  it("shows connect Instagram required copy without changing real Instagram", () => {
    render(<MobileStrategicProfileMediaKitModal profile={connectRequiredProfile()} open onClose={jest.fn()} />);

    expect(screen.getByRole("dialog", { name: "Ativar Mídia Kit" })).toBeInTheDocument();
    expect(screen.getByText("Conectar Instagram é o próximo passo para ativar o Mídia Kit existente.")).toBeInTheDocument();
    expect(screen.getByText(/não conecta Instagram de verdade/)).toBeInTheDocument();
  });

  it("does not show internal diagnosis, quiz, pending signals or weak points", () => {
    render(<MobileStrategicProfileMediaKitModal profile={mediaKitProfile()} open onClose={jest.fn()} />);
    const text = dialogText();

    for (const forbidden of [
      "diagnóstico interno",
      "ponto fraco",
      "quiz",
      "sinais pendentes",
      "oportunidades bloqueadas",
      "qr code",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not render forbidden terms", () => {
    render(<MobileStrategicProfileMediaKitModal profile={mediaKitProfile()} open onClose={jest.fn()} />);
    const text = dialogText();

    for (const forbidden of [
      "api_key",
      "apikey",
      "base64",
      "signedurl",
      "score",
      "nota",
      "pontos",
      "ranking",
      "gabarito",
      "garantido",
      "certeza",
      "comprovado",
      "viralizar garantido",
      "match real",
      "marca garantida",
      "patrocínio garantido",
      "novo mídia kit",
      "mídia kit mobile",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("does not import forbidden integrations or real Media Kit surfaces", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    for (const forbidden of ["MediaKitView", "fetch", "Prisma", "banco", "Gemini", "OpenAI", "Stripe", "SDK"]) {
      expect(importLines).not.toContain(forbidden);
    }
  });
});
