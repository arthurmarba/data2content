# Video Multimodal Narrative Architecture

## Objetivo

Este documento redefine a arquitetura de análise de vídeo para o board de criação.

A feature não existe para apenas extrair texto de vídeo. Ela existe para transformar vídeo em direção estratégica de conteúdo. OCR, transcrição, frames e sinais técnicos continuam úteis, mas devem funcionar como evidências auxiliares. O output principal passa a ser `VideoNarrativeAnalysis`, e essa análise deve alimentar o post em construção.

## Problema Da Abordagem OCR-First

OCR sozinho:

- lê texto na tela;
- não entende fala;
- não entende gancho;
- não entende ritmo;
- não entende intenção narrativa;
- não entende tom;
- não entende contexto visual completo;
- não entende presença de produto ou marca de forma estratégica;
- não transforma o conteúdo em blueprint.

## Nova Abordagem Multimodal-First

```text
VideoUploadDraft
+
creatorQuestion
+
video file future
↓
Multimodal Narrative Provider
↓
VideoNarrativeAnalysis
↓
PostCreationVideoSeed
↓
Board de Criação
↓
Blueprint
↓
Roteiro
```

O vídeo deve ser interpretado como peça de conteúdo em construção. A análise precisa combinar o que é dito, o que aparece, como a abertura funciona, qual narrativa emerge e como isso pode virar direção prática dentro do board.

## Conceito De VideoNarrativeAnalysis

`VideoNarrativeAnalysis` será o principal objeto de saída da análise.

MM2 formaliza esse conceito em contratos puros no arquivo `videoNarrativeAnalysisTypes.ts`, ainda sem provider real e sem integração com o board.

Campos conceituais esperados:

- `hook`;
- `summary`;
- `spokenTopics`;
- `onScreenText`;
- `visualElements`;
- `sceneStructure`;
- `d2cClassification`;
- `diagnosis`;
- `blueprintSuggestion`;
- `brandMatch`;
- `evidence`.

Exemplo conceitual:

```json
{
  "hook": {
    "detected": "...",
    "strength": "weak | medium | strong | unknown",
    "why": "..."
  },
  "summary": "...",
  "spokenTopics": [],
  "onScreenText": [],
  "visualElements": [],
  "sceneStructure": [],
  "d2cClassification": {
    "format": "reel",
    "proposal": "tips",
    "context": "planning",
    "tone": "educational",
    "reference": null,
    "intent": "educar",
    "narrative": "comentário -> insight -> pauta"
  },
  "diagnosis": {
    "strengths": [],
    "weaknesses": [],
    "recommendedAdjustments": []
  },
  "blueprintSuggestion": {
    "whatToPost": "...",
    "whyThisPath": "...",
    "howItShouldWork": "...",
    "scenes": []
  },
  "brandMatch": {
    "enabled": true,
    "territories": [],
    "whyBrandsWouldFit": "..."
  },
  "evidence": {
    "transcript": null,
    "ocr": [],
    "frames": [],
    "technicalSignals": []
  }
}
```

## Relação Com Artifacts Atuais

`VideoProcessingArtifacts` continua útil, mas muda de papel.

Antes:

```text
VideoProcessingArtifacts
↓
quase o centro do pipeline
```

Agora:

```text
VideoProcessingArtifacts
↓
evidence
↓
VideoNarrativeAnalysis
```

Transcrição, OCR, frames e sinais técnicos passam a sustentar a leitura narrativa em vez de definir sozinhos a experiência.

## Relação Com Gemini Flash

A abstração de produto deve ser `Multimodal Narrative Provider`.

`Gemini Flash` é o candidato inicial mais provável para a primeira implementação real porque a experiência precisa combinar vídeo, áudio e contexto visual em uma leitura única. O nome do provider não deve contaminar o contrato de produto.

`Gemini Pro` pode ficar reservado para análises premium ou futuras, se custo e qualidade justificarem.

## Relação Com PostCreationFunnelState

`VideoNarrativeAnalysis` não deve ser despejado diretamente no estado real do funil. O board precisa receber um intermediário orientado à jornada:

`PostCreationVideoSeed`

MM3 formaliza esse intermediário no adapter puro `videoNarrativePostCreationSeed.ts`, sem alterar o `PostCreationFunnelState` real.

