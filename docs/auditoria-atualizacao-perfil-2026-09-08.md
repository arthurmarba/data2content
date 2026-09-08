# Auditoria da atualização do Perfil — 08/09/2026

**Parecer: as regras ainda não são suficientes para apresentar um perfil que acompanha a evolução das publicações.** Há uma falha operacional de leitura, mecanismos que preservam conteúdo antigo e sinais de atualização que confundem sincronização de números com análise de conteúdo.

Não é necessário trocar a narrativa ou o gancho a cada publicação. É necessário incorporar os posts elegíveis, mostrar quando isso não aconteceu e distinguir o histórico que continua forte de uma mudança recente.

## Escopo e evidência

Revisão do código local no commit `8f82478d`, consultas somente leitura ao banco configurado pela aplicação e execução do motor de relatório em memória. Nenhuma alteração de conta, fila, saldo ou publicação em produção. O código do deployment ativo não foi comparado integralmente com esse commit; os relatórios efetivamente salvos no banco corroboram os principais comportamentos descritos.

A consulta do caso indicado pelo usuário foi feita em 08/09/2026, aproximadamente 00h02 de Brasília. Dados pessoais completos e credenciais não são reproduzidos aqui.

### Caso observado

- Conta ativa e Instagram conectado; tentativa de sincronização em 07/09 às 21h, marcada com sucesso, mas com aviso de erro de insights de uma mídia. As métricas recentes efetivamente chegaram.
- Última semana fechada: **31/08 a 06/09**, com **7 posts importados e nenhum com leitura de cena**.
- Janela de 90 dias do relatório: **98 posts, 54 com leitura de cena, cobertura de 55%**. Apesar de não ler nenhum post da última semana, o relatório está `ready`.
- O post mais recente com leitura de cena foi publicado em **25/08** e analisado em **25/08 às 21h20**. Há **13 posts posteriores sem essa leitura**.
- Quatro posts recentes estão com classificação pendente e a mensagem de saldo/quota de IA indisponível.
- O estado global `provider:gemini` registra **`paused`, motivo `provider_balance`**, às 21h20 de 07/09, com próxima tentativa às 03h20 de 08/09. Isso comprova o bloqueio atual; não prova sozinho a causa de toda a lacuna acumulada desde agosto.
- O mesmo texto de gancho aparece nos cinco relatórios salvos mais recentes, de W32 a W36. O multiplicador mudou de **8,2× para 6,0×**, mas o texto permaneceu. Portanto, houve recálculo dos números sem renovação equivalente das evidências de conteúdo.
- O mapa recebeu enriquecimento de Instagram pela última vez em **03/09 às 09h02**. A narrativa está marcada como confirmada desde **15/06**, o que aciona sua preservação automática. Não há histórico suficiente nesta consulta para afirmar que a redação atual é exatamente a mesma daquela confirmação.
- O mapa já tem seis territórios, seis temas e quatro narrativas adjacentes: todos no limite de adições. Os assets também excedem seu limite.

## Achados por prioridade

### P1 — Posts chegam, mas a análise que alimenta os cards não acompanha

Classificação básica, leitura multimodal e sincronização de métricas são etapas distintas. Estar `completed` na classificação básica não significa ter `sceneElements` com assunto, cena e abertura. No caso analisado, até posts classificados continuam sem essa leitura.

O cron `recover-content-intelligence` tenta recuperar classificações e cenas; há controle de pausa por saldo e limites de lote. A recuperação pode reenfileirar, mas não resolve indisponibilidade financeira do provedor. Forçar a geração do relatório apenas recalcula sobre a evidência disponível e não cria as leituras faltantes.

**Correção recomendada:** restabelecer a disponibilidade do provedor, recuperar primeiro o conteúdo recente pendente, conferir a persistência das cenas e só então regenerar o Perfil. Exibir cobertura de conteúdo recente e motivo de atraso. Tratar o orçamento e os limites de recuperação como capacidade que precisa acompanhar o volume de posts.

Fontes: `src/app/lib/relatorio/contentReadingState.ts`, `src/app/api/cron/recover-content-intelligence/route.ts`, `src/app/api/cron/weekly-scene-evaluation/route.ts`.

### P1 — A tela pode dizer que leu recentemente quando apenas os números mudaram

