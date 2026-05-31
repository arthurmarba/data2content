# Data2Content — Roadmap Técnico: Jornada do Criador

> Especificação detalhada de desenvolvimento para cada fase.
> Documento vivo — atualizar a cada fase concluída.
>
> Referência de produto: `docs/product-jornada-criador.md`
> Versão: 1.0 — maio 2026

---

## Convenções deste documento

- **[FE]** = frontend (Next.js / React / TypeScript)
- **[BE]** = backend (Next.js API routes / MongoDB)
- **[DB]** = mudança de schema no banco
- **[AI]** = mudança em prompt ou lógica de IA (Gemini)
- ✅ = concluído · ⚠️ = parcialmente concluído · ❌ = não iniciado

---

## Visão geral das fases

| Fase | Foco | Etapas da jornada | Status |
|---|---|---|---|
| 1A — Confirmação UI | Cards com confirmação | 2, 3, 5, 6 | ✅ UI · ✅ backend |
| 1B — Onboarding | Seed do mapa | 1 | ✅ |
| 2 — Mapa consolidado | Persistência + evolução | 2–7 | ✅ V1 (Stream B signal-deep deferido a 2b) |
| 3 — Criação | Pautas do mapa | 9 | ✅ |
| 4 — Distribuição e monetização | Collabs e marcas | 10, 11 | ⚠️ infra parcial |

---

## Fase 1A — Confirmação de Narrativa (backend)

> A UI já existe. O criador já vê as opções "Sim / Quase / Não é isso".
> Esta fase fecha o ciclo: a resposta persiste entre sessões.

### 1A.1 — Endpoint PATCH [BE]

**Rota:** `PATCH /api/dashboard/mobile-strategic-profile/confirm-map-dimension`

**Autenticação:** sessão autenticada (NextAuth — mesmo padrão das demais rotas do módulo)

**Body:**
```typescript
{
  dimension: "narrative" | "territories" | "tone" | "asset";
  response: "yes" | "almost" | "no";
  assetLabel?: string; // obrigatório se dimension === "asset"
}
```

**Lógica:**
1. Ler `userId` da sessão
2. Validar `dimension` e `response`
3. Se `dimension === "asset"` e `assetLabel` ausente → 400
4. Mapear `response` para `ConfirmationState`:
   - `"yes"` → `"confirmed"`
   - `"almost"` → `"confirmed"` (registrar resposta original separado para contexto de IA)
   - `"no"` → `"dismissed"`
5. Persistir no banco (ver 1A.2)
6. Se `dimension !== "asset"`: atualizar `updatedAt` do perfil
7. Retornar `{ ok: true, dimension, state: ConfirmationState }`

**Erros:**
- 400 — corpo inválido
- 401 — não autenticado
- 500 — falha ao persistir

---

### 1A.2 — Schema do banco [DB]

**Modelo:** `UserStrategicProfile` (ou equivalente onde `synthesis` fica salvo)

Adicionar subdocumento `mapConfirmations`:

```typescript
mapConfirmations: {
  narrative: {
    state: "pending" | "confirmed" | "dismissed";
    response: "yes" | "almost" | "no" | null;
    confirmedAt: Date | null;
  };
  territories: {
    state: "pending" | "confirmed" | "dismissed";
    response: "yes" | "almost" | "no" | null;
    confirmedAt: Date | null;
  };
  tone: {
    state: "pending" | "confirmed" | "dismissed";
    response: "yes" | "almost" | "no" | null;
    confirmedAt: Date | null;
  };
  assets: Array<{
    label: string;
    state: "pending" | "confirmed" | "dismissed" | "occasional";
    response: "yes" | "occasional" | "no" | null;
    confirmedAt: Date | null;
  }>;
}
```

**Índice:** `userId` (já existente no perfil)

**Valor padrão ao criar perfil:** todos os estados `"pending"`, arrays vazios

---

### 1A.3 — Leitura no servidor [BE] [FE]

**Arquivo a modificar:** `diagnosticoPageData.ts`

