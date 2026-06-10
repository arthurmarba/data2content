# Auditoria — Alimentação do mapa via Instagram

> Documento de análise. Avalia se o MapaSeed é alimentado corretamente pelo Instagram
> e onde cabe otimização/inteligência. **§8 registra o que já foi implementado** (G1+G2).
> Data: 2026-06-10.

---

## 1. Como funciona hoje (o pipeline real)

### Disparo
- **Ao conectar** o Instagram → [`connect-selected-account`](../src/app/api/instagram/connect-selected-account/route.ts) enfileira (QStash) um refresh inicial.
- **Periodicamente** → cron `instagram-refresh-data-2x-day` (`0 */12 * * *`, 2×/dia — [`scheduleCrons.ts:54`](../src/scripts/scheduleCrons.ts)) enfileira refresh por usuário elegível.
- **Não há gatilho por postagem.** O [webhook do Instagram](../src/app/api/webhooks/instagram/route.ts) só trata `story_insights` — posts novos de feed entram só no próximo refresh de 12h.

### Execução
Worker [`refresh-instagram-user`](../src/app/api/worker/refresh-instagram-user/route.ts) faz, em sequência:
1. `triggerDataRefresh(userId)` → busca mídia + insights → salva `Metric` docs (histórico bruto).
2. `enrichMapaSeedWithInstagram(userId)` → enriquece o MapaSeed (só se o refresh teve sucesso).

### Enriquecimento ([`enrichMapaSeedForUser.ts`](../src/app/lib/mapaSeed/enrichMapaSeedForUser.ts))
1. Exige um **MapaSeed já existente** (criado no onboarding). Sem mapa → pula.
2. Throttle de 12h: se `maturidade === "instagram_enriched"` e `updatedAt < 12h` → pula.
3. Busca até **30 posts** → `analyzeInstagramPosts` → `enrichMapaWithInstagram` → salva.

### O que é analisado ([`analyzeInstagramPosts.ts`](../src/app/lib/mapaSeed/analyzeInstagramPosts.ts))
- Entrada por post: **apenas** `tipo` (media_type), `legenda` (≤500 chars), `hashtags`, `data`.
- Via **OpenAI gpt-4o** (`callClaudeJSON` é o nome da função, mas `claudeService.ts` usa OpenAI SDK internamente — legado de branding), intensity medium, extrai: `temas_recorrentes`, `tom_real`,
  `formatos_usados`, `assets_identificados`, `ausencias_notaveis`.
- Amostragem: <5 = insuficiente (pula IA), 5-9 = baixa, 10+ = suficiente.

### Como mescla ([`enrichMapaWithInstagram.ts`](../src/app/lib/mapaSeed/enrichMapaWithInstagram.ts))
- Via **OpenAI gpt-4o** (intensity high), cruza mapa declarado × padrões reais e devolve:
  `narrativa_central`, `territorios`, `narrativas_adjacentes`, `assets`, `tom`, `formatos`, `observacoes`.
- `narrativa_central` e `tom` são **substituídos** pela saída da IA; territórios/assets/formatos são combinados.
- Marca `maturidade = "instagram_enriched"`, adiciona `"instagram"` em `fonte`.

### Estrutura do mapa ([`MapaSeed.ts`](../src/app/models/MapaSeed.ts))
`IMapaData` é **plano**: `narrativa_central: string`, `territorios: string[]`, `assets: string[]`,
`tom`, `formatos`, `maturidade`, `fonte[]`, `observacoes[]`. **Sem `evidenceCount`, sem trajetória.**

---

## 2. Veredito de correção

**Está sendo alimentado? Sim, e com uma filosofia correta** — narrativa-primeiro, cruzando
declarado × real, registrando divergências, conservador com pouca amostra. Não há bug que quebre
o fluxo. **Mas é raso e tem riscos de estabilidade.**

---

## 3. Lacunas (detalhadas)

> **Atualização (2026-06-10):** G1 + G2 implementados (§8); G3 + G5 implementados (§9). Resta G4.

### 🔴 G1 — Cego ao conteúdo visual
`analyzeInstagramPosts` lê só `legenda + hashtags + tipo` ([linha 62-67](../src/app/lib/mapaSeed/analyzeInstagramPosts.ts)).
A imagem/vídeo do post nunca é olhada. Para criadores visuais com legenda curta (a maioria no IG),
`assets_identificados` e `temas_recorrentes` ficam pobres ou vazios.

