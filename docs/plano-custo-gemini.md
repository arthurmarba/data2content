# Plano de custo do Gemini

Planejamento em 15/09/2026. Consolida o que foi medido entre 14 e 15/09 e ordena as
frentes por retorno e risco. Não autoriza troca de modelo, lote ou deploy por si só.
Detalhes técnicos das frentes de lote e formato ficam em
[plano-lote-gemini.md](plano-lote-gemini.md) e
[plano-eficiencia-gemini-etapa-2.md](plano-eficiencia-gemini-etapa-2.md).

## Objetivo

Custo de IA que não cresça junto com a base: medir e baixar o **custo por criador
por mês**, sem piorar o que o produto mostra (mapa, relatório semanal, roteiros).
Referência de acompanhamento: R$ 8/dia, sem bloqueio de crescimento.

## Onde estamos

| | Valor | Observação |
| --- | --- | --- |
| Gasto na semana até 14/09 | US$ 16,34 | 45 assinantes conectados ≈ US$ 0,36 por criador por semana |
| Leitura de vídeo/foto publicada (`cena`, gemini-2.5-flash) | 71% | ~US$ 0,012 por leitura saudável |
| Mapa (`llm`, gemini-3.7-flash) | 25% | enriquecimento, limpeza e leitura de legendas |
| Resto (roteiros, comunidade, classificação) | 4% | roteiros ficam em tempo real |

Essa semana inclui desperdícios corrigidos e publicados em 15/09 (commit `0fbcca86`):
vídeo em loop relido a cada 6 h, mapa cortado pelo raciocínio do Gemini 3 e repetido,
nova tentativa paga após falha. A base real depois das correções será medida em
17/09 (tarefa agendada `medir-custo-gemini-pos-deploy`).

## O que já foi testado e descartado

| Ideia | Resultado | Decisão |
| --- | --- | --- |
| Fala escrita uma vez só (`scene_segments_v1`) | −0,7% de resposta em 15 pares; vídeo longo desanda | Mantido em 0% |
| JSON sem indentação | −11% de resposta, mas mudou elementos do mapa e perdeu fala | Desfeito |
| Lote no gemini-2.5-flash | Recusado pela API nesta conta (code 5) | Retestar mensalmente |
| gemini-3.5-flash-lite | 12 elementos do mapa divergentes em 13 vídeos; inventa presença | Descartado |

## Decidido em 18/09/2026

Saldo recarregado. Política escolhida pelo Arthur: **ler os posts novos daqui para
frente e recuperar o atraso acumulado** (sem backfill além de 90 dias), e **ler os 30
posts mais recentes sempre que um criador conectar o Instagram**.

Retrato do atraso no dia: 2.702 posts de 90 dias dos 46 assinantes elegíveis, 1.661 sem
leitura — dos quais 443 são reels que o Instagram não entrega (áudio protegido, ver
`brain/30 Armadilhas/Reel com áudio protegido não devolve o vídeo.md`). Sobram ~1.220
legíveis, ~US$ 15 para zerar. A pausa por saldo tinha represado 623 leituras.

Aplicado:

- Pausa do provedor liberada e as leituras adiadas por saldo devolvidas à fila.
- Repescagem passou de 40 para 150 posts a cada 6 h (`INTELLIGENCE_RECOVERY_SCENE_LIMIT`
  continua mandando): o atraso legível some em ~2 dias em vez de ~8.
- Conexão nova enfileira a leitura dos 30 posts mais recentes na hora
  (`enqueueOnboardingReadings`, chamada pelo worker de refresh quando o motivo é
  `conexao`), em vez de esperar a repescagem.

## Mapa: medido e adotado em 18/09/2026

Experimento com 10 criadores reais, mesma pergunta e mesma temperatura, padrões do
Instagram vindos de checkpoints já pagos (`scripts/compareMapaThinking.ts`, 80 chamadas,
~R$ 1,20). Divergência = chip presente numa resposta e ausente na outra.

| Variante | Entrada/chamada | Raciocínio | Ruído entre execuções | Tom igual ao original |
| --- | --- | --- | --- | --- |
| Produção anterior (mapa inteiro, raciocínio médio) | 19,4 mil | 915 | 15 | referência |
| Sem o campo `suggestions` | 2,9 mil | 0 | 113 | 1/10 |
| Só a âncora (seção, texto, estado) | 3,2 mil | 0 | 49 | 7/10 |
| **Âncora + "repita a redação já proposta"** | **3,3 mil** | **0** | **9** | **9/10** |