Adicionar ao tipo `DiagnosticoPageData`:
```typescript
mapConfirmations?: {
  narrative: ConfirmationState;
  territories: ConfirmationState;
  tone: ConfirmationState;
  assetConfirmations: Array<{ label: string; state: ConfirmationState }>;
} | null;
```

**Onde popular:** na Server Component / RSC que monta `DiagnosticoPageData` antes de passar ao `DiagnosticoRealShellClient`.
- Ler `mapConfirmations` do banco junto com `synthesis`
- Se campo não existir (usuários antigos) → retornar `null` (shell usa `"pending"` como fallback)

**Arquivo a modificar:** `DiagnosticoRealShellClient.tsx`

Inicializar `useState` a partir dos dados do servidor em vez de sempre `"pending"`:
```typescript
const [narrativeConfirmationState, setNarrativeConfirmationState] =
  useState<ConfirmationState>(data.mapConfirmations?.narrative ?? "pending");

const [territoriesConfirmationState, setTerritoriesConfirmationState] =
  useState<ConfirmationState>(data.mapConfirmations?.territories ?? "pending");

const [toneConfirmationState, setToneConfirmationState] =
  useState<ConfirmationState>(data.mapConfirmations?.tone ?? "pending");
```

---

### 1A.4 — Chamada PATCH nos callbacks [FE]

**Arquivo a modificar:** `DiagnosticoRealShellClient.tsx`

Substituir os TODOs nos callbacks por fetch real:

```typescript
const handleConfirmNarrative = useCallback(async (response: ConfirmationResponse) => {
  // Otimismo local imediato
  setNarrativeConfirmationState(response === "no" ? "dismissed" : "confirmed");
  // Persistência em background — falha silenciosa (não bloqueia UX)
  await fetch("/api/dashboard/mobile-strategic-profile/confirm-map-dimension", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dimension: "narrative", response }),
  }).catch(() => { /* non-fatal */ });
}, []);
```

Padrão idêntico para `handleConfirmTerritories`, `handleConfirmTone`, `handleConfirmAsset`.

---

### 1A.5 — Threshold de exibição da ConfirmationRow [FE]

**Regra de negócio:** só mostrar a `ConfirmationRow` quando houver sinal suficiente para confirmar.

**Arquivo a modificar:** `DiagnosticoNarrativeDetailView.tsx`

```typescript
// Só propõe confirmação se evidência >= 2 e estado ainda for pending
const shouldAskNarrativeConfirmation =
  narrativeConfirmationState === "pending" &&
  (leadingNarrative?.evidenceCount ?? 0) >= 2;
```

Regras por dimensão:
- Narrativa: `evidenceCount >= 2`
- Territórios: `territories.length >= 2`
- Tom: `toneSignals.length >= 1` (aparece mais cedo — tom emerge rápido)
- Asset: `evidenceCount === 1` (chip emergente = novo = pedir confirmação)

---

### 1A.6 — Re-proposta automática [BE]

**Quando disparar:** sempre que um novo snapshot de síntese for persistido (após upload D2C ou processamento Stream B), verificar se alguma dimensão `"confirmed"` mudou significativamente.

**Lógica simples para V1:**
- Se `narrativeConfirmationState === "confirmed"` mas a nova leitura tem narrativa **diferente** → resetar para `"pending"` e registrar `previousNarrative` para mostrar ao criador:
  > *"Seu mapa evoluiu. Sua narrativa era X — agora detectamos Y. Faz sentido?"*

**Arquivo novo:** `mapConfirmationReproposal.ts` (utilitário backend)

---

## Fase 1B — Onboarding Guiado (Etapa 1)

> O criador entra na plataforma pela primeira vez. Sem este passo, a IA opera sem intenção calibrada.

### 1B.1 — Detecção de "primeiro acesso" [BE] [FE]

**Critério:** usuário sem `onboardingCompletedAt` no perfil.

**Arquivo a modificar:** `DiagnosticoRealShellClient.tsx` (ou RSC pai)

```typescript
// Na Server Component:
if (!profile.onboardingCompletedAt) {
  redirect("/onboarding");
}
```

