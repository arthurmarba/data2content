# MM82 — Profile Synthesis V1 Dry-Run + Preview

Status: concluído.

Este PR cria a primeira síntese acumulada do Perfil Estratégico a partir de leituras documentadas por vídeo.

O fluxo validado é:

`CreatorVideoNarrativeDiagnosis[]` → síntese dry-run do Perfil → `NarrativeMapMobileViewModel` enriquecido → preview interno.

## O que foi criado

- `creatorStrategicProfileSynthesis.ts`
  - agregador puro e determinístico;
  - consome leituras seguras já documentadas;
  - gera status conservador: `empty`, `first_reading`, `signals_emerging`, `pattern_in_formation`, `profile_consistent`;
  - organiza narrativa principal, narrativas em teste, padrões, tensões, forças, territórios comerciais e próximo movimento;
  - protege contra uma leitura isolada virar narrativa principal de alta confiança.

- `creatorStrategicProfileSynthesisFixtures.ts`
  - fixtures para `no_readings`, `first_reading`, `two_related_readings`, `three_related_readings`, `isolated_strong_video`, `creative_deviation`, `commercial_signals` e `instagram_contextual`.

- Integração com `narrativeMapMobileViewModelServerSelector.ts`
  - o selector monta a síntese dry-run a partir das leituras recentes;
  - o view model passa a receber a síntese como entrada opcional;
  - a UI interna mostra o Perfil como síntese acumulada, não como a última leitura isolada.

- Preview interno
  - adiciona estados internos para validar empty, primeira leitura, sinais emergentes, padrão em formação, vídeo forte isolado, desvio criativo, sinais comerciais e Instagram contextual;
  - a aba Perfil reflete `Seu padrão`, `Sua tensão`, `Seu movimento` e `Seu território` derivados da síntese;
  - a aba Leituras continua listando leituras documentadas;
  - a aba Oportunidades usa territórios comerciais/tipos de collab possíveis da síntese.

## Guardrails mantidos

- Não atualiza `CreatorStrategicProfileSnapshot`.
- Não persiste snapshot geral.
- Não pluga endpoint real.
- Não chama Gemini real.
- Não chama storage/R2.
- Não altera UI real fora do preview interno.
- Não altera MediaKitView, Comunidade, billing/Stripe, NextAuth, DashboardShell, BoardShell ou sidebar.
- Não promete match real, marca real, creator real ou publi garantida.

## Regra crítica

Um vídeo isolado nunca vira narrativa principal definitiva.

- 0 leituras: empty state.
- 1 leitura: `first_reading`, linguagem de primeiro sinal.
- 2 leituras parecidas: `signals_emerging`, sinal em formação.
- 3+ leituras parecidas: `pattern_in_formation` ou `profile_consistent`, ainda com linguagem conservadora.

## Próximo passo

O próximo PR stacked poderá persistir a síntese no snapshot geral, com guardrails fortes para separar dry-run, revisão e atualização real de `CreatorStrategicProfileSnapshot`.
