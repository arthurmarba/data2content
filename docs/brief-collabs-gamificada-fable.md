# Brief — Aba Collabs gamificada (para o Fable)

> Documento autossuficiente. O objetivo é redesenhar a aba **Collabs** do app mobile
> da Data2Content numa experiência divertida e completa, sem quebrar a filosofia do
> produto. Leia a seção "Filosofia" antes de qualquer coisa — ela contém as decisões
> que NÃO podem ser revertidas por conta de "engajamento".

---

## 0. ESTADO FINAL CONSTRUÍDO (jul/2026) — supera os detalhes de UI abaixo

> As seções 3 (Filosofia) e 9 (Guardrails) continuam valendo integralmente. Os
> detalhes de layout das seções 4–5 descrevem uma versão anterior (pilha + lista):
> o desenho **final** é o descrito aqui. Não reverter pra "pilha + lista".

**A metáfora: Mesa e Mochila.** A tela inteira é UM jogo de swipe (a "mesa"); tudo
que é coleção mora na "mochila" (gaveta Guardadas, acessível pelo header).

**Layout vertical:** Header (título + botão Guardadas) → Stories row (fica) → o
DECK ocupando o resto → Tab bar (Perfil · + · Collabs). Sem "palco" atrás do card.

**O deck (a mesa):**
- Um baralho único intercala **cards de pauta** e **cards de collab** (o prêmio).
  A collab NUNCA abre o deck — surge no meio (posições 1, 4, 7…), pela ordem da
  geração, como surpresa. Deck **finito**: acaba e vira estado de recompensa
  ("Você triou a rodada · N na mochila"). Sem refill infinito.
- **Cartão didático (frente/verso):** frente mínima (anatomia única: META chips →
  TÍTULO herói → ZONA). ZONA = gancho-teaser "ABRE COM" (pauta) ou o criador
  (collab). Tocar o corpo → **flip 3D** que abre o detalhe completo (reusa
  `DiagnosticoIdeaDetailSheet`) com **× pra fechar e desvirar**.
- **Botões de decisão DENTRO do rodapé do card** (X / ♥), com micro-rótulos que
  mudam por tipo: "não é pra mim · quero gravar" (pauta) / "não agora · quero
  fazer" (collab). Swipe decide em paralelo.
- **Voo pra mochila:** aceitar arqueia o card pro 🔖 do header (x+y+scale+fade) e
  o contador pulsa. Recusar desliza pra esquerda.
- **Prêmio (collab):** elevação roxa difusa (halo), NÃO borda/moldura.

**Gestos:** arrastar = decidir · tocar o corpo = virar (abre detalhe com ×) ·
botão = decidir · "ver roteiro" no detalhe = ficha completa.

**Decisão por tipo de card:**
- Pauta, ♥ = salva (vai pra mochila) + tira do deck; X = descarta (efêmero).
- Collab, ♥ = registra interesse + salva a pauta; X = "não agora" (silencioso), e a
  PAUTA re-entra no fim do deck como card solo (recusar o parceiro não custa a ideia).

**A mochila (gaveta Guardadas):** header troca o antigo botão de WhatsApp por
**Guardadas** (ícone 🔖 + contador + pontinho verde se há match). Abre um sheet com:
**Combinadas** (verde, atalho pro overlay de match) + **Pra gravar** (pautas salvas,
cards brancos compactos = eco do card do deck, com selos "Aguardando"/"Combinada") +
linha de **alerta WhatsApp** no rodapé ("te avisamos quando der match").

**Uma família visual só:** cards BRANCOS com sombra de elevação, no deck e na
mochila. `MetaChip` (território/formato) é a peça compartilhada.

**Componentes construídos:**
- `DiagnosticoCollabStack.tsx` — o deck (flip, voo, anatomia, cards por tipo, `MetaChip`).
- `DiagnosticoCollabsFeed.tsx` — orquestra deck + header Guardadas + `GuardadasSheet`
  + partição deck/mochila. `ConfirmedMatchesRow`/`PautaCard` reusados na gaveta.