Alternativa: overlay full-screen sobre o shell existente (evita redirect).
**Decisão a tomar:** redirect vs. overlay. Recomendação: overlay (preserva estado do shell; não força navegação).

---

### 1B.2 — Componente de Onboarding [FE]

**Arquivo novo:** `MobileOnboardingFlow.tsx`

**Props:**
```typescript
interface Props {
  open: boolean;
  onComplete: (answers: OnboardingAnswers) => void;
}

type OnboardingAnswers = {
  whyYouCreate: string;      // pergunta 1
  desiredFeeling: string;    // pergunta 2
  contentLimit?: string;     // pergunta 3 (opcional)
  instagramConnected: boolean;
};
```

**Telas (enum `OnboardingStep`):**
```
welcome → instagram → question_1 → question_2 → question_3 → calibrating → first_signal
```

**Tela `welcome`:**
- Título: *"Vamos construir o mapa do seu conteúdo."*
- Subtítulo: *"A D2C aprende com o que você cria — não com o que você preenche."*
- CTA único: "Começar"

**Tela `instagram`:**
- Título: *"Conecte seu Instagram"*
- Subtítulo: *"Seus posts enriquecem o mapa silenciosamente — sem você precisar fazer nada."*
- [Conectar agora] → redirect para OAuth (fluxo já existente)
- [Fazer isso depois] → avança para perguntas
- Se pulado: mostrar aviso calmo: *"Seu mapa vai crescer com os vídeos que você enviar. Posts do Instagram enriquecem mais rápido."*

**Tela `question_1`:**
- Pergunta: *"Por que você cria conteúdo?"*
- Opções (toque único):
  - Expressão pessoal
  - Construir uma audiência
  - Gerar renda
  - Construir autoridade
  - Explorar criatividade
- Progresso visível: "1 de 3"
- Sem campo de texto livre (V1)

**Tela `question_2`:**
- Pergunta: *"O que você quer que alguém sinta depois de ver seu conteúdo?"*
- Opções:
  - Inspirado
  - Informado
  - Entendido
  - Entretido
  - Motivado a agir
- Progresso: "2 de 3"

**Tela `question_3`:**
- Pergunta: *"Tem algo que você nunca quer que apareça no seu conteúdo?"* (opcional)
- Campo de texto livre — 1 linha — placeholder: *"Ex: política, religião, vida pessoal..."*
- Progresso: "3 de 3"
- CTA: "Finalizar" (não "Pular" — a pergunta já é optional por natureza; campo vazio = sem limite)

**Tela `calibrating`:**
- Loading — 2–4s fictício (a calibração real ocorre em background)
- Texto animado: *"Calibrando seu mapa..."*
- Sem barra de progresso percentual — só um spinner calmo

**Tela `first_signal`:**
- Título: *"Detectamos um padrão inicial"*
- Card com o primeiro sinal observado (virá da API de calibração)
- Três opções: [Sim, faz sentido] [Quase isso] [Não é bem assim]
- → Após resposta: transição para o mapa (shell principal)
- → Momento natural para paywall se `accessState === "free_unused"`

---

### 1B.3 — API de salvamento das respostas [BE]

**Rota:** `POST /api/dashboard/mobile-strategic-profile/onboarding`

**Body:**
```typescript
{
  whyYouCreate: string;
  desiredFeeling: string;
  contentLimit?: string;
  instagramConnected: boolean;
}
```

**Lógica:**
1. Salvar respostas como `pastCreatorAnswers` no perfil (já usado pelo prompt Gemini via Phase C)
2. Setar `onboardingCompletedAt = new Date()`
3. Se `instagramConnected === true` e Instagram já estava conectado → trigger de análise inicial do Stream B em background
4. Retornar `{ ok: true, firstSignal?: { label, summary } }` — o primeiro sinal detectado (se houver dados de Instagram para processar imediatamente)

**Schema DB:** adicionar ao perfil do criador:
```typescript
onboardingCompletedAt: Date | null;
onboardingAnswers: {
  whyYouCreate: string;
  desiredFeeling: string;
  contentLimit?: string;
} | null;
```