`CreatorWeeklyProfileExperience` passa `sourceMetricsUpdatedAt` como `lastReadAt`. Essa data vem do maior `Metric.updatedAt`, também alterado pela sincronização comum de números. O estado `ready` exige apenas 40% de cenas na janela inteira, sem requisito de cobertura da última semana. O aviso de pausa na capa considera cobrança do usuário e conexão Instagram, mas não a pausa do provedor de leitura.

A narrativa completa também recebe uma frase de atualização baseada na cobertura do relatório semanal, embora o mapa tenha data e processamento próprios. O texto promete ajuste a cada leitura, enquanto a narrativa confirmada está protegida.

**Correção recomendada:** separar “métricas sincronizadas”, “conteúdo analisado” e “mapa revisado”, cada um com a própria data. Se há posts recentes elegíveis sem análise, mostrar quantos faltam mesmo com histórico suficiente. Nunca usar cobertura histórica como prova de que a semana foi lida.

Fontes: `creatorWeeklyReport/engine.ts`, `CreatorWeeklyProfileExperience.tsx`, `ProfileNextStepField.tsx`, `ProfileNarrativeView.tsx`.

### P1 — Os assuntos visíveis favorecem o passado por ordem de seleção

O serviço ordena os posts por `postDate: 1`. O motor faz `Set` dos assuntos nessa ordem e guarda os primeiros 12. A identidade mostra só os primeiros seis. Não há ordenação por recência, frequência ou relevância nesse resumo.

Isso significa que posts novos podem estar lidos, ter assunto diferente e desempenho superior, e ainda assim não mudar os chips do perfil. A simulação reproduziu exatamente esse caso.

**Correção recomendada:** construir um resumo de assuntos recentes, com repetição e relevância, preservando o histórico em uma apresentação separada. Não usar a lista truncada destinada à capa como base para afirmar que um tema nunca apareceu: `subjectsNotSeen` recebe essa mesma amostra incompleta.

Fontes: `creatorWeeklyReport/service.ts`, `creatorWeeklyReport/engine.ts` (`observedSubjects`), `CreatorWeeklyProfileExperience.tsx` (`identitySubjects`), `ProfileNarrativeView.tsx`.

### P2 — O gancho é o maior resultado histórico, não um padrão recente aprendido

Os rankings de abertura usam frases exatas por post, com `nPosts: 1`, selecionadas em toda a janela de 90 dias. Não agrupam mecanismos de gancho nem incorporam recência. A capa reordena por multiplicador bruto e promove o maior acima de 1, ignorando a ponderação por amostra usada nos rankings agregados do motor.

É esperado que o mesmo vencedor histórico permaneça. No caso real, isso é agravado pela ausência de novos concorrentes lidos. Também não há aprendizagem de recorrência nesse card: mesmo repetir a mesma abertura em posts diferentes não aumenta seu `nPosts`.

**Correção recomendada:** manter o “melhor exemplo dos 90 dias” com data e post de origem e separar a evolução recente. Para chamar algo de padrão de gancho, agrupar mecanismos observados e validar repetição, não apenas copiar a abertura do post vencedor. Não alternar recomendações artificialmente para parecer atualizado.

Fontes: `creatorWeeklyReport/engine.ts` (`buildTextExtremesGroup`), `creatorWeeklyReport/patternHighlights.ts` (`bestPromotable`).

### P2 — A proteção do mapa também impede evolução sem proposta visível

Preservar narrativa confirmada é uma boa regra. O problema é a ausência de uma proposta clara de revisão na experiência atual quando o conteúdo diverge. O enriquecimento mantém a frase e registra divergências em `observacoes`; a tela de narrativa completa inspecionada não apresenta essas observações.

Além disso, `mergeEnrichmentArrays` preserva todos os itens existentes e bloqueia adições ao atingir o limite. No caso observado, o limite já foi atingido em várias seções. Isso torna o mapa antigo difícil de ampliar mesmo que a leitura identifique algo novo. A ordem dos antigos também permanece.

**Correção recomendada:** preservar escolhas confirmadas e propor mudanças sustentadas por posts identificáveis. Guardar candidatos fora do limite de exibição para revisão; não descartar evidência nova só porque o card está cheio. Não remover silenciosamente o que a pessoa declarou.

