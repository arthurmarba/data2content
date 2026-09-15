# Próxima etapa: fala sem duplicação nas leituras do Gemini

Planejamento em 14/09/2026. Não autoriza experimento pago, migração histórica ou deploy por si só.

## Objetivo e escopo

Reduzir o custo por leitura útil de vídeos publicados, preservando a transcrição,
as descrições de cena e os dados usados no mapa, relatório e roteiros. Manter modelo,
resolução e profundidade da análise. R$ 8/dia é referência de acompanhamento, sem
bloqueio fixo de crescimento; não há cota por criador definida.

A etapa anterior está implementada e validada localmente, sem publicação nesta
conversa. Antes de medir impacto em produção, revisar o conjunto de mudanças e
publicá-lo em uma liberação identificável. Separar essa medição da mudança de prompt.

Não incluir nesta etapa Batch API, modelo mais barato, leitura básica/aprofundada,
fotos/carrosséis ou nova geração automática de roteiros. São experiências distintas.

## Problema confirmado no código

O prompt de `relatorio/sceneEvaluation.ts` pede a fala integral em `transcricao`,
novamente em `segmentos` e também em `cenas[].fala`. Há ainda citações e frase de
abertura. O objetivo é eliminar principalmente a repetição integral, não economizar
algumas palavras à custa de perder a seleção editorial das citações.

`publishedContentEvidence.ts` e os consumidores recebem transcrição, segmentos e
timeline. Preservar esse contrato usando um adaptador local: a mudança fica no
formato que pedimos ao provedor, não no significado do dado entregue ao produto.

## Ordem de implementação

### 1. Estabelecer a referência de custo e qualidade

- Confirmar publicação da proteção anterior e sua cobertura nas chamadas reais.
- Usar comprovantes de operações como fonte principal; logs antigos sem identidade
  de conteúdo não demonstram repetição apenas por terem tokens iguais.
- Registrar entrada, saída, raciocínio, motivo de encerramento, duração do vídeo,
  completude e custo estimado com tarifas datadas. Não tratar preço/uso ausente como zero.
- Separar vídeos com fala, sem fala, falhas, respostas parciais e leituras completas.
- O indicador principal é gasto total das tentativas dividido por leituras úteis;
  publicar também custo por leitura completa e taxa de cobertura. Economia por
  desistência ou perda de informação não conta como sucesso.

### 2. Criar o formato compacto e o adaptador

- Pedir uma única sequência de segmentos com ID, início, fim e texto literal.
- Montar `transcript` pela concatenação ordenada desses segmentos, sem nova IA.
- Pedir cenas com descrição visual e referências aos segmentos de fala; preservar
  descrição, texto na tela, cenário, objetos, enquadramento e papel narrativo.
- Definir segmentos curtos por frase/unidade de fala. Uma cena pode compartilhar um
  segmento quando uma frase atravessar o corte; não inventar palavras nem tempos.
- Construir `sceneTimeline[].spokenText` pelas referências, sem exigir que o Gemini
  transcreva novamente. Validar referências inexistentes, duplicadas e fora de ordem.
- Manter inicialmente as citações curtas e a frase de abertura: sua seleção tem
  valor editorial e sua contribuição de custo deve ser medida antes de removê-las.
- Separar o formato de vídeo do de fotos/carrosséis, pois hoje ambos usam `buildPrompt`.
- Aceitar respostas antigas no adaptador. Gravar versão do formato solicitado no
  comprovante, mantendo leitores compatíveis com os dados já salvos.
- Não incrementar a revisão que torna o histórico elegível a releitura. A identidade
  da operação por post continua protegida; mudança de prompt não libera novo pagamento.
- Usar formato explícito no comprovante para escolher o parser em uma recuperação;
  não depender do prompt atualmente ativo para interpretar a resposta antiga.

### 3. Corrigir a verificação de completude

Hoje `transcriptQuality.ts` compara a transcrição com os segmentos. Se o código passa
a montar uma a partir dos outros, essa igualdade vira consequência da implementação,
não prova de que a fala foi capturada integralmente.

- Separar consistência interna de fidelidade ao áudio; não declarar integralidade
  apenas porque concatenação e segmentos coincidem.
