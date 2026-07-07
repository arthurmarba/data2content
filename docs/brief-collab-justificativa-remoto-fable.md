# Brief — Apresentação do "porquê" rico + "como gravar" ciente de distância (Fable)

> A trilha de backend JÁ ESTÁ PRONTA (jul/2026). Este brief é só a camada de
> apresentação: como mostrar, na ficha e na comemoração de match, (1) por que
> aquele criador é ideal e (2) como os dois vão gravar juntos mesmo morando
> longe. Não invente dado — os campos abaixo já existem e já vêm preenchidos.

---

## Contexto do produto (mínimo)

Data2Content = parceiro estratégico de conteúdo. Tom: calmo, sem growth-hack,
sem métrica de performance. A collab é "você não cria sozinho" — e o medo real
do criador é: *"topei, mas moramos longe, como a gente grava isso junto?"*.

## O que o backend agora entrega (dados prontos no `NarrativeCollabMatch`)

- `narrativeFitReason: string` — AGORA é rico: nomeia **o chão comum** (o que os
  dois já tocam nesse território) **+ o ângulo que só o outro traz** (o que a
  collab soma). Ex.: *"Vocês dois falam de paternidade; ela traz a camada de
  finanças da casa que você não cobre."* (Antes era uma frase genérica.)
- `sharedSignal: string | null` — o território em comum (o "chão").
- `distinctSignals: string[]` — os territórios DELE que você não tem (o "novo").
- `collabRecordingIdea: string | null` — como gravar juntos, **já respeitando a
  distância** (nunca sugere encontro presencial pra quem mora longe).
- `collabMode: "presencial" | "remoto" | null` — **NOVO**. "presencial" só quando
  os dois moram na MESMA cidade; "remoto" quando moram longe ou a localização é
  desconhecida. É o rótulo que deixa a distância explícita.

Esses campos aparecem TANTO na sugestão (deck/ficha, pré-decisão) QUANTO no
match confirmado (overlay + Combinadas) — o backend persiste `recordingIdea` e
`collabMode` no `CollabInterest`, então a orientação **sobrevive ao match**.

## O que construir (só apresentação)

### 1. O "porquê" na ficha (`DiagnosticoIdeaDetailSheet`, bloco de collab)
Hoje mostra "Por que [nome] combina" com uma linha. Evoluir pra deixar a
estrutura visível — chão comum vs. ângulo novo:
- **Ponto em comum:** [sharedSignal] — "vocês dois já vivem isso"
- **Ela/ele traz:** [distinctSignals] — "o ângulo que você não cobre"
- A frase do `narrativeFitReason` como síntese.
Calmo, sem caixa pesada — mesma linguagem tipográfica que a gente já usa (rótulo
pequeno + texto 14px). Não vira 3 caixas coloridas.

### 2. O "como gravar" com selo de modo (ficha + overlay de match)
Onde hoje aparece "Como gravar essa collab" (o `collabRecordingIdea`), somar um
**selo de modo**:
- `presencial` → selo neutro "Presencial · mesma cidade" (ícone de dois pontos/lugar)
- `remoto` → selo "À distância" (ícone de sinal/ondas), deixando explícito que a
  ideia de gravação já foi pensada pra quem não pode se encontrar.
O selo tira a ansiedade: o criador vê de cara que a sugestão é viável pra
situação dele.

### 3. O handoff pós-match (`DiagnosticoCollabMatchOverlay`)
Hoje: "Chamar no Instagram" + "Ver a pauta completa". Somar, ANTES do CTA do
Instagram, uma linha de **próximo passo concreto** usando `collabMode` +
`collabRecordingIdea`: ex. remoto → *"Vocês moram longe — o caminho é [ideia de
gravação]. Combinem no Instagram."* Resolve o "casamos, e agora?".

## Guardrails (não reverter)
- Sem métrica/performance/growth. O "porquê" é narrativa, não alcance.
- `collabMode` remoto NUNCA some nem é escondido — a distância é tratada como
  normal, não como obstáculo. O tom é "dá pra fazer assim", não "que pena".
- Se `collabRecordingIdea`/`collabMode` vierem null (fluxos antigos), a seção
  degrada com elegância — não mostra selo vazio (guardrail "nada aparece se não
  existe de verdade").
- Nada de tela nova: evoluir a ficha e o overlay que já existem.

## Arquivos
- `DiagnosticoIdeaDetailSheet.tsx` — bloco de collab (o "porquê" + "como gravar").
- `DiagnosticoCollabMatchOverlay.tsx` — handoff pós-match.
- Tipo fonte: `NarrativeCollabMatch` em `narrativeCollabMatchingService.ts`
  (campos `collabMode`, `collabRecordingIdea`, `sharedSignal`, `distinctSignals`).
- Preview descartável: `src/app/dev-collabs-preview/` (ajustar o fixture pra ter
  casos presencial E remoto). REMOVER antes de mergear.
