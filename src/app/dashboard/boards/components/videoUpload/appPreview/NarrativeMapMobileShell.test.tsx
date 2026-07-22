import fs from "fs";
import path from "path";
import type { ComponentProps } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { NarrativeMapMobileShell } from "./NarrativeMapMobileShell";
import { buildNarrativeMapReadingPreviewFixture } from "./buildNarrativeMapReadingPreviewFixture";

const mockRouterRefresh = jest.fn();
const mockRouterPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRouterRefresh,
    push: mockRouterPush,
  }),
}));

jest.mock("@/app/dashboard/settings/DeleteAccountSection", () => {
  const ReactForMock = require("react");
  return {
    __esModule: true,
    default: () => ReactForMock.createElement("button", { type: "button" }, "Excluir minha conta"),
  };
});

function renderShell(
  state = "narrative_map_three_related_readings",
  internalReview = false,
  overrides: Partial<ComponentProps<typeof NarrativeMapMobileShell>> = {},
) {
  const fixture = buildNarrativeMapReadingPreviewFixture({ state });
  return render(
    <NarrativeMapMobileShell
      viewModel={fixture.viewModel}
      presentation={fixture.presentation}
      snapshotReview={fixture.synthesisSnapshotWrite}
      internalReview={internalReview}
      accessState="pro_instagram_connected"
      readingQuota={{
        userId: "user-test",
        freeReadingUsed: true,
        totalCompletedReadings: 4,
        usedThisMonth: 4,
        periodStart: "2026-05-01T00:00:00.000Z",
        periodEnd: "2026-06-01T00:00:00.000Z",
      }}
      onPrimaryAccessAction={jest.fn()}
      {...overrides}
    />,
  );
}

function renderedText(container: HTMLElement): string {
  return container.textContent?.toLowerCase() ?? "";
}

