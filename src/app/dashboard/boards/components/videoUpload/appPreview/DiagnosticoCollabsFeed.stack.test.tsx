import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { DiagnosticoCollabsFeed } from "./DiagnosticoCollabsFeed";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";

// framer-motion → primitivos estáticos. useReducedMotion=true faz os botões do
// deck decidirem direto (sem esperar animação, que não roda em jsdom).
jest.mock("framer-motion", () => {
  const React = require("react");
  const MotionTag = (tag: string) => {
    const MockMotionComponent = React.forwardRef(({
      initial, animate, exit, transition, whileTap, whileInView, viewport,
      drag, dragConstraints, dragElastic, onDragEnd, onAnimationComplete,
      onTap,
      ...rest
    }: any, ref: any) =>
      React.createElement(tag as any, { ...rest, onClick: onTap ?? rest.onClick, ref }, rest.children));
    MockMotionComponent.displayName = `MockMotion(${tag})`;
    return MockMotionComponent;
  };
  return {
    motion: new Proxy({}, { get: (_, prop) => MotionTag(prop as string) }),
    AnimatePresence: ({ children }: any) => React.createElement(React.Fragment, null, children),
    animate: jest.fn(),
    useMotionValue: () => ({ get: () => 0, set: () => {} }),
    useTransform: () => 0,
    useReducedMotion: () => true,
  };
});

function pauta(id: string, overrides: Partial<ContentIdeaListItem> = {}): ContentIdeaListItem {
  return {
    id,
    title: `Pauta ${id}`,
    angle: "Ângulo de teste",
    hook: "Abertura de teste",
    territory: "Paternidade",
    assets: [],
    suggestedFormat: "Reel falado",
    tone: null,
    whyItFits: "Porque sim",
    scriptPoints: [],
    scriptClosing: null,
    resonanceNote: null,
    status: "active" as ContentIdeaListItem["status"],
    generatedAt: "2026-07-01T00:00:00.000Z",
    scheduledFor: null,
    ...overrides,
  };
}

function match(name: string): NarrativeCollabMatch {
  return {
    id: `creator-${name}`,
    name,
    username: name.toLowerCase(),
    avatarUrl: null,
    mediaKitSlug: `${name.toLowerCase()}-slug`,
    narrativeExample: "Vídeo — resumo",
    suggestedNarrativeLabel: "Sair do automático",
    narrativeFitReason: "fala de dinheiro sem culpa",
    sharedSignal: "Paternidade",
    distinctSignals: ["Finanças"],
    narrativeMatch: true,
  };
}

const baseProps = {
  isPro: true,
  whatsappLinked: true,
  isGeneratingIdeas: false,
};

