# MM84 — Controlled Mock/Allowlist Synthesis Snapshot Write

Status: concluido.

## Objetivo

Este PR conecta o write path do MM83 a um fluxo mock/internal controlado.

Fluxo permitido:

`mock/internal analysis -> save CreatorVideoNarrativeDiagnosis -> list readings for user -> build CreatorStrategicProfileSynthesis -> persist synthesis snapshot with mode: "write" -> safe audit result`

## O que foi criado

- `creatorVideoNarrativeMockSynthesisSnapshotWriteOrchestrator.ts`
  - orquestra leitura salva, retrieval seguro, sintese acumulada e escrita do snapshot;
  - exige `enableSnapshotWrite: true`;
  - exige `source: "mock_internal"`;
  - valida que a leitura salva esta entre as leituras recentes do usuario;
  - chama `persistCreatorStrategicProfileSynthesis` com `mode: "write"`;
  - retorna somente auditoria segura.

- Integracao na rota interna `/api/internal/video-narrative/analyze`
  - `persistSynthesisSnapshot: true` so tem efeito quando `persistReading: true` tambem salva a leitura;
  - o comportamento existente permanece igual quando o parametro nao e enviado;
  - falha de sintese/escrita nao quebra a resposta principal mock.

## Retorno seguro

A rota pode retornar:

```json
{
  "synthesisSnapshotWrite": {
    "attempted": true,
    "written": true,
    "synthesisStatus": "signals_emerging",
    "analyzedReadingsCount": 2,
    "updatedAt": "2026-05-20T00:00:00.000Z"
  }
}
```

Nao retorna:

- snapshot completo;
- payload do mapper;
- leituras completas;
- metadados de video;
- referencias de midia;
- resposta bruta de modelo;
- stack trace.

## Guardrails

- Este PR ainda nao pluga endpoint real publico.
- Este PR ainda nao chama Gemini real.
- Este PR ainda nao chama storage/R2.
- Este PR ainda nao altera upload/cleanup.
- Este PR ainda nao altera UI real.
- Este PR ainda nao altera MediaKitView, Comunidade, billing/Stripe, NextAuth, DashboardShell, BoardShell ou sidebar.
- Este PR ainda nao cria matches reais.
- Usuarios comuns continuam bloqueados pela regra existente de acesso interno.

## Regra anti-overwrite

O snapshot e atualizado por sintese acumulada.

Uma leitura isolada pode registrar estado inicial/hipotese, mas nao pode virar padrao definitivo. Sintese vazia nao escreve snapshot. Padroes em formacao exigem recorrencia nas leituras documentadas.

## Proximo passo

O proximo PR pode decidir entre:

- expor uma UI interna para acionar o write controlado; ou
- integrar o fluxo real gated/allowlist, mantendo Gemini/storage e endpoint publico fora ate a decisao de produto.
