# Oferta de assinatura logo depois da narrativa

Plano de desenvolvimento — celular e computador.
Data: 18/08/2026

---

# Parte 1 — O plano em português simples

## O problema hoje

Quando alguém entra na D2C pela primeira vez, a gente pede uma coisa só: *"Qual é o seu Norte?"* — para quem você cria e o que quer provocar nessas pessoas. A pessoa escreve, aparece uma tela de "estamos organizando seus primeiros sinais", e ela cai direto dentro do aplicativo.

Só que, nesses poucos segundos, o sistema **já descobriu a narrativa da pessoa** — a frase que resume quem ela é como criadora. E hoje a gente simplesmente **não mostra essa frase**. Ela é calculada, guardada, e a pessoa entra no app sem nunca viver o momento "nossa, é isso mesmo, é assim que eu sou".

Esse é o momento mais forte do primeiro acesso e ele está sendo desperdiçado. É logo depois dele que nasce a pergunta certa na cabeça da pessoa: *"e agora, o que eu faço com isso?"* — que é exatamente onde a assinatura faz sentido.

Tem um segundo problema: **quem entra pelo computador não passa por nada disso.** O primeiro acesso guiado só acontece no celular. No computador a pessoa cai direto na tela principal, sem ser perguntada nada e sem receber narrativa nenhuma.

## O que vai mudar

O primeiro acesso passa a ter cinco momentos, iguais no celular e no computador:

1. **"Qual é o seu Norte?"** — a pergunta que já existe hoje.
2. **"Organizando seus primeiros sinais"** — a espera curta, que já existe hoje.
3. **A narrativa** — *tela nova*. A frase que resume a pessoa aparece em destaque, com dois ou três assuntos que ela pode ocupar. Embaixo, um aviso honesto: isso é uma primeira leitura, vai se afinar com o tempo. Um botão: **Continuar**.
4. **A assinatura** — *tela nova*. Aqui a gente explica o que o plano pago faz **com aquela narrativa específica** que acabou de aparecer: vira pauta, vira parceria com outros criadores, vira direção toda semana. Mostra o preço, mensal ou anual. Dois botões: **"Assinar e aprofundar meu mapa"** e **"Ver meu mapa primeiro"**.
5. **O aplicativo** — a pessoa chega no mapa dela, tendo assinado ou não.

## As regras que protegem a experiência

- **Quem já paga não vê a tela de assinatura.** Óbvio, mas precisa estar escrito.
- **Quem não respondeu a pergunta inicial não vê a tela de assinatura.** Sem narrativa, a oferta não teria em que se apoiar — seria vender no vazio.
- **A tela aparece uma vez só na vida.** Se a pessoa fechar, atualizar a página, voltar amanhã — ela não vê de novo. Ninguém é perseguido por uma tela de venda.
- **"Ver meu mapa primeiro" é uma saída de verdade.** Não é "pular", não é "fechar", não é um botãozinho escondido. A pessoa vai para o app, usa tudo que o plano gratuito oferece, e o convite para assinar continua ali disponível no perfil — calmo, sem alarme.
- **Se o sistema não conseguir gerar a narrativa** (acontece), as duas telas novas simplesmente não aparecem. A pessoa entra no app normalmente.

## Por que separar em duas telas em vez de uma

A tentação é juntar tudo: mostrar a narrativa e o preço na mesma tela. A gente não vai fazer isso.

A narrativa é um momento de autoconhecimento — a pessoa se vendo pela primeira vez. Se tiver um preço do lado, ela lê a frase desconfiada, achando que a frase foi escrita para vender. A frase perde a força e a venda perde a credibilidade junto. Uma tela para se ver, a tela seguinte para decidir.

## O computador

Em vez de construir um segundo primeiro-acesso só para computador (o dobro do trabalho, o dobro dos textos, o dobro dos erros), quem entra pela primeira vez no computador passa a ser levado para a mesma tela que o celular usa — ela já se adapta ao monitor. Um caminho só, um texto só.

## Ordem do trabalho e prazo

Cinco etapas, **cerca de 4 a 5 dias de trabalho** no total:

| Etapa | O que entrega | Tempo |
|---|---|---|
| 1 | Preparação por baixo: o sistema passa a saber se aquela pessoa deve ou não receber a oferta, e a guardar se já mostrou | meio dia |
| 2 | A tela da narrativa | 1 dia |
| 3 | A tela da assinatura, reaproveitando a tela de pagamento que já existe no site | 1 dia e meio |
| 4 | Computador entra no mesmo caminho + a volta depois do pagamento | meio dia |
| 5 | Testes, medição e liberação gradual | 1 dia |

Tudo entra com uma "chavinha" que a gente liga e desliga sem precisar de nova publicação: primeiro só para o time, depois metade das pessoas, depois todo mundo.