**Impacto:** o sinal mais forte do Instagram — o que aparece na tela — é descartado. O mapa fica
dependente de quão verbosa é a legenda, não de quem o criador é.

### 🟡 G2 — Ignora ressonância (performance) por completo
O enrich trata os 30 posts como iguais. Os `Metric` docs (saves, shares, alcance, watch time) já
foram salvos por `triggerDataRefresh` no mesmo worker — mas não chegam ao enriquecimento.

**Impacto:** territórios entram no mapa por *frequência de menção*, não por *onde o criador tem
tração real*. Pela lógica do produto, performance não deve virar pressão pro criador — mas usá-la
*internamente* para ponderar quais territórios são legítimos é "número traduzido em decisão calma",
totalmente coerente. Hoje essa inteligência é jogada fora.

### 🟡 G3 — Overwrite total do núcleo a cada run
`narrativa_central` e `tom` são reescritos pela IA a cada enriquecimento
([linha 118/122](../src/app/lib/mapaSeed/enrichMapaWithInstagram.ts)). Um lote de 30 posts atípico
(uma fase, uma campanha, um assunto pontual) pode *virar* o núcleo do mapa. O prompt pede "se
confirma, mantenha", mas é uma instrução mole, sem gating de confiança nem diff.

**Impacto:** o mapa pode oscilar a cada 12h. Fere a estabilidade que um "mapa" deveria ter — o
criador não confia num norte que muda sozinho.

### 🟡 G4 — Snapshot que apaga, sem evidência acumulada nem trajetória
`IMapaData` é plano e cada enriquecimento substitui o anterior. Não há `evidenceCount` por
território/asset (que o pipeline de vídeo já tem em `confirmedLifeAssets`), nem memória de evolução.

**Impacto:** impossível dizer "este território aparece há 3 meses" vs. "surgiu esta semana", nem
mostrar trajetória ("seu conteúdo migrou para X"). Contradiz o princípio de UX "enriquecimento
incremental". A força de um sinal (1 menção vs. 20) é invisível.

### ⚪ G5 — Throttle frágil + comentários desatualizados
- O throttle checa `maturidade === "instagram_enriched"`. Mas o stream de **vídeo**
  ([`enrichMapaWithVideoReadings.ts:157`](../src/app/lib/mapaSeed/enrichMapaWithVideoReadings.ts))
  sobrescreve `maturidade` para `"video_enriched"`. Resultado: após qualquer enriquecimento por
  vídeo, o throttle do Instagram **falha** → re-enriquece a cada 12h mesmo sem posts novos (LLM à
  toa). E vice-versa. Os dois streams disputam o mesmo campo `maturidade`.
- `updatedAt` é bumped por qualquer save no doc, podendo bloquear/destravar o throttle por motivos
  alheios ao Instagram.
- O nome `callClaudeJSON` é enganoso: o serviço usa **OpenAI gpt-4o** por dentro (o comentário
  "Modelo: gpt-4o" estava certo; o nome da função é que mente). `enrichMapaWithInstagram.ts` ainda
  carrega esse comentário/nome.

**Impacto:** custo de LLM desperdiçado ou enriquecimento perdido, de forma imprevisível.

---

## 4. A questão estrutural por trás das lacunas

Há **duas representações do mapa** alimentadas em paralelo:

| | MapaSeed (`IMapaData`) | Síntese estratégica (vídeo) |
|---|---|---|
| Estrutura | plana (`string[]`) | rica (`confirmedLifeAssets` com `evidenceCount`, anchors, contentContext) |
| Alimentado por | Instagram **e** vídeo (digest achatado) | leituras de vídeo |
| Inteligência | overwrite | acúmulo com evidência |

O Instagram só alimenta a representação **plana**. O motor multimodal rico (Gemini, já em produção
no pipeline de vídeo: setting, socialPresence, lifeSignals, productionStyle, evidenceAnchors) **não
é usado** para Instagram. Unificar os dois streams sob a mesma estrutura de evidência é a
oportunidade de fundo — um mapa coerente em vez de duas fontes que se sobrescrevem.

