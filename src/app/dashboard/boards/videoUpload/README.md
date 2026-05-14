# Video Upload Foundation

Este diretório guarda a fundação pura do épico VU. A intenção é preparar, em fases pequenas, uma entrada futura de vídeo como fonte narrativa, sem tratar vídeo como produto separado.

O vídeo ainda não é enviado de verdade e ainda não é processado de verdade. A fundação existe para manter essa futura experiência conectada à promessa da D2C: transformar fontes criativas em narrativa, estratégia e sinais úteis para entender o perfil do criador.

Hoje, vídeo é apenas uma possível origem futura para preencher uma `NarrativeSource`.

## Visão Geral

O Video Upload Foundation prepara os contratos e testes para uma experiência futura em que o criador poderá enviar um vídeo e descobrir qual narrativa ele comunica.

O que esta fundação permite validar agora:

- um draft de vídeo pode ser representado e validado de forma determinística;
- um draft válido pode virar uma `NarrativeSource` do tipo `video_upload_future`;
- artefatos simulados de processamento podem enriquecer `transcript` e `visualDescription`;
- a fonte enriquecida pode alimentar o Narrative Source Engine;
- a NSE pode alimentar o Adaptive V2;
- o Adaptive V2 pode gerar um plano estratégico em ambiente de teste.

O que ela não faz:

- não recebe arquivo real;
- não processa arquivo real;
- não salva vídeo;
- não extrai transcrição, frames ou OCR reais;
- não chama OpenAI;
- não conecta nada ao produto real.

## Mapa Das Fases

### VU1 — Contratos puros e validação

Status: concluído.

Arquivos principais:

- `videoUploadTypes.ts`
- `videoUploadTypes.test.ts`

O que faz:

- define status futuros de upload/processamento;
- define origens possíveis de vídeo;
- define MIME types aceitos;
- define limites padrão;
- cria `VideoUploadDraft`;
- valida draft de vídeo de forma pura;
- cria uma bridge conceitual para `video_upload_future`.

O que não faz:

- não importa tipos da NSE;
- não cria upload real;
- não cria endpoint;
- não cria storage;
- não cria UI.

### VU2 — Bridge tipada com NarrativeSource

Status: concluído.

Arquivos principais:

- `videoUploadNarrativeSourceBridge.ts`
- `videoUploadNarrativeSourceBridge.test.ts`

O que faz:

- converte `VideoUploadDraft` validado em `NarrativeSource`;
- usa `validateVideoUploadDraft` como fonte da verdade;
- preserva `id`, `createdAt`, `creatorQuestion` e metadados básicos;
- define `sourceType: "video_upload_future"`;
- mantém `rawText`, `transcript` e `visualDescription` vazios.

O que não faz:

- não infere transcrição;
- não descreve visualmente o vídeo;
- não salva nada;
- não roda NSE;
- não roda Adaptive V2.

### VU3 — QA do pipeline VideoUpload → NSE → Adaptive V2

Status: concluído.

Arquivo principal:

- `videoUploadPipeline.test.ts`

O que faz:

- valida, apenas em teste, o caminho `VideoUploadDraft` → `NarrativeSource` → NSE → Adaptive V2;
- cobre vídeos válidos para validação, marca, melhoria de gancho, collab e vídeo longo com limites customizados;
- garante abort seguro para draft inválido;
- verifica linguagem segura e isolamento de imports.

O que não faz:

- não cria lógica nova de produção;
- não processa vídeo real;
- não cria rota, endpoint ou UI.

### VU4 — Contratos de artefatos de processamento

Status: concluído.

Arquivos principais:

- `videoProcessingArtifacts.ts`
- `videoProcessingArtifacts.test.ts`

O que faz:

- define contratos para transcrição, segmentos, frames-chave, OCR, sinais técnicos, resumo visual e notas de processamento;
- cria helpers puros para montar texto de transcrição e descrição visual a partir de artefatos;
- identifica se há contexto utilizável.

O que não faz:

- não usa ffmpeg;
- não usa OpenAI;
- não transcreve;
- não extrai frames;
- não executa OCR;
- não salva artefatos.

### VU5 — Adapter de artefatos para NarrativeSource

Status: concluído.

Arquivos principais:

- `videoUploadProcessedNarrativeSource.ts`
- `videoUploadProcessedNarrativeSource.test.ts`

O que faz:

- combina `VideoUploadDraft` validado com `VideoProcessingArtifacts` simulados;
- usa `buildNarrativeSourceFromVideoUploadDraft` como base;
- preenche `transcript` via `buildTranscriptTextFromArtifacts`;
- preenche `visualDescription` via `buildVisualDescriptionFromArtifacts`;
- preserva metadata, `id`, `createdAt` e `creatorQuestion`;
- cria helper para saber se há contexto suficiente para análise narrativa.

O que não faz:

- não roda NSE;
- não roda Adaptive V2;
- não processa vídeo real;
- não salva nada.

### VU6 — QA do pipeline com artefatos simulados

Status: concluído.

Arquivo principal:

- `videoUploadProcessedPipeline.test.ts`

O que faz:

- valida, apenas em teste, o pipeline com `VideoUploadDraft + VideoProcessingArtifacts`;
- cobre transcript de rotina/skincare, visual summary de bastidor, frames + OCR para marca, artifacts vazios e draft inválido;
- demonstra `hasEnoughProcessedContextForNarrativeAnalysis`;
- garante linguagem segura e isolamento de imports.

