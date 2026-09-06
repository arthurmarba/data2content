# MM81 — Mock Reading Loop + Retrieval + Preview Wiring

Status: concluído.

Este PR fecha o primeiro ciclo mock seguro de leitura documentada por vídeo:

análise mock estruturada → save orchestrator MM76 → `CreatorVideoNarrativeDiagnosis` salvo → retrieval seguro → selector server-side → adapter MM80 → preview interno em `Perfil | Leituras | Oportunidades`.

## O que foi criado

- `creatorVideoNarrativeDiagnosisReadService.ts`
  - lista leituras por `userId`;
  - busca leitura por `userId + diagnosisId`;
  - limita leituras recentes;
  - projeta apenas campos seguros para UI;
  - não retorna metadados de arquivo, links, chaves, resposta bruta de modelo ou transcrição longa.

- `narrativeMapMobileViewModelServerSelector.ts`
  - recebe leituras já consultadas ou consulta pelo read service injetável;
  - escolhe a leitura atual por `diagnosisId` ou usa a mais recente;
  - monta `CreatorNarrativeMapReadingPresentation` via MM77;
  - monta `NarrativeMapMobileViewModel` via MM80;
  - retorna empty state quando não há leitura.

- `creatorVideoNarrativeDiagnosisMockSaveIntegration.ts`
  - conecta o fluxo mock interno ao save orchestrator MM76;
  - roda apenas quando o endpoint interno recebe `persistReading: true`;
  - devolve summary seguro quando o save falha.

- Preview interno
  - a rota interna continua sendo `/dashboard/boards/mobile-strategic-profile-preview`;
  - o preview passa a renderizar `Perfil | Leituras | Oportunidades` a partir do view model;
  - a aba `Leituras` mostra leitura atual, leituras recentes, `rememberedAs`, `contributionLabel`, `profileImpactPreview`, `dateLabel` e CTA `Ver leitura`;
  - `Ver leitura` abre um detalhe seguro, sem mídia persistida.

## Guardrails mantidos

- Não pluga endpoint real.
- Não chama Gemini real.
- Não chama SDK de storage.
- Não salva vídeo, thumbnail, signed URL, upload URL, object key ou path local.
- Não atualiza `CreatorStrategicProfileSnapshot`.
- Não cria agregador do Perfil.
- Não altera UI real fora do preview interno.
- Não altera MediaKitView, Comunidade, billing/Stripe, NextAuth, DashboardShell, BoardShell ou sidebar.
- Não promete match real, marca real, creator real ou publi garantida.

## UX validada

A aba `Leituras` comunica:

> Cada vídeo enviado vira uma leitura. O Perfil junta essas leituras para separar padrão, hipótese, desvio criativo e oportunidade.

Os itens usam linguagem humana, por exemplo:

- Hoje
- Narrativa reforçada
- Vídeo sobre reunião que era para ser rápida
- Esse vídeo reforça um sinal de humor cotidiano com identificação rápida.
- Ver leitura

A aba `Oportunidades` continua limitada a:

- Territórios em formação
- Fit narrativo possível
- Tipo de collab possível
- Ponte para Mídia Kit

## Próximo passo

O próximo PR stacked sugerido é `Profile Synthesis V1 dry-run`: consumir leituras seguras já persistidas para gerar uma síntese seca do Perfil, sem atualizar `CreatorStrategicProfileSnapshot` e sem publicar efeito em UI real.