---

## 5. Plano priorizado

### Fase 1 — Robustez (baixo risco, alto valor de confiança)
- **F1.1** Corrigir o throttle: desacoplar `maturidade` por fonte (ex.: campos
  `instagramEnrichedAt` / `videoEnrichedAt` separados) em vez de um `maturidade` único disputado.
- **F1.2** Gating de estabilidade no overwrite de `narrativa_central`/`tom`: só trocar o núcleo com
  corroboração (amostragem suficiente + confirmação), senão propor a mudança (reusar
  `mapConfirmationReproposalService`) em vez de aplicar direto.
- **F1.3** Limpeza: o nome `callClaudeJSON` (na verdade OpenAI gpt-4o) confunde — renomear ou
  documentar; filtro de recência nos 30 posts (janela de data, não só count).

### Fase 2 — Ressonância interna (G2)
- Passar um resumo dos `Metric` (saves/shares/alcance por post) ao `analyzeInstagramPosts` para
  **ponderar** temas/territórios — sem expor performance ao criador. Saída ganha "força" por
  território. Decisão de produto: confirmar que isso fica interno (não vira número na tela).

### Fase 3 — Análise visual (G1) — o maior ganho, custo mínimo
- Estratégia: usar o **`thumbnail_url`** (imagem estática da Graph API) dos **top 5 posts por
  saves+shares** (fallback: top 5 mais recentes). Não precisamos do pipeline de vídeo completo
  (Files API + transcrição) — o thumbnail já revela setting, estilo visual, presença.
- Motor: Gemini 2.5 Flash com `inlineData` de imagem. Custo estimado ≈ $0.000019/imagem →
  ~$0.0001 por ciclo de 5 imagens. Mais barato que o gpt-4o textual atual.
- Implementação: expandir `preparePostSummaries` para incluir `thumbnail_url`; adicionar etapa
  multimodal no `analyzeInstagramPosts` para os top posts antes (ou em paralelo) ao texto.
- Latência: paralelo às chamadas de texto existentes — sem aumento perceptível no worker.
- **Decisão de custo necessária:** quantos posts por ciclo (3, 5, 10)? 5 é o ponto de equilíbrio
  recomendado (cobre a maioria dos criadores, custo negligenciável).

### Fase 4 — Evidência acumulada (G3/G4) — estrutural
- Evoluir `IMapaData` (ou uma camada de evidência ao lado) para `evidenceCount` por território/asset
  e trajetória, convergindo com `confirmedLifeAssets`. Permite "este território cresce há X" e
  protege o núcleo. É a mudança mais profunda (migração de modelo + ambos os enrichers).

---

## 6. Decisões abertas (precisam de você)

1. **Performance interna (G2):** ok usar saves/shares para ponderar territórios, desde que nunca
   vire pressão visível pro criador? (Alinha com "número traduzido em decisão calma".)
2. **Custo da análise visual (G1/F3):** análise de thumbnails (imagem estática, não vídeo completo)
   via Gemini Flash é mais barata que o gpt-4o textual atual. Estratégia "top 5 por ressonância"
   recomendada — confirmar o número (3, 5 ou 10 posts) e que thumbnail_url está presente na
   resposta da Graph API no contexto atual.
3. **Estabilidade vs. frescor (G3/F1.2):** quando o IG diverge do mapa, aplicar direto ou **propor**
   a mudança e deixar o criador confirmar? (Stream A já tem declaração de publicação — há precedente
   de "o criador confirma o que entra no mapa".)
4. **Unificação estrutural (Fase 4):** vale o investimento de unir MapaSeed plano + síntese rica, ou
   manter dois e só melhorar o Instagram no modelo plano atual?

---

## 7. Recomendação de sequência

Começar por **Fase 1** (robustez — o mapa não pode oscilar nem gastar LLM à toa; é pré-requisito de
confiança). Depois **Fase 2** (ressonância — barato, dados já existem, alto sinal). **Fase 3** (visual)
e **Fase 4** (estrutural) são saltos maiores que dependem das decisões 2 e 4 acima.

---

## 8. Implementado — leitura visual de thumbnails (2026-06-10)

Desenho A (consolidado) implementado: G1 (visual) e G2 (ressonância) fundidos numa única mudança.