## Como saber se deu certo

- **O que queremos que suba:** quantas pessoas assinam já no primeiro dia.
- **O que não pode cair (mais importante que o de cima):** quantas pessoas terminam o primeiro acesso e chegam no mapa. Se a tela de venda espantar gente na porta de entrada, a gente perdeu — mesmo que o número de cliques em "assinar" tenha subido.
- **O que vamos observar com calma:** quantas das pessoas que clicaram "ver meu mapa primeiro" acabam assinando em 7 e em 30 dias. O "depois" precisa continuar funcionando; senão a gente só adiantou o incômodo.

## O que já está pronto e ninguém está usando

Vale dizer, porque encurta o trabalho: a tela de pagamento com os textos certos para o primeiro acesso **já foi construída** em algum momento e está desligada, sem nada apontando para ela. O cálculo de "quanto criadores parecidos com você cobram por uma publi" também está pronto e parado. Boa parte da etapa 3 é acender o que já existe, não construir do zero.

---

# Parte 2 — Para quem for implementar

---

## 1. Estado atual (o que já existe no código)

| Peça | Onde | Situação |
|---|---|---|
| Onboarding vivo (overlay) | `src/app/dashboard/boards/components/videoUpload/appPreview/MobileOnboardingFlow.tsx` | 2 estados: `north` (textarea "Qual é o seu Norte?") → `building` ("Organizando seus primeiros sinais") → fecha |
| Gate de primeiro acesso | `src/app/dashboard/boards/mobile-strategic-profile/page.tsx:410` (`needsOnboarding`) | `isNewUserForOnboarding && !onboardingCompletedAt` |
| Shell que hospeda o overlay | `DiagnosticoRealShellClient.tsx:2572` | mesmo shell em mobile (`/dashboard/boards/mobile-strategic-profile`) e desktop (`/dashboard/profile`, `surface="responsive"`) |
| Geração da narrativa | `POST /api/dashboard/mobile-strategic-profile/onboarding` → `seedMapaSeedFromPurpose` → **já devolve `seedSignal { label, territorios, temas, assets }`** | O cliente recebe a narrativa e **descarta a tela** — nunca mostra |
| Paywall | `openPaywallModal({ context })` → `PaywallModalProvider` → `BillingSubscribeModal` | Contexto `"onboarding"` **já existe** com copy ("Seu mapa é só o começo.") e CTA secundário "Explorar grátis primeiro" — **sem nenhum caller hoje** |
| Valor de publi por narrativa | `OnboardingValueBlock.tsx` + `/api/dashboard/pricing-stats/narrative-range` | Componente pronto, **órfão** (nenhum import de produção) |

**Os dois buracos:** (1) a narrativa é gerada e nunca é mostrada — o criador cai no perfil sem o momento "aqui está você"; (2) o desktop novo cai em `/dashboard` (`HomeClientPage` → boards) e **nunca vê o onboarding** — o gate só existe na rota de perfil.

---

## 2. Fluxo alvo (mobile e desktop, mesma superfície)

```
[login primeiro acesso]
      │
      ├─ mobile  → middleware já redireciona /dashboard → /dashboard/boards/mobile-strategic-profile
      └─ desktop → NOVO: /dashboard → redirect /dashboard/profile?onboarding=1
      │
      ▼
  1. NORTE            "Qual é o seu Norte?"            [existe]
        │ Criar meu primeiro mapa              └── Entrar sem preencher ─┐
        ▼                                                               │
  2. CONSTRUINDO      "Organizando seus primeiros sinais"  [existe]      │
        │ (POST /onboarding → seedSignal + elegibilidade)                │
        ▼                                                               │
  3. NARRATIVA  ★NOVO  "Sua narrativa inicial"                           │
        │  narrativa em destaque + 2–3 territórios                       │
        │  "É uma hipótese — ela se afina conforme você usa a D2C."      │
        │  [Continuar]                                                   │
        ▼                                                               │
     elegível? (free, sem skip, seedSignal != null, flag on)             │
        │ não ─────────────────────────────────────────────────┐        │
        ▼ sim                                                  │        │
  4. OFERTA     ★NOVO  "Seu mapa é só o começo."               │        │
        │  o que o Pro faz COM essa narrativa + faixa de publi  │        │
        │  preço/período (mensal ⇄ anual)                       │        │
        ├── [Assinar e aprofundar meu mapa] → checkout Stripe   │        │
        │        └── volta em /dashboard/profile?welcome=pro    │        │
        └── [Ver meu mapa primeiro]  ("ver depois")             │        │
                 │                                             │        │
                 ▼                                             ▼        ▼
  5. PERFIL / SEU MAPA — scroll até o card, `starterMapJustCreated` ativo
     + (se "ver depois") pendência calma no perfil: "Ativar o Pro" sempre disponível
```

