# MM86 — Diagnostic Writer Evidence Anchors

Status: concluído.

## Objetivo

Reduzir diagnóstico genérico na leitura documentada por vídeo. A D2C deve ler o vídeo, não apenas classificá-lo: falas curtas, cenas, intenção declarada e sinais de Perfil precisam sustentar os capítulos do mapa narrativo.

## Conceito

`evidenceAnchors` é um campo seguro de `CreatorVideoNarrativeDiagnosis`. Ele guarda apenas evidências curtas e sanitizadas:

- `speechQuotes`: falas curtas ou sugestões de fala.
- `sceneAnchors`: cenas/momentos descritos de forma curta.
- `creatorIntentAnchor`: intenção declarada e interpretação.
- `profilePatternAnchors`: relação com sinais acumulados do Perfil.
- `instagramAnchors`: sinais de precisão quando Instagram existir.

Quote real e sugestão da IA são coisas diferentes:

- `creator_spoken`: pode ser lido como “quando você diz...”.
- `ai_suggested`: deve aparecer como “teste uma frase como...” ou “sugestão de fala”.

O fallback conservador do mapper usa `suggestedHook`/`scriptDirection.opening` como `ai_suggested`, `rememberedAs` como `derived_scene`, `creatorGoal` como `creator_goal` e `profileContribution.reason` como anchor de Perfil. Ele não inventa fala real.

## Fórmula editorial

Os capítulos principais seguem:

1. Espelho: “Você parece...”
2. Âncora: “Isso aparece quando você diz/faz/mostra...”
3. Leitura: “O que isso revela é...”
4. Movimento: “Por isso, teste...”

Quando não há anchor suficiente, o capítulo assume a limitação em vez de preencher com frase genérica.

## Guardrails

Não salvamos:

- transcrição longa;
- raw transcript;
- raw Gemini response;
- vídeo;
- thumbnail;
- signed URL;
- upload URL;
- objectKey;
- localPath;
- storageProviderPath;
- metadados de storage.

O sanitizer remove URLs, signed URLs, paths de storage, tokens/headers e limita arrays. Quotes são limitadas a 180 caracteres e anchors a listas curtas.

## QA anti-genérico

`creatorVideoNarrativeDiagnosticSpecificityQa.ts` adiciona helpers internos:

- `hasSpecificEvidenceAnchor(text, anchors)`
- `isProbablyGenericDiagnosticText(text, anchors)`

Eles não criam score de UI. O objetivo é testar que frases amplas como “Seu conteúdo gera conexão” só passam quando acompanhadas de evidência específica.

## UI

A modal de diagnóstico completo pode mostrar “Onde a D2C percebeu isso” com itens curtos:

- `Fala: "..."`
- `Sugestão de fala: "..."`
- `Cena: ...`
- `Intenção: ...`

Ela não mostra transcript, player, thumbnail persistida ou timestamp técnico.

## Próximo passo

Este PR prepara a qualidade textual antes de expandir endpoint real. O próximo PR pode fazer o provider preencher anchors estruturados quando houver leitura multimodal mais rica, mantendo os mesmos guardrails.