- Conservar a informação de resposta cortada. Campos recuperados continuam parciais.
- Validar tempos finitos, positivos quando aplicável, ordenação, duração e referências.
- Tratar silêncio e ausência de fala como casos válidos. Cobrir 90% da duração total
  não é requisito universal: vídeos podem ter trechos longos sem ninguém falar.
- Não trocar essa regra por outra promessa automática de fidelidade. Guardar o que
  foi verificado estruturalmente e deixar explícito o que não foi conferido no áudio.
- Conferir efeitos no seletor de evidências e no DNA: a nova marcação não pode
  promover fala incompleta nem excluir em massa evidências válidas por mudança de regra.

### 4. Comparar numa amostra controlada

- Começar com 30 vídeos variados: curtos/longos, fala rápida/lenta, silêncio,
  música, cortes de cena, fala atravessando cortes e exemplos que já falharam.
- Comparar os dois formatos com o mesmo modelo, configuração e contexto congelado.
  Reaproveitar a resposta antiga apenas quando for uma referência comparável.
- Experimentos têm identidade própria, sem apagar o bloqueio do conteúdo nem
  substituir a evidência de produção. No máximo uma solicitação por variante/item;
  falha não dá origem a repetição automática ou terceiro avaliador pago.
- Antes de executar, estimar o custo total da amostra e definir limite específico
  para o experimento. R$ 8 é uma proposta inicial para esse limite, não garantia de
  que 30 pares caibam; reduzir a amostra se necessário. Nenhuma chamada nesta fase de plano.
- Revisar contra o áudio, sem mostrar ao avaliador qual formato produziu cada texto.
  A transcrição antiga não é a verdade de referência.
- Verificar omissões, palavras inventadas, nomes/números/negações, abertura/CTA,
  vínculo de fala com cena e preservação dos dados visuais.
- Conferir os pacotes de evidência para roteiros e relatório sem pagar novas gerações
  de roteiro por padrão. O benchmark automatizado complementa a revisão, não a substitui.

### 5. Liberar progressivamente

- Começar por 10% dos novos vídeos, com seleção estável e versões rastreáveis;
  avançar para 50% e 100% apenas após volume suficiente e revisão dos indicadores.
- Nenhum processamento duplo em produção. Cada post recebe somente uma variante.
- Controlar o piloto por configuração persistida, com possibilidade de voltar ao
  formato anterior para novos trabalhos. Operações já iniciadas preservam sua variante.
- Reverter a seleção não apaga comprovantes, não repaga vídeos já analisados e não
  muda a interpretação das respostas salvas.

## Critérios de aprovação

Metas de engenharia propostas, a validar com a referência; não são projeções de economia:

| Aspecto | Critério |
| --- | --- |
| Economia | Buscar pelo menos 20% menos tokens de saída e 10% menos custo total por leitura útil na amostra comparável. Se a entrada dominar o custo, revisar o ganho antes de ampliar. |
| Fidelidade | Nenhuma nova omissão/invenção crítica na amostra revisada; comparar taxa de erros com o áudio, não apenas com a resposta antiga. |
| Cobertura | Sem queda observada de leituras úteis ou completas na amostra; ampliar a avaliação se o resultado for inconclusivo. |
| Dados visuais | Preservar descrição, texto em tela, objetos, temas e papéis usados pelo produto. |
| Recuperação | Uma chamada por variante/item; resposta salva recuperável com seu parser correto. |
| Compatibilidade | Dados antigos, novos e parciais continuam consumíveis sem releitura histórica. |

Trinta vídeos servem como triagem, não comprovação estatística de equivalência. A
liberação gradual deve confirmar custo e qualidade num volume maior. As economias
da proteção anterior e do novo formato devem ser medidas separadamente.

## Validação e entregáveis

Testar adaptador, referências de segmentos, frases atravessando cenas, silêncio,
resposta cortada, checkpoint antigo/novo, mudança de variante durante recuperação,
contrato da evidência e seleção para roteiros. Rodar `npm run check:scripts-quality`
antes da mudança para referência e depois para comparação, além dos testes afetados
e `npm run build`. Atualizar o cérebro quando a implementação estiver validada.

Entregar: formato compacto, adaptador compatível, verificação de qualidade ajustada,
relatório da comparação com custos/limitações, controle de liberação e procedimento
de reversão. Sem ganho comprovado, manter o formato atual e avaliar Batch API como
experimento seguinte, separado da simplificação da resposta.