**Regras de exibição da tela 4**
- Só para quem **não** é Pro/trial/admin (`accessState` / `planStatus`).
- Só quando existe narrativa: `skipped === false` **e** `seedSignal?.label` presente. Sem narrativa não há oferta — senão vira bait‑and‑switch (a oferta se apoia no que acabou de ser revelado).
- **No máximo uma vez por criador** (`onboardingOfferSeenAt`). Refresh no meio do fluxo não repete a tela; o convite volta como entrada calma no perfil, nunca como pop‑up recorrente.
- Falha da IA (`seedSignal === null`) → pula 3 e 4, vai direto ao mapa.

**"Ver depois" é honesto**: fecha o onboarding, leva ao mapa, e o convite passa a viver no perfil (`handleProfileUpgrade`, já existente) e no motor de recorrência semanal — sem repetir a tela.

---

## 3. Decisões de arquitetura

1. **Uma superfície de onboarding só.** Em vez de escrever um onboarding desktop, o desktop passa a usar a mesma rota (`/dashboard/profile`), que já renderiza o overlay em layout responsivo (`max-w-[680px]` centrado). Custo baixo, zero divergência de copy/telemetria.
2. **Revelação e oferta são telas separadas.** "Uma coisa de cada vez": a narrativa é autoconhecimento (Etapas 1–2 da jornada); o R$ é argumento de profundidade. Misturar as duas na mesma tela contamina a leitura da narrativa.
3. **Reaproveitar o motor de checkout, não duplicá‑lo.** Extrair o miolo de `BillingSubscribeModal` (preços, toggle mensal/anual, cupom, `POST` de checkout, tratamento de erro) para um `SubscribePlanPanel` compartilhado; o modal continua sendo o wrapper de sempre e o step 4 do onboarding é o segundo consumidor. **Não** abrir o modal por cima do overlay (`z-[200]` do overlay ganha do modal — colisão real de z-index).
4. **Elegibilidade decidida no servidor.** O `POST /onboarding` passa a devolver `offer: { eligible, reason }`. O cliente não recalcula plano.

---

## 4. Fases de implementação

### Fase 0 — Fundação (≈0,5 dia)
- `src/app/models/User.ts`: `onboardingOfferSeenAt?: Date`, `onboardingOfferDecision?: "subscribe" | "later" | null`.
- `src/lib/featureFlags.ts`: nova chave `onboarding.offer_after_narrative` (default `false`).
- `mobileNarrativeTelemetry.ts`: novos eventos no union type —
  `mobile_onboarding_narrative_revealed`, `mobile_onboarding_offer_viewed`,
  `mobile_onboarding_offer_subscribe_clicked`, `mobile_onboarding_offer_later_clicked`.
- `POST /api/dashboard/mobile-strategic-profile/onboarding`: incluir `offer: { eligible: boolean; reason: "eligible" | "already_pro" | "skipped" | "no_narrative" | "already_seen" }` no response (lê `planStatus`/`role` do usuário já carregado).

### Fase 1 — Tela 3: revelação da narrativa (≈1 dia)
- `MobileOnboardingFlow.tsx`: `FlowState` vira `"north" | "building" | "reveal" | "offer"`; guardar `seedSignal`/`offer` em estado ao invés de chamar `onComplete` direto.
- Nova view `reveal`: eyebrow "Primeira leitura", título "Sua narrativa inicial", `seedSignal.label` em destaque tipográfico, até 3 chips de território, nota de hipótese, CTA "Continuar" (e "Ver meu mapa" como saída silenciosa).
- `onComplete` só dispara ao sair da última tela — o payload continua o mesmo (`answers`, `seedSignal`, `skipped`), então `DiagnosticoRealShellClient` não muda.
- Telemetria: `mobile_onboarding_narrative_revealed`.

### Fase 2 — Tela 4: oferta (≈1,5 dia)
- Extrair `SubscribePlanPanel` de `BillingSubscribeModal.tsx` (preços, período, cupom, `startCheckout`) — modal e onboarding passam a consumir o mesmo componente; copy do contexto `"onboarding"` já existe em `PAYWALL_COPY`.
- View `offer` no overlay: título/benefícios ancorados **na narrativa recém‑revelada** + `OnboardingValueBlock` (tira o componente do limbo) com a faixa real de publi da coorte.
- CTA primário → checkout, com `sessionStorage[PAYWALL_RETURN_STORAGE_KEY] = "/dashboard/profile?welcome=pro"`.
- CTA secundário "Ver meu mapa primeiro" → `POST /api/onboarding/offer-decision { decision: "later" }` → `onComplete`.
- Marcar `onboardingOfferSeenAt` no primeiro render elegível (idempotente).