**O que mudou:**
- [`analyzeInstagramPosts.ts`](../src/app/lib/mapaSeed/analyzeInstagramPosts.ts) migrado para
  **Gemini 2.5 Flash multimodal**. Lê as legendas de todos os posts **+ as thumbnails (imagens)**
  dos posts de maior ressonância. Resolve a melhor imagem por tipo (carrossel → 1ª filha · vídeo →
  thumbnail · foto → media_url), espelhando `metricActions.ts`.
- Seleção visual: `selectVisualPosts` ranqueia por **saves+shares** (fallback recência), top **12**
  (`DEFAULT_MAX_VISUAL_POSTS`). Performance nunca aparece ao criador — só aponta a inteligência.
- [`enrichMapaSeedForUser.ts`](../src/app/lib/mapaSeed/enrichMapaSeedForUser.ts): cruza `Metric`
  docs por `instagramMediaId` (`buildResonanceMap`, non-fatal) e passa `resonanceByMediaId`.
- **Fallback gpt-4o texto-only** preservado: sem chave Gemini, em teste, ou se nenhuma thumbnail
  baixar, cai no caminho histórico. Contrato `InstagramPatterns` inalterado → `enrichMapaWithInstagram`
  não foi tocado.

**Custo:** thumbnails (imagem estática) via Flash ≈ desprezível (~$0.0001/ciclo de 12). A R$49/mês
por usuário, irrelevante.

---

## 9. Implementado — robustez do throttle e do núcleo (2026-06-10)

### G5 — throttle por fonte
- [`MapaSeed.ts`](../src/app/models/MapaSeed.ts): novos campos top-level `instagramEnrichedAt` /
  `videoEnrichedAt`. Cada stream carimba o seu — não disputam mais `mapa.maturidade` + `updatedAt`.
- [`enrichMapaSeedForUser.ts`](../src/app/lib/mapaSeed/enrichMapaSeedForUser.ts): throttle de 12h agora
  checa `instagramEnrichedAt`, imune ao que o vídeo faz. Ausente → sempre roda (inclui re-enriquecer
  uma vez os mapas legados, dando a eles a leitura visual nova).
- [`enrichMapaSeedWithVideoForUser.ts`](../src/app/lib/mapaSeed/enrichMapaSeedWithVideoForUser.ts):
  carimba `videoEnrichedAt` (simetria / uso futuro).
- `maturidade` segue intacto para os consumidores downstream (pautas, whatsapp, onboarding status).

### G3 — estabilidade do núcleo
- [`enrichMapaWithInstagram.ts`](../src/app/lib/mapaSeed/enrichMapaWithInstagram.ts): novo param
  `CoreStabilityLocks`. Se o criador **já confirmou** narrativa/tom (via `CreatorMapConfirmations`),
  o IG **não sobrescreve** — mantém o confirmado e registra a divergência como `observacao` calma
  ("seu Instagram sugere X; mantivemos o seu"). Núcleo não confirmado segue enriquecendo livremente.
- Caller deriva os locks de `getMapConfirmationsSnapshot` (non-fatal). Mesma filosofia do Stream A:
  o criador confirma o que entra no núcleo. **Sem auto-repropor** (evita nag — decisão de UX calma).

### G3 — estendido aos dois streams (follow-up)
- Lógica do lock extraída para [`coreStabilityLocks.ts`](../src/app/lib/mapaSeed/coreStabilityLocks.ts)
  (`applyCoreStabilityLocks`), compartilhada por ambos os enrichers — DRY, frase de divergência por fonte.
- [`enrichMapaWithVideoReadings.ts`](../src/app/lib/mapaSeed/enrichMapaWithVideoReadings.ts) agora também
  respeita o núcleo confirmado: mesmo o vídeo (fonte mais autoritativa) propõe via observação, não
  sobrescreve. Caller [`enrichMapaSeedWithVideoForUser.ts`](../src/app/lib/mapaSeed/enrichMapaSeedWithVideoForUser.ts)
  deriva os locks igual ao IG. **Estabilidade do núcleo agora vale para os dois streams.**

**Ainda aberto:** G4 (evidência acumulada / trajetória — `evidenceCount`) é a única lacuna estrutural
restante (Fase 4).
