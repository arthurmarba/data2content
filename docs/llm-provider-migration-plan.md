# Plano faseado — consolidação de provider LLM (OpenAI → Gemini, híbrido)

> Plano de desenvolvimento. Define como migrar o uso de LLM do projeto de forma
> incremental e de baixo risco, priorizando onde há ganho real de custo/qualidade.
> Nenhuma mudança de código foi feita ainda. Data: 2026-06-10.

---

## Objetivo e não-objetivos

**Objetivo:** reduzir custo e ganhar performance/qualidade trocando para Gemini Flash
**onde o ganho é real** (chamadas gpt-4o), atrás de uma interface única que torne
provider uma escolha de configuração — não de reescrita.

**NÃO é objetivo:** migrar 100% para um único provider. Manter o **híbrido** é proposital:
- Metade das chamadas (gpt-4o-mini / gpt-3.5) já é barata → migrar não muda a fatura.
- Híbrido dá hedge de fornecedor (fallback) e já é o padrão saudável que existe hoje
  (ex.: `analyzeInstagramPosts` = Gemini-primário + OpenAI-fallback).

## Princípios

1. **Interface antes de migração.** Centralizar o acesso a LLM primeiro; trocar provider depois.
2. **Híbrido com fallback**, não fornecedor único.
3. **Incremental** — uma camada por vez, sempre com fallback e flag.
4. **Medir** custo/latência antes e depois; nada de migração "no escuro".
5. **Adiar o arriscado** (function calling + streaming do orchestrator) até haver motivo concreto.

---

## Estado atual (mapeado em 2026-06-10)

| Camada | Provider | Arquivos | Modelos | Complexidade |
|---|---|---|---|---|
| **mapaSeed** (atrás de `callClaudeJSON`/`callClaude`) | OpenAI | 9 (1 wrapper: `claudeService.ts`) | gpt-4o (high/medium), gpt-4o-mini (low) | 🟢 trivial |
| **aiService** (resumo, expertise, Q&A) | OpenAI SDK | `aiService.ts` | gpt-3.5-turbo | 🟡 fácil |
| **Orchestrator / state / admin-chat** | OpenAI SDK | `aiOrchestrator.ts`, `stateService.ts`, `admin-ai/chat-processor.ts` | gpt-4o, gpt-4o-mini | 🔴 difícil (function calling + streaming) |
| **Outros utilitários** | OpenAI SDK | `planner/*`, `proposals/analysis/llm.ts`, `strategicNarrative.ts`, `communityProcessorService.ts`, `scripts/ai.ts`, `api/ai/dynamicCards` | gpt-4o-mini / gpt-4o | 🟡 fácil-médio |
| **videoUpload** (vídeo, pautas, collab, adjacentes) | **Gemini** já | 9 | 2.5-flash, 2.0-flash | ✅ já migrado |

**Fatos que simplificam:** sem embeddings em lugar nenhum; o pipeline de vídeo já roda Gemini
(há padrão e chave em produção); o mapaSeed inteiro está atrás de **um** wrapper.

**Onde está o ganho de custo:** só nas chamadas **gpt-4o** (Flash é ~5–10× mais barato e mais
rápido). gpt-4o-mini → Flash é ~empate de custo. gpt-3.5 → Flash é ganho de qualidade a custo similar.

---

## Fase 0 — Núcleo provider-agnóstico (fundação) — ✅ implementada (2026-06-10)

> Maior alavancagem do plano. Sem isso, cada migração é editar N arquivos; com isso,
> é trocar um parâmetro. Habilita todas as fases seguintes.

**Entregue:** `src/app/lib/llm/` com `types.ts`, `openaiProvider.ts` (import estático de `openai`),
`geminiProvider.ts` (**import dinâmico** de `@google/genai` — evita carregar ESM no Jest),
`index.ts` (`llmGenerate` / `llmGenerateSafe` / `llmGenerateJSON`, seleção por `LLM_PROVIDER_<SCOPE>`
→ ordem [primário, fallback], short-circuit em `NODE_ENV=test` retornando `"{}"`). Testado em
`index.test.ts` (seleção, fallback, indisponibilidade, parse). Default seguro = **openai primário**.