---

### 1B.4 — Barra de progresso [FE]

**Componente:** `OnboardingProgressBar` (novo, simples)

```typescript
// Exibida nas telas question_1, question_2, question_3
// Não exibida em welcome, instagram, calibrating, first_signal
<OnboardingProgressBar current={1} total={3} />
```

Visual: 3 dots ou barra segmentada — mesmo estilo dos indicators existentes no app.

---

### 1B.5 — Integração com paywall [FE]

**Quando disparar:** após a tela `first_signal`, se `data.accessState === "free_unused"`.

**Não bloquear** o onboarding — o paywall é oferecido, não imposto.

Fluxo:
```
first_signal
  → resposta do criador
  → if (free_unused): mostrar slide-up de upgrade (existente: openPaywallModal)
  → if (qualquer outro): ir direto para o shell
```

---

## Fase 2 — Mapa Consolidado + Persistência (Etapas 2–7)

> O mapa persiste entre sessões, evolui com Stream B e mostra ao criador o que foi aprendido.

### 2.1 — Job de processamento do Stream B [BE]

**O que é:** processamento regular dos posts do Instagram para acumular sinais no mapa.

**Quando rodar:** após cada sincronização de Instagram (já existe job de sync) ou por cron separado.

**Arquivo novo:** `streamBMapEnrichmentJob.ts`

**O que faz:**
1. Ler posts do Instagram do criador desde `lastStreamBProcessedAt`
2. Para cada post: extrair assunto, formato, tom (via caption + hashtags)
3. Agregar sinais por dimensão (território, tom, asset)
4. Incrementar `evidenceCount` nas dimensões existentes ou criar novas
5. Se nova dimensão atingir threshold → marcar como `"pending"` para confirmação
6. Atualizar `lastStreamBProcessedAt` e `lastMapEnrichmentAt`

**Dados que alimentam o mapa por Stream B:**
- `caption` → assunto, tom de escrita, possíveis territórios
- `hashtags` → territórios e assets
- `mediaType` → padrão de formato
- `likeCount + commentCount + shareCount` → sinal de performance por formato

---

### 2.2 — Notificação de enriquecimento no shell [FE]

**Onde exibir:** `NarrativeMapMobileShell` — área de resumo acima dos cards

**Dado necessário em `DiagnosticoPageData`:**
```typescript
lastMapEnrichmentAt?: Date | null;
streamBPostsProcessedSinceLastVisit?: number | null;
newSignalsDetectedSinceLastVisit?: number | null;
```

**Copy (exemplos):**
- *"2 posts analisados desde ontem."*
- *"Novo sinal detectado: território 'finanças pessoais' está crescendo."*
- *"Seu mapa está mais preciso — 5 posts processados."*

**UX:** mensagem discreta abaixo do estado de evolução do mapa. Desaparece após o criador abrir o mapa.

---

### 2.3 — Estado de evolução do mapa [FE]

**Já existe:** `profileSynthesisStatus` em `DiagnosticoPageData` com valores:
`first_reading` → `signals_emerging` → `pattern_in_formation` → `profile_consistent`

**O que falta:** conectar os estados aos critérios reais de evolução (hoje o estado pode não refletir o que foi confirmado).

**Regras de evolução a implementar [BE]:**
```
first_reading        → tem pelo menos 1 leitura D2C
signals_emerging     → tem 2+ leituras OU mapConfirmations.narrative !== "pending"
pattern_in_formation → narrativa confirmed + 1+ território confirmed
profile_consistent   → narrativa + 2+ territórios + tom confirmed
```

**Arquivo a modificar:** onde `profileSynthesisStatus` é calculado (provavelmente no service de síntese).

---

### 2.4 — Re-proposta de confirmação [BE]

**Gatilho:** novo snapshot de síntese gerado (após upload D2C com nova leitura).

**Lógica:**
- Comparar nova síntese com a confirmada
- Se narrativa mudou (label diferente com alta confiança) E estava `"confirmed"` → resetar para `"pending"` + registrar `previousNarrativeLabel`
- Mesma lógica para territórios e tom (menos sensível — só resetar se mudança > 40%)

