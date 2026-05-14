# Narrative Source Engine

O Narrative Source Engine (NSE) é uma camada pura para transformar fontes criativas em leitura estratégica. A proposta não é criar uma ferramenta isolada de "análise de vídeo", mas representar qualquer fonte criativa como uma `NarrativeSource` capaz de revelar:

- intenção estratégica;
- assets narrativos;
- sinais de perfil;
- entrada para o Adaptive V2;
- plano adaptativo em ambiente controlado.

Vídeo é uma fonte futura e rica, mas a NSE ainda não faz upload, transcrição, extração de frames ou análise multimodal real. Nesta etapa, vídeo aparece apenas como `video_simulated`, alimentado por texto, transcrição ou descrição visual mockada/controlada.

## Mapa das fases

| Fase | Status | Arquivos principais | Faz | Não faz |
| --- | --- | --- | --- | --- |
| NSE1 | Concluída | `narrativeSourceTypes.ts`, `narrativeSourceTypes.test.ts` | Define contratos puros para fontes, intents, assets, sinais e diagnóstico. | Não extrai assets, não roteia, não persiste e não integra com UI. |
| NSE2 | Concluída | `narrativeSourceIntentRouter.ts`, `narrativeSourceIntentRouter.test.ts` | Detecta intenção estratégica da fonte por heurísticas determinísticas. | Não usa IA, fetch, banco, upload ou UI. |
| NSE3 | Concluída | `narrativeAssetExtractor.ts`, `narrativeAssetExtractor.test.ts` | Extrai assets narrativos e sinais de perfil simulados por regras simples. | Não usa OpenAI, análise multimodal ou persistência. |
| NSE4 | Concluída | `narrativeSourceAdaptiveAdapter.ts`, `narrativeSourceAdaptiveAdapter.test.ts` | Transforma a fonte analisada em input textual para o Adaptive V2. | Não roda Router, QuizBuilder, AnswerKey ou PlanBuilder dentro do adapter. |
| NSE5 | Concluída | `narrativeSourcePipeline.test.ts` | Valida em teste o pipeline NSE -> Adaptive V2 completo. | Não cria lógica nova de produção e não conecta o fluxo real. |
| NSE6 | Concluída | `components/narrativeSource/*` | Renderiza preview visual isolada por props. | Não roda pipeline internamente, não cria rota e não chama serviços. |
| NSE7 | Concluída | `narrative-source-preview/page.tsx`, `buildNarrativeSourcePreviewScenario.ts`, `narrativeSourceFeatureFlag.ts` | Cria harness interno com cenários controlados e flag própria. | Não adiciona navegação/menu, input livre, upload, endpoint ou BoardShell. |

## Arquitetura atual

Fluxo conceitual validado:

```text
NarrativeSource
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
  ↓
NarrativeSourcePreview
```

O adapter existe para aproximar a linguagem da fonte narrativa da linguagem que o Adaptive V2 já entende. A preview recebe dados prontos por props. Apenas o harness interno controlado roda o pipeline para montar cenários de desenvolvimento.

## Rota interna de preview

Rota:

```text
/dashboard/boards/narrative-source-preview
```

Flag necessária:

```text
NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED=1
```

Cenários disponíveis:

- `/dashboard/boards/narrative-source-preview?scenario=video-validate`
- `/dashboard/boards/narrative-source-preview?scenario=video-brand-potential`
- `/dashboard/boards/narrative-source-preview?scenario=video-discover-narrative`
- `/dashboard/boards/narrative-source-preview?scenario=video-improve-content`
- `/dashboard/boards/narrative-source-preview?scenario=video-collab`
- `/dashboard/boards/narrative-source-preview?scenario=comment-to-post`
- `/dashboard/boards/narrative-source-preview?scenario=script-to-plan`

Se `scenario` estiver ausente ou inválido, o harness usa `video-validate`.

## Limites atuais

A NSE ainda não possui:

- upload real;
- análise multimodal real;
- transcrição automática;
- extração de frames;
- OpenAI;
- banco ou persistência;
- treino real da conta;
- input livre do usuário;
- exposição no produto real;
- conexão com BoardShell;
- link em navegação/menu;
- integração com Planner, Media Kit, marcas, collabs reais ou DNA Narrativo.

O estado atual usa apenas cenários controlados, contratos tipados e heurísticas determinísticas.

## Conexão com a promessa da D2C

A NSE reforça a promessa da D2C de ajudar o criador a descobrir, manter e evoluir uma narrativa consistente. Fontes criativas como comentários, roteiros, legendas, briefings e vídeos podem revelar temas recorrentes, territórios de marca, inseguranças, forças de conteúdo e oportunidades de posicionamento.

Esses assets e sinais podem, futuramente, enriquecer o perfil narrativo do criador. O vídeo entra como uma fonte mais rica dentro do mesmo modelo, não como o centro do produto.

## Critérios antes de avançar para upload real

Antes de qualquer upload real ou análise de vídeo, validar:

- harness visual em browser real;
- linguagem dos relatórios e blocos de leitura;
- política de persistência dos sinais de perfil;
- consentimento do usuário para uso e persistência de sinais;
- limites de vídeo: duração, tamanho, formato e quantidade;
- estratégia de storage temporário;
- estratégia de transcrição;
- estratégia de extração de frames;
- custo por análise;
- plano de rollback;
- feature flag desligada em produção até aprovação explícita.

## QA recomendado

```bash
npm test -- --runInBand src/app/dashboard/boards/narrative-source-preview/page.test.tsx
npm test -- --runInBand src/app/dashboard/boards/narrativeSource/narrativeSourceFeatureFlag.test.ts
npm test -- --runInBand src/app/dashboard/boards/components/narrativeSource/NarrativeSourcePreview.test.tsx
npm test -- --runInBand src/app/dashboard/boards/narrativeSource/narrativeSourcePipeline.test.ts
npm test -- --runInBand src/app/dashboard/boards/narrativeSource/narrativeSourceAdaptiveAdapter.test.ts
npm test -- --runInBand src/app/dashboard/boards/narrativeSource/narrativeAssetExtractor.test.ts
npm test -- --runInBand src/app/dashboard/boards/narrativeSource/narrativeSourceIntentRouter.test.ts
npm test -- --runInBand src/app/dashboard/boards/narrativeSource/narrativeSourceTypes.test.ts
npm run typecheck
```

## Próximas fases sugeridas

- NSE9: QA manual visual do harness.
- NSE10: proteção por sessão admin/dev.
- NSE11: integração experimental com BoardShell atrás de flag.
- VU1: fundação de upload de vídeo, em PR separado.
- VU2: transcrição e frames.
- VU3: análise multimodal com IA.
- NP1: persistência de perfil narrativo, em PR separado.