### Fase 3 — Paridade desktop (≈0,5 dia)
- `src/app/dashboard/page.tsx` (server component): se `isNewUserForOnboarding && !onboardingCompletedAt` → `redirect("/dashboard/profile?onboarding=1")`. Mesmo tratamento em `/dashboard/home` se ele for alcançável direto.
- Ajustes de layout do overlay em ≥1024px (o `d2c-mobile-app` já é responsivo; conferir respiro e largura da tela de oferta).
- Retorno pós‑checkout: `/dashboard/profile?welcome=pro` mostra o mapa com o estado Pro ativo (reusar `starterMapJustCreated` ou um aviso equivalente).

### Fase 4 — "Ver depois" com continuidade (≈0,5 dia)
- Perfil: quem decidiu `later` vê o convite calmo já existente (nada de novo pop‑up); usar `onboardingOfferDecision` para a copy ("Seu mapa está aqui. Quando quiser aprofundar…").
- `PATCH /api/dashboard/mobile-strategic-profile/onboarding-answers` passa a **devolver o `seedSignal`** (hoje ele é gerado e descartado) — assim quem declara o Norte depois, por "Meu Norte" (`DiagnosticoNorteView`), também recebe a revelação da narrativa e, se elegível, a mesma oferta.

### Fase 5 — Testes, telemetria e rollout (≈1 dia)
- `MobileOnboardingFlow.test.tsx`: revelação aparece com `seedSignal`; oferta só quando `offer.eligible`; `skip` não mostra nem revelação nem oferta; "ver depois" chama `onComplete` e registra decisão; falha da IA pula as duas telas.
- Teste do route handler: matriz de `offer.reason`.
- Playwright `jornada-novo-usuario`: mobile e desktop, capturando as duas telas novas.
- Rollout: flag off → interno → 50% → 100%.
- ⚠️ ~15 suítes de `appPreview` já quebravam no HEAD antes desta mudança — não confundir com regressão.

**Total estimado: 4–5 dias.**

---

## 5. Funil e métricas

`mobile_north_submitted` → `mobile_starter_map_created` → `mobile_onboarding_narrative_revealed` → `mobile_onboarding_offer_viewed` → `mobile_onboarding_offer_subscribe_clicked` → checkout iniciado → assinatura ativa.

- **Métrica primária:** assinaturas por criador novo em D0.
- **Guardrail (não pode cair):** `mobile_starter_map_viewed` / `mobile_north_submitted` — se a oferta derrubar a conclusão do onboarding, o funil piorou mesmo com mais cliques.
- **Métrica de paciência:** conversão em 7 e 30 dias de quem clicou "ver depois" — o "depois" precisa continuar convertendo, senão a tela só antecipou o atrito.

---

## 6. Copy proposta (pt‑BR)

**Tela 3 — narrativa**
- Eyebrow: `Primeira leitura`
- Título: `Sua narrativa inicial`
- Corpo: a narrativa (`seedSignal.label`), em destaque
- Nota: `É uma hipótese. Ela se afina conforme você cria — e conforme a D2C lê seu conteúdo.`
- CTA: `Continuar`

**Tela 4 — oferta**
- Título: `Seu mapa é só o começo.`
- Subtítulo: `Com o Pro, essa narrativa vira pautas, collabs e direção — semana após semana.`
- Benefícios: `Pautas que nascem do seu mapa` · `Collabs com criadores da mesma narrativa` · `Reunião ao vivo com análise e direção`
- CTA primário: `Assinar e aprofundar meu mapa`
- CTA secundário: `Ver meu mapa primeiro`  ← nunca "Pular" ou "Fechar"

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| Overlay `z-[200]` vs. modal de billing | Não abrir modal por cima: a oferta é um step do próprio overlay (`SubscribePlanPanel`) |
| Latência do LLM na geração da narrativa | Já coberta pela tela `building`; acima de ~8s, seguir para o mapa e oferecer depois |
| Oferta cedo demais derruba a ativação | Flag + guardrail de conclusão do onboarding; nunca exibir para quem pulou o Norte |
| Prometer o que o free não tem | Copy fala do que o Pro faz **com a narrativa já revelada**, sem prometer entrega imediata |
| Repetição da tela em refresh | `onboardingOfferSeenAt` gravado no primeiro render elegível |

---

## 8. Alinhamento com a jornada

A revelação fecha a Etapa 2 (narrativa central) — o momento em que o criador se vê pela primeira vez. A oferta entra logo depois porque é exatamente ali que a pergunta "e agora, o que eu faço com isso?" nasce; a assinatura é a resposta (Etapas 9–11: criação, collabs, monetização). A assinatura **não pula etapas** — desbloqueia profundidade conforme o mapa cresce.
