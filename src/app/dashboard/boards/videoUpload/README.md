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

### MM9 — Factory isolada do cliente Gemini

Status: concluído.

Arquivos principais:

- `geminiVideoNarrativeClientFactory.ts`
- `geminiVideoNarrativeClientFactory.test.ts`

O que faz:

- adiciona o SDK oficial `@google/genai`;
- cria uma factory server-side isolada que adapta URI existente ou vídeo inline à interface local do provider;
- centraliza o modelo inicial em `DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL`.

O que não faz:

- não cria upload via File API;
- não integra automaticamente a factory ao fluxo real;
- não cria endpoint nem navegação.

### MM10 — Composer seguro do provider Gemini

Status: concluído.

Arquivos principais:

- `geminiVideoNarrativeProviderComposer.ts`
- `geminiVideoNarrativeProviderComposer.test.ts`

O que faz:

- resolve chave e modelo a partir de configuração server-side;
- compõe explicitamente a factory real com o provider injetável já existente;
- mantém a chamada isolada e sob a flag server-side existente.

O que não faz:

- não cria endpoint;
- não inicia fluxo automático;
- não conecta no board real nem em navegação.

### MM11 — Harness manual de execução real

Status: concluído.

Arquivos principais:

- `geminiVideoNarrativeRealRunHarness.ts`
- `geminiVideoNarrativeRealRunHarness.test.ts`
- `../../../../../scripts/video-narrative-real-run.ts`

O que faz:

- expõe um harness manual para avaliar uma execução real controlada do provider Gemini;
- resume `VideoNarrativeAnalysis` e `PostCreationVideoSeed` sem imprimir o texto bruto completo;
- pode ser executado localmente com `npm run video:narrative:real-run`.

Variáveis necessárias para uso manual:

- `VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED=true`
- `GEMINI_API_KEY` ou `GOOGLE_GENAI_API_KEY`
- `VIDEO_NARRATIVE_VIDEO_URI` ou `VIDEO_NARRATIVE_INLINE_BASE64` + `VIDEO_NARRATIVE_MIME_TYPE`
- `VIDEO_NARRATIVE_CREATOR_QUESTION`

Cuidados:

- não commitar API key;
- não commitar vídeo nem base64 de vídeo;
- usar apenas em ambiente local/admin;
- não usar ainda com usuário real.

O que não faz:

- não cria endpoint;
- não cria upload real;
- não integra o harness ao fluxo real do produto.

### MM12 — Auditoria de prontidão sem chamada real

Status: concluído.

Arquivos principais:

- `GEMINI_VIDEO_NARRATIVE_READINESS_AUDIT.md`
- `geminiVideoNarrativeReadinessAudit.test.ts`

O que faz:

- consolida a prontidão técnica da linha Gemini sem chamar a API real;
- verifica guardas, isolamento e pendências antes de qualquer teste externo;
- registra que a API real só deve ser testada depois de billing/quota disponível.

O que não faz:

- não substitui teste real com vídeo curto;
- não cria endpoint, upload real ou UI;
- não integra nada ao fluxo real do produto.

### MM13 — Contrato de endpoint interno/admin

Status: concluído.

Arquivos principais:

- `VIDEO_NARRATIVE_INTERNAL_ENDPOINT_CONTRACT.md`
- `videoNarrativeInternalEndpointContract.test.ts`

O que faz:

- define antes da implementação o futuro endpoint interno/admin;
- descreve segurança, payload, resposta, status, limites e privacidade;
- fixa os critérios que precisam existir antes de qualquer rota real.

O que não faz:

- não cria endpoint real;
- não cria upload real ou UI;
- não conecta nada ao fluxo real do produto.

### MM14 — Contrato de origem do vídeo

Status: concluído.

Arquivos principais:

- `VIDEO_NARRATIVE_INPUT_SOURCE_CONTRACT.md`
- `videoNarrativeInputSourceContract.test.ts`

O que faz:

- compara Gemini File API, inline base64, storage temporário próprio, GCS/S3/R2 e URL pública restrita;
- define recomendação por fase para teste manual, endpoint interno/admin e beta/produto;
- separa a decisão de origem do vídeo de qualquer implementação de upload real.

O que não faz:

- não cria endpoint, upload real, storage real ou UI;
- não conecta nada ao fluxo real do produto.

### MM15 — Contrato de consentimento e retenção

Status: concluído.

Arquivos principais:

- `VIDEO_NARRATIVE_CONSENT_RETENTION_CONTRACT.md`
- `videoNarrativeConsentRetentionContract.test.ts`

O que faz:

- define consentimento, retenção, privacidade, logs, expiração e uso de sinais narrativos antes de qualquer beta;
- trata vídeo como dado temporário de análise, não como ativo permanente da conta;
- formaliza que `profileSignals` não devem ser persistidos automaticamente no perfil.

O que não faz:

- não cria implementação real;
- não cria endpoint, upload real, storage real, UI ou rota;
- não conecta nada ao fluxo real do produto.

### MM16 — Contrato de limites e custo

Status: concluído.

Arquivos principais:

- `VIDEO_NARRATIVE_USAGE_LIMITS_COST_CONTRACT.md`
- `videoNarrativeUsageLimitsCostContract.test.ts`

O que faz:

- define limites, custo, quota, retry, cooldown, rate limit e regras comerciais futuras;
- registra 5 análises/mês como hipótese de beta, não promessa pública;
- condiciona 10 análises/mês à medição de custo real.

O que não faz:

- não cria billing real;
- não cria cobrança;
- não cria endpoint, upload real, storage real, UI ou rota;
- não conecta nada ao fluxo real do produto.

### MM17 — Contrato de métricas e observabilidade

Status: concluído.

Arquivos principais:

- `VIDEO_NARRATIVE_OBSERVABILITY_CONTRACT.md`
- `videoNarrativeObservabilityContract.test.ts`

O que faz:

- define métricas, eventos conceituais, logs seguros, dashboards e alertas futuros;
- exige visibilidade de custo, latência, falha, fallback e utilidade antes de endpoint real;
- formaliza que `rawText` completo, base64, vídeo bruto, API key e URL assinada com token não devem ir para logs.

O que não faz:

- não cria analytics real;
- não cria banco/tabela;
- não cria endpoint, upload real, storage real, UI ou rota;
- não conecta provider externo nem fluxo real do produto.

### MM18 — Contrato dos guards do endpoint real

Status: concluído.

Arquivos principais:

- `VIDEO_NARRATIVE_REAL_ENDPOINT_GUARDS_CONTRACT.md`
- `videoNarrativeRealEndpointGuardsContract.test.ts`

O que faz:

- define a ordem obrigatória dos guards do futuro endpoint real/admin;
- bloqueia chamada ao provider antes de acesso, flag, payload, origem, consentimento, retenção, usage/quota e observabilidade;
- documenta o contrato de resposta segura e a regra de consumo de quota.

O que não faz:

- não cria endpoint real;
- não cria `route.ts`;
- não cria upload real, storage real, UI, banco/tabela ou analytics real;
- não conecta nada ao fluxo real do produto.

### MM19 — Contratos puros de guard result/status

Status: concluído.

Arquivos principais:

- `videoNarrativeGuardContracts.ts`
- `videoNarrativeGuardContracts.test.ts`

O que faz:

- cria tipos puros para nomes, status, códigos, severidade, resultado e resumo dos guards;
- define `VIDEO_NARRATIVE_GUARD_ORDER` na mesma ordem do contrato MM18;
- adiciona helpers determinísticos para resultado passed/blocked/skipped, resumo do pipeline, decisão de provider/quota e sanitização de mensagens.

O que não faz:

- não cria endpoint;
- não cria `route.ts`;
- não cria upload real, storage real, UI, banco/tabela ou analytics real;
- não conecta nada ao fluxo real do produto.

### MM20 — Payload validation contracts

Status: concluído.

Arquivos principais:

- `videoNarrativePayloadValidation.ts`
- `videoNarrativePayloadValidation.test.ts`

O que faz:

- cria tipos puros para `VideoNarrativeAnalyzePayload` e `VideoNarrativeNormalizedAnalyzePayload`;
- valida `id`, `creatorQuestion`, `videoUri`, `inlineVideoBase64`, `mimeType`, `source` e `creatorContext`;
- prepara o futuro `payload_schema` guard e parte do `input_source` guard sem criar rota real.

O que não faz:

- não cria endpoint;
- não cria `route.ts`;
- não cria upload real, storage real, UI, banco/tabela ou analytics real;
- não conecta nada ao fluxo real do produto.

### MM21 — Input/source guard helpers

Status: concluído.

Arquivos principais:

- `videoNarrativeInputSourceGuards.ts`
- `videoNarrativeInputSourceGuards.test.ts`

O que faz:

- cria helpers puros para decidir se uma origem de vídeo normalizada pode ser usada em cada fase;
- define políticas para `manual_real_test`, `internal_endpoint`, `closed_beta` e `production`;
- prepara o futuro `input_source` guard sem criar endpoint, upload real ou storage real.

O que não faz:

- não cria endpoint;
- não cria `route.ts`;
- não cria upload real, storage real, UI, banco/tabela ou analytics real;
- não conecta nada ao fluxo real do produto.

### MM22 — Consent/retention guard helpers

Status: concluído.

Arquivos principais:

- `videoNarrativeConsentRetentionGuards.ts`
- `videoNarrativeConsentRetentionGuards.test.ts`

O que faz:

- cria helpers puros para validar consentimento, retenção e expiração por fase;
- define políticas para `manual_real_test`, `internal_endpoint`, `closed_beta` e `production`;
- prepara os futuros guards `consent` e `retention` sem criar endpoint, upload real ou storage real.

O que não faz:

- não cria endpoint;
- não cria `route.ts`;
- não cria upload real, storage real, UI, banco/tabela ou analytics real;
- não conecta nada ao fluxo real do produto.

### MM23 — Usage/quota guard helpers

Status: concluído.

Arquivos principais:

- `videoNarrativeUsageQuotaGuards.ts`
- `videoNarrativeUsageQuotaGuards.test.ts`

O que faz:

- cria helpers puros para limite de uso, cooldown e decisão de consumo de quota;
- define políticas para `manual_real_test`, `internal_endpoint`, `closed_beta` e `production`;
- prepara o futuro `usage_quota` guard e a etapa `usage_consumption` sem billing real, Stripe ou cobrança.

O que não faz:

- não cria endpoint;
- não cria `route.ts`;
- não cria billing real, Stripe, cobrança, banco/tabela ou analytics real;
- não conecta nada ao fluxo real do produto.

### MM24 — Observability event contracts

Status: concluído.

Arquivos principais:

- `videoNarrativeObservabilityEvents.ts`
- `videoNarrativeObservabilityEvents.test.ts`

O que faz:

- cria tipos e helpers puros para eventos futuros de observabilidade;
- define payloads seguros para requested, started, completed, failed, fallback, seed, usage consumed/not consumed e limit reached;
- adiciona buckets de duração/tamanho, requestId determinístico, validação de payload e redação de API key, base64 e URL assinada.

O que não faz:

- não cria analytics real;
- não cria banco/tabela;
- não cria endpoint, `route.ts`, upload real ou UI;
- não conecta provider externo nem envia eventos.

### MM25 — Safe response builder

Status: concluído.

Arquivos principais:

- `videoNarrativeSafeResponseBuilder.ts`
- `videoNarrativeSafeResponseBuilder.test.ts`

O que faz:

- cria helpers puros para montar a resposta segura do futuro endpoint interno/admin;
- reduz guard, usage e observability para summaries seguros;
- garante resposta sem `rawText` completo, base64, API key, vídeo bruto ou URL assinada com token.

O que não faz:

- não cria endpoint;
- não cria `route.ts`;
- não cria upload real, UI, banco/tabela ou analytics real;
- não conecta nada ao fluxo real do produto.

### MM26 — Endpoint skeleton readiness

Status: concluído.

Arquivos principais:

- `VIDEO_NARRATIVE_ENDPOINT_SKELETON_READINESS.md`
- `videoNarrativeEndpointSkeletonReadiness.test.ts`

O que faz:

- cria checklist documental e testável para o futuro endpoint skeleton admin/dev sem provider real;
- mapeia fundação disponível, helpers que o skeleton pode usar e itens que continuam desligados;
- prepara MM27 sem criar `route.ts`.

O que não faz:

- não cria endpoint;
- não cria `route.ts`;
- não cria upload real, UI, banco/tabela ou analytics real;
- não liga Gemini real.

### MM27 — Endpoint skeleton admin/dev sem provider real

Status: concluído.

Arquivos principais:

- `../../../../api/internal/video-narrative/analyze/route.ts`
- `../../../../api/internal/video-narrative/analyze/route.test.ts`
- `videoNarrativeInternalEndpointFeatureFlag.ts`
- `videoNarrativeInternalEndpointFeatureFlag.test.ts`

O que faz:

- cria `POST /api/internal/video-narrative/analyze` como skeleton interno/admin-dev;
- protege a rota com `VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED=true`;
- executa guards de sessão, admin/dev, content-type, payload, input source, consent/retention e usage/quota;
- retorna `VideoNarrativeSafeResponse` bloqueada/disabled com observabilidade local resumida.

O que não faz:

- não chama Gemini real nem provider real;
- não cria upload real, storage real, UI, banco/tabela, analytics real, billing, Stripe ou cobrança;
- não conecta BoardShell, navegação/menu ou `PostCreationFunnelState`;
- não aceita multipart e não faz rede.

### MM28 — Endpoint mock mode

Status: concluído.

Arquivos principais:

- `../../../../api/internal/video-narrative/analyze/route.ts`
- `../../../../api/internal/video-narrative/analyze/route.test.ts`
- `videoNarrativeEndpointMockMode.ts`
- `videoNarrativeEndpointMockMode.test.ts`

O que faz:

- adiciona `VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE=mock` para o endpoint interno/admin-dev;
- resolve cenário mock por `creatorQuestion` e `creatorContext.knownNarratives`;
- executa o mock provider narrativo existente e retorna `VideoNarrativeAnalysis`, `PostCreationVideoSeed` e `primaryAction`;
- mantém `usageSummary`, `guardSummary` e eventos locais resumidos para UX/UI futura.

O que não faz:

- não chama Gemini real nem provider real;
- não importa SDK Gemini na rota;
- não cria upload real, storage real, UI, banco/tabela ou analytics real;
- não conecta BoardShell, navegação/menu, Stripe, billing ou cobrança.

### MM29 — Diagnosis and Creator Learning Model

Status: concluído.

Arquivos principais:

- `videoNarrativeDiagnosisLearningModel.ts`
- `videoNarrativeDiagnosisLearningModel.test.ts`

O que faz:

- cria um modelo puro de diagnóstico estratégico para `free`, `premium` e `instagram_optimized`;
- cruza `VideoNarrativeAnalysis`, `PostCreationVideoSeed`, pergunta do criador, respostas futuras de quiz, perfil narrativo futuro e contexto futuro de Instagram;
- transforma respostas do quiz em `creatorSignals` para aprendizado progressivo futuro do criador;
- mantém `shouldPersistLater: false` em todos os sinais nesta fase.

O que não faz:

- não cria UI, upload real, storage real, banco/tabela, analytics real ou persistência;
- não conecta Instagram real nem usa dados reais de Instagram;
- não chama Gemini real, OpenAI, fetch, Stripe, billing ou cobrança;
- não conecta BoardShell, navegação/menu ou `PostCreationFunnelState`.

### MM30 — Diagnosis-driven quiz builder

Status: concluído.

Arquivos principais:

- `videoNarrativeDiagnosisQuizBuilder.ts`
- `videoNarrativeDiagnosisQuizBuilder.test.ts`

O que faz:

- cria um quiz builder puro orientado por lacunas do diagnóstico estratégico;
- gera entre 3 e 5 perguntas consultivas a partir de análise, seed, diagnóstico, pergunta do criador e sinais existentes;
- associa opções a `learningSignalType` e `learningSignalValue` para aprendizado futuro;
- preserva o quiz no acesso free, sem bloquear respostas.

O que não faz:

- não cria UI, upload real, storage real, banco/tabela, analytics real ou persistência;
- não persiste respostas nem sinais;
- não conecta Instagram real nem usa dados reais de Instagram;
- não altera endpoint real, BoardShell, navegação/menu ou `PostCreationFunnelState`.

### MM31 — Creator Narrative Profile contract

Status: concluído.

Arquivos principais:

- `videoNarrativeCreatorProfileContract.ts`
- `videoNarrativeCreatorProfileContract.test.ts`

O que faz:

- cria um contrato puro para organizar sinais narrativos acumulados do criador;
- mapeia `creatorSignals` para categorias como objetivos, preferências criativas, dores recorrentes, formatos e territórios de marca;
- mescla sinais repetidos por categoria/tipo/valor e recalcula recorrência, força, status e evidências;
- gera summary limitado para contexto futuro de diagnóstico.

O que não faz:

- não cria banco, tabela, Prisma ou persistência;
- não conecta Instagram real nem usa dados reais de Instagram;
- não cria UI, endpoint, upload real, storage real ou analytics real;
- não transforma sinais em verdade permanente automaticamente.

### MM32 — App-first flow state model

Status: concluído.

Arquivos principais:

- `videoNarrativeAppFlowState.ts`
- `videoNarrativeAppFlowState.test.ts`

O que faz:

- define estados puros da jornada app-first de análise narrativa de vídeo;
- modela transições, progresso, copies, loading messages e CTAs;
- define prompts de upgrade e otimização com Instagram a partir do contexto;
- permite carregar diagnóstico, quiz e perfil como contexto futuro sem persistir nada.

O que não faz:

- não cria UI, upload real, storage real, banco/tabela, analytics real ou persistência;
- não altera endpoint real nem conecta BoardShell;
- não conecta Instagram real nem usa dados reais de Instagram;
- não altera navegação/menu ou `PostCreationFunnelState`.

### MM33 — Internal app-first preview with mock

Status: concluído.

Arquivos principais:

- `../video-narrative-app-preview/page.tsx`
- `../video-narrative-app-preview/page.test.tsx`
- `../components/videoUpload/buildVideoNarrativeAppPreviewScenario.ts`
- `../components/videoUpload/buildVideoNarrativeAppPreviewScenario.test.ts`
- `../components/videoUpload/VideoNarrativeAppPreview.tsx`
- `../components/videoUpload/VideoNarrativeAppPreview.test.tsx`
- `videoNarrativeAppPreviewFeatureFlag.ts`
- `videoNarrativeAppPreviewFeatureFlag.test.ts`

O que faz:

- cria a rota interna `/dashboard/boards/video-narrative-app-preview`;
- protege a preview com `NEXT_PUBLIC_VIDEO_NARRATIVE_APP_PREVIEW_ENABLED=1` e sessão admin/dev;
- monta cenários mockados com análise, seed, diagnóstico, quiz, perfil narrativo e estado app-first;
- permite alternar scenario, stage, access e Instagram por query params para sentir a jornada.

O que não faz:

- não cria upload real, storage real, banco/tabela, analytics real ou persistência;
- não chama Gemini, OpenAI, endpoint real ou rede;
- não conecta BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta Instagram real, billing, Stripe ou cobrança.

### MM34 — Diagnosis and Quiz UI primitives

Status: concluído.

Arquivos principais:

- `../components/videoUpload/appPreview/VideoNarrativeStageShell.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeProgress.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeLoadingBlock.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeQuizCard.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeDiagnosisBlocks.tsx`
- `../components/videoUpload/appPreview/VideoNarrativePromptCards.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeAppPreviewPrimitives.ts`

O que faz:

- cria primitives reutilizáveis para a preview app-first;
- deixa quiz, diagnóstico, loading, progresso e prompts em componentes modulares;
- melhora a sensação de app interno sem conectar a experiência ao produto real;
- mantém `VideoNarrativeAppPreview` como composição de blocos testáveis.