**UX da re-proposta:** próxima vez que o criador abrir a tela de narrativa, vê:
> *"Seu mapa evoluiu. Antes: [X]. Agora detectamos: [Y]. Faz sentido?"*

**Campo adicional no `mapConfirmations`:**
```typescript
narrative: {
  ...
  previousLabel?: string | null; // para mostrar no re-propose
}
```

---

### 2.5 — Confirmações de assets persistidas [FE]

**Estado atual:** `handleConfirmAsset` no shell faz otimismo local mas não persiste nem remove o chip.

**O que implementar:**
1. Salvar no banco via PATCH (herdado de 1A.4)
2. Carregar `assetConfirmations` do banco ao iniciar o shell
3. Chips com `state === "dismissed"` → não exibir (ou exibir com visual esmaecido)
4. Chips com `state === "confirmed"` → mover para seção "confirmados" (já existe no `DiagnosticoToneCard`)

**Novo tipo no shell:**
```typescript
const [assetConfirmations, setAssetConfirmations] =
  useState<Map<string, AssetConfirmationResponse>>(
    new Map(data.mapConfirmations?.assetConfirmations.map(a => [a.label, a.state]))
  );
```

---

## Fase 3 — Criação a partir do Mapa (Etapa 9)

> Pautas geradas do mapa específico do criador. Disponível após narrativa + 2 territórios confirmados.

### 3.1 — Endpoint de geração de pautas [BE] [AI]

**Rota:** `POST /api/dashboard/mobile-strategic-profile/generate-content-ideas`

**Gatilho de acesso:** verificar se `mapConfirmations.narrative === "confirmed"` e pelo menos 2 territórios confirmados. Se não → 403 com `{ reason: "map_not_ready", missingDimensions: [...] }`.

**Body:**
```typescript
{
  count?: number; // padrão: 3
  territory?: string; // opcional — focar em território específico
  format?: string;    // opcional — focar em formato específico
}
```

**Lógica de geração:**
1. Ler do perfil: `narrativa confirmada`, `territórios confirmados`, `assets confirmados`, `tom confirmado`, `formatos com melhor fit`
2. Montar prompt Gemini com:
   ```
   Narrativa central: [label + summary]
   Territórios confirmados: [lista]
   Assets recorrentes: [lista]
   Tom: [dominantTone]
   Formatos com melhor fit: [lista com performance]
   ```
3. Pedir ao Gemini: N pautas estruturadas (sem mencionar tendências)
4. Cada pauta retornada:
   ```typescript
   {
     title: string;
     angle: string;        // ângulo narrativo específico para este criador
     hook: string;         // gancho sugerido
     territory: string;    // território que conecta
     assets: string[];     // assets que aparecem
     suggestedFormat: string;
     whyItFits: string;    // "por que este vídeo é coerente com o seu mapa"
   }
   ```

**Prompt guidelines:**
- Nunca mencionar algoritmo, tendência, viralização
- Sempre conectar à narrativa confirmada
- Tom de geração = tom do criador (injeta `dominantTone` no prompt)

---

### 3.2 — Card de pauta no shell [FE]

**Categoria nova:** adicionar `"ideas"` ao `DiagnosticoCategoryMeta`

**Arquivo a modificar:** `DiagnosticoCategoryMeta.ts`
```typescript
ideas: {
  id: "ideas",
  title: "Próximas Pautas",
  icon: <IdeasIcon />,
  iconBg: "bg-emerald-500",
  ...
}
```

**Componente novo:** `DiagnosticoIdeasDetailView.tsx`

Exibe lista de pautas geradas. Para cada pauta:
- Título em destaque
- Ângulo narrativo (menor, zinc-500)
- Gancho (menor, zinc-400)
- Chips: território + assets envolvidos
- Footer: *"Por que faz sentido para o seu mapa: [whyItFits]"*
- Ação: [Copiar pauta] [Gerar nova]

**Gatilho de desbloqueio na UI:** card na `NarrativeMapMobileShell` só aparece se `hasMapForIdeas === true` (calculado no servidor: narrativa + 2 territórios confirmados).