O enriquecimento de Instagram tem intervalo mínimo de 12 horas, mas isso não garante execução bem-sucedida a cada 12 horas. Seus erros são registrados e absorvidos, e não há nessa função estado persistido de falha/próxima tentativa. A causa específica de o mapa não enriquecer após 03/09 exige logs desse caminho; a pausa atual do Gemini não comprova esse motivo, pois o fluxo do mapa usa outros passos/provedores.

Fontes: `mapaSeed/coreStabilityLocks.ts`, `mapaSeed/enrichMapaSeedForUser.ts`, `mapaSeed/enrichMapaWithInstagram.ts`.

### P2 — “Regra” recebe certeza maior do que o cálculo sustenta

O critério de promoção é `index > 1`; o de “regra” é três posts. Uma simulação com três ocorrências e resultado **1,01×** já entrou como regra. A evidência considera quantidade, mas não dispersão, distribuição por semanas ou consistência recente. A capa usa o multiplicador bruto para selecionar o vencedor.

A comparação usa medianas de quantidades absolutas de compartilhamentos, depois salvamentos, depois visualizações. Não separa tipos de mídia nem compara os resultados na mesma idade de publicação. Isso não torna todos os achados inválidos, mas limita quanto se pode atribuir o resultado ao cenário, tom, objeto ou horário.

**Correção recomendada:** manter “vale testar” para sinais fracos e promover padrões só após repetição em períodos distintos, ganho material e consistência. Calibrar os cortes com retrospectivas reais; aumentar um número fixo sem validação não resolve. Comparar formatos e maturidade de métricas semelhantes quando disponíveis. Apresentar associação observada, sem prometer causalidade.

Fontes: `creatorWeeklyReport/engine.ts`, `creatorWeeklyReport/patternSections.ts`, `creatorWeeklyReport/patternHighlights.ts`.

## O que já está adequado

- Comparar com o histórico da própria conta, usando mediana, reduz a influência de um único viral na linha de base.
- Distinguir indício de recorrência é uma boa direção, embora os critérios de promoção precisem de ajuste.
- Preservar o núcleo confirmado e não inventar leitura quando faltam cenas são proteções úteis.
- Semana fechada é apropriada para a entrega semanal. O corte precisa continuar explícito; se o produto quiser evolução durante a semana, ela precisa ser uma leitura separada, com resultados ainda em maturação.

## Validação executada

**54 testes existentes passaram**, nas cinco suítes de motor, destaques, seções, travas do mapa e enriquecimento por Instagram. Isso comprova o comportamento previsto pelo código, não a qualidade da política de produto nem o funcionamento do provedor.

**Seis cenários adicionais executados em memória:**

1. Uma abertura nova, lida, elegível e mais forte muda o destaque: o motor não é um cache imutável.
2. Doze assuntos antigos ocultam um novo assunto lido mesmo com desempenho superior.
3. Histórico suficiente produz `ready` mesmo sem leitura do post recente.
4. Post da semana corrente é excluído do relatório da última semana fechada.
5. Três ocorrências com 1% de vantagem viram regra.
6. Seis territórios existentes impedem a adição de um novo.

Os relatórios históricos **salvos** foram consultados para confirmar a repetição do gancho. Também foram recalculadas quatro janelas em memória; essas simulações usam as métricas atuais, portanto não devem ser confundidas com reconstrução dos números disponíveis nas datas antigas.

## Ordem proposta para corrigir e aceitar

1. Recuperar disponibilidade e leituras faltantes. Aceite: todos os posts recentes elegíveis têm leitura ou motivo explícito de impedimento, sem sucesso aparente para falha de IA.
2. Corrigir datas e cobertura da tela. Aceite: sincronizar somente métricas não altera “última análise”; sete posts sem leitura aparecem como pendentes.
3. Corrigir seleção de assuntos. Aceite: uma mudança sustentada nos posts recentes aparece no resumo; ausência não é inferida a partir de uma lista truncada.
4. Separar histórico e evolução de ganchos/padrões. Aceite: vencedor antigo permanece identificável, mas não ocupa sozinho o espaço destinado às novidades.
5. Criar proposta de revisão do mapa e calibrar a força dos padrões. Aceite: confirmação do criador é preservada, candidatos novos sobrevivem ao limite visual e sinais mínimos não viram ordens firmes.

Esses itens são recomendações desta auditoria, ainda não implementadas.