describe("NarrativeMapMobileShell", () => {
  it("renderiza tabs Mapa, Leituras e Oportunidades", () => {
    renderShell();

    expect(screen.getByRole("tab", { name: "Mapa" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Leituras" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Oportunidades" })).toBeInTheDocument();
  });

  it("Perfil mostra identidade e capitulos do view model", () => {
    renderShell();

    expect(screen.getByText("Lívia Linhares")).toBeInTheDocument();
    expect(screen.getByText("Seu padrão")).toBeInTheDocument();
    expect(screen.getByText("Sua tensão")).toBeInTheDocument();
    expect(screen.getByText("Seu movimento")).toBeInTheDocument();
    expect(screen.getByText("Seu território")).toBeInTheDocument();
  });

  it("Leituras mostra itens recentes e Ver leitura abre detalhe seguro", () => {
    renderShell();

    fireEvent.click(screen.getByRole("tab", { name: "Leituras" }));
    expect(screen.getByText("Suas leituras")).toBeInTheDocument();
    expect(screen.getAllByText("Vídeo sobre humor cotidiano com identificação rápida").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText("Vídeo sobre humor cotidiano com identificação rápida")[0]);
    const dialog = screen.getByRole("dialog", { name: "Vídeo sobre humor cotidiano com identificação rápida" });
    expect(within(dialog).getByText("Contribuição")).toBeInTheDocument();
    expect(within(dialog).queryByText(/objectKey|signedUrl|uploadUrl|thumbnailUrl|localPath|storageProviderPath/)).not.toBeInTheDocument();
  });

  it("Leituras mostra empty state quando nao existirem", () => {
    renderShell("narrative_map_no_readings");

    fireEvent.click(screen.getByRole("tab", { name: "Leituras" }));

    expect(screen.getByText("Envie seu primeiro vídeo")).toBeInTheDocument();
  });

  it("Oportunidades mostra territorios e fit narrativo sem match real", () => {
    const { container } = renderShell("narrative_map_commercial_signals");

    fireEvent.click(screen.getByRole("tab", { name: "Oportunidades" }));

    expect(screen.getByText("Territórios de marca")).toBeInTheDocument();
    expect(renderedText(container)).toContain("tipo de collab possível");
    expect(renderedText(container)).not.toContain("match real");
  });

  it("CTA principal e secundaria seguem a hierarquia esperada", () => {
    renderShell("narrative_map_three_related_readings", false, {
      accessState: "pro_needs_instagram",
    });

    expect(screen.getByRole("button", { name: "Conectar Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nova leitura" })).toBeInTheDocument();
  });

  it("Status Card MM90 mostra pro sem Instagram sem bloquear nova leitura", () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    renderShell("narrative_map_three_related_readings", false, {
      accessState: "pro_needs_instagram",
      onPrimaryAccessAction: onPrimary,
      onSecondaryAccessAction: onSecondary,
    });

    expect(screen.getByText("Pro ativo")).toBeInTheDocument();
    expect(screen.getByText("Conecte o Instagram para melhorar a precisão do Perfil.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Conectar Instagram" }));
    fireEvent.click(screen.getByRole("button", { name: "Nova leitura" }));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it("frameMode app remove moldura de preview da superficie real", () => {
    const { container } = renderShell("narrative_map_three_related_readings", false, {
      frameMode: "app",
    });

    expect(container.firstElementChild).toHaveClass("bg-white");
    expect(container.firstElementChild).not.toHaveClass("rounded-[2rem]");
    expect(container.firstElementChild).not.toHaveClass("bg-zinc-950");
  });

  it("frameMode app renderiza bottom nav com Perfil, + e Comunidade", () => {
    renderShell("narrative_map_three_related_readings", false, {
      frameMode: "app",
    });

    const nav = screen.getByLabelText("Navegação principal");
    expect(within(nav).getByText("Perfil")).toBeInTheDocument();
    expect(within(nav).getByText("+")).toBeInTheDocument();
    expect(within(nav).getByText("Comunidade")).toBeInTheDocument();
  });

  it("botão central + dispara nova leitura", () => {
    const onPrimary = jest.fn();
    renderShell("narrative_map_three_related_readings", false, {
      frameMode: "app",
      onPrimaryAccessAction: onPrimary,
    });

    fireEvent.click(screen.getByRole("button", { name: "Nova leitura" }));

    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("botão de configurações abre menu de conta com ações diretas", () => {
    renderShell("narrative_map_three_related_readings", false, {
      frameMode: "app",
      userInfo: {
        name: "Arthur Marba",
        email: "arthur@example.com",
        plan: "Pro",
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Configurações da conta" }));

    expect(screen.getByRole("dialog", { name: "Conta e preferências" })).toBeInTheDocument();
    expect(screen.getByText("Arthur Marba")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Configurações" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conexão Instagram" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerenciar assinatura" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Suporte por email" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Afiliados" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Política de Privacidade" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Termos e Condições" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir minha conta" })).toBeInTheDocument();
  });

  it("badge Pro fica junto ao nome, fora da linha de ações do Mídia Kit", () => {
    renderShell("narrative_map_three_related_readings", false, {
      frameMode: "app",
    });

    expect(within(screen.getByLabelText("Identidade do Perfil")).getByText("Pro")).toBeInTheDocument();
    expect(within(screen.getByLabelText("Ações do Perfil")).queryByText("Pro")).not.toBeInTheDocument();
  });

  it("usa foto do Instagram no avatar do Perfil quando disponível", () => {
    const { container } = renderShell("narrative_map_three_related_readings", false, {
      frameMode: "app",
      profileImageUrl: "https://cdninstagram.com/avatar.jpg",
    });

    const avatar = container.querySelector('img[src="https://cdninstagram.com/avatar.jpg"]');
    expect(avatar).toBeInTheDocument();
  });

  it("Ler diagnostico completo abre leitura completa sob demanda", () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Ver diagnóstico completo" }));

    expect(screen.getByRole("dialog", { name: "Diagnóstico completo" })).toBeInTheDocument();
  });

  it("cards principais nao renderizam fullReading diretamente", () => {
    renderShell();

    expect(screen.queryByText(/síntese dry-run|Capítulos em sequência/i)).not.toBeInTheDocument();
  });

  it("safety note aparece de forma discreta", () => {
    renderShell();

    expect(screen.getByText("A D2C guarda a leitura estratégica, não o vídeo.")).toBeInTheDocument();
  });

  it("Snapshot review panel renderiza auditoria segura apenas em contexto interno", () => {
    const { rerender } = renderShell("narrative_map_three_related_readings", false);

    expect(screen.queryByLabelText("Snapshot write review")).not.toBeInTheDocument();

    const fixture = buildNarrativeMapReadingPreviewFixture({ state: "narrative_map_three_related_readings" });
    rerender(
      <NarrativeMapMobileShell
        viewModel={fixture.viewModel}
        presentation={fixture.presentation}
        snapshotReview={fixture.synthesisSnapshotWrite}
        internalReview
      />,
    );

    const panel = screen.getByLabelText("Snapshot write review");
    expect(within(panel).getByText("attempted")).toBeInTheDocument();
    expect(within(panel).getByText("written")).toBeInTheDocument();
    expect(within(panel).queryByText(/snapshotJson|payload|videoReading|stack trace/i)).not.toBeInTheDocument();
  });

  it("UI nao exibe termos proibidos", () => {
    const { container } = renderShell("narrative_map_commercial_signals", true);
    const text = renderedText(container);

    for (const forbidden of [
      "score",
      "nota",
      "viralizar",
      "garantido",
      "certeza",
      "comprovado",
      "match real",
      "publi garantida",
      "gemini",
      "raw response",
      "objectkey",
      "signedurl",
      "uploadurl",
      "thumbnailurl",
      "localpath",
      "storageproviderpath",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("shell nao chama endpoint real, SDK, storage ou modelo de snapshot", () => {
    const source = [
      "NarrativeMapMobileShell.tsx",
      "NarrativeMapSnapshotReviewPanel.tsx",
    ].map((file) => fs.readFileSync(path.join(__dirname, file), "utf8")).join("\n");

    expect(source).not.toMatch(/fetch\(|analyze-real|@google\/genai|@aws-sdk|CreatorStrategicProfileSnapshot|from ["']mongoose["']/);
  });
});