---

### 3.3 — Geração de roteiro (V2, não para agora) [BE] [AI]

> Expandir pauta em roteiro completo (gancho → desenvolvimento → CTA).
> Dependência: pauta gerada + confirmação do criador de que quer desenvolver.
> Não implementar antes de validar que pautas estão sendo usadas.

---

## Fase 4 — Distribuição e Monetização (Etapas 10–11)

> Conectar recomendações existentes ao mapa confirmado. Hoje as views existem mas operam com `synthesis` genérico — não com o mapa confirmado.

### 4.1 — Collabs conectados ao mapa [BE] [FE]

**Arquivo a modificar:** payload de `DiagnosticoCollabsDetailView` / endpoint de collabs

**Hoje:** usa `collabTerritories` de `synthesis` (não confirmados pelo criador)

**O que mudar:**
- Usar apenas territórios com `state === "confirmed"` no matching de collabs
- Adicionar `narrativeLabel` confirmado ao payload de busca
- Exibir em cada collab sugerido: *"Fit narrativo: [motivo]"*

**Campo novo no `DiagnosticoCollabSuggestion`:**
```typescript
narrativeFitReason?: string; // "Sua narrativa de [X] complementa [Y]"
```

---

### 4.2 — Territórios de marca calculados do mapa [BE]

**Hoje:** `brandMatches` em `DiagnosticoPageData` (como está implementado hoje não é claro — verificar)

**O que deve ser:**
1. Ler narrativa + territórios + assets confirmados
2. Mapear para categorias de marca (ex: território "paternidade" → marcas de experiências familiares, produtos domésticos)
3. Não retornar marcas específicas — retornar **territórios de marca**:
   ```typescript
   {
     territory: "experiências familiares";
     fit: "Sua narrativa central conecta diretamente com marcas neste espaço";
     examples: ["parques, viagens em família, produtos de rotina doméstica"];
   }
   ```

**Arquivo a modificar:** `DiagnosticoBrandsDetailView.tsx` — substituir visual de marcas genéricas por territórios com justificativa narrativa.

**Gatilho de desbloqueio:** narrativa + territórios + tom confirmados.

---

## Resumo de arquivos por fase

### Fase 1A backend

| Arquivo | Tipo | Ação |
|---|---|---|
| `confirm-map-dimension/route.ts` | [BE] | Criar |
| Schema do UserStrategicProfile | [DB] | Alterar — adicionar `mapConfirmations` |
| `diagnosticoPageData.ts` | [FE] | Alterar — adicionar `mapConfirmations?` |
| Server Component que monta `DiagnosticoPageData` | [BE] | Alterar — ler `mapConfirmations` do banco |
| `DiagnosticoRealShellClient.tsx` | [FE] | Alterar — inicializar estado do servidor + PATCH real |
| `DiagnosticoNarrativeDetailView.tsx` | [FE] | Alterar — threshold de exibição |
| `mapConfirmationReproposal.ts` | [BE] | Criar |

### Fase 1B

| Arquivo | Tipo | Ação |
|---|---|---|
| `MobileOnboardingFlow.tsx` | [FE] | Criar |
| `OnboardingProgressBar.tsx` | [FE] | Criar |
| `onboarding/route.ts` | [BE] | Criar |
| Schema do UserStrategicProfile | [DB] | Alterar — adicionar `onboardingCompletedAt`, `onboardingAnswers` |
| RSC pai do shell | [BE/FE] | Alterar — detectar primeiro acesso e abrir onboarding |

### Fase 2

| Arquivo | Tipo | Ação |
|---|---|---|
| `streamBMapEnrichmentJob.ts` | [BE] | Criar |
| `NarrativeMapMobileShell.tsx` | [FE] | Alterar — notificação de enriquecimento |
| `diagnosticoPageData.ts` | [FE] | Alterar — adicionar campos de enriquecimento |
| Service de cálculo do `profileSynthesisStatus` | [BE] | Alterar — conectar aos critérios reais |
| `DiagnosticoRealShellClient.tsx` | [FE] | Alterar — estado de assets persistido |

