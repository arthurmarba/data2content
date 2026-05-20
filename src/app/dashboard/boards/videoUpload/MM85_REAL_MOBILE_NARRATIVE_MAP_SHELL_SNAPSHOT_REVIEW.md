# MM85 — Real Mobile Narrative Map Shell + Snapshot Review Panel

Status: concluido.

## Objetivo

Este PR leva a experiencia mobile real do Perfil Estrategico para a organizacao:

- Perfil;
- Leituras;
- Oportunidades.

A experiencia passa a usar `NarrativeMapMobileViewModel`, leituras recentes seguras e sintese acumulada do Perfil.

## Produto

O Perfil Estrategico nao e o ultimo video.

O Perfil Estrategico e uma sintese viva das leituras documentadas.

Fluxo visual:

- Perfil: mapa narrativo acumulado;
- Leituras: evidencias por video;
- Oportunidades: territorios de marca, tipos de collab e ponte para Midia Kit.

## O que foi criado

- `NarrativeMapMobileShell.tsx`
  - shell mobile compartilhado para a experiencia `Perfil | Leituras | Oportunidades`;
  - renderiza hero, metricas, capitulos, leituras recentes, oportunidades e safety note;
  - abre detalhe seguro de leitura e diagnostico completo sob demanda.

- `NarrativeMapSnapshotReviewPanel.tsx`
  - painel interno discreto para auditoria do write controlado do snapshot;
  - renderiza apenas `attempted`, `written`, `skippedReason`, `synthesisStatus`, `analyzedReadingsCount`, `updatedAt` e `snapshotId`.

- Pagina real `/dashboard/boards/mobile-strategic-profile`
  - monta server-side o `NarrativeMapMobileViewModel` com `buildNarrativeMapMobileViewModelFromReadings`;
  - passa o view model para o shell client;
  - preserva fallback antigo quando o mapa narrativo nao pode ser montado.

## Snapshot review

O painel de review e opt-in via prop interna.

Ele nao mostra:

- snapshot completo;
- payload do mapper;
- leituras completas;
- videoMetadata;
- raw response;
- storage metadata;
- stack trace.

## Guardrails

- Endpoint real publico continua intocado.
- Gemini/storage continuam intocados.
- Upload/cleanup continuam intocados.
- Nao ha matches reais.
- Nao ha thumbnail persistida.
- Nao ha galeria, player, filename bruto ou metadata de storage.
- `CreatorStrategicProfileSnapshot` nao e importado em client component.
- MediaKitView, Comunidade, billing/Stripe, NextAuth, DashboardShell, BoardShell e sidebar continuam fora do escopo.

## Proximo passo

O proximo PR pode integrar uma acao interna de review para comparar snapshot atual, sintese dry-run e write audit antes de qualquer rollout real/gated.
