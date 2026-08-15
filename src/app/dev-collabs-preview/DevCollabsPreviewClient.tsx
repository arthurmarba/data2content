"use client";

// ⚠️ DESCARTÁVEL — a tela COMPLETA de Collabs (header, fotos, pilha, aguardando,
// combinadas, lista, gerar) sem login, com fixture. Monta a DiagnosticoCollabsFeed
// de verdade (agora que o compile client está limpo) + ficha + overlay de match.
// Some no fim da verificação.

import { useEffect, useMemo, useState } from "react";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import { DiagnosticoCollabsFeed } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabsFeed";
import type { PautaActionState } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabsFeed";
import { DiagnosticoIdeaDetailSheet } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoIdeaDetailSheet";
import { DiagnosticoCollabMatchOverlay } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabMatchOverlay";
import type { CollabStackDecision } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabStack";
// Tab bar REAL (não uma cópia) — o preview precisa da mesma estrutura de
// container do shell de produção pra denunciar overlap de verdade, não só
// "parecer" a tela real.
import { DiagnosticoTabBar } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoTabBar";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";

function pauta(id: string, o: Partial<ContentIdeaListItem>): ContentIdeaListItem {
  return {
    id, title: "Pauta", angle: "", territory: "Paternidade", assets: ["Mesa de trabalho"],
    hook: "Ontem meu filho perguntou uma coisa que me travou por uns segundos.",
    suggestedFormat: "Reel falado", tone: "reflexivo",
    whyItFits: "Você fala de trabalho e presença — esse é o nervo exposto.",
    mapAnchors: [
      { kind: "situation", source: "themes", label: "Tentando encerrar o expediente no horário" },
      { kind: "scene", source: "assets", label: "Mesa de trabalho" },
      { kind: "voice", source: "tone", label: "reflexivo" },
    ],
    scriptPoints: ["Abre com a pergunta do filho", "Conta o que passou na cabeça", "Fecha com a decisão que tomou"],
    scriptClosing: "E você, já parou pra pensar no que o automático te custou?",
    scriptBlueprint: {
      version: 2,
      visualPremise: "A rotina de trabalho muda de ritmo quando a pergunta do filho entra em cena.",
      estimatedDurationSeconds: 45,
      scenes: [
        { beat: "abertura", visual: "Mostre o computador aberto e olhe para fora do quadro", spokenIntent: "Repita a pergunta que seu filho fez", onScreenText: "Eu precisava mesmo trabalhar?", shot: "câmera próxima", asset: "Mesa de trabalho", durationSeconds: 6 },
        { beat: "contexto", visual: "Mostre a lista de tarefas daquele dia", spokenIntent: "Explique por que tudo parecia urgente", onScreenText: null, shot: "detalhe", asset: null, durationSeconds: 12 },
        { beat: "virada", visual: "Feche o computador e se afaste da mesa", spokenIntent: "Conte a decisão simples que tomou naquele momento", onScreenText: "Presença também entra na agenda", shot: "câmera mais afastada", asset: "Mesa de trabalho", durationSeconds: 17 },
        { beat: "fechamento", visual: "Fale diretamente com a câmera", spokenIntent: "Convide quem assiste a rever o próprio automático", onScreenText: null, shot: "câmera próxima", asset: null, durationSeconds: 10 },
      ],
      recordingChecklist: ["Separar uma lista de tarefas real", "Gravar a mesa antes e depois de fechar o computador"],
    },
    opportunityBrief: {
      version: 1,
      kind: "collab_optional",
      whyNow: "Seus vídeos sobre escolhas reais da rotina são os que mais geram identificação.",
      collabReason: "Outra pessoa pode trazer uma decisão diferente para a mesma situação.",
      evidenceSummary: "Usamos o seu Mapa e 18 vídeos recentes.",
      evidenceLevel: "strong",
      postsAnalyzed: 18,
      timing: {
        dayLabel: "quinta-feira",
        windowLabel: "entre 18h e 21h",
        shortLabel: "quinta à noite",
        confidence: "high",
        reason: "Nesse período, seus vídeos de rotina receberam mais respostas e salvamentos.",
        sampleSize: 18,
      },
    },
    resonanceNote: null, status: "active", generatedAt: "2026-07-01T00:00:00.000Z", scheduledFor: null,
    ...o,
  };
}

