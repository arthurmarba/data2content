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
    useMotionValue: (initial = 0) => {
      const valueRef = React.useRef(initial);
      const motionValueRef = React.useRef({
        get: () => valueRef.current,
        set: (next: number) => { valueRef.current = next; },
      });
      return motionValueRef.current;
    },
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
    partnerContribution: "um olhar financeiro que completa essa história",
    collabMode: "remoto",
    narrativeMatch: true,
  };
}

const baseProps = {
  isPro: true,
  whatsappLinked: true,
  isGeneratingIdeas: false,
};

describe("DiagnosticoCollabsFeed — deck unificado", () => {
  it("não expõe cards provisórios enquanto o bootstrap ainda está incompleto", () => {
    const props = {
      ...baseProps,
      pautas: [pauta("a")],
      collabDecisions: new Map<string, "interested" | "dismissed">(),
    };
    const { rerender } = render(
      <DiagnosticoCollabsFeed
        {...props}
        bootstrapStatus="loading"
        pautaCollabs={new Map()}
      />,
    );

    expect(screen.getByRole("status", { name: "Preparando suas ideias" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Ideia:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver combinadas/ })).not.toBeInTheDocument();

    rerender(
      <DiagnosticoCollabsFeed
        {...props}
        bootstrapStatus="ready"
        pautaCollabs={new Map([["a", match("Marina")]])}
      />,
    );

    expect(screen.queryByRole("status", { name: "Preparando suas ideias" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Parceria recomendada: Pauta a/ })).toBeInTheDocument();
    expect(screen.getByText("Com Marina")).toBeInTheDocument();
  });

  it("falha de bootstrap nunca se disfarça de pauta solo e oferece retry", () => {
    const onRetryBootstrap = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("a")]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
        bootstrapStatus="error"
        bootstrapError="Não foi possível sincronizar sugestões e matches."
        onRetryBootstrap={onRetryBootstrap}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Não conseguimos preparar suas ideias");
    expect(screen.queryByRole("group", { name: /Ideia:/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetryBootstrap).toHaveBeenCalledTimes(1);
  });

  it("mantém cards de trás fora da árvore acessível e vira o topo pelo teclado", () => {
    const onOpenIdea = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("a"), pauta("b"), pauta("c")]}
        pautaCollabs={new Map([["a", null], ["b", null], ["c", null]])}
        collabDecisions={new Map()}
        onOpenIdea={onOpenIdea}
      />,
    );

    const top = screen.getByRole("group", { name: /Ideia: Pauta a/ });
    fireEvent.keyDown(top, { key: "Enter" });
    expect(screen.getByTestId("collab-flashcard-back")).toBeInTheDocument();
    expect(onOpenIdea).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Abrir plano completo da ideia" }));
    expect(onOpenIdea).toHaveBeenCalledWith("a");
    expect(screen.getByText("Pauta b").closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it("mostra território e formato na frente, e a justificativa só no verso", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("a")]}
        pautaCollabs={new Map([["a", match("Marina")]])}
        collabDecisions={new Map()}
      />,
    );

    const collabCard = screen.getByRole("group", { name: /Parceria recomendada: Pauta a/ });
    expect(collabCard).toHaveTextContent("Pauta a");
    expect(collabCard).toHaveTextContent("Collab sugerida");
    expect(collabCard).toHaveTextContent("Com Marina");
    expect(collabCard).toHaveTextContent("Marina");
    expect(collabCard).not.toHaveTextContent("Um olhar financeiro que completa essa história");
    // Território e formato ficam na FRENTE: são o que decide "eu gravo isso?".
    // O que continua escondido é a JUSTIFICATIVA — o texto que explica a escolha.
    expect(collabCard).toHaveTextContent("Reel falado");
    expect(collabCard).not.toHaveTextContent("Cada pessoa grava de onde estiver");

    const identityHeader = screen.getByTestId("collab-identity-header");
    expect(identityHeader).toHaveStyle({ borderBottom: "1px solid var(--ds-color-line)" });
    expect(identityHeader.nextElementSibling).toHaveTextContent("Pauta a");

    fireEvent.click(screen.getByRole("button", { name: "Ver por que combina" }));
    expect(screen.getByTestId("collab-flashcard-back")).toHaveTextContent("Um olhar financeiro que completa essa história");
    expect(screen.getByTestId("collab-flashcard-back")).toHaveTextContent("Reel falado");
    expect(screen.getByTestId("collab-flashcard-back")).toHaveTextContent("À distância");
  });

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
    expect(screen.getByRole("group", { name: /Ideia: Pauta b/ })).toBeInTheDocument();
    // Nada de lista de leitura fora da estante: sem seção "Pra gravar" ainda.
    expect(screen.queryByText("Pra gravar")).not.toBeInTheDocument();
  });

  it("promove exatamente o card visível atrás depois de salvar o topo", () => {
    const onSavePauta = jest.fn();
    const pautas = [pauta("a"), pauta("b"), pauta("c"), pauta("d"), pauta("e")];
    const pautaCollabs = new Map([
      ["a", match("Marina")],
      ["b", null],
      ["c", null],
      ["d", match("Théo")],
      ["e", null],
    ]);
    const { rerender } = render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={pautas}
        pautaCollabs={pautaCollabs}
        collabDecisions={new Map()}
        onSavePauta={onSavePauta}
      />,
    );

    expect(screen.getByRole("group", { name: /Ideia: Pauta b/ })).toBeInTheDocument();
    expect(screen.getByText("Pauta a").closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText("1 de 5")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver como gravar" }));
    expect(screen.getByTestId("collab-flashcard-back")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Salvar ideia" }));
    expect(onSavePauta).toHaveBeenCalledWith("b");

    rerender(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={pautas.map((item) => item.id === "b" ? { ...item, status: "saved" as const } : item)}
        pautaCollabs={pautaCollabs}
        collabDecisions={new Map()}
        pautaActionStates={new Map([["b", { kind: "save" as const, phase: "pending" as const }]])}
        onSavePauta={onSavePauta}
      />,
    );

    expect(screen.getByRole("group", { name: /Parceria recomendada: Pauta a/ })).toBeInTheDocument();
    expect(screen.getAllByTestId("collab-flashcard-front").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("collab-flashcard-back")).not.toBeInTheDocument();
    expect(screen.getByText("2 de 5")).toBeInTheDocument();
  });

  it("promove exatamente o card visível atrás depois de descartar o topo", () => {
    const onDismissPauta = jest.fn();
    const pautas = [pauta("a"), pauta("b"), pauta("c"), pauta("d"), pauta("e")];
    const pautaCollabs = new Map([
      ["a", match("Marina")],
      ["b", null],
      ["c", null],
      ["d", match("Théo")],
      ["e", null],
    ]);
    const { rerender } = render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={pautas}
        pautaCollabs={pautaCollabs}
        collabDecisions={new Map()}
        onDismissPauta={onDismissPauta}
      />,
    );

    expect(screen.getByRole("group", { name: /Ideia: Pauta b/ })).toBeInTheDocument();
    expect(screen.getByText("Pauta a").closest('[aria-hidden="true"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Descartar ideia" }));
    expect(onDismissPauta).toHaveBeenCalledWith("b");

    rerender(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={pautas.map((item) => item.id === "b" ? { ...item, status: "dismissed" as const } : item)}
        pautaCollabs={pautaCollabs}
        collabDecisions={new Map()}
        pautaActionStates={new Map([["b", { kind: "dismiss" as const, phase: "confirmed" as const }]])}
        onDismissPauta={onDismissPauta}
      />,
    );

    expect(screen.getByRole("group", { name: /Parceria recomendada: Pauta a/ })).toBeInTheDocument();
  });

  it("prioriza a frase inteira antes de aplicar reticências", () => {
    const title = "A verdade sobre como a IA mudou o jeito que eu trabalho";
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("b", { title })]}
        pautaCollabs={new Map([["b", null]])}
        collabDecisions={new Map()}
      />,
    );
    const titleElement = screen.getByText(title);
    expect(titleElement).toHaveStyle({ width: "100%", hyphens: "none" });
    expect(titleElement.style.maxWidth).toBe("100%");
    expect(titleElement).toHaveAttribute("data-max-lines", "4");
    expect(titleElement.style.overflowWrap).toBe("normal");
    expect(titleElement.style.wordBreak).toBe("normal");
  });

  it("limpa texto corrompido salvo antes de renderizar cards antigos", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[
          pauta("b", {
            title: "A verdade sobre como eu decido o que gravar sem depender de ningu\nR",
            hook: "Eu aprendi que ela me d\r\n\r\nm\r\n\r\ná mais liberdade.",
          }),
        ]}
        pautaCollabs={new Map([["b", null]])}
        collabDecisions={new Map()}
      />,
    );
    expect(screen.getByText("A verdade sobre como eu decido o que gravar sem depender de ninguém")).toBeInTheDocument();
    // A frente virou superfície de decisão visual: o gancho fica no detalhe.
    expect(screen.queryByText("“Eu aprendi que ela me dá mais liberdade.”")).not.toBeInTheDocument();
    expect(screen.queryByText(/ningu\s*R/)).not.toBeInTheDocument();
  });

  it("mantém a frente limpa e leva as evidências do mapa para o detalhe", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("mapa", {
          title: "O dia em que parei de imitar meu próprio conteúdo",
          territory: "Autonomia criativa",
          assets: ["Mesa de trabalho"],
          tone: "Direto e irônico",
          hook: "Eu estava copiando até a versão antiga de mim.",
          scriptPoints: ["Abra a pasta de rascunhos antigos."],
          mapAnchors: [
            { kind: "situation", source: "themes", label: "Refazendo o mesmo vídeo" },
            { kind: "subject", source: "territories", label: "Autonomia criativa" },
            { kind: "scene", source: "assets", label: "Mesa de trabalho" },
            { kind: "voice", source: "tone", label: "Direto e irônico" },
          ],
        })]}
        pautaCollabs={new Map([["mapa", null]])}
        collabDecisions={new Map()}
      />,
    );

    expect(screen.queryByText("Do seu mapa")).not.toBeInTheDocument();
    expect(screen.queryByText("Situação real")).not.toBeInTheDocument();
    expect(screen.queryByText("Refazendo o mesmo vídeo")).not.toBeInTheDocument();
    expect(screen.queryByText("Jeito de falar")).not.toBeInTheDocument();
    expect(screen.queryByText(/Eu estava copiando/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver como gravar" }));
    expect(screen.getByTestId("collab-flashcard-back")).toHaveTextContent("Eu estava copiando até a versão antiga de mim.");
    expect(screen.queryByText(/Abra a pasta/)).not.toBeInTheDocument();
  });

  it("aceitar uma pauta solo → salva (vai pra estante); não registra decisão de collab", () => {
    const onSavePauta = jest.fn();
    const onAcceptCollabPauta = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("b")]}
        pautaCollabs={new Map([["b", null]])}
        collabDecisions={new Map()}
        onSavePauta={onSavePauta}
        onAcceptCollabPauta={onAcceptCollabPauta}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Salvar ideia" }));
    expect(onSavePauta).toHaveBeenCalledWith("b");
    expect(onAcceptCollabPauta).not.toHaveBeenCalled(); // solo não é collab
  });

  it("no Free, abre a assinatura sem retirar nem salvar o card atual", () => {
    const onSavePauta = jest.fn();
    const onUpgrade = jest.fn();
    const { container } = render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        isPro={false}
        pautas={[pauta("free-a"), pauta("free-b")]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
        onSavePauta={onSavePauta}
        onUpgrade={onUpgrade}
      />,
    );

    const topBefore = container.querySelector('[data-stack-position="0"]')?.getAttribute("data-stack-card-id");
    fireEvent.click(screen.getByRole("button", { name: "Salvar ideia" }));

    expect(onUpgrade).toHaveBeenCalledWith("narrative_map");
    expect(onSavePauta).not.toHaveBeenCalled();
    expect(container.querySelector('[data-stack-position="0"]')).toHaveAttribute("data-stack-card-id", topBefore);
  });

  it("aceitar parceria registra interesse; recusar a pessoa preserva a ideia", () => {
    const onSavePauta = jest.fn();
    const onAcceptCollabPauta = jest.fn();
    const onDeclineCollabPauta = jest.fn();
    const onDismissPauta = jest.fn();
    const { rerender } = render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("solo", { status: "saved" }), pauta("a")]}
        pautaCollabs={new Map([["a", match("Marina")], ["solo", null]])}
        collabDecisions={new Map()}
        onSavePauta={onSavePauta}
        onAcceptCollabPauta={onAcceptCollabPauta}
        onDeclineCollabPauta={onDeclineCollabPauta}
        onDismissPauta={onDismissPauta}
      />,
    );
    // Só a collab "a" restou no deck (solo já está salva → estante).
    fireEvent.click(screen.getByRole("button", { name: "Quero gravar com Marina" }));
    expect(onAcceptCollabPauta).toHaveBeenCalledWith("a");
    expect(onSavePauta).not.toHaveBeenCalled();
    expect(onDismissPauta).not.toHaveBeenCalled();

    onSavePauta.mockClear();
    onAcceptCollabPauta.mockClear();
    rerender(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("solo", { status: "saved" }), pauta("b")]}
        pautaCollabs={new Map([["b", match("Théo")], ["solo", null]])}
        collabDecisions={new Map()}
        onSavePauta={onSavePauta}
        onAcceptCollabPauta={onAcceptCollabPauta}
        onDeclineCollabPauta={onDeclineCollabPauta}
        onDismissPauta={onDismissPauta}
      />,
    );
    // Recusar a pessoa → registra só a recusa da parceria; a ideia não é apagada.
    fireEvent.click(screen.getByRole("button", { name: "Agora não quero esta parceria" }));
    expect(onDeclineCollabPauta).toHaveBeenCalledWith("b");
    expect(onDismissPauta).not.toHaveBeenCalled();
    expect(onSavePauta).not.toHaveBeenCalled();
    expect(onAcceptCollabPauta).not.toHaveBeenCalled();

    rerender(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("solo", { status: "saved" }), pauta("b")]}
        pautaCollabs={new Map([["b", match("Théo")], ["solo", null]])}
        collabDecisions={new Map([["b", "dismissed" as const]])}
        onSavePauta={onSavePauta}
        onAcceptCollabPauta={onAcceptCollabPauta}
        onDeclineCollabPauta={onDeclineCollabPauta}
        onDismissPauta={onDismissPauta}
      />,
    );
    expect(screen.getByRole("group", { name: /Ideia: Pauta b/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar ideia" })).toBeInTheDocument();
  });

  it("usa a rota interna estável para a foto no card real de collab", () => {
    const { container } = render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("solo", { status: "saved" }), pauta("a")]}
        pautaCollabs={new Map([["a", match("Marina")], ["solo", null]])}
        collabDecisions={new Map()}
      />,
    );

    const avatar = container.querySelector('img[src^="/api/dashboard/mobile-strategic-profile/collabs/creators/creator-Marina/avatar"]');
    expect(avatar).not.toBeNull();
    expect(avatar).toHaveAttribute(
      "src",
      "/api/dashboard/mobile-strategic-profile/collabs/creators/creator-Marina/avatar?v=20260719-collab-avatar-v4",
    );
  });

  it("falha de save não recoloca a mesma pauta no deck e mostra retry", () => {
    const onRetryPautaAction = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("a")]}
        pautaCollabs={new Map([["a", null]])}
        collabDecisions={new Map()}
        pautaActionStates={new Map([[
          "a",
          { kind: "save" as const, phase: "failed" as const, message: "Não foi possível salvar agora. Tente novamente." },
        ]])}
        onRetryPautaAction={onRetryPautaAction}
      />,
    );
    expect(screen.queryByRole("group", { name: /Ideia: Pauta a/ })).not.toBeInTheDocument();
    expect(screen.getByText("Não foi possível salvar agora. Tente novamente.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetryPautaAction).toHaveBeenCalledWith("a");
  });

  it("save pendente mantém a pauta fora do deck e visível na estante como não sincronizada", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("a")]}
        pautaCollabs={new Map([["a", null]])}
        collabDecisions={new Map()}
        pautaActionStates={new Map([["a", { kind: "save" as const, phase: "pending" as const }]])}
      />,
    );
    expect(screen.queryByRole("group", { name: /Ideia: Pauta a/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver ideia sendo salva" }));
    expect(screen.getByText("Pauta a")).toBeInTheDocument();
    expect(screen.getByText("Salvando...")).toBeInTheDocument();
  });

  it("remover da gaveta usa unsave explícito", () => {
    const onUnsavePauta = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("salva", { status: "saved" })]}
        pautaCollabs={new Map([["salva", null]])}
        collabDecisions={new Map()}
        onUnsavePauta={onUnsavePauta}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver ideias salvas (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Tirar das ideias salvas" }));
    expect(onUnsavePauta).toHaveBeenCalledWith("salva");
  });

  it("tirar das salvas devolve a ideia ativa para o deck", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("salva", { status: "active" })]}
        pautaCollabs={new Map([["salva", null]])}
        collabDecisions={new Map()}
      />,
    );
    expect(screen.queryByRole("button", { name: /Ver ideias salvas/ })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Ideia: Pauta salva/ })).toBeInTheDocument();
  });

  it("estado antigo de unsave não transforma uma ideia ativa em descarte", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("salva", { status: "active" })]}
        pautaCollabs={new Map([["salva", null]])}
        collabDecisions={new Map()}
        pautaActionStates={new Map([["salva", { kind: "unsave" as const, phase: "confirmed" as const }]])}
      />,
    );
    expect(screen.queryByRole("button", { name: /Ver ideias salvas/ })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Ideia: Pauta salva/ })).toBeInTheDocument();
  });

  it("falha ao tirar das salvas mantém a ideia salva e oferece nova tentativa", () => {
    const onRetryPautaAction = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("salva", { status: "saved" })]}
        pautaCollabs={new Map([["salva", null]])}
        collabDecisions={new Map()}
        pautaActionStates={new Map([[
          "salva",
          { kind: "unsave" as const, phase: "failed" as const, message: "Não foi possível tirar a ideia das salvas. Tente novamente." },
        ]])}
        onRetryPautaAction={onRetryPautaAction}
      />,
    );
    expect(screen.getByRole("button", { name: /Ver ideias salvas/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Ideia: Pauta salva/ })).not.toBeInTheDocument();
    expect(screen.getByText("Não foi possível tirar a ideia das salvas. Tente novamente.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(onRetryPautaAction).toHaveBeenCalledWith("salva");
  });

  it("pauta descartada (status dismissed) some do deck E da estante — nunca reaparece", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("a", { status: "dismissed" }), pauta("b")]}
        pautaCollabs={new Map([["a", match("Marina")], ["b", null]])}
        collabDecisions={new Map()}
      />,
    );
    // "a" foi descartada → nem no deck nem na estante. Topo é "b".
    expect(screen.getByRole("group", { name: /Ideia: Pauta b/ })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Pauta a/ })).not.toBeInTheDocument();
    expect(screen.queryByText("com Marina")).not.toBeInTheDocument();
  });

  it("mantém no header apenas 'Combinadas' (novidade) e 'Pra gravar' (acervo)", () => {
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

    // O grupo da comunidade foi consolidado no card de reunião do Perfil.
    expect(screen.queryByRole("button", { name: "Comunidade no WhatsApp" })).not.toBeInTheDocument();

    // Ícone de salvas → salvas-solo + aguardando. A CASADA NÃO mora aqui:
    // a célula completa dela vive em Combinadas (uma casa por item).
    fireEvent.click(screen.getByRole("button", { name: "Ver ideias salvas (2)" }));
    expect(screen.getByRole("dialog", { name: "Ideias salvas" })).toBeInTheDocument();
    expect(screen.getByText("Interesse registrado")).toBeInTheDocument();
    // A espera fecha o loop: diz o que falta e onde a resposta chega.
    expect(screen.getByText(/Se houver interesse dos dois lados, avisamos você no WhatsApp/)).toBeInTheDocument();
    expect(screen.queryByText(/Combinada com/)).not.toBeInTheDocument();
    expect(screen.queryByText("Parceria com Théo confirmada")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    // Ícone de combinadas → só os matches + o alerta de WhatsApp no rodapé.
    fireEvent.click(screen.getByRole("button", { name: "Ver parcerias confirmadas (1)" }));
    expect(screen.getByRole("dialog", { name: "Combinadas" })).toBeInTheDocument();
    expect(screen.getByText("Parceria com Théo confirmada")).toBeInTheDocument();
    expect(screen.getByText("Próximo passo: combinar a gravação.")).toBeInTheDocument();
    expect(screen.getByText(/Avisamos no WhatsApp/)).toBeInTheDocument();
    expect(screen.queryByText("Interesse registrado")).not.toBeInTheDocument();
  });

  it("Parcerias confirmadas fica sempre visível, mesmo sem nenhuma — e abre um estado vazio explicado", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("a"), pauta("b")]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
        confirmedMatches={[]}
      />,
    );
    // O botão não pode sumir por falta de match — sumir lê como "essa função não existe".
    const combinadasBtn = screen.getByRole("button", { name: "Ver parcerias confirmadas — nenhuma ainda" });
    expect(combinadasBtn).toBeInTheDocument();
    // Sem contador numérico quando é zero (o badge só existe pra número > 0).
    expect(combinadasBtn).not.toHaveTextContent(/\d/);

    fireEvent.click(combinadasBtn);
    expect(screen.getByRole("dialog", { name: "Combinadas" })).toBeInTheDocument();
    expect(screen.getByText("Nenhuma parceria confirmada ainda")).toBeInTheDocument();
    expect(screen.getByText("Quando outra pessoa escolher a mesma ideia, ela aparecerá aqui.")).toBeInTheDocument();
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
    // "a" foi rejeitada (status dismissed) → deck vazio, mas a saved "guardada"
    // mantém a área visível e o stack mostra a recompensa.
    rerender(
      <DiagnosticoCollabsFeed
        {...props}
        pautas={[pauta("a", { status: "dismissed" as const }), pauta("guardada", { status: "saved" as const })]}
        collabDecisions={new Map()}
      />,
    );
    expect(screen.getByText("Rodada concluída")).toBeInTheDocument();
    expect(screen.getByText("Quer ver novas ideias?")).toBeInTheDocument();
    expect(screen.getByText("1 ideia salva nesta rodada.")).toBeInTheDocument();
  });

  it("assinante encerra a rodada apenas com a próxima ação de pautas", () => {
    const onGenerate = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("guardada", { status: "saved" as const })]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
        onGenerate={onGenerate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver novas ideias" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Entrar no grupo do WhatsApp" })).not.toBeInTheDocument();
  });

  it("rodada concluída expõe falha de geração e oferece Tentar novamente", () => {
    const onGenerate = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("guardada", { status: "saved" as const })]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
        ideaGenerationBlocker="failed"
        onGenerate={onGenerate}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/Não foi possível carregar a nova rodada/i);
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("rodada concluída com cota estourada avisa e esconde o botão de gerar", () => {
    const onGenerate = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("guardada", { status: "saved" as const })]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
        ideaGenerationBlocker="quota_exceeded"
        ideaQuotaResetAt="2026-08-01T00:00:00.000Z"
        onGenerate={onGenerate}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/gerações de ideias deste mês/i);
    expect(screen.queryByRole("button", { name: /Ver novas ideias/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tentar novamente/ })).not.toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("não assinante abre o modal contextual para gerar a próxima rodada", () => {
    const onUpgrade = jest.fn();
    const onGenerate = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        isPro={false}
        pautas={[pauta("guardada", { status: "saved" as const })]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
        onUpgrade={onUpgrade}
        onGenerate={onGenerate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ver novas ideias/ }));
    expect(onUpgrade).toHaveBeenLastCalledWith("planning");
    expect(screen.queryByRole("button", { name: /Entrar no grupo do WhatsApp/ })).not.toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("não duplica no Collabs os acessos à comunidade que ficam no Perfil", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("guardada", { status: "saved" as const })]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Comunidade no WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Entrar no grupo do WhatsApp/ })).not.toBeInTheDocument();
  });

  it("free: uma pauta vira o card misterioso e o coração abre o paywall (não decide)", () => {
    const onUpgrade = jest.fn();
    const onAcceptCollabPauta = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        isPro={false}
        pautas={[pauta("a", { status: "dismissed" }), pauta("b", {
          opportunityBrief: {
            version: 1,
            kind: "collab_optional",
            whyNow: "Esse assunto aparece nos seus vídeos recentes.",
            collabReason: "Outra pessoa pode mostrar uma experiência diferente.",
            evidenceSummary: "Usamos o seu Mapa e 8 vídeos recentes.",
            evidenceLevel: "medium",
            postsAnalyzed: 8,
            timing: null,
          },
        })]}
        collabDecisions={new Map()}
        onUpgrade={onUpgrade}
        onAcceptCollabPauta={onAcceptCollabPauta}
      />,
    );
    // "a" foi descartada; sobra "b" — que é o card misterioso (2ª posição original).
    expect(screen.getByText("Há uma pessoa indicada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver sugestão de parceria no Pro" }));
    expect(onUpgrade).toHaveBeenCalledWith("narrative_map");
    expect(onAcceptCollabPauta).not.toHaveBeenCalled();
  });
});