O que não faz:

- não cria lógica nova de produção;
- não cria upload real;
- não cria endpoint;
- não cria storage;
- não cria UI.

### VU8 — Harness interno com artifacts simulados

Status: concluído.

Arquivos principais:

- `../video-upload-preview/page.tsx`
- `../video-upload-preview/page.test.tsx`
- `../components/videoUpload/buildVideoUploadPreviewScenario.ts`
- `videoUploadPreviewFeatureFlag.ts`
- `videoUploadPreviewFeatureFlag.test.ts`

O que faz:

- cria uma rota interna em `/dashboard/boards/video-upload-preview`;
- protege a rota com `NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED=1`;
- renderiza cenários fixos de `VideoUploadDraft + VideoProcessingArtifacts`;
- mostra validação, readiness, artifacts simulados, `NarrativeSource` enriquecida, intenção NSE, entrada Adaptive V2 e plano estratégico;
- aborta NSE/Adaptive quando o draft controlado não passa pela validação;
- mantém QA de linguagem segura e isolamento de imports.

O que não faz:

- não cria upload real;
- não cria file picker;
- não aceita input livre;
- não cria endpoint;
- não cria storage;
- não usa ffmpeg;
- não usa OpenAI;
- não conecta no BoardShell;
- não adiciona link em navegação ou menu.

### VU9 — Checklist manual do Video Upload Preview

Status: concluído.

Arquivo principal:

- `VIDEO_UPLOAD_PREVIEW_QA.md`

O que faz:

- documenta a QA manual da rota `/dashboard/boards/video-upload-preview`;
- lista URLs de todos os cenários controlados;
- define checklist geral, mobile, por cenário, linguagem proibida e segurança de produto;
- cria tabela de achados para revisão visual antes de qualquer avanço para storage ou upload real.

O que não faz:

- não altera lógica;
- não altera testes;
- não cria UI nova;
- não conecta no produto real.

## Arquitetura Atual

```text
VideoUploadDraft
↓
validateVideoUploadDraft
↓
buildNarrativeSourceFromVideoUploadDraft
↓
VideoProcessingArtifacts simulados
↓
buildProcessedNarrativeSourceFromVideoUpload
↓
NSE
↓
Adaptive V2
↓
Strategic Plan
```

Na prática, existem dois níveis de prova:

- `VideoUploadDraft` validado já pode virar uma `NarrativeSource` básica.
- `VideoUploadDraft + VideoProcessingArtifacts` simulados já pode virar uma `NarrativeSource` enriquecida com `transcript` e `visualDescription`.

## O Que Existe Hoje

- Validação pura de draft de vídeo.
- Limites padrão de duração, tamanho e pergunta obrigatória.
- MIME types aceitos: `video/mp4`, `video/quicktime`, `video/webm`.
- Bridge tipada para `NarrativeSource`.
- Contratos de artefatos de processamento.
- Helpers para transcrição e descrição visual a partir de artefatos.
- Adapter para `NarrativeSource` enriquecida.
- QA de pipeline completo com artifacts simulados.
- Harness interno com cenários simulados atrás de feature flag.
- Checklist manual do preview interno.
- Testes de linguagem segura e isolamento de escopo.

## O Que Ainda Não Existe

- Upload real.
- Endpoint.
- Storage.
- Transcrição automática.
- Extração real de frames.
- OCR real.
- Análise multimodal.
- OpenAI.
- ffmpeg.
- Banco ou persistência.
- UI.
- BoardShell.
- Navegação ou menu.
- Liberação para usuário.

## Conexão Com A NSE E A Promessa Da D2C

O vídeo é uma fonte narrativa. Ele pode carregar falas, contexto visual, ritmo, cenas, texto na tela e intenção do criador.

Nesta fundação, a transcrição e a `visualDescription` enriquecem a leitura sem transformar vídeo em produto isolado. A fonte enriquecida alimenta a NSE, a NSE transforma a fonte em intenção, assets narrativos e sinais de perfil, e o Adaptive V2 transforma essa leitura em plano estratégico.

Isso prepara a futura experiência: envie um vídeo e descubra qual narrativa ele comunica, como melhorar a pauta e que direção estratégica faz sentido.

## Critérios Antes De Upload Real

Antes de qualquer upload real, ainda é preciso decidir:

- provedor de storage temporário;
- política de retenção e exclusão do vídeo;
- limite final de tamanho e duração;
- extração de duração no client, no server ou em ambos;
- provedor de transcrição;
- estratégia de frames-chave;
- estratégia de OCR;
- estratégia de análise multimodal;
- custo estimado por análise;
- rate limit por plano;
- consentimento do usuário para usar análise no perfil narrativo;
- plano de rollback;
- feature flag para manter a experiência desligada em produção até aprovação.

## QA Recomendada

```bash
npm test -- --runInBand src/app/dashboard/boards/video-upload-preview/page.test.tsx
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadPreviewFeatureFlag.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoProcessingArtifacts.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadProcessedPipeline.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadProcessedNarrativeSource.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadNarrativeSourceBridge.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadPipeline.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadTypes.test.ts
npm run typecheck
git diff --check
```

## Próximas Fases Sugeridas

- VU10: contrato de storage temporário, ainda sem implementação real.
- VU11: contrato de providers de transcrição, frames e OCR.
- VU12: documentação de custos, limites e retenção.
- VU13: upload real em PR separado ou fase isolada, somente depois das decisões de produto, segurança e custo.