function match(name: string, o: Partial<NarrativeCollabMatch> = {}): NarrativeCollabMatch {
  const previewAvatar = name.includes("Marina")
    ? "/images/community/avatars/marina-dutra.jpg"
    : name.includes("Théo")
      ? "/images/community/avatars/arthur-marba.jpg"
      : "/images/community/avatars/joao-lucas.jpg";
  return {
    id: `c-${name}`, name, username: name.toLowerCase().replace(/\s/g, ""), avatarUrl: previewAvatar,
    mediaKitSlug: `${name.toLowerCase()}-slug`, narrativeExample: "Como saí do vermelho — resumo",
    suggestedNarrativeLabel: "Dinheiro sem culpa",
    narrativeFitReason: "fala de dinheiro sem culpa — cruza com o seu território de paternidade",
    collabRecordingIdea: "Vocês trocam de casa por um dia e narram a rotina financeira um do outro.",
    viewerContribution: "uma situação real de paternidade e trabalho",
    partnerContribution: "uma forma prática de organizar as decisões financeiras da família",
    collabBlueprint: {
      version: 1,
      format: "Reel em tela dividida",
      openingOwner: "viewer",
      scenes: [
        { owner: "viewer", beat: "abertura", visual: "Você mostra a pergunta que recebeu em casa", spokenIntent: "Conte o que seu filho perguntou", transition: "Envie a pergunta para Marina responder" },
        { owner: "partner", beat: "contexto", visual: "Marina mostra uma conta comum da rotina familiar", spokenIntent: "Explique como dinheiro e tempo se misturam nessa decisão", transition: "Volte para sua reação" },
        { owner: "both", beat: "fechamento", visual: "Os dois fecham com uma escolha prática", spokenIntent: "Cada um diz o que faria diferente hoje", transition: null },
      ],
      editPlan: "Alterne as falas e termine com os dois vídeos lado a lado.",
      handoffChecklist: ["Combinar a duração de cada fala", "Gravar na vertical e com luz parecida"],
    },
    sharedSignal: "Paternidade", distinctSignals: ["Finanças"], narrativeMatch: true, ...o,
  };
}

const PAUTAS: ContentIdeaListItem[] = [
  pauta("p1", { title: "O dia que meu filho perguntou se eu precisava trabalhar" }),
  pauta("p2", { title: "Aprendi a proteger o jantar como reunião importante", territory: "Rotina" }),
  pauta("p3", { title: "Por que parei de responder e-mail depois das 18h", territory: "Trabalho" }),
  // Território longo de propósito — regressão do chip truncando ("Cultura pop
  // como nego...") reportada em produção; mantém a checagem visual viva.
  pauta("p4", {
    title: "A verdade sobre como a IA mudou o jeito que eu trabalho",
    territory: "Cultura pop como negócio",
    hook: "Muita gente vê a inteligência artificial como uma ameaça, mas pra mim, foi o meu melhor parceiro de trabalho.",
  }),
  pauta("p5", { title: "Trabalhei 10 anos no automático. O que eu perdi?", territory: "Reflexão" }),
  pauta("p6", { title: "Já combinada — vídeo com o Théo sobre rotina", territory: "Rotina" }),
];