- `DiagnosticoCollabMatchOverlay.tsx` — comemoração (celebration) e revisit.
- `DiagnosticoIdeaDetailSheet.tsx` — o "verso"/detalhe (já existia; ganhou barra de decisão).
- Backend: `CollabInterest` (model, TTL) + `collabInterestService` (match por par,
  atômico, WhatsApp) + rota `/api/dashboard/mobile-strategic-profile/collabs/interest`.

**Match V1 = por PAR de criadores** (A→B e B→A, cada um da própria pauta) — não por
pauta idêntica; a pauta conjunta dos dois mapas é track paralelo da geração (pendente).

**Pendente:** pauta conjunta nascida dos dois mapas na geração; template de WhatsApp
se o envio livre esbarrar na janela de 24h da Meta; acento de cor por território
(flourish opcional). O preview descartável vive em `src/app/dev-collabs-preview/`
(gateado a non-prod) — remover antes de mergear.

---

## 1. O que é a Data2Content (contexto mínimo)

Parceiro estratégico de conteúdo para criadores. A frase que resume tudo:
**"Você não está mais criando conteúdo sozinho."** O produto trata dados do criador
como sinais de vida e narrativa — nunca como pressão de performance.

Cada criador tem um **mapa**: narrativa central → territórios → assets → tom → formatos.
Desse mapa nascem **pautas** (ideias de conteúdo específicas, na voz dele). A aba
Collabs é onde essas pautas encontram **outros criadores narrativamente compatíveis**
pra gravar junto.

Tom do produto: calmo, guiado, esparso. O oposto de um app de rede social ansioso.

---

## 2. A tela hoje (ponto de partida real)

Arquivos que já existem e devem ser respeitados/evoluídos (não recriar do zero):

- `src/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCollabsFeed.tsx`
  — a aba Collabs atual: feed de pautas; quando há criador compatível, ele aparece
  embutido no card ("Collab sugerida"). Já tem bookmark (salvar), header com selo de
  WhatsApp ("Alertas ativos"), fileira de criadores (stories) + "Descobrir".
- `src/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoIdeaDetailSheet.tsx`
  — a **ficha completa** de uma pauta (bottom sheet). JÁ TEM: abertura/hook, roteiro
  passo a passo, "por que é a sua cara", "o que mais reconhecem em você", e um bloco
  **"Collab pra essa pauta"** (criador + razão do fit + "como gravar essa collab").
  **Reaproveitar esta tela como destino do toque no card. Não criar tela nova.**
- `src/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoTabBar.tsx`
  — barra inferior: Perfil · "+" (upload) · Collabs.
- `src/app/dashboard/boards/components/videoUpload/appPreview/DiagnosticoCommunityDetailView.tsx`
  — tela de Comunidade (diretório de criadores + convite reunião semanal WhatsApp).

Tipos de dados que já existem:

- `NarrativeCollabMatch` (em `narrativeCollabMatchingService.ts`): `name`, `username`
  (o @ do Instagram), `avatarUrl`, `mediaKitSlug`, `narrativeFitReason`,
  `collabRecordingIdea`, `sharedSignal` (território em comum), `distinctSignals`
  (o ângulo novo que o outro traz).
- `ContentIdeaListItem` (em `contentIdeasReadService.ts`): a pauta — `title`,
  `territory`, `hook`, `angle`, `suggestedFormat`, `tone`, `whyItFits`,
  `resonanceNote`, `scriptPoints`, `status` ("active" | "saved").

---

## 3. Filosofia — decisões travadas (NÃO reverter)

Estas foram debatidas exaustivamente. São o que separa "app calmo" de "mais uma
máquina de ansiedade". Se algo no design colidir com isto, o design cede.

1. **SEM ranking, SEM placar, SEM contador público.** Nada de "quantos matches você
   tem", "pauta mais curtida", "top criadores". Comparar-se com outros é um gatilho de
   ansiedade que o produto existe pra dissolver.
