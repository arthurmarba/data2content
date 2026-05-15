# Video Upload Foundation

Este diretório guarda a fundação pura do épico VU. A intenção é preparar, em fases pequenas, uma entrada futura de vídeo como fonte narrativa, sem tratar vídeo como produto separado.

O vídeo ainda não é enviado de verdade e ainda não é processado de verdade. A fundação existe para manter essa futura experiência conectada à promessa da D2C: transformar fontes criativas em narrativa, estratégia e sinais úteis para entender o perfil do criador.

Hoje, vídeo é apenas uma possível origem futura para preencher uma `NarrativeSource`.

### MM1 — Arquitetura narrativa multimodal-first

Status: concluído.

Arquivo principal:

- `VIDEO_MULTIMODAL_NARRATIVE_ARCHITECTURE.md`

O que faz:

- redefine a direção de produto para uma experiência `multimodal-first`;
- posiciona `VideoNarrativeAnalysis` como saída principal da análise futura;
- trata transcrição, OCR, frames e sinais técnicos como evidências auxiliares;
- introduz `PostCreationVideoSeed` como ponte conceitual para o board de criação.

O que não faz:

- não altera contratos existentes;
- não cria provider real;
- não conecta nada ao fluxo real do produto.

### MM2 — Contratos de VideoNarrativeAnalysis

Status: concluído.

Arquivos principais:

- `videoNarrativeAnalysisTypes.ts`
- `videoNarrativeAnalysisTypes.test.ts`

O que faz:

- define o contrato puro de `VideoNarrativeAnalysis`;
- modela hook, cenas, classificação D2C, diagnóstico, blueprint, brand match, evidências e sinais futuros de perfil;
- cria helpers para reconhecer análise útil, direção principal, próximo passo sugerido e sanitização de texto.

O que não faz:

- não implementa provider real;
- não usa Gemini;
- não cria endpoint, UI ou persistência;
- não conecta o contrato ao board real.

### MM3 — Adapter para PostCreationVideoSeed

Status: concluído.

Arquivos principais:

- `videoNarrativePostCreationSeed.ts`
- `videoNarrativePostCreationSeed.test.ts`

O que faz:

- define `PostCreationVideoSeed` como ponte intermediária entre análise multimodal e board futuro;
- converte `VideoNarrativeAnalysis` em ideia inicial, narrativa detectada, diagnóstico, blueprint draft, direção de roteiro, hints de marca e perguntas de refinamento;
- mantém sanitização dos textos oriundos da análise.

O que não faz:

- não altera `PostCreationFunnelState`;
- não conecta no `BoardShell`;
- não cria provider, endpoint ou UI real.

### MM4 — Mock provider narrativo multimodal

Status: concluído.

Arquivos principais:

- `videoNarrativeMockProvider.ts`
- `videoNarrativeMockProvider.test.ts`

O que faz:

- simula leituras narrativas multimodais determinísticas;
- retorna `VideoNarrativeAnalysis` diretamente, sem usar artifacts técnicos como saída principal;
- cobre rotina de skincare, bastidor, potencial de marca, gancho fraco, collab, conteúdo pouco claro e adaptação para publi.

O que não faz:

- não usa provider real;
- não usa Gemini;
- não cria endpoint, UI ou integração com o board real.

### MM5 — QA do pipeline narrativo multimodal

Status: concluído.

Arquivo principal:

- `videoNarrativePipeline.test.ts`

O que faz:

- valida o fluxo `VideoNarrativeMockProvider` → `VideoNarrativeAnalysis` → `PostCreationVideoSeed`;
- prova que análises narrativas já geram blueprint, direção de abertura, hints de marca e perguntas de refinamento úteis;
- mantém a linha nova separada de `VideoProcessingArtifacts`, NSE e Adaptive V2.

O que não faz:

- não cria lógica nova de produção;
- não integra o seed ao board real;
- não usa provider externo.

### MM6 — Preview interno narrativo multimodal

Status: concluído.

Arquivos principais:

- `../video-narrative-preview/page.tsx`
- `../video-narrative-preview/page.test.tsx`
- `../components/videoUpload/buildVideoNarrativePreviewScenario.ts`
- `videoNarrativePreviewFeatureFlag.ts`
- `videoNarrativePreviewFeatureFlag.test.ts`

O que faz:

- cria a rota interna `/dashboard/boards/video-narrative-preview`;
- mostra cenários controlados de `VideoNarrativeAnalysis` → `PostCreationVideoSeed`;
- protege o harness com `NEXT_PUBLIC_VIDEO_NARRATIVE_PREVIEW_ENABLED=1` e sessão admin/dev.

O que não faz:

- não aceita input livre;
- não usa provider real;
- não conecta no board real nem em navegação.

### MM7 — Prompt e schema para análise narrativa multimodal

Status: concluído.

Arquivos principais:

- `geminiVideoNarrativePrompt.ts`
- `geminiVideoNarrativePrompt.test.ts`
- `geminiVideoNarrativeSchema.ts`
- `geminiVideoNarrativeSchema.test.ts`

O que faz:

- define o prompt textual base da futura análise narrativa multimodal;
- normaliza a resposta estruturada esperada para `VideoNarrativeAnalysis`;
- aplica sanitização e fallback seguro antes de qualquer integração real.

O que não faz:

- não chama provider externo;
- não usa SDK;
- não conecta no board real nem em navegação.

### MM8 — Provider multimodal atrás de flag server-side

Status: concluído.

Arquivos principais:

- `geminiVideoNarrativeFeatureFlag.ts`
- `geminiVideoNarrativeFeatureFlag.test.ts`
- `geminiVideoNarrativeProvider.ts`
- `geminiVideoNarrativeProvider.test.ts`

O que faz:

- protege a futura execução multimodal com `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED=true`;
- expõe um provider server-side injetável, com fallback seguro e sem rede nos testes;
- mantém a dependência de cliente externa fora desta fase.

O que não faz:

- não cria endpoint;
- não adiciona cliente real;
- não conecta no board real nem em navegação.

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
- protege a rota com `NEXT_PUBLIC_VIDEO_UPLOAD_PREVIEW_ENABLED=1` e sessão admin/dev;
- renderiza cenários fixos de `VideoUploadDraft + VideoProcessingArtifacts`;
- mostra validação, readiness, artifacts simulados, `NarrativeSource` enriquecida, intenção NSE, entrada Adaptive V2 e plano estratégico;
- aborta NSE/Adaptive quando o draft controlado não passa pela validação;
- não monta o pipeline quando a flag está desligada ou a sessão não tem permissão;
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

### STOR1 — Contratos de storage temporário

Status: concluído.

Arquivos principais:

- `videoTemporaryStorageTypes.ts`
- `videoTemporaryStorageTypes.test.ts`

O que faz:

- define providers futuros de storage temporário sem acoplar SDK real;
- define status, visibilidade, política de retenção e objeto temporário;
- cria helpers puros para calcular expiração, marcar upload simulado e marcar remoção;
- valida vínculo com draft, chave temporária, data de expiração, acesso público e status reconhecido;
- mantém `publicUrl` sempre nulo nesta fase.

O que não faz:

- não cria storage real;
- não gera URL assinada;
- não usa S3, Vercel Blob, R2, GCS ou SDK de provider;
- não cria upload real;
- não cria endpoint;
- não salva nada em banco;
- não conecta no produto real.

### STOR2 — Contratos de sessão de upload e provider

Status: concluído.

Arquivos principais:

- `videoUploadSessionContracts.ts`
- `videoUploadSessionContracts.test.ts`

O que faz:

- define `VideoUploadSession` como contrato futuro entre draft validado, objeto temporário e URL temporária recebida;
- define status de sessão, issues de validação e capacidades conceituais de provider;
- cria helpers puros para criar sessão, marcar URL temporária pronta, marcar envio em andamento, marcar enviado e abortar;
- valida sessão, draft snapshot, vínculo com usuário quando exigido, URL temporária e expiração;
- cria mocks explícitos de capabilities e prepared upload result para testes/harness futuros.

O que não faz:

- não implementa provider real;
- não gera URL assinada;
- não usa S3, Vercel Blob, R2, GCS ou SDK de provider;
- não cria upload real;
- não cria endpoint;
- não salva sessão em banco;
- não conecta no produto real.

### STOR3 — Contratos de retenção e cleanup

Status: concluído.

Arquivos principais:

- `videoStorageRetentionContracts.ts`
- `videoStorageRetentionContracts.test.ts`

O que faz:

- define política de retenção para vídeos temporários;
- define decisão de retenção, ação de cleanup, motivo e mensagem;
- cria contrato de job de cleanup sem executar remoção real;
- cria helpers puros para decidir cleanup, criar job, marcar fila/execução/conclusão/falha e validar tentativas;
- cobre objetos expirados, uploads abortados, arquivos processados e fallback de manter pela política.

O que não faz:

- não cria cron ou job real;
- não deleta arquivo real;
- não chama provider de storage;
- não usa SDK de storage;
- não cria endpoint;
- não salva nada em banco;
- não conecta no produto real.

### PROC1 — Contratos de providers de processamento

Status: concluído.

Arquivos principais:

- `videoProcessingProviderContracts.ts`
- `videoProcessingProviderContracts.test.ts`

O que faz:

- define providers futuros de processamento sem implementar provider real;
- define tarefas de transcrição, extração de frames, OCR, resumo visual, sinais técnicos e análise multimodal futura;
- cria contrato de input de processamento a partir de sessão e objeto temporário;
- cria capabilities conceituais de provider e valida request por tarefa, URL temporária, duração e tamanho;
- cria helpers puros para resultado de tarefa, conclusão, falha e merge de resultados em `VideoProcessingArtifacts`.

O que não faz:

- não implementa provider real;
- não usa OpenAI, Whisper, ffmpeg, OCR real ou SDK de processamento;
- não cria fila ou job real;
- não cria endpoint;
- não cria storage real;
- não salva nada em banco;
- não conecta no produto real.

### PROC2 — QA do pipeline com resultados mockados de provider

Status: concluído.

Arquivo principal:

- `videoProcessingProviderPipeline.test.ts`

O que faz:

- valida, apenas em teste, o caminho `VideoUploadSession` → `VideoProcessingTaskResult` mockado → `VideoProcessingArtifacts` → `NarrativeSource` enriquecida → NSE → Adaptive V2;
- cobre resultado de transcrição para rotina/skincare, visual summary para descoberta de narrativa, frames + OCR para potencial de marca e falhas parciais de provider;
- garante que resultados de provider com falha não quebram o merge de artefatos;
- garante que, quando todos os resultados falham, o pipeline ainda pode usar a pergunta do criador se o draft for válido;
- garante abort seguro para draft inválido;
- verifica linguagem segura e isolamento de imports.

O que não faz:

- não implementa provider real;
- não cria fila ou job real;
- não usa OpenAI, Whisper, OCR real, ffmpeg ou SDK de processamento;
- não cria endpoint;
- não cria storage real;
- não salva nada em banco;
- não conecta no produto real.

### PROC3 — Documentação de rollout de providers

Status: concluído.

Arquivo principal:

- `VIDEO_PROCESSING_PROVIDER_ROLLOUT.md`

O que faz:

- documenta a arquitetura preparada para providers futuros de processamento;
- compara tarefas como transcrição, frames, OCR, resumo visual, sinais técnicos e análise multimodal;
- registra critérios de decisão, política de custos, consentimento, riscos, flags futuras e checklist antes de provider real;
- sugere próximos PRs para mock in-memory, storage real, upload session server-side e processamento protegido.

O que não faz:

- não altera lógica;
- não altera testes;
- não implementa provider real;
- não cria endpoint, fila, storage, banco ou UI;
- não usa OpenAI, Whisper, OCR real, ffmpeg ou SDK de processamento.

### PROVIDER1 — Provider mock in-memory

Status: concluído.

Arquivos principais:

- `videoProcessingMockProvider.ts`
- `videoProcessingMockProvider.test.ts`

O que faz:

- cria um provider local, síncrono e determinístico para simular resultados de processamento;
- recebe `VideoProcessingTaskRequest` e retorna `VideoProcessingTaskResult`;
- cobre cenários de rotina/skincare, bastidor/processo, OCR de marca, melhoria de gancho, vazio e falha;
- valida requests com os contratos de provider antes de simular artifacts;
- permite batch local para compor resultados e testar `mergeVideoProcessingTaskResults`.

O que não faz:

- não implementa provider real;
- não faz rede, `fetch`, upload, storage, fila ou job real;
- não usa OpenAI, Whisper, OCR real, ffmpeg ou SDK de processamento;
- não cria endpoint, banco, UI ou integração com BoardShell.

### PROVIDER2 — QA do pipeline com mock provider

Status: concluído.

Arquivo principal:

- `videoProcessingMockProviderPipeline.test.ts`

O que faz:

- valida, apenas em teste, o caminho `VideoUploadSession` → `VideoProcessingTaskRequest[]` → mock provider → artifacts → `NarrativeSource` enriquecida → NSE → Adaptive V2;
- cobre cenários de skincare, bastidor, marca com OCR, melhoria de gancho, artifacts vazios, falha total e falha parcial;
- garante que `failTasks` preserva o pipeline quando parte das tarefas falha;
- garante abort seguro para draft inválido;
- verifica linguagem segura e isolamento de imports.

O que não faz:

- não implementa provider real;
- não cria endpoint, fila, storage, banco ou UI;
- não faz rede, `fetch`, upload real ou integração com BoardShell;
- não usa OpenAI, Whisper, OCR real, ffmpeg ou SDK de processamento.

## Arquitetura Atual

```text
VideoUploadDraft
↓
validateVideoUploadDraft
↓
VideoUploadSession futuro
↓
buildNarrativeSourceFromVideoUploadDraft
↓
VideoTemporaryStorageObject futuro
↓
VideoRetentionPolicy / VideoCleanupJob futuros
↓
VideoProcessingProviderContracts futuros
↓
VideoProcessingMockProvider local
↓
VideoProcessingTaskResult mockado
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
- Proteção admin/dev compartilhada para previews internos.
- Checklist manual do preview interno.
- Contratos puros de storage temporário com retenção e validação.
- Contratos puros de sessão de upload e interface conceitual de provider.
- Contratos puros de retenção e cleanup de vídeo temporário.
- Contratos puros de providers de processamento de vídeo.
- QA de pipeline com resultados mockados de provider de processamento.
- Documentação de rollout e matriz de decisão de providers de processamento.
- Provider mock in-memory para simulação local sem rede.
- QA de pipeline usando provider mock in-memory.
- Testes de linguagem segura e isolamento de escopo.

## O Que Ainda Não Existe

- Upload real.
- Endpoint.
- Storage.
- Provider real de storage temporário.
- URL assinada gerada por serviço real.
- Sessão persistida de upload.
- Provider real de URL temporária.
- Cleanup real.
- Cron ou job real de remoção.
- Deleção real de arquivo.
- Provider real de processamento.
- Fila ou job real de processamento.
- Transcrição automática.
- Extração real de frames.
- OCR real.
- Whisper SDK.
- OCR SDK.
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
- contrato de URL assinada e escopo de acesso;
- estratégia de remoção após processamento;
- janela de retenção por plano e por status de processamento;
- auditoria de cleanup e tentativas de remoção;
- limite final de tamanho e duração;
- extração de duração no client, no server ou em ambos;
- provedor de transcrição;
- contrato operacional de provider de processamento;
- estratégia de fila/job de processamento;
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
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoProcessingMockProviderPipeline.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoProcessingMockProvider.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoProcessingProviderPipeline.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoProcessingProviderContracts.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoStorageRetentionContracts.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoUploadSessionContracts.test.ts
npm test -- --runInBand src/app/dashboard/boards/videoUpload/videoTemporaryStorageTypes.test.ts
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

- PROC4: contrato de fila/job conceitual de processamento.
- STOR4: contrato de auditoria de cleanup e eventos de retenção.
- VU11: documentação de custos, limites e retenção.
- VU12: upload real em PR separado ou fase isolada, somente depois das decisões de produto, segurança e custo.