**Escopo:** criar um módulo único de acesso a LLM que cubra os dois formatos realmente usados
hoje (Tiers 1–2):
- `generateText({ prompt, system, intensity, maxTokens })` → string
- `generateJSON<T>({ prompt, system, intensity, schema? })` → T (com `responseSchema` quando Gemini)

Características:
- Seleção de provider por **intensidade** e/ou **call-site**, resolvida por env/flag
  (ex.: `LLM_PROVIDER_MAPA=gemini`, com default seguro).
- Fallback embutido: se o primário falhar/sem chave, cai no secundário (espelha o padrão já
  usado em `analyzeInstagramPosts`).
- Stub único de teste (hoje há **dois** clients OpenAI com stub duplicado: `claudeService.ts`
  e `aiService.ts` — unificar).
- Mapa de intensidade → modelo, por provider:
  - OpenAI: low=gpt-4o-mini, medium/high=gpt-4o (atual)
  - Gemini: low/medium/high=2.5-flash (ou 3-flash quando estável)

**NÃO incluir** function calling/streaming nesta fase (YAGNI — shape diferente, entra na Fase 3).

**Arquivos:** novo `src/app/lib/llm/` (`provider.ts`, `openaiProvider.ts`, `geminiProvider.ts`,
`index.ts`). Sem tocar consumidores ainda.

**Critério de aceite:** interface coberta por testes (texto + JSON, ambos providers mockados,
fallback exercitado); nenhuma mudança de comportamento em produção (ninguém consome ainda).

**Risco:** baixo (código novo, isolado). **Esforço:** médio.

---

## Fase 1 — mapaSeed para Gemini Flash (maior ganho, menor risco) 🟢 — ✅ implementada (2026-06-10)

**Entregue:** `claudeService.ts` (`callClaude`/`callClaudeSafe`/`callClaudeJSON`) agora delega ao
núcleo com `scope: "MAPA"`. Assinatura intacta → os 9 consumidores do mapaSeed não mudaram (62
testes verdes em `llm/` + `mapaSeed/`). **Para ativar Gemini Flash:** definir `LLM_PROVIDER_MAPA=gemini`
(a `GEMINI_API_KEY` já existe em produção para o vídeo); sem a flag, segue OpenAI gpt-4o como hoje.
Rollback = remover a flag, sem deploy. Falta só **medir custo/latência antes×depois** ao ativar.

### Detalhe original do escopo

**Escopo:** reimplementar o interior de `callClaudeJSON`/`callClaude` (`claudeService.ts`) sobre
o núcleo da Fase 0, com **Gemini Flash como primário** e OpenAI como fallback. A assinatura
pública (`intensity`, `systemPrompt`, `maxTokens`) **não muda** → os 9 consumidores do mapaSeed
não são tocados.

Ganhos concretos:
- As chamadas `intensity: high`/`medium` (hoje gpt-4o) passam a Flash → **principal economia**.
- `generateJSON` com `responseSchema` substitui o atual "limpa fences + `JSON.parse`" → **menos
  parse quebrado** (robustez de quebra).

**Arquivos:** `claudeService.ts` (interior), opcionalmente renomear para refletir que não é Claude.
Consumidores: zero mudança.

**Critério de aceite:** todos os testes de `mapaSeed/` verdes; saída JSON válida nos 9 fluxos
(gerar seed, leitura inaugural, enriquecer IG, enriquecer vídeo, pautas, whatsapp, coerência,
onboarding signal, analyze IG); medição de custo/latência antes×depois registrada.

**Risco:** baixo-médio (1 wrapper, fallback presente). **Esforço:** baixo.

---

## Fase 2 — Utilitários sem tools 🟡 — 🟨 em andamento (2026-06-10)