const MATCHES = new Map<string, NarrativeCollabMatch | null>([
  ["p1", match("Marina Braga", {
    collabMode: "remoto",
    // Longo de propósito — pior caso combinado com o título mais longo do
    // fixture (regressão de espaçamento/clipping em tela baixa).
    narrativeFitReason: "Ela cruza a visão financeira familiar dela com o seu pilar de paternidade ativa, trazendo o ângulo do dinheiro em casa que você ainda não cobre nos seus vídeos.",
    collabRecordingIdea: "Vocês gravam em formato remoto de reação, onde cada um comenta o planejamento do outro via split-screen.",
    sharedSignal: "Paternidade",
    distinctSignals: ["Finanças", "Planejamento"]
  })],
  ["p2", match("Théo Pires", {
    collabMode: "presencial",
    narrativeFitReason: "Vocês dois documentam a rotina em casa com leveza e bom humor.",
    collabRecordingIdea: "Vocês gravam um café da manhã juntos na mesma cozinha, trocando experiências reais de paternidade.",
    sharedSignal: "Rotina",
    distinctSignals: ["Educação infantil"]
  })],
  ["p3", match("João Reis", {
    collabMode: "remoto",
    narrativeFitReason: "fala de limites e trabalho com honestidade",
    collabRecordingIdea: "Vocês gravam em formato de revezamento/dueto dividindo dicas de rotina.",
    sharedSignal: "Trabalho",
    distinctSignals: ["Carreira"],
  })],
  ["p4", null],
  ["p5", null],
  ["p6", match("Théo Pires", {
    collabMode: "presencial",
    narrativeFitReason: "Vocês dois documentam a rotina em casa com leveza e bom humor.",
    collabRecordingIdea: "Vocês gravam um café da manhã juntos na mesma cozinha, trocando experiências reais de paternidade.",
    sharedSignal: "Rotina",
    distinctSignals: ["Educação infantil"],
  })],
]);

