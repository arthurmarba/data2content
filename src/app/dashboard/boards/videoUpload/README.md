# Video Upload Foundation

Este diretório guarda a fundação pura do épico VU. A intenção é preparar, em fases pequenas, uma forma futura de receber vídeo como fonte narrativa sem tratar vídeo como produto separado.

Nesta fase, vídeo é apenas uma possível origem futura para preencher uma `NarrativeSource`.

## VU1 — Contratos puros e validação

Status: concluído nesta branch.

Arquivos principais:

- `videoUploadTypes.ts`: tipos, limites padrão, validação pura e bridge conceitual para fonte narrativa.
- `videoUploadTypes.test.ts`: cobertura dos tipos utilitários, validações, bridge e isolamento de escopo.

O que existe:

- status de processamento futuro;
- fontes possíveis de vídeo;
- MIME types aceitos;
- limites padrão de duração e tamanho;
- códigos e mensagens de validação;
- criação de draft vazio;
- validação determinística de draft;
- bridge compatível com a ideia de `video_upload_future`.

O que não existe:

- upload real;
- endpoint;
- storage;
- transcrição;
- extração de frames;
- análise multimodal;
- OpenAI;
- banco;
- UI;
- BoardShell;
- integração com o fluxo real.

## Limites padrão

- Duração máxima: 60 segundos.
- Tamanho máximo: 100 MB.
- Formatos aceitos: `video/mp4`, `video/quicktime`, `video/webm`.
- Pergunta do criador obrigatória.

## Validação

`validateVideoUploadDraft` normaliza `fileName`, `mimeType` e `creatorQuestion`, preserva tamanho e duração, e retorna erros exibíveis de forma simples.

Validações atuais:

- arquivo obrigatório;
- formato suportado;
- limite de tamanho;
- duração informada;
- limite de duração;
- pergunta do criador quando exigida;
- nome de arquivo sem caracteres simples de risco.

## Bridge narrativa

`buildNarrativeSourceBridgeFromVideoUpload` só retorna dados quando o draft passa pela validação.

O retorno usa:

- `sourceType: "video_upload_future"`;
- `creatorQuestion` normalizada;
- `transcript: null`;
- `visualDescription: null`;
- metadados básicos do vídeo.

O arquivo não importa tipos da NSE nesta fase para manter o acoplamento baixo. A compatibilidade é conceitual e deve ser formalizada em uma fase posterior.

## VU2 — Bridge tipada com NarrativeSource

Status: concluído nesta branch.

Arquivos principais:

- `videoUploadNarrativeSourceBridge.ts`: converte um `VideoUploadDraft` validado em `NarrativeSource`.
- `videoUploadNarrativeSourceBridge.test.ts`: cobre conversão, `id`, `createdAt`, formato curto/longo, helper de prontidão e isolamento de escopo.

O que existe:

- `buildNarrativeSourceFromVideoUploadDraft`;
- `isVideoUploadReadyForNarrativeSource`;
- import tipado de `NarrativeSource`;
- uso de `validateVideoUploadDraft` como fonte da verdade;
- conversão para `sourceType: "video_upload_future"`;
- metadados básicos de vídeo preservados.

O que continua fora do escopo:

- upload real;
- endpoint;
- storage;
- transcrição;
- frames;
- OpenAI;
- banco;
- UI;
- BoardShell;
- navegação real.

Esta fase prova apenas que um vídeo já validado pode ser representado como uma fonte narrativa futura. A bridge não infere transcrição, não descreve visualmente o vídeo e não salva nada.

## VU3 — QA do pipeline VideoUpload → NSE → Adaptive V2

Status: concluído nesta branch.

Arquivo principal:

- `videoUploadPipeline.test.ts`: teste ponta a ponta, apenas em ambiente de QA, cobrindo `VideoUploadDraft` validado até o plano estratégico Adaptive V2.

Pipeline validado:

```text
VideoUploadDraft
↓
validateVideoUploadDraft
↓
buildNarrativeSourceFromVideoUploadDraft
↓
detectNarrativeSourceIntent
↓
extractNarrativeAssets
↓
buildAdaptiveInputFromNarrativeSource
↓
Adaptive V2 Router
↓
QuizBuilder
↓
AnswerKey
↓
PlanBuilder
```

O teste cobre:

- vídeo válido para validar antes de postar;
- vídeo válido para potencial de marca;
- vídeo válido para melhorar gancho;
- vídeo válido para collab;
- draft inválido sem rodar NSE/Adaptive;
- vídeo longo com limites customizados;
- linguagem segura nos outputs gerados;
- isolamento de imports.

Esta fase não cria lógica nova de produção. O pipeline existe apenas como teste de integridade.

## VU4 — Contratos de artefatos de processamento

Status: concluído nesta branch.

Arquivos principais:

- `videoProcessingArtifacts.ts`: tipos e helpers puros para representar artefatos futuros de processamento de vídeo.
- `videoProcessingArtifacts.test.ts`: cobertura dos defaults, transcrição, descrição visual, OCR, sinais úteis e isolamento de escopo.

Artefatos representados:

- status de processamento;
- transcrição completa e por segmentos;
- frames-chave;
- OCR/texto na tela;
- sinais técnicos;
- resumo visual;
- notas de processamento.

Helpers criados:

- `createEmptyVideoProcessingArtifacts`;
- `mergeTranscriptSegments`;
- `buildTranscriptTextFromArtifacts`;
- `buildVisualDescriptionFromArtifacts`;
- `hasUsableVideoProcessingArtifacts`.

Esta fase não processa vídeo real. Ela apenas prepara a forma dos dados que, no futuro, poderão enriquecer uma `NarrativeSource` com transcrição, contexto visual e sinais técnicos.

## QA

Comandos recomendados para esta fundação:

```bash
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoProcessingArtifacts.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadNarrativeSourceBridge.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadPipeline.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadTypes.test.ts
npm run typecheck
git diff --check
```

## Próximas fases sugeridas

- VU5: adapter puro de artefatos para enriquecer `NarrativeSource`.
- VU6: fixture/harness interno com artefatos simulados.
- VU7: contrato de storage temporário, ainda sem implementação real.
- VU8: documentação de rollout antes de qualquer upload real.
