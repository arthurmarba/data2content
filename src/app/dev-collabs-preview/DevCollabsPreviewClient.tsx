"use client";

// ⚠️ DESCARTÁVEL — a tela COMPLETA de Collabs (header, fotos, pilha, aguardando,
// combinadas, lista, gerar) sem login, com fixture. Monta a DiagnosticoCollabsFeed
// de verdade (agora que o compile client está limpo) + ficha + overlay de match.
// Some no fim da verificação.

import { useEffect, useMemo, useState } from "react";
import type { ContentIdeaListItem } from "@/app/dashboard/boards/videoUpload/contentIdeasReadService";
import type { NarrativeCollabMatch } from "@/app/dashboard/boards/videoUpload/narrativeCollabMatchingService";
import type { DiagnosticoCreatorDirectoryState } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import { DiagnosticoCollabsFeed } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabsFeed";
import { DiagnosticoIdeaDetailSheet } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoIdeaDetailSheet";
import { DiagnosticoCollabMatchOverlay } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabMatchOverlay";
import type { CollabStackDecision } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabStack";
// Tab bar REAL (não uma cópia) — o preview precisa da mesma estrutura de
// container do shell de produção pra denunciar overlap de verdade, não só
// "parecer" a tela real.
import { DiagnosticoTabBar } from "@/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoTabBar";

function pauta(id: string, o: Partial<ContentIdeaListItem>): ContentIdeaListItem {
  return {
    id, title: "Pauta", angle: "", territory: "Paternidade", assets: [],
    hook: "Ontem meu filho perguntou uma coisa que me travou por uns segundos.",
    suggestedFormat: "Reel falado", tone: "reflexivo",
    whyItFits: "Você fala de trabalho e presença — esse é o nervo exposto.",
    scriptPoints: ["Abre com a pergunta do filho", "Conta o que passou na cabeça", "Fecha com a decisão que tomou"],
    scriptClosing: "E você, já parou pra pensar no que o automático te custou?",
    resonanceNote: null, status: "active", generatedAt: "2026-07-01T00:00:00.000Z", scheduledFor: null,
    ...o,
  };
}

function match(name: string, o: Partial<NarrativeCollabMatch> = {}): NarrativeCollabMatch {
  return {
    id: `c-${name}`, name, username: name.toLowerCase().replace(/\s/g, ""), avatarUrl: null,
    mediaKitSlug: `${name.toLowerCase()}-slug`, narrativeExample: "Como saí do vermelho — resumo",
    suggestedNarrativeLabel: "Dinheiro sem culpa",
    narrativeFitReason: "fala de dinheiro sem culpa — cruza com o seu território de paternidade",
    collabRecordingIdea: "Vocês trocam de casa por um dia e narram a rotina financeira um do outro.",
    sharedSignal: "Paternidade", distinctSignals: ["Finanças"], narrativeMatch: true, ...o,
  };
}

const PAUTAS: ContentIdeaListItem[] = [
  pauta("p1", { title: "O dia que meu filho perguntou se eu precisava trabalhar" }),
  pauta("p2", { title: "Aprendi a proteger o jantar como reunião importante", territory: "Rotina" }),
  pauta("p3", { title: "Por que parei de responder e-mail depois das 18h", territory: "Trabalho" }),
  pauta("p4", { title: "Os livros que li pra sair do automático", territory: "Leitura" }),
  pauta("p5", { title: "Trabalhei 10 anos no automático. O que eu perdi?", territory: "Reflexão" }),
  pauta("p6", { title: "Já combinada — vídeo com o Théo sobre rotina", territory: "Rotina" }),
];