Esse seed deve carregar:

- `initialIdea`;
- `creatorQuestion`;
- `detectedNarrative`;
- `suggestedFormat`;
- `suggestedProposal`;
- `strategicDiagnosis`;
- `blueprintDraft`;
- `scriptDirection`;
- `brandMatchHints`;
- `followUpQuestions`.

O board deve consumir esse seed para continuar a jornada com contexto suficiente, sem acoplar o funil inteiro ao schema bruto do provider.

## Experiência Esperada Para O Usuário

1. Criador escolhe “Analisar um vídeo”.
2. Sobe vídeo.
3. Responde: “O que você quer descobrir com esse vídeo?”
4. A D2C analisa narrativa, gancho, cenas, intenção e potencial.
5. A D2C entrega diagnóstico.
6. A D2C transforma em blueprint.
7. O criador refina.
8. A D2C gera roteiro ou post em construção.

## Pergunta Do Criador

O campo de texto não deve ser genérico.

Pergunta recomendada:

> O que você quer descobrir com esse vídeo?

Exemplos:

- Quero saber se vale postar.
- Quero melhorar o gancho.
- Quero entender qual narrativa esse vídeo comunica.
- Quero adaptar para publi.
- Quero saber que marca combina.
- Quero transformar em roteiro.

## O Que Fica Fora Do MVP

- vídeos longos;
- `Gemini Pro` automático;
- reprocessamento ilimitado;
- persistência automática no perfil narrativo;
- comparação entre vídeos;
- múltiplos vídeos;
- brand matching avançado com banco real de marcas;
- collab automática.

## Ordem Recomendada A Partir Desta Virada