export function DevCollabsPreviewClient() {
  const [decisions, setDecisions] = useState<Map<string, CollabStackDecision>>(new Map());
  const [actionStates, setActionStates] = useState<Map<string, PautaActionState>>(new Map());
  // p5 começa salva comum para validar remoção; p6 começa salva e combinada.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(["p5", "p6"]));
  const [confirmed, setConfirmed] = useState<Array<{ pautaId: string; collab: NarrativeCollabMatch }>>([
    {
      pautaId: "p6",
      collab: match("Théo Pires", {
        collabMode: "presencial",
        narrativeFitReason: "Vocês dois documentam a rotina em casa com leveza e bom humor.",
        collabRecordingIdea: "Vocês gravam um café da manhã juntos na mesma cozinha, trocando experiências reais de paternidade.",
        sharedSignal: "Rotina",
        distinctSignals: ["Educação infantil"],
      })
    },
  ]);
  // Ideias descartadas recebem status "dismissed", como no shell real.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [openIdeaId, setOpenIdeaId] = useState<string | null>(null);
  const [openMatch, setOpenMatch] = useState<{ pautaId: string; variant: "celebration" | "revisit" } | null>(null);

  // Simula "match ao voltar": p6 casou com o app fechado (isNew) — a festa
  // dispara na montagem, como faria a hidratação real do shell. (Sem ref guard:
  // em StrictMode o ref persistiria entre os double-invokes e barraria o timer.)
  useEffect(() => {
    const t = setTimeout(() => setOpenMatch({ pautaId: "p6", variant: "celebration" }), 500);
    return () => clearTimeout(t);
  }, []);

  // Status derivado — salvas → "saved"; ideias descartadas → "dismissed".
  const pautasWithStatus = useMemo(
    () => PAUTAS.map((p) =>
      dismissedIds.has(p.id) ? { ...p, status: "dismissed" as const }
        : savedIds.has(p.id) ? { ...p, status: "saved" as const }
        : p,
    ),
    [savedIds, dismissedIds],
  );
  const pautaById = useMemo(() => new Map(pautasWithStatus.map((p) => [p.id, p])), [pautasWithStatus]);

  const savePauta = (id: string) => {
    setActionStates((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const unsavePauta = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setActionStates((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  };

  const dismissPauta = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    setActionStates((prev) => new Map(prev).set(id, { kind: "dismiss", phase: "confirmed" }));
  };

  const acceptCollabPauta = (pautaId: string) => {
    savePauta(pautaId);
    setDecisions((prev) => new Map(prev).set(pautaId, "interested"));
    // Simula o match mútuo: "quero fazer" na p1 dispara a comemoração — no real
    // isso vem da resposta do POST /collabs/interest (matched=true).
    if (pautaId === "p1") {
      const collab = MATCHES.get("p1")!;
      setConfirmed((prev) => [...prev, { pautaId, collab }]);
      setTimeout(() => setOpenMatch({ pautaId, variant: "celebration" }), 260);
    }
  };

  const declineCollabPauta = (pautaId: string) => {
    setDecisions((prev) => new Map(prev).set(pautaId, "dismissed"));
    setActionStates((prev) => {
      const next = new Map(prev);
      next.delete(pautaId);
      return next;
    });
  };

  const openIdea = openIdeaId ? pautaById.get(openIdeaId) ?? null : null;
  const openIdeaDecision = openIdeaId ? decisions.get(openIdeaId) : undefined;
  const openIdeaCollab = openIdeaId && openIdeaDecision !== "dismissed" ? MATCHES.get(openIdeaId) ?? null : null;
  const openIdeaMatched = confirmed.some((m) => m.pautaId === openIdeaId);

  const matchEntry = openMatch ? confirmed.find((m) => m.pautaId === openMatch.pautaId) ?? null : null;
  const matchPauta = matchEntry ? pautaById.get(matchEntry.pautaId) ?? null : null;

  return (
    // Mesmo container do shell real: fixed inset-0 flex-col, área rolável com
    // padding-bottom reservado pra tab bar (fixed, por cima), tab bar como
    // último irmão. Sem isso, o preview não denuncia overlap real — só "parece"
    // a tela, sem ser a mesma estrutura de espaço.
    <div
      className={`d2c-mobile-app fixed inset-0 flex flex-col overflow-hidden ${d2cFontVariables}`}
      style={{ width: "100%", margin: "0 auto", background: "var(--ds-color-paper)" }}
    >
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
      >
        <DiagnosticoCollabsFeed
          pautas={pautasWithStatus}
          isPro
          whatsappLinked
          isGeneratingIdeas={false}
          pautaCollabs={MATCHES}
          collabDecisions={decisions}
          confirmedMatches={confirmed}
          pautaActionStates={actionStates}
          onOpenMatch={(pautaId) => setOpenMatch({ pautaId, variant: "revisit" })}
          onOpenIdea={setOpenIdeaId}
          onSavePauta={savePauta}
          onUnsavePauta={unsavePauta}
          onAcceptCollabPauta={acceptCollabPauta}
          onDeclineCollabPauta={declineCollabPauta}
          onDismissPauta={dismissPauta}
          onGenerate={() => {}}
          onUpgrade={() => alert("paywall")}
        />
      </div>

      <DiagnosticoTabBar
        activeTab="collabs"
        onSelectPerfil={() => alert("iria pro Perfil")}
        onSelectCollabs={() => {}}
        onPressPlus={() => alert("abriria upload")}
      />

      {openIdea ? (
        <DiagnosticoIdeaDetailSheet
          idea={openIdea}
          collab={openIdeaCollab}
          isPro
          decisionPending={Boolean(openIdeaCollab) && !openIdeaDecision && !openIdeaMatched}
          onDecide={(d) => {
            if (d === "interested") acceptCollabPauta(openIdeaId!);
            else declineCollabPauta(openIdeaId!);
            setOpenIdeaId(null);
          }}
          onSaveIdea={() => {
            savePauta(openIdeaId!);
            setOpenIdeaId(null);
          }}
          awaitingOtherSide={Boolean(openIdeaCollab) && openIdeaDecision === "interested" && !openIdeaMatched}
          onClose={() => setOpenIdeaId(null)}
        />
      ) : null}

      {matchEntry && matchPauta ? (
        <DiagnosticoCollabMatchOverlay
          pauta={matchPauta}
          collab={matchEntry.collab}
          viewerName="Arthur"
          viewerAvatarUrl={null}
          variant={openMatch!.variant}
          onOpenIdea={(id) => { setOpenMatch(null); setOpenIdeaId(id); }}
          onClose={() => setOpenMatch(null)}
        />
      ) : null}
    </div>
  );
}