O que não faz:

- não cria upload real, storage real, banco/tabela, analytics real ou persistência;
- não altera endpoint real nem chama Gemini, OpenAI, endpoint ou rede;
- não conecta BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta Instagram real, billing, Stripe ou cobrança.

### MM35 — Interactive app-first preview

Status: concluído.

Arquivos principais:

- `../components/videoUpload/VideoNarrativeInteractiveAppPreview.tsx`
- `../components/videoUpload/VideoNarrativeInteractiveAppPreview.test.tsx`
- `../components/videoUpload/appPreview/useVideoNarrativeInteractivePreviewState.ts`
- `../components/videoUpload/appPreview/useVideoNarrativeInteractivePreviewState.test.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeGoalInput.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeGoalInput.test.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeInteractiveQuiz.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeInteractiveQuiz.test.tsx`

O que faz:

- adiciona `mode=interactive` em `/dashboard/boards/video-narrative-app-preview`;
- simula a jornada app-first em estado local, de começar até diagnóstico e prompts;
- permite digitar objetivo, selecionar respostas do quiz e avançar manualmente por loadings;
- usa os helpers puros já existentes para recompor diagnóstico, quiz e perfil narrativo em memória.

O que não faz:

- não cria upload real, storage real, banco/tabela, analytics real ou persistência;
- não altera endpoint real nem chama Gemini, OpenAI, endpoint ou rede;
- não conecta BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta Instagram real, billing, Stripe ou cobrança.

### MM36 — Interactive preview UX refinement

Status: concluído.

Arquivos principais:

- `../components/videoUpload/VideoNarrativeInteractiveAppPreview.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeInteractiveQuiz.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeDiagnosisBlocks.tsx`
- `../components/videoUpload/appPreview/VideoNarrativePromptCards.tsx`
- `videoNarrativeAppFlowState.ts`

O que faz:

- refina copy de boas-vindas, upload simulado, loadings, pergunta central e prompts;
- deixa o quiz com sensação de conversa guiada, opções maiores e sinal aprendido discreto;
- reorganiza o diagnóstico em blocos de narrativa, leitura estratégica, gancho, potencial comercial, blueprint, ações e aprendizado;
- torna CTAs finais mais diretos para roteiro, blueprint, versão para publi, Instagram e planos.

O que não faz:

- não cria upload real, storage real, banco/tabela, analytics real ou persistência;
- não altera endpoint real nem chama Gemini, OpenAI, endpoint ou rede;
- não conecta BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta Instagram real, billing, Stripe ou cobrança.

### MM37 — Browser UX QA checklist

Status: concluído.

Arquivos principais:

- `VIDEO_NARRATIVE_BROWSER_UX_QA_CHECKLIST.md`
- `videoNarrativeBrowserUxQaChecklist.test.ts`

O que faz:

- cria uma checklist manual para revisar a preview interativa no navegador;
- documenta ambiente, URLs de teste, roteiro principal, critérios por etapa e cenários obrigatórios;
- cobre acessos `free`, `premium` e `instagram_optimized`, mobile-first, segurança visual e critérios de aprovação;
- prepara a próxima decisão a partir dos achados da revisão.

O que não faz:

- não cria feature nova, upload real, storage real, banco/tabela, analytics real ou persistência;
- não altera endpoint real nem chama Gemini, OpenAI, endpoint ou rede;
- não conecta BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta Instagram real, billing, Stripe ou cobrança.

### MM38 — Evolving Creator Diagnosis Contract

Status: concluído.

Arquivos principais:

- `videoNarrativeEvolvingDiagnosisContract.ts`
- `videoNarrativeEvolvingDiagnosisContract.test.ts`

O que faz:

- cria um contrato puro para diagnóstico evolutivo do creator;
- conecta o diagnóstico pontual de vídeo ao mapa estratégico do creator;
- modela nível atual, próximo nível, impacto no perfil, sinais desbloqueados, sinais pendentes, próximos sinais e oportunidades futuras;
- diferencia `free`, `premium` e `instagram_optimized` sem billing real;
- mantém marca/collab como oportunidade futura, sem match real.

O que não faz:

- não cria persistência, banco/tabela, endpoint, UI, preview, upload real, storage real ou analytics real;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta billing, Stripe ou cobrança.

### MM39 — Access Tier Diagnosis Rules

Status: concluído.

Arquivos principais:

- `videoNarrativeAccessTierDiagnosisRules.ts`
- `videoNarrativeAccessTierDiagnosisRules.test.ts`

O que faz:

- cria regras puras para diferenciar diagnóstico `free`, `premium` e `instagram_optimized`;
- separa valor gratuito, valor de assinatura e valor de Instagram conectado;
- modela disponibilidade de marca/collab sem match real;
- prepara a futura camada de apresentação sem criar UI;
- centraliza a lógica de acesso para evitar espalhar paywall/copy pelos componentes.

O que não faz:

- não cria persistência, banco/tabela, endpoint, UI, preview, upload real, storage real ou analytics real;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta billing, Stripe ou cobrança.

### MM40 — Diagnosis Presentation Model

Status: concluído.

Arquivos principais:

- `videoNarrativeDiagnosisPresentationModel.ts`
- `videoNarrativeDiagnosisPresentationModel.test.ts`

O que faz:

- cria uma camada pura de apresentação para o diagnóstico evolutivo;
- transforma diagnóstico, regras de acesso e mapa evolutivo em hero, cards prioritários, seções, previews bloqueados, badges e CTAs;
- prepara uma futura UI mobile-first sem criar componentes React;
- mantém a superfície curta e escaneável, com profundidade organizada em seções;
- diferencia `free`, `premium` e `instagram_optimized` sem billing real.

O que não faz:

- não cria persistência, banco/tabela, endpoint, UI, preview, upload real, storage real ou analytics real;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta billing, Stripe ou cobrança.

### MM41 — Evolving Diagnosis Preview Scenarios

Status: concluído.

Arquivos principais:

- `../components/videoUpload/buildVideoNarrativeAppPreviewScenario.ts`
- `../components/videoUpload/buildVideoNarrativeAppPreviewScenario.test.ts`

O que faz:

- conecta diagnóstico evolutivo, regras de acesso e presentation model ao builder da preview interna;
- retorna `evolvingDiagnosis`, `accessRules` e `diagnosisPresentation` junto dos cenários mockados;
- mantém tudo local, mockado e determinístico;
- prepara a futura UI mobile-first sem alterar visual ainda;
- garante cenários `free`, `premium` e `instagram_optimized` conectados aos novos contratos.

O que não faz:

- não cria persistência, banco/tabela, endpoint, UI pública, preview visual nova, upload real, storage real ou analytics real;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta billing, Stripe ou cobrança.