1. MM2 — Contratos `VideoNarrativeAnalysis`.
2. MM3 — Adapter `VideoNarrativeAnalysis` → `PostCreationVideoSeed`.
3. MM4 — Mock provider narrativo multimodal. Concluído como provider local determinístico.
4. MM5 — Pipeline QA multimodal. Concluído como validação de `VideoNarrativeAnalysis` → `PostCreationVideoSeed`.
5. MM6 — Preview interno narrativo. Concluído como harness isolado por flag e sessão admin/dev.
6. MM7 — Prompt/schema Gemini. Concluído como contratos puros de prompt, normalização e fallback seguro.
7. MM8 — Gemini Flash real atrás de server flag. Concluído como provider injetável protegido por flag server-side, sem cliente real nesta fase.
8. MM9 — Factory isolada do cliente Gemini. Concluída como adapter server-side para cliente real, sem integração automática ao fluxo.
9. MM10 — Composer seguro do provider Gemini. Concluído como composição explícita de config, factory e provider, sem integração automática ao fluxo.
10. MM11 — Harness interno para execução real controlada. Concluído como teste manual explícito, sem endpoint, UI ou upload real.
11. MM12 — Readiness audit sem chamada real. Concluído como auditoria documental e estática antes de qualquer teste externo.
12. MM13 — Internal endpoint contract. Concluído como contrato interno/admin, ainda sem endpoint real.
13. MM14 — Input source contract. Define a origem futura do vídeo por fase, ainda sem upload ou storage real.
14. MM15 — Consent and retention contract. Define consentimento, retenção, expiração e uso de sinais antes de upload real ou beta.
15. MM16 — Usage limits and cost contract. Define limite, quota, custo, retry, cooldown e regras comerciais futuras.
16. MM17 — Observability contract. Define métricas, eventos, logs seguros, dashboards e alertas futuros.
17. MM18 — Real endpoint guards contract. Define a ordem dos guards obrigatórios antes de route.ts ou provider real.
18. MM19 — Pure guard contracts. Define tipos/helpers puros para resultados e resumo dos guards, sem endpoint.
19. MM20 — Payload validation contracts. Define validação pura para o futuro payload_schema guard e parte do input_source guard.
20. MM21 — Input/source guard helpers. Define políticas puras por fase para o futuro input_source guard.
21. MM22 — Consent/retention guard helpers. Define políticas puras por fase para os futuros guards consent e retention.
22. MM23 — Usage/quota guard helpers. Define políticas puras para usage_quota e usage_consumption, sem billing real.
23. MM24 — Observability event contracts. Define eventos e payloads seguros, sem analytics real.
24. MM25 — Safe response builder. Define empacotamento seguro da resposta futura, sem endpoint.
25. MM26 — Endpoint skeleton readiness. Define checklist final antes de endpoint skeleton admin/dev sem provider real.
26. MM27 — Endpoint skeleton admin/dev sem provider real. Cria `route.ts` interno protegido por flag, com guards puros e resposta segura, sem provider real.
27. MM28 — Endpoint mock mode. Permite resposta narrativa simulada útil via mock provider, sem Gemini real.
28. MM29 — Diagnosis and Creator Learning Model. Define diagnóstico estratégico e sinais de aprendizado do criador, sem UI, persistência ou Instagram real.
29. MM30 — Diagnosis-driven quiz builder. Gera perguntas por lacunas do diagnóstico e opções com sinais de aprendizado futuro.
30. MM31 — Creator Narrative Profile contract. Organiza sinais acumulados do criador sem persistência, banco ou Instagram real.
31. MM32 — App-first flow state model. Define estados, transições, copy e prompts antes de qualquer UI real.
32. MM33 — Internal app-first preview with mock. Permite sentir a experiência app-first em preview interna/admin-dev com cenários mockados, sem produto real.
33. MM34 — Diagnosis and Quiz UI primitives. Modulariza a preview interna em componentes reutilizáveis de shell, progresso, loading, quiz, diagnóstico e prompts.
34. MM35 — Interactive app-first preview state. Permite navegar pela jornada em estado local via `mode=interactive`, sem depender de query params etapa por etapa.
35. MM36 — Interactive preview UX refinement. Lapida copy, quiz, diagnóstico, CTAs e prompts antes de conectar upload real ou BoardShell.
36. MM37 — Browser UX QA checklist. Cria roteiro manual e testável para revisar a experiência no navegador antes de upload, BoardShell ou paywall.
37. MM38 — Evolving Creator Diagnosis Contract. Modela a camada evolutiva acima do diagnóstico pontual, sem persistência ou match real.
38. MM39 — Access Tier Diagnosis Rules. Define regras de acesso e valor por camada para free, premium e Instagram conectado.
39. MM40 — Diagnosis Presentation Model. Transforma diagnóstico evolutivo e regras de acesso em blocos de apresentação para futura UI mobile-first.
40. MM41 — Evolving Diagnosis Preview Scenarios. Conecta os contratos evolutivos ao builder mockado da preview interna, sem alterar UI visual.
41. Teste real manual quando houver quota/billing disponível.
42. Integração experimental futura no Board de Criação.

## Critérios Antes De Provider Real

- schema definido;
- mock provider validado;
- preview interno aprovado;
- custo estimado;
- consentimento definido;
- limite por plano definido;
- server-side flag;
- fallback seguro;
- nenhum sinal persistido automaticamente.

## Frase Norte

> O vídeo não entra na D2C para ser extraído. Ele entra para ser interpretado como narrativa em construção.

## Harness Real Controlado

MM11 adiciona apenas um caminho manual de avaliação para o provider real já composto. Ele continua sem endpoint, sem UI e sem upload real. O objetivo é observar output, latência e issues do parser em ambiente interno antes de qualquer exposição ao fluxo do produto.

## Readiness Audit

MM12 confirma que a linha está preparada para um teste real futuro sem executar rede nesta fase. O próximo passo prático deixa de ser nova implementação e passa a ser um teste manual curto quando houver quota/billing disponível.

## Internal Endpoint Contract

MM13 define o formato futuro de acesso interno/admin, payload, resposta e limites antes de existir qualquer rota real. O contrato preserva a separação entre prontidão técnica e exposição de produto.

MM14 separa a decisão de origem do vídeo da implementação de upload. Ele recomenda File API ou inline pequeno para teste manual, `videoUri` primeiro no endpoint interno e storage temporário próprio para beta/produto.

MM20 adiciona `VideoNarrativeAnalyzePayload`, `VideoNarrativeNormalizedAnalyzePayload` e `validateVideoNarrativeAnalyzePayload` como contratos puros para validar payload futuro sem criar endpoint, route.ts, upload real ou UI.