**Entregue:** `aiService.ts` (resumo de conversa, inferência de expertise, Q&A — consumido por
`api/ai/chat` e `whatsapp/sendTips`) migrado para o núcleo, **eliminando o segundo client OpenAI
duplicado** (e seu stub próprio). Núcleo ganhou overrides opcionais de `model`/`temperature` →
o path OpenAI **preserva exatamente** o modelo (gpt-3.5-turbo) e parâmetros atuais; com
`LLM_PROVIDER_AI=gemini` passa a Flash. Stub de teste do núcleo passou a diferenciar texto ("")
de JSON ("{}"). 94 testes verdes.

**Restante (oportunístico, todos sem tools — auditados, mesma conversão do aiService):**
`planner/ai.ts`, `planner/themes.ts`, `proposals/analysis/llm.ts`, `strategicNarrative.ts`,
`communityProcessorService.ts`, `api/ai/dynamicCards`, `scripts/ai.ts`, `worker/classify-content`.

### Detalhe original do escopo

**Escopo:** migrar os consumidores de chat-completion puro (sem function calling) para o núcleo:
- `aiService.ts` (resumo de conversa, inferência de expertise, Q&A) — gpt-3.5 → Flash (ganho de qualidade)
- `planner/ai.ts`, `planner/themes.ts`, `proposals/analysis/llm.ts`, `strategicNarrative.ts`,
  `communityProcessorService.ts`, `api/ai/dynamicCards`, `scripts/ai.ts`, `classify-content`

Feito **oportunisticamente** (quando já estiver mexendo no arquivo) ou em lote, por subsistema.

**Critério de aceite:** paridade de saída por subsistema; testes existentes verdes; flag por
call-site permite reverter sem deploy.

**Risco:** baixo. **Esforço:** médio (muitos arquivos, cada um simples).

---

## Fase 3 — Orchestrator conversacional (adiar; condicional) 🔴

**Escopo:** `aiOrchestrator.ts` + `stateService.ts` + `admin-ai/chat-processor.ts` — usam
**function calling + streaming**, o cérebro do WhatsApp/chat (núcleo do produto de recorrência).

Por que adiar:
- Gemini tem function calling e streaming, mas com **shape de API diferente** (function
  declarations, tool config, formato dos chunks) — não é find-replace.
- Alto risco de regressão exatamente no que mais importa.
- O ganho de custo aqui é menor (boa parte já é gpt-4o-mini).

**Pré-condições para iniciar (qualquer uma):**
- Custo do orchestrator virar fração relevante da fatura.
- Decisão estratégica de fornecedor único.
- Fase 0–2 estáveis em produção por tempo suficiente.

Quando for: estender o núcleo da Fase 0 com uma abstração de tools/streaming, migrar **um**
call-site por vez atrás de flag, com **canário/shadow** (rodar os dois e comparar antes de cortar).

**Risco:** alto. **Esforço:** alto. **Tratar como projeto próprio.**

---

## Transversal — medição, flags e rollback

- **Flag por camada/call-site** (`LLM_PROVIDER_*`) com default seguro; reverter = mudar env, sem deploy.
- **Telemetria** de custo/latência/erro por provider (logar modelo+provider+tokens já no núcleo).
- **Fallback** sempre ligado nas Fases 1–2 (primário Gemini, secundário OpenAI).
- **Sem big-bang:** cada fase entra atrás de flag, observa, depois vira default.

## Sequência e portões de decisão

```
Fase 0 (fundação)  →  Fase 1 (mapaSeed: maior ganho)  →  [medir custo/qualidade]
   →  Fase 2 (utilitários, oportunístico)  →  [reavaliar se Fase 3 se justifica]
   →  Fase 3 (orchestrator) SÓ se pré-condição for atingida
```

**Recomendação de início:** Fase 0 + Fase 1 juntas (a 0 existe para servir a 1). É onde está
quase todo o ganho de custo, com risco baixo e zero mudança nos consumidores.