### MM42 — Mobile Diagnosis UI Refactor

Status: concluído.

Arquivos principais:

- `../components/videoUpload/appPreview/VideoNarrativeDiagnosisPresentationBlocks.tsx`
- `../components/videoUpload/appPreview/VideoNarrativeDiagnosisBlocks.tsx`
- `../components/videoUpload/VideoNarrativeAppPreview.tsx`
- `../components/videoUpload/VideoNarrativeInteractiveAppPreview.tsx`

O que faz:

- refatora a UI interna do diagnóstico para consumir `VideoNarrativeDiagnosisPresentation`;
- troca a sensação de relatório por um painel estratégico mobile-first;
- renderiza hero, cards prioritários, CTAs, seções, badges e previews bloqueados;
- diferencia visualmente `free`, `premium` e `instagram_optimized` na preview interna;
- mantém a experiência mockada e interna.

O que não faz:

- não cria persistência, banco/tabela, endpoint, UI pública, upload real, storage real ou analytics real;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, BoardShell, navegação/menu, fluxo real ou `PostCreationFunnelState`;
- não conecta billing, Stripe ou cobrança.

### MM43 — Strategic Profile State Contract

Status: concluído.

Arquivos principais:

- `mobileStrategicProfileStateContract.ts`
- `mobileStrategicProfileStateContract.test.ts`

O que faz:

- cria contrato puro para os estados do Perfil Estratégico mobile;
- define que o Perfil é o diagnóstico vivo do creator;
- cobre usuário anônimo, conta criada só com Gmail, primeira leitura, premium e Instagram otimizado;
- modela estado do Mídia Kit sem recriar Mídia Kit ou alterar `MediaKitView`;
- modela Comunidade apenas como destino existente de navegação futura;
- reaproveita a lógica existente de login/callback em etapa futura, sem recriar login com Google.

O que não faz:

- não cria UI, preview visual, nova página de diagnóstico, nova tela de login ou histórico visual;
- não altera endpoint, NextAuth, `LoginClient`, navegação/sidebar, `ActivationPendingWidget`, Mídia Kit real, `MediaKitView` ou Comunidade real;
- não cria persistência, banco/tabela, schema, Prisma, upload real ou storage real;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing, Stripe, match real de marcas ou creators.

### MM44 — Strategic Profile Mapping Layer

Status: concluído.

Arquivos principais:

- `mobileStrategicProfileMapping.ts`
- `mobileStrategicProfileMapping.test.ts`

O que faz:

- cria camada pura que transforma estado do Perfil + diagnóstico em um `MobileStrategicProfile`;
- monta header, tabs internas, seções, ações, bridges de Mídia Kit/Comunidade e navegação mobile futura;
- mantém o Perfil Estratégico como diagnóstico vivo do creator;
- usa `VideoNarrativeDiagnosisPresentation` para alimentar a aba Diagnóstico;
- traduz Comercial como leitura interna do diagnóstico, sem substituir Mídia Kit;
- mantém Mídia Kit e Comunidade como recursos existentes, não recriados.

O que não faz:

- não cria UI, preview visual, nova navegação real, nova página de diagnóstico ou histórico visual;
- não altera endpoint, NextAuth, `LoginClient`, navegação/sidebar, `ActivationPendingWidget`, Mídia Kit real, `MediaKitView` ou Comunidade real;
- não cria persistência, banco/tabela, schema, Prisma, upload real ou storage real;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing, Stripe, match real de marcas ou creators.

### MM45 — Strategic Profile Preview UI

Status: concluído.

Arquivos principais:

- `../components/videoUpload/appPreview/MobileStrategicProfilePreview.tsx`
- `../components/videoUpload/appPreview/buildMobileStrategicProfilePreviewFixture.ts`
- `../mobile-strategic-profile-preview/page.tsx`
- `mobileStrategicProfilePreviewFeatureFlag.ts`

O que faz:

- cria a primeira UI interna do Perfil Estratégico mobile;
- consome `MobileStrategicProfile` em vez de reconstruir lógica de estado ou tier;
- renderiza auth gate visual, Perfil em construção, primeira leitura, premium, Instagram otimizado e Mídia Kit Bridge;
- usa estrutura familiar de perfil social sem copiar métricas de rede social;
- mantém Mídia Kit e Comunidade como recursos existentes, não recriados;
- expõe preview interna por flag `NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_PREVIEW_ENABLED=1` e acesso admin/dev.

O que não faz:

- não altera endpoint, NextAuth, `LoginClient`, navegação/sidebar, `ActivationPendingWidget`, Mídia Kit real, `MediaKitView` ou Comunidade real;
- não cria upload real, storage real, persistência, banco/tabela, schema ou Prisma;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing, Stripe, match real de marcas ou creators;
- não cria histórico de vídeos analisados.

### MM46 — Strategic Profile Login Intent Copy

Status: concluído.

Arquivos principais:

- `../../../login/LoginClient.tsx`
- `../../../login/loginIntentCopy.ts`
- `../../../login/loginIntentCopy.test.ts`

O que faz:

- reaproveita `LoginClient` existente para suportar Perfil Estratégico e análise narrativa;
- adiciona copy contextual para usuário não logado que tenta acessar Perfil ou tocar no `+`;
- preserva `callbackUrl` e o fluxo existente de login com Google;
- suporta intenção por path e query param `intent=strategic_profile` ou `intent=analyze_video`;
- mantém comportamento existente para calculator, media-kit, planning, campaigns e community.

O que não faz:

- não cria nova tela de login, novo Auth Gate real ou rota pública do Perfil Estratégico;
- não altera endpoint, NextAuth, provider Google, callback real de autenticação, navegação/sidebar ou `ActivationPendingWidget`;
- não cria upload real, storage real, persistência, banco/tabela, schema ou Prisma;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, Mídia Kit real, `MediaKitView`, Comunidade real, billing ou Stripe.

### MM47 — Media Kit Modal Bridge

Status: concluído.

Arquivos principais:

- `../components/videoUpload/appPreview/MobileStrategicProfileMediaKitModal.tsx`
- `../components/videoUpload/appPreview/MobileStrategicProfilePreview.tsx`

O que faz:

- cria modal visual/local para acessar o Mídia Kit existente a partir do Perfil Estratégico mobile;
- mantém Mídia Kit como recurso existente, sem recriar ou alterar `MediaKitView`;
- abre o modal a partir da ação `share_media_kit` e dos botões do `mediaKitBridge`;
- adiciona ações visuais para copiar link, compartilhar, ver como marca e abrir Mídia Kit;
- cobre estado informativo de ativação quando conectar Instagram é o próximo passo.

O que não faz:

- não executa clipboard real, Web Share API, abertura de aba ou navegação real;
- não cria novo Mídia Kit, QR Code, seção pública nova ou alteração em `/mediakit/[token]`;
- não altera endpoint, `LoginClient`, NextAuth, navegação/sidebar, `ActivationPendingWidget`, Mídia Kit real, `MediaKitView` ou Comunidade real;
- não cria upload real, storage real, persistência, banco/tabela, schema ou Prisma;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing ou Stripe.

### MM48 — Analyze Entry and Return Flow

Status: concluído.

Arquivos principais:

- `../components/videoUpload/appPreview/MobileStrategicProfileAnalyzeFlow.tsx`
- `../components/videoUpload/appPreview/MobileStrategicProfilePreview.tsx`

O que faz:

- cria fluxo local/mockado para a ação `+ / Analisar vídeo`;
- trata análise como ação temporária que atualiza o Perfil Estratégico;
- usa o mesmo fluxo para o `+` do header, o `+` central da bottom nav, `Analisar vídeo` e `Analisar primeiro vídeo`;
- mostra etapas curtas de intro, upload mockado, objetivo, perguntas rápidas, atualização e confirmação;
- mostra confirmação curta e retorna para o Perfil na seção Diagnóstico;
- adiciona indicação temporária local de diagnóstico atualizado na simulação.

O que não faz:

- não cria upload real, input de arquivo ativo, storage, endpoint, persistência, histórico de vídeos ou página final separada;
- não usa fetch, FileReader, storage do navegador, router push ou navegação real;
- não altera Mídia Kit, Comunidade, `LoginClient`, NextAuth, navegação/sidebar, `ActivationPendingWidget` ou `MediaKitView`;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing, Stripe ou match real de marcas/creators.

### MM49 — Mobile Navigation Preview Strategy

Status: concluído.

Arquivos principais:

- `mobileStrategicProfileNavigationStrategy.ts`
- `mobileStrategicProfileNavigationStrategy.test.ts`
- `MOBILE_STRATEGIC_PROFILE_NAVIGATION_STRATEGY.md`

O que faz:

- cria estratégia pura/documental para futura navegação mobile;
- define `Perfil / + / Comunidade`;
- mantém `+` como ação central, não aba;
- mantém Mídia Kit como bridge/modal;
- mantém Diagnóstico e Comercial dentro do Perfil;
- modela redirects futuros de auth por intenção para Perfil e análise;
- documenta riscos com sidebar mobile e `ActivationPendingWidget`.

O que não faz:

- não altera navegação real, sidebar/config, `DashboardShell`, `BoardShell` ou rotas reais de produção;
- não altera Mídia Kit real, `MediaKitView`, Comunidade real, `LoginClient`, NextAuth ou `ActivationPendingWidget`;
- não cria upload real, storage real, persistência, banco/tabela, schema ou Prisma;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing ou Stripe.

### MM50 — Activation Widget Conflict Strategy

Status: concluído.

Arquivos principais:

- `mobileStrategicProfileActivationWidgetStrategy.ts`
- `mobileStrategicProfileActivationWidgetStrategy.test.ts`
- `MOBILE_STRATEGIC_PROFILE_ACTIVATION_WIDGET_STRATEGY.md`

O que faz:

- cria estratégia pura/documental para o conflito entre `ActivationPendingWidget` e futura experiência mobile app-first;
- modela riscos com bottom nav, botão `+`, Mídia Kit modal e fluxo de análise;
- recomenda não alterar produção agora;
- prepara decisão futura por feature flag;
- recomenda card interno do Perfil como opção futura.

O que não faz:

- não altera widget real, `useActivationChecklist`, navegação real, sidebar/config, `DashboardShell` ou `BoardShell`;
- não altera endpoint, `LoginClient`, NextAuth, `MediaKitView`, Mídia Kit real ou Comunidade real;
- não cria upload real, storage real, persistência, banco/tabela, schema ou Prisma;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing ou Stripe.

### MM51 — Strategic Profile Mobile UX QA Checklist

Status: concluído.

Arquivos principais:

- `MOBILE_STRATEGIC_PROFILE_UX_QA.md`
- `mobileStrategicProfileUxQa.test.ts`

O que faz:

- cria checklist manual/testável para validar a experiência mobile do Perfil Estratégico;
- cobre auth gate, Perfil em construção, primeira leitura, premium, Instagram optimized, Mídia Kit modal, fluxo `+`, navegação, Comunidade e `ActivationPendingWidget`;
- define critérios de aprovação antes de integração real;
- define tabela de achados e próximas decisões sugeridas;
- recomenda QA/polish visual antes de qualquer integração real.

O que não faz:

- não altera UI, preview, navegação real, `ActivationPendingWidget`, `LoginClient`, NextAuth, endpoint, `MediaKitView` ou Comunidade real;
- não cria upload real, storage real, persistência, banco/tabela, schema ou Prisma;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing ou Stripe.

### MM52 — Strategic Profile Mobile Visual Polish

Status: concluído.

Arquivos principais:

- `MobileStrategicProfilePreview.tsx`
- `MobileStrategicProfilePreview.test.tsx`
- `MobileStrategicProfileMediaKitModal.tsx`
- `MobileStrategicProfileAnalyzeFlow.tsx`

O que faz:

- refina visualmente a preview mobile do Perfil Estratégico;
- melhora header, status pills, CTAs, tabs internas, cards, bottom nav, modal de Mídia Kit e fluxo `+`;
- torna Diagnóstico/Comercial tabs internas interativas localmente;
- mantém Perfil como diagnóstico vivo;
- mantém Mídia Kit e Comunidade como recursos existentes.

O que não faz:

- não altera contratos puros, mapping/state, endpoint, `LoginClient`, NextAuth, `MediaKitView`, Mídia Kit real, Comunidade real ou navegação real;
- não cria upload real, storage real, persistência, banco/tabela, schema ou Prisma;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing ou Stripe.

### MM53 — Strategic Profile Preview Copy Refinement

Status: concluído.

Arquivos principais:

- `mobileStrategicProfileStateContract.ts`
- `mobileStrategicProfileMapping.ts`
- `MobileStrategicProfilePreview.tsx`
- `MobileStrategicProfileAnalyzeFlow.tsx`
- `loginIntentCopy.ts`

O que faz:

- refina a linguagem da preview mobile do Perfil Estratégico;
- melhora copy de auth gate, Perfil em construção, primeira leitura, premium, Instagram optimized, Comercial, Mídia Kit, Comunidade e fluxo `+`;
- mantém a experiência clara, humana e orientada a próximo passo;
- reforça que Perfil é diagnóstico vivo, análise é ação temporária e Mídia Kit/Comunidade são recursos existentes.

O que não faz:

- não altera comportamento real, contratos de tipo, endpoint, login real, NextAuth, `MediaKitView`, Mídia Kit real, Comunidade real ou navegação real;
- não cria upload real, storage real, persistência, banco/tabela, schema ou Prisma;
- não chama Gemini real, OpenAI, endpoint ou rede;
- não conecta Instagram real, billing ou Stripe.

### MM54 — Mobile Strategic Profile Real Route Shell

Status: concluído.

Arquivos principais:

- `mobileStrategicProfileFeatureFlag.ts`
- `buildMobileStrategicProfileRealShellInput.ts`
- `buildMobileStrategicProfileRealShellInput.test.ts`
- `MobileStrategicProfilePreview.tsx`
- `src/app/dashboard/boards/mobile-strategic-profile/page.tsx`
- `src/app/dashboard/boards/mobile-strategic-profile/page.test.tsx`

O que faz:

- adiciona feature flag `NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED=1` e helper correspondente;
- implementa o mapeador `buildMobileStrategicProfileRealShellInput` adaptando dados leves da sessão NextAuth;
- atualiza o renderer `MobileStrategicProfilePreview` com suporte à flag `isRealShell` ocultando banners internos de preview;
- cria a rota real segura `/dashboard/boards/mobile-strategic-profile` protegida por flag e NextAuth session;
- redireciona usuários anônimos com segurança preservando `callbackUrl` e `intent=strategic_profile`;
- garante 100% de cobertura de testes unitários e de integração cobrindo os cenários descritos.

O que não faz:

- não altera comportamento do dashboard atual e não integra upload/storage/Gemini/persistência;
- não faz chamadas de rede externas ou de banco reais;
- não altera componentes de login real, `MediaKitView`, Comunidade real ou navegação global legado.

### MM55 — Existing Data Adapter

Status: concluído.

Arquivos principais:

- `mobileStrategicProfileExistingDataAdapter.ts`
- `mobileStrategicProfileExistingDataAdapter.test.ts`
- `buildMobileStrategicProfileRealShellInput.ts`
- `buildMobileStrategicProfileRealShellInput.test.ts`

O que faz:

- cria o adapter puro `buildMobileStrategicProfileExistingDataAdapter` para enriquecer o Perfil Estratégico mobile com dados leves existentes;
- consome dados de sessão, home summary, mídia kit, comunidade e planos de forma totalmente síncrona;
- resolve displayName de forma segura (nome da sessão -> email local part -> "Creator") e displayHandle (instagramUsername da sessão -> null);
- valida avatares descartando base64 longo e emite warnings testáveis em formato de lista interna sem poluir a UI;
- resolve o estado do Mídia Kit a partir do `MediaKitCardData` e o Href da Comunidade respeitando os inviteUrls de VIP/Free existentes;
- mantém o diagnóstico no fallback seguro de "Perfil em construção" quando não há snapshot persistido;
- garante 100% de cobertura de testes unitários e de regressão.

O que não faz:

- não busca dados sozinho, não faz fetch HTTP, consultas ao banco de dados ou Prisma;
- não cria tabelas ou persistência e não altera contratos do Stripe ou billing;
- não conecta OpenAI, Gemini real ou qualquer provider multimodal externo;
- não altera o layout `MediaKitView`, Comunidade real ou navegação do dashboard legado.

### MM56 — Mobile Strategic Profile Real Data Hydration

Status: concluído.

Arquivos principais:

- `MobileStrategicProfileRealShellClient.tsx`
- `MobileStrategicProfileRealShellClient.test.tsx`
- `page.tsx`
- `page.test.tsx`

O que faz:

- enriquece a rota real do Perfil Estratégico com dados existentes da dashboard/home;
- usa o adapter puro `buildMobileStrategicProfileExistingDataAdapter` do MM55;
- mantém render inicial rápido e seguro com dados da sessão;
- hidrata dinamicamente o Mídia Kit, a comunidade e os planos/acesso premium quando `HomeSummaryResponse` estiver disponível;
- mantém fallback seguro sem quebrar a rota quando o summary falha ou o fetch é rejeitado;
- exibe um indicador discreto e polido de "Atualizando dados do Perfil..." durante a hidratação em segundo plano.

O que não faz:

- não cria endpoint, banco de dados ou persistência;
- não altera o layout `MediaKitView`, a Comunidade real ou a navegação do dashboard legado;
- não usa real upload, storage ou Gemini real.

### MM57 — Persisted Strategic Profile Snapshot

Status: concluído.

Arquivos principais:

- `src/app/models/CreatorStrategicProfileSnapshot.ts`
- `mobileStrategicProfileSnapshotTypes.ts`
- `mobileStrategicProfileSnapshotService.ts`
- `mobileStrategicProfileSnapshotService.test.ts`
- `mobileStrategicProfileSnapshotMapping.ts`
- `mobileStrategicProfileSnapshotMapping.test.ts`
- `MobileStrategicProfileRealShellClient.tsx`
- `MobileStrategicProfileRealShellClient.test.tsx`
- `page.tsx`
- `page.test.tsx`

O que faz:

- modela a entidade Mongoose de persistência do snapshot estratégico (`CreatorStrategicProfileSnapshot`), limitando estritamente a 1 snapshot por usuário com índice único ativo no `userId`;
- define tipos de dados versionados em `mobile_strategic_profile_snapshot_v1`;
- implementa o serviço e repositório de persistência pura (`mobileStrategicProfileSnapshotService`) com validações estritas de segurança: bloqueia API keys (Gemini e OpenAI), URLs assinadas ou de vídeos e payloads volumosos contendo transcrições/base64 longos;
- implementa a camada de mapeamento síncrona (`mobileStrategicProfileSnapshotMapping`) para converter o snapshot em cards e sinalizações visuais estruturadas do Perfil Estratégico mobile;
- integra a leitura do snapshot de forma segura na rota real (`page.tsx`), buscando o snapshot persistido server-side e repassando-o diretamente ao cliente, eliminando chamadas desnecessárias;
- garante 100% de cobertura de testes unitários e de integração com 26 asserções totalmente verdes e typecheck de 0 erros.

O que não faz:

- não salva arquivos de vídeo, imagens ou mídias em banco de dados;
- não gera histórico visual de vídeos analisados ou feeds públicos no mídia kit;
- não conecta OpenAI, Gemini real ou qualquer API externa de rede nesta fase;
- não altera tabelas ou esquemas do Prisma.

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

### MM59 — Temporary Upload/Storage Readiness Plan

Status: concluído.