2. **SEM streak / sequência de dias.** Nada que puna quem não abriu o app ontem.
3. **"Quero fazer", nunca "curtir".** O gesto positivo é adoção/intenção, não aprovação.
4. **Match por interesse paralelo, nunca convite→aceite.** Ninguém "convida" ninguém.
   Os dois expressam interesse de forma independente e o sistema casa quando bate.
   Isso elimina a posição constrangedora de recusar um pedido direto.
5. **A pauta é a MESMA para os dois lados.** Só o "por que combina com você" muda por
   pessoa. A ideia central que ambos vão gravar é uma só.
6. **A comemoração do match é GANHA, não fabricada.** Só acontece quando os dois mapas
   realmente combinam e os dois realmente quiseram. É o único momento "alto" da tela.
7. **Match é privado** entre os dois. Nada aparece publicamente. (Só o vídeo publicado,
   no futuro, poderia aparecer — fora do escopo deste brief.)
8. **Contato via Instagram.** O `username` (@) já é público no mídia kit. O CTA é
   "chamar no Instagram" (abre o DM). NÃO construir chat interno.
9. **Nada aparece se não existir de verdade.** Sem placeholder vazio. "Combinadas" só
   aparece se houver match; a pilha só aparece se houver candidato.
10. **Interesse expira sozinho** depois de algumas semanas se o outro lado nunca topar
    (o mapa muda; um match velho pode não fazer mais sentido).

---

## 4. A experiência gamificada (o coração deste redesign)

A diversão vem da **textura da interação**, não de mecânicas de vício. O modelo mental
é "o gostinho do Tinder" — mas curado, pequeno e sem estranhos.

### 4.1 Duas linguagens na tela

- **Pilha de swipe** = decisão a dois. Toda pauta que tem um criador compatível vira
  card arrastável (sem limite artificial de 3 — entra todo candidato de verdade).
  - Arrastar/botão **esquerda (X)** = "não agora" — silencioso, ninguém sabe, sem
    julgamento, sem rejeição visível.
  - Arrastar/botão **direita (coração)** = "quero fazer".
- **Lista** = ideia solo. Pautas sem par (natural numa base pequena) continuam como
  card de lista normal, sem swipe — não há segundo lado esperando resposta.

**Regra de ouro: uma decisão mora num lugar só.** Uma pauta que está na pilha (decisão
de collab em aberto) NÃO deve também aparecer com bloco "Collab sugerida" embutido no
feed. O bloco embutido no card só volta quando o match já está **combinado** (aí é
status, não decisão).

### 4.2 O toque no card abre a ficha completa

Tocar um card da pilha (sem arrastar) abre a `DiagnosticoIdeaDetailSheet` que já existe
— com hook, roteiro, "por que é a sua cara", e o bloco "Collab pra essa pauta"
(criador + `narrativeFitReason` + `collabRecordingIdea`). Dentro da ficha também deve
ser possível decidir (X / coração) — é a mesma ação da pilha.

### 4.3 A comemoração do match

Quando os dois topam a mesma pauta: momento de celebração caprichado, mas de bom gosto
(nada de confete exagerado). Movimento sutil, talvez um som leve. Copy calma e calorosa:
**"É um match — você e Marina, pela mesma pauta"**. CTA único: **"ver e chamar no
Instagram"**. Sem "parabéns!", sem hype de growth.

### 4.4 O ritmo (o "jogo" saudável)

Uma pilha pequena e curada que o criador "zera" — arrasta as poucas que chegaram, sente
que limpou (como terminar o Wordle do dia), e ela se renova depois. O motivo de voltar é
um ritual pessoal + a possível notícia de um match — nunca um número piscando cobrando.

---

## 5. Estrutura da tela (ordem vertical)

1. **Header** — título "Collabs" + selo/botão WhatsApp (existe hoje: "Alertas ativos"
   quando conectado; "Receber" quando não — free abre paywall).
2. **Fileira de criadores** (stories row) + "Descobrir" — existe hoje, mantém.
3. **Pilha de swipe** ("suas da semana") — LOGO ABAIXO das fotos, ACIMA do feed. Bloco
   curto, sem scroll pra ver. Card com território, título da pauta, "com [criador] —
   [ponto em comum]", e os dois botões (X / coração).