### Fase 3

| Arquivo | Tipo | Ação |
|---|---|---|
| `generate-content-ideas/route.ts` | [BE] | Criar |
| `DiagnosticoCategoryMeta.ts` | [FE] | Alterar — adicionar categoria "ideas" |
| `DiagnosticoIdeasDetailView.tsx` | [FE] | Criar |
| Prompt de geração de pautas | [AI] | Criar |

### Fase 4

| Arquivo | Tipo | Ação |
|---|---|---|
| Endpoint de collabs (suggestions) | [BE] | Alterar — usar territórios confirmados |
| `DiagnosticoCollabsDetailView.tsx` | [FE] | Alterar — exibir fit narrativo |
| Endpoint/service de brand matches | [BE] | Alterar — calcular territórios de marca do mapa |
| `DiagnosticoBrandsDetailView.tsx` | [FE] | Alterar — territórios com justificativa narrativa |

---

## Fase 2b — Integração profunda do Stream B (deferida)

A V1 da Fase 2 entrega: notificação ("X posts analisados"), evolution status com confirmações, re-proposta automática. **Não** integra os sinais classificados do Stream B (campos `theme`, `context`, `tone` do Metric) nos cards de territórios, tom e assets do mapa.

Para fazer essa integração no futuro:

1. Aggregar `Metric.theme` / `Metric.context` / `Metric.tone` por usuário e contar evidências
2. Mesclar com `synthesis.narrativeTerritories` / `synthesis.toneSignals` no service de view-model — distinguindo `source: "stream_a" | "stream_b"`
3. Card do mapa exibe selo "via Instagram" para sinais oriundos do Stream B
4. Re-proposta passa a considerar também os sinais do Stream B

**Quando fazer:** quando criadores começarem a sinalizar que o mapa parece "preso" no Stream A — ou seja, após observação real de uso.

---

## Dependências entre fases

```
Fase 1A UI (✅ feito)
    │
    ▼
Fase 1A backend  ←──── Fase 1B (onboarding)
    │                       │
    ▼                       ▼
Fase 2 (mapa consolidado)
    │
    ├──▶ Fase 3 (criação)
    │
    └──▶ Fase 4 (distribuição)
```

**Regras de dependência:**
- Fase 1B pode ser desenvolvida em paralelo com Fase 1A backend
- Fase 2 **depende** de Fase 1A backend (precisamos de confirmações persistidas para saber o estado real do mapa)
- Fase 3 **depende** de Fase 2 (pautas sem mapa confirmado seriam genéricas)
- Fase 4 **pode começar** quando Fase 2 estiver em andamento (basta que territórios confirmados estejam disponíveis)

---

## Perguntas em aberto (para debate antes de implementar cada fase)

### Fase 1B
- [ ] Onboarding como overlay ou redirect para `/onboarding`?
- [ ] Barra de progresso: dots ou barra segmentada?
- [ ] Paywall imediatamente após `first_signal` ou só depois que o criador explorar o shell?
- [ ] Usuários existentes (sem `onboardingCompletedAt`): exibir onboarding retroativamente ou só para novos?

### Fase 2
- [ ] Job do Stream B: rodar junto ao sync do Instagram existente ou cron separado?
- [ ] Notificação de enriquecimento: aparecer sempre ou só uma vez por sessão?
- [ ] Re-proposta: resetar confirmação ou criar estado `"needs_review"`?

### Fase 3
- [ ] Pautas ficam salvas ou são geradas a cada abertura?
- [ ] Limite de pautas por mês (controle de custo de IA) ou ilimitado?
- [ ] Criador pode dar feedback em pauta ("gostei" / "não é para mim") para refinar futuras gerações?

### Fase 4
- [ ] Collabs V1: só recomendação ou adicionar mecanismo de convite?
- [ ] Territórios de marca: exibir como list ou como "radar" visual?

---

*Documento técnico — Data2Content, maio 2026.*
*Atualizar a cada fase concluída ou decisão de produto tomada.*