O que faz:
- Cria tipos, contratos e políticas seguras de upload e storage temporário de vídeo (`videoNarrativeTemporaryUploadContracts.ts`);
- Implementa validação puríssima de metadados, tamanhos, durações e consentimento explícito do criador (`videoNarrativeTemporaryUploadValidation.ts`);
- Garante mitigação de riscos bloqueando Base64, URLs externas no nome/source do arquivo, e arquivos executáveis disfarçados;
- Preserva a segurança operacional mantendo o provider de storage desativado por padrão (`providerMode = "disabled"`);
- Garante total conformidade com a premissa de produto: não cria histórico visual de vídeos, não salva thumbnails e exige descarte físico seguro pós-análise.

O que não faz:
- Não implementa upload real nem picks de arquivo físico;
- Não conecta com buckets S3, R2, GCS ou APIs do Cloudinary;
- Não assina URLs de envio nem gera chaves reais;
- Não altera o fluxo interativo "+" do perfil ou o endpoint interno de análise.

### MM60 — Temporary Upload Session API

Status: concluído.

O que faz:
- Cria a API server-side `/api/dashboard/mobile-strategic-profile/upload-session` para preparar sessões de upload temporário de vídeo;
- Exige sessão real autenticada do criador e feature flags ativas (`MOBILE_STRATEGIC_PROFILE_ENABLED=1` e `VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED=1`);
- Executa as validações puras de metadados, tamanhos e consentimento aceito e versão explícita do termo criadas no MM59;
- Retorna uma resposta de sessão em modo mock segura (`mock_session_created`) com ID seguro, mantendo o provider real inativo (`providerMode = "mock"`, `storageProvider = "none"`);
- Protege a API rejeitando payloads suspeitos de dupla extensão, injeções de Base64, links de mídia assinados e arquivos maiores que 5000 bytes.

O que não faz:
- Não implementa upload real nem picks de arquivo físico;
- Não conecta com buckets de storage reais (S3/R2/GCS) nem assina URLs reais;
- Não salva nenhuma informação em banco de dados, nem vídeo nem thumbnail;
- Não altera o endpoint de análise narrativa existente.

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

- Upload real amplo fora de allowlist/flags.
- Endpoint.
- Storage.
- Provider real de storage temporário.
- URL assinada gerada por serviço real.
- Sessão persistida de upload.
- Provider real de URL temporária.
- Cleanup real físico.
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

### MM61 — Upload Metadata & Consent UI Dry Run

Status: concluído.

MM61 integra a UI do fluxo `+ / Analisar vídeo` à upload-session API em modo metadata-only. A rota real do Perfil Estratégico mobile permite seleção local de arquivo apenas para ler `name`, `type` e `size` do objeto `File`, exige consentimento explícito e chama `/api/dashboard/mobile-strategic-profile/upload-session` antes de seguir para a análise mock.

Esta fase não envia arquivo, não lê bytes, não usa `FileReader`, não cria thumbnail/player, não salva vídeo e não usa storage real. Depois que a API retorna `mock_session_created`, o fluxo continua para objetivo/perguntas e mantém a atualização do snapshot pela análise mock existente.

### MM62 — Temporary Storage Provider Abstraction

Status: concluído.

MM62 cria a abstração server-side para storage temporário futuro, separando a upload-session API da decisão de provider físico. A fase adiciona contratos de provider, providers `disabled`/`mock`, parser seguro de configuração/env e factory server-side para escolher o comportamento em runtime.

A upload-session API passa a usar a factory, mas provider real continua bloqueado. Não há signed URL real, `uploadUrl`, `storageKey`, SDK de storage, bucket real ou upload real. Providers R2/S3/GCS/Cloudinary existem apenas como modos planejados e retornam disabled nesta build.

### MM63 — Signed Upload Session Allowlist

Status: concluído.

MM63 adiciona o primeiro caminho server-side para signed upload session, restrito a allowlist/admin-dev e atrás das flags `VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED=1`, `VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED=true`, `VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER=r2|aws_s3` e `VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED=1`.

Como o repo ainda não possui SDK S3/R2 adequado instalado, a geração física de signed URL fica isolada em um signer server-side injetável/testável. A rota real continua sem upload client, sem envio de arquivo, sem storage SDK, sem vídeo salvo, sem thumbnail, sem Gemini e sem persistir signed URL. Usuários comuns seguem bloqueados e o modo mock/disabled permanece o comportamento padrão.

### MM64 — Client Direct Upload + Cleanup Contract

Status: concluído.

MM64 adiciona o primeiro client direct upload para signed URL temporária, somente quando o servidor retorna `signed_upload_session_created` para allowlist/admin-dev e flags reais ativas. O arquivo vai direto do browser para a signed URL via `PUT` com `credentials: "omit"`; ele não passa pelo servidor da aplicação.

O fluxo mock permanece funcionando: `mock_session_created` continua exibindo vídeo validado para análise e não faz PUT. A preview interna sem callbacks continua funcionando sem upload-session e sem direct upload.

Também foi criado o contrato/API seguro de cleanup temporário em `/api/dashboard/mobile-strategic-profile/upload-cleanup`, preparado para receber `uploadSessionId`, `objectKey` seguro e reason, sem aceitar `uploadUrl`, `signedUrl`, bucket público ou secrets. Nesta fase o cleanup real ainda pode responder `cleanup_not_configured` sem quebrar a análise mock.

Guardrails preservados: sem `FileReader`, sem object URL, sem thumbnail/player, sem vídeo salvo no banco, sem signed URL persistida, sem `objectKey` no snapshot, sem histórico visual e sem Gemini/análise real de vídeo.

### MM65 — Gemini Provider Readiness + Response Adapter

Status: concluído.

MM65 prepara a camada server-side de análise real para o Perfil Estratégico mobile sem conectá-la ao fluxo principal. A fase cria provider interface, config/env validation, allowlist server-side, prompt builder estratégico, parser seguro de resposta JSON, adapter de provider com timeout e mapper de resposta parseada para snapshot estratégico.

Gemini real segue desligado por default e exige `VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED=true`, `VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED=1`, allowlist/admin-dev, API key e `VIDEO_NARRATIVE_GEMINI_MODEL`. O provider novo usa client injetável em testes e não substitui `/api/dashboard/mobile-strategic-profile/analyze`, que continua mock.

O parser não aceita resposta vazia, JSON inválido, campos obrigatórios ausentes, signed URLs, tokens/API keys ou transcrição bruta longa. A resposta bruta não é retornada nem persistida; apenas a análise parseada/sanitizada pode virar snapshot. O mapper não inclui vídeo, thumbnail, signed URL, `uploadUrl` ou `objectKey`, e usa source seguro `gemini_ready`/`gemini_fixture` nesta fase.

## Próximas Fases Sugeridas

- PROC4: contrato de fila/job conceitual de processamento.
- STOR4: contrato de auditoria de cleanup e eventos de retenção.
- VU11: documentação de custos, limites e retenção.
- VU12: upload real em PR separado ou fase isolada, somente depois das decisões de produto, segurança e custo.