MM21 adiciona `VideoNarrativeInputSourceGuardPolicy` e `validateVideoNarrativeInputSourceForPhase` para aplicar políticas por fase sobre payload já normalizado, ainda sem endpoint, upload real ou storage real.

MM22 adiciona `VideoNarrativeConsentPolicy`, `VideoNarrativeRetentionPolicy` e `validateVideoNarrativeConsentRetentionForPhase` para preparar consentimento, retenção e expiração sem endpoint, upload real, storage real ou cleanup real.

MM23 adiciona `VideoNarrativeUsagePolicy`, `validateVideoNarrativeUsageQuotaForPhase` e `decideVideoNarrativeUsageConsumption` para preparar limite, cooldown e consumo de quota sem endpoint, billing real, Stripe ou cobrança.

MM24 adiciona `VideoNarrativeObservabilityEventPayload`, `buildVideoNarrativeObservabilityEvent` e `validateVideoNarrativeObservabilityEvent` para preparar eventos seguros sem endpoint, analytics real, banco/tabela ou provider externo.

MM25 adiciona `VideoNarrativeSafeResponse`, `buildVideoNarrativeSafeResponse` e `validateVideoNarrativeSafeResponse` para preparar a resposta segura futura sem endpoint, route.ts, upload real ou UI.

MM26 adiciona `VIDEO_NARRATIVE_ENDPOINT_SKELETON_READINESS.md` para confirmar que a próxima fase pode criar endpoint skeleton admin/dev sem provider real, desde que nasça bloqueado, observável e sem vazamento de dados sensíveis.

MM27 cria `POST /api/internal/video-narrative/analyze` como skeleton admin/dev protegido por `VIDEO_NARRATIVE_INTERNAL_ENDPOINT_ENABLED=true`. Ele valida payload, origem, consentimento/retenção e usage/quota, gera eventos locais em response e retorna safe response bloqueada/disabled sem chamar Gemini real, sem upload real, sem storage real, sem analytics real e sem UI.

MM28 adiciona `VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE=mock` para que o skeleton retorne `VideoNarrativeAnalysis`, `PostCreationVideoSeed` e `primaryAction` a partir do mock provider narrativo existente. O modo `real` segue bloqueado nesta fase e a rota continua sem Gemini real, sem SDK Gemini, sem fetch, sem upload/storage real, sem UI e sem analytics real.

MM29 adiciona `VideoNarrativeStrategicDiagnosis` e `VideoNarrativeDiagnosisCreatorSignal` como camada pura posterior à análise/seed. O diagnóstico passa a orientar quiz, UX futura e extração narrativa por níveis `free`, `premium` e `instagram_optimized`, enquanto as respostas do quiz geram sinais internos com `shouldPersistLater: false`.

MM30 adiciona `buildVideoNarrativeDiagnosisQuiz` para gerar perguntas adaptativas a partir das lacunas do diagnóstico. O quiz existe para completar o diagnóstico daquele vídeo e capturar respostas com `learningSignalType`/`learningSignalValue`, ainda sem UI, persistência, endpoint real ou integração com Instagram real.

MM31 adiciona `VideoNarrativeCreatorProfile` como contrato puro para agregar sinais narrativos ao longo do tempo. O perfil futuro pode melhorar diagnósticos recorrentes, mas nesta fase não há banco, persistência, Instagram real ou sinal transformado em verdade permanente automaticamente.

MM32 adiciona `VideoNarrativeAppFlowState` para modelar a experiência app-first antes da UI. A jornada cobre upload, análise, pergunta central, quiz, diagnóstico, CTAs e prompts de upgrade/Instagram sem alterar endpoint, criar upload real ou persistir respostas/sinais.

MM33 adiciona `/dashboard/boards/video-narrative-app-preview` como preview interna protegida por flag e admin/dev. A experiência já pode ser sentida com cenários mockados, controles por query param, diagnóstico, quiz, perfil narrativo e prompts, mas continua fora do produto real, sem upload real, storage, banco, BoardShell, endpoint real ou persistência.

