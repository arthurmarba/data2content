# QA — Jornada do Criador (Data2Content)

Roteiro de validação para testes pessoais em localhost + sessões com criadores reais.

> **Contexto:** O produto foi construído seguindo a ordem autoconhecimento → narrativa → criação → expansão → retenção. Este QA valida se essa ordem *é sentida* pelo criador — não apenas se funciona tecnicamente.

---

## 1. Smoke Check Técnico (localhost)

Execute antes de qualquer sessão com criador. Marca como ✅ quando passar.

### Onboarding e Primeiro Vídeo
- [ ] Usuário novo vê tela de boas-vindas sem diagnóstico
- [ ] Upload de vídeo completa e exibe tela de confirmação ("seu mapa está começando")
- [ ] Após análise, home exibe card de diagnóstico com status "1ª análise registrada"
- [ ] Perguntas do onboarding são salvas e aparecem editáveis em "O que você nos contou"

### Mapa e Confirmações
- [ ] Card de narrativa exibe sinal detectado após 1+ análise
- [ ] Botão de confirmar narrativa funciona e atualiza chip ✓ no home card
- [ ] Botão de confirmar territórios funciona
- [ ] Hipóteses mostram botão "Faz sentido para mim" e ficam marcadas após clique
- [ ] Formatos confirmáveis aparecem na view de execução e persistem

### Pautas (Criação)
- [ ] Sem mapa confirmado: card de pautas mostra "Confirmar mapa" como próximo passo
- [ ] Com mapa confirmado: botão "Gerar pautas" aparece e dispara geração
- [ ] Ideia gerada pode ser salva (status → "saved")
- [ ] Ideia salva aparece em "Minhas pautas" com tira de calendário de 7 dias
- [ ] Agendamento de data funciona e persiste
- [ ] "Já postei ✓" muda status para "posted" e some da lista ativa
- [ ] Cota esgotada (mês) exibe banner âmbar com data de reset

### Home e Ritual Diário
- [ ] Card "Seu mapa hoje" exibe estado correto para cada cenário:
  - Sem leituras → "Comece com uma leitura"
  - Com posts novos do Instagram → "Sua grade trouxe sinais novos"
  - Com pauta salva → "Sua próxima pauta já existe"
  - Mapa pronto sem pautas → "Seu mapa já pode virar conteúdo"
  - Mapa incompleto → "Falta uma confirmação"
- [ ] Badge numérico aparece no card do Instagram quando há posts novos
- [ ] Seção "Expansão" (marcas/collabs) fica bloqueada antes do mapa confirmado
- [ ] Após confirmar mapa, seção "Expansão" desbloqueia com marcas e collabs

### Instagram
- [ ] Modal "Instagram conectado ao seu mapa" aparece após conexão
- [ ] Botão "Voltar ao mapa" fecha o modal e retorna ao diagnóstico

### Resumo Semanal
- [ ] Endpoint GET `/api/cron/weekly-map-summary` em dev retorna `{ ok: true }`
- [ ] Após geração, card "Seu mapa esta semana" aparece no Diagnóstico Overview
- [ ] Card não aparece quando `weeklyMapSummary` é null

---

## 2. Roteiro de Sessão com Criador Real

### Perfil ideal para validação V1
- Cria conteúdo há pelo menos 6 meses (tem histórico)
- Não é especialista em marketing digital (não traz viés de métricas)
- Sente que "não sabe direito qual é o fio do seu conteúdo"

### Setup
1. Compartilhe localhost via ngrok ou Vercel preview
2. Peça para o criador navegar sem instrução ("exploração livre")
3. Observe sem intervir nos primeiros 5 minutos
4. Anote o que ele clica primeiro, o que ignora, onde trava

### Perguntas guia — fazer após a exploração

**Bloco 1 — Reconhecimento (mais importante)**
- "Em algum momento você sentiu que o produto entendeu algo sobre você?"
- "Se sim, o que foi? Se não, o que faltou?"
- "O texto que apareceu sobre sua narrativa parecia verdadeiro ou genérico?"

**Bloco 2 — Clareza de ação**
- "Você entendeu qual seria seu próximo conteúdo ao usar a plataforma?"
- "Teve algum momento em que você não soube o que fazer a seguir?"
- "O card 'Seu mapa hoje' ajudou ou confundiu?"

**Bloco 3 — Ansiedade e pressão**
- "A experiência reduziu ou aumentou sua ansiedade em relação a criar conteúdo?"
- "Alguma parte pareceu cobrar algo de você?"
- "Você se sentiu pressionado a confirmar algo antes de estar pronto?"

**Bloco 4 — Retenção**
- "Você voltaria amanhã? Por quê?"
- "O que faria você voltar toda semana?"
- "O resumo semanal do seu mapa seria útil para você? Como você usaria?"

**Bloco 5 — Ordem da jornada**
- "As recomendações de marcas e collabs apareceram no momento certo, ou cedo demais?"
- "Você entendeu por que algumas seções estavam bloqueadas?"
- "Faltou algo que você esperava ver mais cedo?"

---

## 3. Sinais de Alerta Durante a Sessão

Pare e anote se o criador disser ou fizer:

| Sinal | O que significa |
|-------|----------------|
| "Isso parece uma planilha" | Home ainda está pesada demais — reduzir |
| "Não entendi o que confirmar" | Copy de confirmação não está claro |
| "Quando aparecem as marcas?" | Gate de expansão não está comunicando o motivo |
| "Isso é como o Instagram Insights" | Estamos tratando dados como métricas, não como narrativa |
| "Não tenho mais nada para fazer aqui" | Ritual diário não está dando motivo de retorno |
| Scrollou rápido pelo card "Seu mapa hoje" | Card não está atraindo atenção suficiente |
| Clicou em marcas/collabs antes da narrativa | Hierarquia da home não está guiando a jornada |

---

## 4. O Que Fazer Com o Feedback

### Se "não me senti reconhecido"
→ Problema na análise de vídeo ou na copy de espelho. Revisar `diagnosticoDisplayText.ts` e os textos gerados pelo Gemini.

### Se "não entendi o próximo passo"
→ `nextContentCard` ou `dailyRitual` com estado incorreto. Verificar qual estado o usuário estava e o que foi exibido.

### Se "apareceu cedo demais" (marcas/collabs)
→ Revisar lógica `isMapConfirmed` em `DiagnosticoPage.tsx` — verificar se as condições estão corretas para o perfil do criador testado.

### Se "não voltaria"
→ O ritual diário não entregou valor naquela sessão. Verificar qual dos 6 estados do `dailyRitual` foi exibido e se a copy estava correta para o momento do criador.

---

## 5. Critério de Aprovação para Lançamento Público

O produto está pronto para lançamento quando, em pelo menos 3 sessões com criadores reais:

- [ ] **2 de 3** dizem "senti que entendeu algo sobre mim" no Bloco 1
- [ ] **2 de 3** conseguem identificar o próximo conteúdo sem ajuda
- [ ] **2 de 3** dizem que voltariam (Bloco 4)
- [ ] **0 de 3** descrevem a experiência com palavras de métricas ("alcance", "engajamento", "algoritmo")
- [ ] Nenhum sinal de alerta crítico sem solução conhecida

---

*Última atualização: maio 2026 — pós-implementação Fases 1–D*