4. **Combinadas** — só se houver match. Fileira de avatares com selinho de check verde;
   toque leva à tela de "chamar no Instagram".
5. **Lista de pautas solo** — o feed de sempre, agora só com pautas sem par. Card de
   lista, bookmark, sem swipe.
6. **"Gerar novas pautas →"** — existe hoje, mantém.
7. **Tab bar** — Perfil · "+" · Collabs. Sem mudança.

---

## 6. Estados a cobrir

- **Free vs Pro.** Free vê a pilha com o criador "misterioso" (silhueta borrada + "?")
  e o coração abre o paywall (não roda o match — zero custo). Pro vê o match real.
  (Já existe o padrão `MysteryAvatar` / `CollabTeaser` no código.)
- **Sem mapa** (`map_incomplete`): estado que devolve ao Perfil ("suas pautas nascem do
  seu mapa"). Existe hoje.
- **Mapa pronto, sem pautas ainda**: convite calmo a gerar. Existe hoje.
- **Pilha vazia** (nenhum candidato no momento): estado calmo, não alarmante. Ex.:
  "Nenhuma collab combinando agora — geramos mais quando novos criadores entram."
- **Esperando o outro lado**: pautas onde só você topou. Podem viver numa mini-lista
  discreta ("aguardando o outro lado") — motivo de voltar sem pressão pro outro.
- **Loading** do match por-pauta: skeleton (existe hoje, `CollabRowSkeleton`).

---

## 7. Linguagem visual (do código atual — manter coerência)

- Fundo da página: branco `#ffffff`; cards no off-white quente `#fffaf7` (mesmo do card
  "Seu Mapa").
- Tinta/preto principal: `#18181b`. Roxo do collab: `#7c3aed` (e família violeta:
  `#ede9fe`, `#f5f3ff`, `#faf5ff`).
- Verde de "confirmado/reconhecimento": `#22c55e` / `#059669` / `#ecfdf5`.
- WhatsApp: verde `#25D366`, selo `#dcfce7`/`#15803d`.
- Título do header: Poppins, ~27px, peso 700, letter-spacing -0.5.
- Cards: raio 18–20px, sombra suave com hairline (sem borda dura).
- Sem métricas de audiência nos cards de criador (seguidores/views) — só fit narrativo.

---

## 8. O que muda por baixo (contrato de dados — fora do escopo visual, mas necessário saber)

- A pauta que entra na pilha precisa nascer pensando **nos dois mapas ao mesmo tempo**
  (hoje nasce do mapa de 1 criador com o 2º "colado" depois). Para o build da tela, o
  Fable pode assumir que cada card da pilha carrega: a pauta (`ContentIdeaListItem`) +
  o match (`NarrativeCollabMatch`) + o motivo do fit escrito para o viewer.
- Cada "quero fazer" é registrado como interesse do viewer naquela pauta+par. Match =
  os dois registraram. (Backend — não é trabalho de UI, mas a UI deve refletir os
  estados: aberto / esperando / combinado.)
- Aviso de match sai pelo canal WhatsApp existente ("Alertas ativos"). Só no match.

---

## 9. Guardrails finais (checklist antes de entregar)

- [ ] Nenhum número comparativo, ranking, streak ou contador público em lugar nenhum.
- [ ] Positivo é "quero fazer", nunca "curtir".
- [ ] "Não agora" é silencioso e sem peso — nunca comunica rejeição.
- [ ] Match é privado, celebrado, e leva ao Instagram (sem chat interno).
- [ ] Toque no card reusa a ficha `DiagnosticoIdeaDetailSheet` existente.
- [ ] Uma decisão mora num lugar só (pilha OU card, nunca duplicada).
- [ ] Seções que dependem de dado real somem quando não há dado (sem placeholder).
- [ ] Free vê teaser/misterioso; Pro vê o real. Paywall nos pontos certos.
- [ ] Tom calmo em toda copy. Nada de growth/hype.
```
