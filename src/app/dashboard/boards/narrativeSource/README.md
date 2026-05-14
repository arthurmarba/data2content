# Narrative Source Engine

NSE representa fontes criativas como contratos narrativos puros. Nesta primeira fase, vídeo é apenas uma possível `NarrativeSource`, sem upload real, endpoint, banco, OpenAI ou UI.

## NSE1

Esta fase define:

- Tipos de fonte narrativa.
- Intenções possíveis por trás da fonte.
- Assets narrativos extraídos futuramente.
- Sinais que podem enriquecer o perfil narrativo depois.
- Diagnóstico narrativo básico.

Os contratos vivem em `narrativeSourceTypes.ts`. A fase não implementa extração, roteamento, adapters para Adaptive V2 ou persistência.

## NSE2

Esta fase adiciona `detectNarrativeSourceIntent(source)`, um roteador heurístico e determinístico para identificar a intenção estratégica da fonte narrativa. Ele usa apenas texto local da `NarrativeSource` e continua sem UI, endpoint, banco, upload, OpenAI ou integração com o fluxo real.

## NSE3

Esta fase adiciona `extractNarrativeAssets({ source, intentDetection })`, um extractor simulado e determinístico que transforma a fonte em assets narrativos e sinais de perfil por heurísticas simples. Ele continua sem UI, endpoint, banco, upload, OpenAI ou integração com o fluxo real.

## NSE4

Esta fase adiciona `buildAdaptiveInputFromNarrativeSource(...)`, um adapter puro que transforma uma fonte narrativa analisada em uma entrada textual estratégica para o Adaptive V2. Ele apenas monta `input`, `modeHint`, `sourceSummary` e `signals`; não chama Router, QuizBuilder, AnswerKey, PlanBuilder, UI, endpoint, banco, upload ou OpenAI.

## NSE5

Esta fase adiciona `narrativeSourcePipeline.test.ts`, uma suíte de QA que valida o fluxo completo em ambiente de teste: `NarrativeSource` → roteador NSE → extractor → adapter → pipeline Adaptive V2. A fase não cria lógica nova de produção e continua sem UI, endpoint, banco, upload, OpenAI ou conexão com o BoardShell.

## NSE6

Esta fase adiciona uma preview visual isolada em `components/narrativeSource/`. Os componentes recebem dados prontos por props e mostram fonte, intenção, assets, sinais de perfil, ponte para Adaptive V2 e plano recebido. Eles não rodam pipeline, não criam rota, não chamam UI real, endpoint, banco, upload, OpenAI ou BoardShell.