describe("DiagnosticoCollabsFeed — deck unificado", () => {
  it("todas as pautas entram no deck; a collab surge no meio, nunca como 1º card", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("a"), pauta("b"), pauta("c")]}
        pautaCollabs={new Map([["a", match("Marina")], ["b", null], ["c", null]])}
        collabDecisions={new Map()}
      />,
    );
    // Topo do deck = pauta solo (b), não a collab (a) — o prêmio surge no meio.
    expect(screen.getByRole("group", { name: "Pauta: Pauta b" })).toBeInTheDocument();
    // Nada de lista de leitura fora da estante: sem seção "Pra gravar" ainda.
    expect(screen.queryByText("Pra gravar")).not.toBeInTheDocument();
  });

  it("coração numa pauta solo salva (estante) e marca decisão local com prefixo pauta:", () => {
    const onToggleSave = jest.fn();
    const onCollabDecision = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("b")]}
        pautaCollabs={new Map([["b", null]])}
        collabDecisions={new Map()}
        onToggleSave={onToggleSave}
        onCollabDecision={onCollabDecision}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Quero gravar essa pauta" }));
    expect(onToggleSave).toHaveBeenCalledWith("b");
    expect(onCollabDecision).toHaveBeenCalledWith("pauta:b", "interested");
  });

  it("coração na collab registra interesse E salva a pauta; X é 'não agora' sem salvar", () => {
    const onToggleSave = jest.fn();
    const onCollabDecision = jest.fn();
    const { rerender } = render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("solo"), pauta("a")]}
        pautaCollabs={new Map([["a", match("Marina")], ["solo", null]])}
        collabDecisions={new Map([["pauta:solo", "interested" as const]])}
        onToggleSave={onToggleSave}
        onCollabDecision={onCollabDecision}
      />,
    );
    // Só a collab restou no deck — topo é ela.
    fireEvent.click(screen.getByRole("button", { name: "Quero fazer essa collab" }));
    expect(onToggleSave).toHaveBeenCalledWith("a");
    expect(onCollabDecision).toHaveBeenCalledWith("a", "interested");

    onToggleSave.mockClear();
    onCollabDecision.mockClear();
    rerender(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("solo"), pauta("b")]}
        pautaCollabs={new Map([["b", match("Théo")], ["solo", null]])}
        collabDecisions={new Map([["pauta:solo", "interested" as const]])}
        onToggleSave={onToggleSave}
        onCollabDecision={onCollabDecision}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Não agora" }));
    expect(onCollabDecision).toHaveBeenCalledWith("b", "dismissed");
    expect(onToggleSave).not.toHaveBeenCalled();
  });

  it("collab dispensada: a pauta re-entra no deck como card solo (a ideia sobrevive)", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("a")]}
        pautaCollabs={new Map([["a", match("Marina")]])}
        collabDecisions={new Map([["a", "dismissed" as const]])}
      />,
    );
    expect(screen.getByRole("group", { name: "Pauta: Pauta a" })).toBeInTheDocument();
    expect(screen.queryByText("com Marina")).not.toBeInTheDocument();
  });

  it("dois ícones no header: 'Pra gravar' (acervo) e 'Combinadas' (novidade), painéis separados", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[
          pauta("salva", { status: "saved" }),
          pauta("esperando", { status: "saved" }),
          pauta("casada", { status: "saved" }),
        ]}
        pautaCollabs={new Map([["esperando", match("Marina")], ["casada", match("Théo")]])}
        collabDecisions={new Map([["esperando", "interested" as const]])}
        confirmedMatches={[{ pautaId: "casada", collab: match("Théo") }]}
      />,
    );
    // A mesa fica só com o deck — nada de coleção solta no scroll.
    expect(screen.queryByText("Pra gravar")).not.toBeInTheDocument();

    // Ícone de salvas → só o acervo (sem WhatsApp, sem match card).
    fireEvent.click(screen.getByRole("button", { name: "Ver pautas salvas (3)" }));
    expect(screen.getByRole("dialog", { name: "Pra gravar" })).toBeInTheDocument();
    expect(screen.getByText("Aguardando Marina")).toBeInTheDocument();
    expect(screen.getByText("Combinada com Théo")).toBeInTheDocument();
    expect(screen.queryByText("Você e Théo toparam")).not.toBeInTheDocument();
    expect(screen.queryByText(/Te avisamos no WhatsApp/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    // Ícone de combinadas → só os matches + o alerta de WhatsApp no rodapé.
    fireEvent.click(screen.getByRole("button", { name: "Ver combinadas (1)" }));
    expect(screen.getByRole("dialog", { name: "Combinadas" })).toBeInTheDocument();
    expect(screen.getByText("Você e Théo toparam")).toBeInTheDocument();
    expect(screen.getByText(/Te avisamos no WhatsApp/)).toBeInTheDocument();
    expect(screen.queryByText("Aguardando Marina")).not.toBeInTheDocument();
  });

  it("zerar o deck mostra a recompensa do ritual (com a contagem da mochila)", () => {
    const props = {
      ...baseProps,
      pautas: [pauta("a"), pauta("guardada", { status: "saved" as const })],
      pautaCollabs: new Map([["a", match("Marina")]]),
    };
    const { rerender } = render(
      <DiagnosticoCollabsFeed {...props} collabDecisions={new Map()} />,
    );
    expect(screen.getByRole("group", { name: /Pauta a/ })).toBeInTheDocument();
    rerender(
      <DiagnosticoCollabsFeed
        {...props}
        collabDecisions={new Map([["a", "dismissed" as const], ["pauta:a", "dismissed" as const]])}
      />,
    );
    expect(screen.getByText("Você triou a rodada")).toBeInTheDocument();
    expect(screen.getByText(/1 pauta guardada na mochila/)).toBeInTheDocument();
  });

  it("free: uma pauta vira o card misterioso e o coração abre o paywall (não decide)", () => {
    const onUpgrade = jest.fn();
    const onCollabDecision = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        isPro={false}
        pautas={[pauta("a"), pauta("b")]}
        collabDecisions={new Map([["pauta:a", "dismissed" as const]])}
        onUpgrade={onUpgrade}
        onCollabDecision={onCollabDecision}
      />,
    );
    // "a" foi descartada; sobra "b" — que é o card misterioso (2ª posição original).
    expect(screen.getByText("Um criador combina com essa pauta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quero fazer essa collab" }));
    expect(onUpgrade).toHaveBeenCalledWith("narrative_map");
    expect(onCollabDecision).not.toHaveBeenCalled();
  });
});
