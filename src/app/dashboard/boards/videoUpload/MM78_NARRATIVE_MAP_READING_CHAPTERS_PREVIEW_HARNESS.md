# MM78 — Narrative Map Reading Chapters Preview Harness

Este milestone cria apenas um preview interno para validar a experiencia editorial criada no MM77.

## Decisao

A experiencia testada e:

- card curto na tela principal;
- leitura profunda sob demanda;
- diagnostico completo em painel interno;
- variacoes de primeira leitura, Instagram conectado e oportunidades em formacao.

O preview usa fixtures e o builder puro do MM77. Ele nao chama endpoint, nao salva documentos e nao altera a UI real do Perfil Estrategico.

## O que foi criado

- `NarrativeMapReadingPreview`
- `NarrativeMapReadingChapterCard`
- `NarrativeMapReadingChapterModal`
- `NarrativeMapReadingFullDiagnosisModal`
- `buildNarrativeMapReadingPreviewFixture`

O harness pode ser acessado pela rota interna ja protegida do preview mobile usando estados `narrative_map_*`.

## O que a UX valida

- A tela principal mostra o espelho.
- O modal mostra a leitura.
- Cards fechados entregam valor sozinhos.
- Evidencias aparecem como lista curta.
- A acao do capitulo fica clara.
- O diagnostico completo existe, mas nao compete com a acao principal de nova leitura.

## Guardrails

Este PR nao:

- pluga endpoint real;
- pluga endpoint mock;
- salva documento;
- chama Gemini;
- chama storage;
- altera upload ou cleanup;
- altera `CreatorStrategicProfileSnapshot`;
- cria agregador do Perfil;
- altera `MobileStrategicProfilePreview`;
- altera `MediaKitView`, Comunidade, billing, Stripe, NextAuth, shells, sidebar ou navegacao real.

Instagram aparece apenas como camada de precisao. Oportunidades seguem como territorios e fit narrativo em formacao, sem match real ou promessa comercial.

## Caminho futuro

Um PR posterior pode transformar este harness em componentes de UI reais quando existir decisao de produto sobre a estrutura final:

- Perfil;
- Leituras;
- Oportunidades;
- bottom sheet de capitulo;
- leitura completa.
