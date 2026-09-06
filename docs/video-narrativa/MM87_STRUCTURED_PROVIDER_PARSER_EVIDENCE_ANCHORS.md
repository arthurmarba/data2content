# MM87 — Structured Provider Parser Evidence Anchors

Status: concluído.

## Objetivo

O MM86 criou o contrato seguro de `evidenceAnchors`. O MM87 ensina o prompt, schema e parser do provider multimodal a produzir anchors reais quando houver evidência concreta no vídeo.

O objetivo é reduzir diagnóstico genérico: o texto final deve poder apontar falas curtas, cenas, viradas e intenção, sem depender de transcrição bruta ou metadados de storage.

## O que mudou

- O prompt do provider real pede `evidenceAnchors` estruturados.
- O schema de resposta aceita `speechQuotes`, `sceneAnchors` e `creatorIntentAnchor`.
- O parser valida anchors, limita arrays e remove conteúdo inseguro.
- Anchors inválidos são descartados sem quebrar a análise inteira.
- O mapper preserva anchors reais antes de usar fallback conservador.
- `creator_spoken` só é preservado quando vem do parser como fala observada.
- `ai_suggested` continua reservado para sugestões geradas pela D2C.

## Fala real vs sugestão

`creator_spoken` significa fala curta que o modelo observou com segurança no vídeo. O provider não deve inventar frases nem transformar sugestão editorial em fala real.

Quando não houver segurança suficiente, `speechQuotes` deve vir vazio. Sugestões de fala seguem no fallback do mapper como `ai_suggested`.

## Cenas e intenção

`sceneAnchors` descrevem momentos observados, por exemplo abertura, conflito, virada narrativa, sinal visual, ritmo ou produção. Eles não usam timestamp técnico e não mencionam arquivo, URL, upload ou storage.

`creatorIntentAnchor` diferencia:

- `statedGoal`: objetivo informado pelo creator/fluxo;
- `interpretedGoal`: leitura estratégica do modelo;
- `whyItMatters`: por que essa diferença muda a leitura.

## Guardrails

Não salvamos:

- transcrição bruta;
- raw Gemini response;
- raw model response;
- vídeo;
- thumbnail;
- signed URL;
- upload URL;
- objectKey;
- localPath;
- storageProviderPath;
- arquivo local.

O parser remove URLs, signed URLs, paths de storage, tokens, base64 grande e blobs parecidos com transcript. Anchors são limitados a 4 falas e 4 cenas.

## Compatibilidade

`evidenceAnchors` é opcional. Respostas antigas continuam válidas, e o mapper mantém fallback conservador quando não há anchors reais.

## Próximo passo

Um próximo PR pode ligar a exibição de anchors reais no fluxo allowlist/admin-dev de ponta a ponta, medindo qualidade textual sem abrir endpoint real para usuários comuns.
