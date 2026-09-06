# MM77 — Narrative Map Reading Chapters Contract

Este milestone cria o contrato editorial que transforma uma `CreatorVideoNarrativeDiagnosis` ja documentada em capitulos humanos para a experiencia futura de mapa narrativo.

## Decisao

A tela principal deve mostrar cards curtos. Cada card representa um capitulo da leitura e pode abrir, em milestone futura, um modal ou bottom sheet com a leitura completa.

A experiencia segue a formula:

- card = espelho rapido;
- modal = leitura profunda;
- diagnostico completo = capitulos organizados.

## O que foi criado

- `CreatorNarrativeMapReadingChapter`
- `CreatorNarrativeMapReadingPresentation`
- `buildCreatorNarrativeMapReadingPresentation`

O builder e puro, testavel e sem banco. Ele recebe uma leitura por video ja persistivel/documentada e devolve uma apresentacao editorial com:

- headline;
- subheadline;
- statusLabel;
- primaryAction;
- safetyNote;
- capitulos `pattern`, `tension`, `movement`, `territory`, `video_reveal`, `profile_impact` e `opportunities`.

## Regras editoriais

A camada traduz diagnostico documentado em leitura humana. A inspiracao e um espelho estrategico, nao um relatorio tecnico.

Os capitulos usam:

- espelho;
- evidencia;
- movimento.

Quando ainda nao ha dados suficientes, o builder gera capitulos honestos:

- ainda e cedo para cravar padrao;
- este video abre uma hipotese inicial;
- mais leituras ajudam a confirmar repeticao.

## Guardrails

Este PR nao cria endpoint, UI, agregador do Perfil ou matches reais.

O builder nao:

- chama Gemini;
- chama storage;
- persiste nada sozinho;
- atualiza `CreatorStrategicProfileSnapshot`;
- altera endpoint real ou endpoint mock;
- altera upload, cleanup, billing, Stripe, NextAuth, shells, sidebar, MediaKitView ou Comunidade.

Oportunidades seguem como territorios e fit narrativo em formacao, sem promessa de marca real ou parceria fechada.

## Caminho futuro

Em milestones posteriores, a UI mobile podera consumir este contrato para montar:

- `Perfil`;
- `Leituras`;
- `Oportunidades`;
- cards de leitura;
- modais ou bottom sheets de capitulo.

O Perfil geral continuara sendo atualizado apenas por sintese/agregador futuro, nunca diretamente por um unico video.