MM34 adiciona primitives visuais em `components/videoUpload/appPreview/` para tornar a preview interna mais próxima de um app. A rota passa a compor shell, progresso, loading, quiz, diagnóstico e prompts com componentes testáveis, ainda sem upload real, endpoint alterado, persistência, BoardShell ou integração real.

MM35 adiciona `VideoNarrativeInteractiveAppPreview` e `useVideoNarrativeInteractivePreviewState` para transformar a preview em uma jornada navegável por estado local. `mode=interactive` simula upload, loadings, objetivo do criador, quiz, diagnóstico e prompts sem upload real, endpoint call, persistência, BoardShell, Gemini real ou integração externa.

MM36 refina a UX da preview interativa. A experiência fica mais clara na primeira tela, o upload simulado ganha CTA central, os loadings usam mensagens mais estratégicas, o quiz parece conversa guiada e o diagnóstico passa a priorizar narrativa, leitura estratégica, potencial comercial, blueprint, ações e aprendizado do criador. A fase continua mock/local-state, sem upload real, endpoint call, persistência, BoardShell ou Gemini real.

MM37 cria uma checklist de QA visual/funcional para testar a preview interativa no navegador. O roteiro cobre URLs, cenários, acessos, mobile-first, segurança visual, critérios por etapa e registro de achados antes de integrar upload, BoardShell, paywall ou qualquer fluxo real.

MM38 adiciona `VideoNarrativeEvolvingDiagnosis` como camada acima de `VideoNarrativeStrategicDiagnosis`. O diagnóstico estratégico continua sendo a leitura pontual do vídeo; a nova camada organiza esse valor em torno da evolução do creator, com nível atual, próximo nível, impacto no perfil, sinais desbloqueados, sinais pendentes e oportunidades futuras. Ela usa o `VideoNarrativeCreatorProfile` como contexto, mas não persiste sinais, não substitui o profile contract e não cria match real de marcas ou creators.

MM39 adiciona `VideoNarrativeAccessTierDiagnosisRules` para explicitar as regras de acesso e valor por camada. MM38 define o diagnóstico evolutivo; MM39 define o que fica visível, limitado, bloqueado ou sugerido em `free`, `premium` e `instagram_optimized`. Essa camada deve ser usada futuramente pela apresentação/UI para não espalhar lógica de paywall, disponibilidade comercial, collab e precisão por Instagram pelos componentes.

MM40 adiciona `VideoNarrativeDiagnosisPresentation` como superfície de apresentação pura acima de MM38 e MM39. MM38 define o diagnóstico evolutivo, MM39 define as regras de acesso e MM40 organiza o que a futura UI deve renderizar como hero, cards prioritários, seções, previews bloqueados, badges e CTAs. Componentes React futuros devem consumir essa camada para evitar lógica de copy, paywall e priorização espalhada na UI.

MM41 conecta a cadeia de contratos ao builder da preview interna. A preview passa a carregar diagnóstico pontual, diagnóstico evolutivo, regras de acesso e presentation model em cada cenário mockado, mantendo tudo local e determinístico. A UI futura deve consumir `VideoNarrativeDiagnosisPresentation` em vez de reconstruir lógica de tier, bloqueio, oportunidade comercial ou precisão por Instagram dentro dos componentes.

MM15 formaliza consentimento e retenção antes de upload real, endpoint real ou beta. O contrato trata vídeo como dado temporário de análise e bloqueia persistência automática de sinais narrativos no perfil.

MM16 formaliza limites e custo antes de billing real, endpoint real ou beta. Ele usa 5 análises/mês como hipótese inicial de beta e só considera 10 análises/mês depois de medir custo real.

MM17 formaliza observabilidade antes de analytics real, endpoint real ou beta. Ele exige medir custo, latência, falha, fallback e utilidade sem logar vídeo, base64, API key, rawText completo ou URL assinada com token.

MM18 formaliza a ordem de guards do futuro endpoint real/admin. Ele bloqueia `route.ts` e provider real até que método, sessão, admin/dev, flag, payload, origem, consentimento, retenção, usage/quota e observabilidade estejam resolvidos.

MM19 começa a transformar a ordem de guards em fundação de código puro. Ele cria `VideoNarrativeGuardResult`, `VideoNarrativeGuardPipelineSummary` e helpers determinísticos para decidir provider/quota sem endpoint real.