Duas lições: o histórico de sugestões era 96% da entrada (33.736 de 35.043 caracteres),
e ele não estava lá à toa — **o texto já proposto ancora a redação dos chips**. Cortar o
campo inteiro deixou a resposta 7× mais instável, o que encheria a fila do criador de
quase-duplicatas. Mandar só a âncora e pedir explicitamente para repetir a redação
resolve os dois lados.

Adotado: âncora enxuta, instrução de redação e `thinkingLevel: "low"` no
enriquecimento. Custo da chamada: **US$ 0,0197 → US$ 0,0042 (−79%)**, sem perda de
conteúdo (311 chips contra 315).

Também etiquetada a classificação de texto (`classificacao_texto`): eram 198 chamadas
por dia escondidas dentro de "llm" no registro de uso.

## Frentes, em ordem

### 0. Medir a base (17/09, sem custo)
Custo por dia e por fluxo depois das correções; leituras por criador; chamadas do
mapa por criador por dia. **Tudo abaixo é recalibrado com esse número.**

### 1. Mapa: rodar só quando houver novidade (sem mudar qualidade)
Hoje o enriquecimento é enfileirado a cada leitura concluída e pela repescagem de 6 h
para todos os assinantes; a revisão muda a cada leitura nova. Proposta: juntar as
leituras do dia e enriquecer no máximo 1 vez por dia por criador, e só se entraram
leituras com assuntos/tons/objetos novos. Medir antes chamadas por criador/dia.
Potencial: boa parte dos 25% do mapa. Risco: mapa atualiza até 1 dia depois.

### 2. Repostagem de reels de teste (sem mudar qualidade)
12% dos reels de 90 dias têm um gêmeo do mesmo criador (mesma duração). Confirmar pela
legenda não genérica ou pelo áudio dos 10 s iniciais antes de copiar a leitura.
Potencial: até ~10% da leitura de vídeo, e padrões do relatório menos inflados.
Ver `brain/30 Armadilhas/Reel repostado é lido e contado de novo.md`.

### 3. Modelo mais barato para a leitura de vídeo (com teste de qualidade)
gemini-3.1-flash-lite, chamada normal, 13 Reels: 5 elementos do mapa divergentes
(régua do 2.5 contra ele mesmo: 1), tom igual em 62% (régua: 100%), fala 0,84 (0,93).
Os modelos 3 leem vídeo a 70 tokens por quadro por padrão. Próximo passo: mesmo teste
em resolução alta (~R$ 0,60). Aprovar só se ficar perto da régua.
Potencial: ~US$ 0,007 por leitura normal (−40%); habilita a frente 4.

### 4. Lote pela metade do preço (depende da 3)
Medido: lote com vídeo levou 5 h e 18,8 h. Regras: arquivos da Files API vivos até
o job terminar; posts da semana corrente saem do lote no sábado às 18:00 para não
furar o fechamento de segunda 01:00; liberação por flag. Potencial: −50% sobre a
leitura que for para lote. Detalhes em [plano-lote-gemini.md](plano-lote-gemini.md).

### 5. Proteção para escalar
- Custo por criador por mês e por fluxo no painel admin (dados de `gemini_operations`
  e `geminiusagelogs`).
- Alerta, não bloqueio, quando o dia passar da referência ou uma leitura passar de
  16 mil tokens de resposta (sinal de loop).
- Retestar lote no gemini-2.5-flash todo mês; se voltar, a frente 4 dispensa troca
  de modelo.

## Projeção (hipótese a confirmar com a base de 17/09)

| Cenário | Leitura de vídeo | Mapa | Total estimado |
| --- | --- | --- | --- |
| Só correções já publicadas | ? | ? | medir em 17/09 |
| + frentes 1 e 2 | −10% | −40 a −60% | −15 a −25% |
| + frente 3 aprovada | −45% | igual | −40 a −50% |
| + frente 4 (lote) | −70% | igual | −55 a −65% |

## Decisões que dependem do Arthur

1. Aceitar que o mapa atualize até 1 dia depois (frente 1).
2. Critério de qualidade para trocar de modelo (frente 3): proposta = no máximo 2
   elementos do mapa divergentes em 13 vídeos e nenhuma fala perdida.
3. Aceitar leitura de post publicado em até ~1 dia (frente 4).

## Ordem de execução

17/09 medir → frente 1 → teste da frente 3 em resolução alta → frente 2 → frente 4
(se a 3 passar) → frente 5 em paralelo.