const MATCHES = new Map<string, NarrativeCollabMatch | null>([
  ["p1", match("Marina Braga", {
    collabMode: "remoto",
    narrativeFitReason: "Cruza a visão financeira familiar dela com seu pilar de paternidade ativa.",
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

const AVATAR = "https://placehold.co/160x160/e4e4e7/71717a?text=%20";

const DIRECTORY: DiagnosticoCreatorDirectoryState = {
  status: "ready",
  creators: [
    { id: "c-marina", name: "Marina Braga", username: "marinabraga", avatarUrl: AVATAR, hasAvatarImage: true, followers: 42000, totalInteractions: 0, postCount: 0, avgInteractionsPerPost: 0, avgReachPerPost: 0, rank: 1 },
    { id: "c-theo", name: "Théo Pires", username: "theopires", avatarUrl: AVATAR, hasAvatarImage: true, followers: 38000, totalInteractions: 0, postCount: 0, avgInteractionsPerPost: 0, avgReachPerPost: 0, rank: 2 },
    { id: "c-joao", name: "João Reis", username: "joaoreis", avatarUrl: AVATAR, hasAvatarImage: true, followers: 31000, totalInteractions: 0, postCount: 0, avgInteractionsPerPost: 0, avgReachPerPost: 0, rank: 3 },
    { id: "c-livia", name: "Lívia Linhares", username: "livialinhares", avatarUrl: AVATAR, hasAvatarImage: true, followers: 29000, totalInteractions: 0, postCount: 0, avgInteractionsPerPost: 0, avgReachPerPost: 0, rank: 4 },
  ],
};

export function DevCollabsPreviewClient() {
  const [decisions, setDecisions] = useState<Map<string, CollabStackDecision>>(new Map());
  // p6 começa salva e combinada — mostra a estante com selo desde o load.
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(["p6"]));
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
  const [openIdeaId, setOpenIdeaId] = useState<string | null>(null);
  const [openMatch, setOpenMatch] = useState<{ pautaId: string; variant: "celebration" | "revisit" } | null>(null);

  // Simula "match ao voltar": p6 casou com o app fechado (isNew) — a festa
  // dispara na montagem, como faria a hidratação real do shell. (Sem ref guard:
  // em StrictMode o ref persistiria entre os double-invokes e barraria o timer.)
  useEffect(() => {
    const t = setTimeout(() => setOpenMatch({ pautaId: "p6", variant: "celebration" }), 500);
    return () => clearTimeout(t);
  }, []);

  // Status "saved" derivado — o deck manda pauta pra estante ao salvar.
  const pautasWithStatus = useMemo(
    () => PAUTAS.map((p) => (savedIds.has(p.id) ? { ...p, status: "saved" as const } : p)),
    [savedIds],
  );
  const pautaById = useMemo(() => new Map(pautasWithStatus.map((p) => [p.id, p])), [pautasWithStatus]);

  const toggleSave = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const decide = (pautaId: string, decision: CollabStackDecision) => {
    setDecisions((prev) => new Map(prev).set(pautaId, decision));
    // Simula o match mútuo: "quero fazer" na p1 dispara a comemoração — no real
    // isso vem da resposta do POST /collabs/interest (matched=true).
    if (decision === "interested" && pautaId === "p1") {
      const collab = MATCHES.get("p1")!;
      setConfirmed((prev) => [...prev, { pautaId, collab }]);
      setTimeout(() => setOpenMatch({ pautaId, variant: "celebration" }), 260);
    }
  };

  const openIdea = openIdeaId ? pautaById.get(openIdeaId) ?? null : null;
  const openIdeaCollab = openIdeaId ? MATCHES.get(openIdeaId) ?? null : null;
  const openIdeaDecision = openIdeaId ? decisions.get(openIdeaId) : undefined;
  const openIdeaMatched = confirmed.some((m) => m.pautaId === openIdeaId);

  const matchEntry = openMatch ? confirmed.find((m) => m.pautaId === openMatch.pautaId) ?? null : null;
  const matchPauta = matchEntry ? pautaById.get(matchEntry.pautaId) ?? null : null;

  return (
    // Mesmo container do shell real: fixed inset-0 flex-col, área rolável com
    // padding-bottom reservado pra tab bar (fixed, por cima), tab bar como
    // último irmão. Sem isso, o preview não denuncia overlap real — só "parece"
    // a tela, sem ser a mesma estrutura de espaço.
    <div
      className="fixed inset-0 flex flex-col overflow-hidden"
      style={{ maxWidth: 420, margin: "0 auto", background: "linear-gradient(180deg, #fff8f5 0%, #ffffff 18%)" }}
    >
      <div
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 5.5rem)" }}
      >
        <DiagnosticoCollabsFeed
          pautas={pautasWithStatus}
          creatorDirectory={DIRECTORY}
          isPro
          whatsappLinked
          isGeneratingIdeas={false}
          pautaCollabs={MATCHES}
          collabDecisions={decisions}
          onCollabDecision={decide}
          confirmedMatches={confirmed}
          onOpenMatch={(pautaId) => setOpenMatch({ pautaId, variant: "revisit" })}
          onOpenIdea={setOpenIdeaId}
          onToggleSave={toggleSave}
          onOpenCommunity={() => alert("abriria Comunidade")}
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
          onDecide={(d) => { decide(openIdeaId!, d); setOpenIdeaId(null); }}
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
