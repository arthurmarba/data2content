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

    expect(screen.getByRole("status", { name: "Preparando suas collabs" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Pauta:/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ver combinadas/ })).not.toBeInTheDocument();

    rerender(
      <DiagnosticoCollabsFeed
        {...props}
        bootstrapStatus="ready"
        pautaCollabs={new Map([["a", match("Marina")]])}
      />,
    );

    expect(screen.queryByRole("status", { name: "Preparando suas collabs" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Collab pra pauta: Pauta a" })).toBeInTheDocument();
    expect(screen.getByText("Marina")).toBeInTheDocument();
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

    expect(screen.getByRole("alert")).toHaveTextContent("Não conseguimos preparar suas collabs");
    expect(screen.queryByRole("group", { name: /Pauta:/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetryBootstrap).toHaveBeenCalledTimes(1);
  });

  it("mantém cards de trás fora da árvore acessível e abre o topo pelo teclado", () => {
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

    const top = screen.getByRole("group", { name: "Pauta: Pauta a" });
    fireEvent.keyDown(top, { key: "Enter" });
    expect(onOpenIdea).toHaveBeenCalledWith("a");
    expect(screen.getByText("Pauta b").closest('[aria-hidden="true"]')).not.toBeNull();
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
    expect(screen.getByRole("group", { name: "Pauta: Pauta b" })).toBeInTheDocument();
    // Nada de lista de leitura fora da estante: sem seção "Pra gravar" ainda.
    expect(screen.queryByText("Pra gravar")).not.toBeInTheDocument();
  });

  it("renderiza títulos de card sem quebra agressiva no meio de palavra", () => {
    const title = "A verdade sobre como eu decido o que gravar sem depender de ninguém";
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("b", { title })]}
        pautaCollabs={new Map([["b", null]])}
        collabDecisions={new Map()}
      />,
    );
    expect(screen.getByText(title)).toHaveStyle({
      overflowWrap: "normal",
      wordBreak: "normal",
      hyphens: "none",
    });
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

  it("mostra a pauta e as evidências do Seu mapa como chips, sem roteiro corrido", () => {
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

    expect(screen.getByText("Do seu mapa")).toBeInTheDocument();
    expect(screen.getByText("Situação real")).toBeInTheDocument();
    expect(screen.getByText("Refazendo o mesmo vídeo")).toBeInTheDocument();
    expect(screen.getByText("Jeito de falar")).toBeInTheDocument();
    expect(screen.queryByText(/Eu estava copiando/)).not.toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Quero gravar essa pauta" }));
    expect(onSavePauta).toHaveBeenCalledWith("b");
    expect(onAcceptCollabPauta).not.toHaveBeenCalled(); // solo não é collab
  });

  it("aceitar collab → salva + registra interesse; REJEITAR (qualquer card) → descarte permanente", () => {
    const onSavePauta = jest.fn();
    const onAcceptCollabPauta = jest.fn();
    const onDismissPauta = jest.fn();
    const { rerender } = render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("solo", { status: "saved" }), pauta("a")]}
        pautaCollabs={new Map([["a", match("Marina")], ["solo", null]])}
        collabDecisions={new Map()}
        onSavePauta={onSavePauta}
        onAcceptCollabPauta={onAcceptCollabPauta}
        onDismissPauta={onDismissPauta}
      />,
    );
    // Só a collab "a" restou no deck (solo já está salva → estante).
    fireEvent.click(screen.getByRole("button", { name: "Quero fazer essa collab" }));
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
        onDismissPauta={onDismissPauta}
      />,
    );
    // Rejeitar a collab → descarta a pauta de vez (não salva, não registra collab).
    fireEvent.click(screen.getByRole("button", { name: "Não é pra mim" }));
    expect(onDismissPauta).toHaveBeenCalledWith("b");
    expect(onSavePauta).not.toHaveBeenCalled();
    expect(onAcceptCollabPauta).not.toHaveBeenCalled();
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
    expect(screen.queryByRole("group", { name: /Pauta: Pauta a/ })).not.toBeInTheDocument();
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
    expect(screen.queryByRole("group", { name: /Pauta: Pauta a/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver pautas salvas (1)" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Ver pautas salvas (1)" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover de Pra gravar" }));
    expect(onUnsavePauta).toHaveBeenCalledWith("salva");
  });

  it("unsave confirmado remove a pauta da sessão sem voltar para deck ou gaveta", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("salva", { status: "saved" })]}
        pautaCollabs={new Map([["salva", null]])}
        collabDecisions={new Map()}
        pautaActionStates={new Map([["salva", { kind: "unsave" as const, phase: "confirmed" as const }]])}
      />,
    );
    expect(screen.queryByRole("button", { name: /Ver pautas salvas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Pauta: Pauta salva/ })).not.toBeInTheDocument();
  });

  it("unsave confirmado com status local active também não volta para o deck", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("salva", { status: "active" })]}
        pautaCollabs={new Map([["salva", null]])}
        collabDecisions={new Map()}
        pautaActionStates={new Map([["salva", { kind: "unsave" as const, phase: "confirmed" as const }]])}
      />,
    );
    expect(screen.queryByRole("button", { name: /Ver pautas salvas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Pauta: Pauta salva/ })).not.toBeInTheDocument();
  });

  it("falha de unsave mantém a pauta fora da gaveta sem pedir sincronização manual", () => {
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("salva", { status: "saved" })]}
        pautaCollabs={new Map([["salva", null]])}
        collabDecisions={new Map()}
        pautaActionStates={new Map([[
          "salva",
          { kind: "unsave" as const, phase: "failed" as const, message: "Removida da lista. Não consegui sincronizar; se recarregar, ela pode voltar." },
        ]])}
      />,
    );
    expect(screen.queryByRole("button", { name: /Ver pautas salvas/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Pauta: Pauta salva/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Removida da lista. Não consegui sincronizar; se recarregar, ela pode voltar.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sincronizar" })).not.toBeInTheDocument();
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
    expect(screen.getByRole("group", { name: "Pauta: Pauta b" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /Pauta a/ })).not.toBeInTheDocument();
    expect(screen.queryByText("com Marina")).not.toBeInTheDocument();
  });

  it("três ícones no header: Comunidade (WhatsApp), 'Combinadas' (novidade) e 'Pra gravar' (acervo)", () => {
    const onOpenWhatsAppCommunity = jest.fn();
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
        onOpenWhatsAppCommunity={onOpenWhatsAppCommunity}
      />,
    );
    // A mesa fica só com o deck — nada de coleção solta no scroll.
    expect(screen.queryByText("Pra gravar")).not.toBeInTheDocument();

    // Comunidade sempre visível — o grupo do WhatsApp é entrega principal,
    // não pode depender de estado de match/acervo. O gate Pro/free é do caller.
    fireEvent.click(screen.getByRole("button", { name: "Comunidade no WhatsApp" }));
    expect(onOpenWhatsAppCommunity).toHaveBeenCalledTimes(1);

    // Ícone de salvas → salvas-solo + aguardando. A CASADA NÃO mora aqui:
    // a célula completa dela vive em Combinadas (uma casa por item).
    fireEvent.click(screen.getByRole("button", { name: "Ver pautas salvas (2)" }));
    expect(screen.getByRole("dialog", { name: "Pra gravar" })).toBeInTheDocument();
    expect(screen.getByText("Aguardando Marina")).toBeInTheDocument();
    // A espera fecha o loop: diz o que falta e onde a resposta chega.
    expect(screen.getByText(/Se Marina também topar essa pauta, é match/)).toBeInTheDocument();
    expect(screen.queryByText(/Combinada com/)).not.toBeInTheDocument();
    expect(screen.queryByText("Você e Théo toparam")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));

    // Ícone de combinadas → só os matches + o alerta de WhatsApp no rodapé.
    fireEvent.click(screen.getByRole("button", { name: "Ver combinadas (1)" }));
    expect(screen.getByRole("dialog", { name: "Combinadas" })).toBeInTheDocument();
    expect(screen.getByText("Você e Théo toparam")).toBeInTheDocument();
    expect(screen.getByText(/Te avisamos no WhatsApp/)).toBeInTheDocument();
    expect(screen.queryByText("Aguardando Marina")).not.toBeInTheDocument();
  });

  it("Combinadas fica sempre visível, mesmo sem nenhum match — e abre um estado vazio explicado", () => {
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
    const combinadasBtn = screen.getByRole("button", { name: "Ver combinadas — nenhuma ainda" });
    expect(combinadasBtn).toBeInTheDocument();
    // Sem contador numérico quando é zero (o badge só existe pra número > 0).
    expect(combinadasBtn).not.toHaveTextContent(/\d/);

    fireEvent.click(combinadasBtn);
    expect(screen.getByRole("dialog", { name: "Combinadas" })).toBeInTheDocument();
    expect(screen.getByText("Nenhuma collab combinada ainda")).toBeInTheDocument();
    expect(screen.getByText("Quando um criador topar a mesma pauta que você, aparece aqui.")).toBeInTheDocument();
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
    expect(screen.getByText("Pronto para novas pautas?")).toBeInTheDocument();
    expect(screen.getByText("1 pauta guardada nesta rodada.")).toBeInTheDocument();
  });

  it("assinante encerra a rodada com geração principal e WhatsApp secundário", () => {
    const onOpenWhatsAppCommunity = jest.fn();
    const onGenerate = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        pautas={[pauta("guardada", { status: "saved" as const })]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
        onOpenWhatsAppCommunity={onOpenWhatsAppCommunity}
        onGenerate={onGenerate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Carregar nova rodada" }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Entrar no grupo do WhatsApp" }));
    expect(onOpenWhatsAppCommunity).toHaveBeenCalledTimes(1);
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
    expect(screen.getByRole("alert")).toHaveTextContent(/gerações de pautas deste mês/i);
    expect(screen.queryByRole("button", { name: /Carregar nova rodada/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tentar novamente/ })).not.toBeInTheDocument();
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it("não assinante abre o modal contextual em cada ação do fim da rodada", () => {
    const onUpgrade = jest.fn();
    const onGenerate = jest.fn();
    const onOpenWhatsAppCommunity = jest.fn();
    render(
      <DiagnosticoCollabsFeed
        {...baseProps}
        isPro={false}
        pautas={[pauta("guardada", { status: "saved" as const })]}
        pautaCollabs={new Map()}
        collabDecisions={new Map()}
        onUpgrade={onUpgrade}
        onGenerate={onGenerate}
        onOpenWhatsAppCommunity={onOpenWhatsAppCommunity}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Carregar nova rodada/ }));
    expect(onUpgrade).toHaveBeenLastCalledWith("planning");
    fireEvent.click(screen.getByRole("button", { name: /Entrar no grupo do WhatsApp/ }));
    expect(onUpgrade).toHaveBeenLastCalledWith("whatsapp");
    expect(onGenerate).not.toHaveBeenCalled();
    expect(onOpenWhatsAppCommunity).not.toHaveBeenCalled();
  });

  it("sem handler de comunidade, nem o ícone do header nem o card do fim aparecem", () => {
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
        pautas={[pauta("a", { status: "dismissed" }), pauta("b")]}
        collabDecisions={new Map()}
        onUpgrade={onUpgrade}
        onAcceptCollabPauta={onAcceptCollabPauta}
      />,
    );
    // "a" foi descartada; sobra "b" — que é o card misterioso (2ª posição original).
    expect(screen.getByText("Um criador combina com essa pauta")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Quero fazer essa collab" }));
    expect(onUpgrade).toHaveBeenCalledWith("narrative_map");
    expect(onAcceptCollabPauta).not.toHaveBeenCalled();
  });
});
