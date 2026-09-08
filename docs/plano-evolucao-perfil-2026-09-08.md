# Plano de melhorias da evolução do Perfil

Data: 08/09/2026. Status: **implementação local aplicada; publicação, recuperação paga e calibração longitudinal pendentes**.

Base: [auditoria da atualização do Perfil](auditoria-atualizacao-perfil-2026-09-08.md).

## Resultado esperado

A cada novo post, a criadora consegue perceber se ele chegou, se foi analisado e o que acrescentou à leitura do perfil. Quando o conteúdo confirma um padrão anterior, a tela explica essa continuidade. Quando revela uma mudança, ela aparece nos assuntos e recomendações, e pode gerar uma proposta de revisão da narrativa.

A identidade confirmada continua sob controle da criadora. O histórico de bons resultados permanece consultável. A leitura recente ganha espaço próprio e não precisa derrubar um vencedor antigo para ficar visível.

## As decisões propostas

| Parte do Perfil | Como deve funcionar |
| --- | --- |
| Saúde da atualização | Mostrar posts importados, analisados e pendentes, com datas reais de cada etapa |
| Novas publicações | Entrar na leitura descritiva depois de analisadas, inclusive durante a semana |
| Assuntos recentes | Refletir os últimos 28 dias, com frequência, recência e links de evidência |
| Padrões de desempenho | Usar os últimos 90 dias, comparações equivalentes e força de evidência explícita |
| Gancho | Separar exemplo vencedor do histórico, exemplo recente e mecanismo recorrente |
| Narrativa confirmada | Manter a frase; propor revisão quando novas evidências sustentarem uma mudança |
| Relatório semanal | Continuar identificado pela última semana fechada; não misturar resultados provisórios na mesma série |

As janelas e os cortes novos abaixo são propostas iniciais para piloto. Os testes de regressão garantem funcionamento; a calibração com dados reais decide se os cortes produzem recomendações úteis.

## Entrega 1 — Recuperar leituras e evitar nova acumulação

**Prioridade imediata.** Resolve posts importados que nunca chegam aos cards de cena, assunto e gancho.

1. Antes da execução, conferir o deployment ativo, os agendamentos e os limites configurados. O diagnóstico anterior verificou o banco e o código local; não substitui essa conferência operacional.
2. Verificar a disponibilidade atual dos provedores. A auditoria registrou falta de saldo; só iniciar recuperação paga depois de haver disponibilidade e orçamento definido pelo responsável. Nenhuma compra ou aumento de limite está incluído neste plano.
3. Levantar pendências por conta, idade do post, etapa, motivo e próxima tentativa. Separar classificação básica, leitura multimodal e atualização do mapa.
4. Recuperar em lotes: primeiro os últimos 14 dias, depois 28 e por fim o restante dos 90 dias. Distribuir vagas entre criadores, reservando capacidade para o passivo antigo não ficar permanentemente para trás.
5. Reutilizar extrações e checkpoints existentes. Persistir a evidência e a cena com consistência; tentativa repetida não deve pagar de novo por uma extração já aproveitável.
6. Acionar a leitura quando a classificação de um post novo terminar. Manter o cron como recuperação de falhas, não como única forma de descobrir trabalho novo.
7. Após salvar novas evidências, enfileirar a atualização do Perfil por criador, agrupando eventos próximos para evitar uma regeneração por post. Usar revisão da fonte e deduplicação para impedir que um job antigo sobrescreva um resultado mais recente.
8. Separar o enriquecimento pesado do mapa do worker de sincronização do Instagram. Uma falha ou demora do mapa não deve impedir a atualização dos cards.

**Meta operacional proposta:** com provedores disponíveis, analisar 95% dos posts elegíveis em até 24 horas após a importação; mostrar impedimento explícito nos demais. Medir separadamente o atraso entre publicação e importação. A sincronização atual de 12 horas não permite prometer atualização imediata após publicar.

**Aceite:** os sete posts da semana auditada da Juliete têm leitura persistida ou impedimento individual identificado; nenhuma pendência desaparece do painel por falta de saldo; repetição do job não duplica evidência nem pagamento. A recuperação completa dos 90 dias deve informar total restante e custo, sem exigir que todo o histórico termine antes de melhorar o perfil recente.

## Entrega 2 — Mostrar a atualização real

**Pode ser desenvolvida enquanto a disponibilidade do provedor é resolvida.** Deve sair antes de chamar os novos padrões de confiáveis.

Separar três informações:

- **Métricas sincronizadas:** última importação bem-sucedida dos números, com indicação de resultado parcial quando necessário.
- **Conteúdo analisado:** data da análise persistida e cobertura dos posts da janela indicada. A data sozinha não basta: analisar um vídeo antigo hoje não comprova que todos os recentes foram lidos.
- **Mapa revisado:** última revisão bem-sucedida do mapa, distinta de edição manual e de simples atualização de métricas.

Substituir a dependência de `Metric.updatedAt` como prova de análise. Os estados apresentados devem distinguir atualizado, em processamento, atrasado, temporariamente indisponível e sem posts elegíveis. Se o processamento terminar com itens incompatíveis, apresentar cobertura parcial e motivo; isso não equivale a ter analisado tudo.

Exemplo para o caso auditado: **“7 posts novos recebidos. A análise deles está atrasada; os padrões abaixo usam as leituras anteriores.”** O motivo técnico e financeiro fica na visão operacional, sem atribuir à assinatura da criadora um problema de saldo da D2C.

Cobertura deve existir por período — semana fechada, últimos 28 dias e 90 dias — e por capacidade: classificação, cena/visual e abertura. Foto sem áudio não entra como falha de transcrição; imagem pode ter abertura visual, identificada como tal. Campos ausentes devem diferenciar “não se aplica”, “não identificado” e “leitura pendente”.

O backend deve entregar o mesmo estado para computador e celular. Na tela, revalidar ao retornar ao foco e depois da conclusão de trabalho, com polling limitado apenas enquanto houver processamento. Não parar de atualizar apenas porque o relatório já tem um post.

**Aceite:** atualizar só os números não altera a data de análise; sete posts recentes sem cena não recebem estado de leitura atualizada; versões antigas do relatório exibem data desconhecida quando faltar evidência confiável, sem inventar migração histórica.

## Entrega 3 — Fazer os assuntos acompanharem o conteúdo recente

Criar uma leitura descritiva dos últimos 28 dias, independente do fechamento semanal. Novos posts podem acrescentar assuntos antes de terem métricas maduras para comparação de desempenho.

Regra inicial de seleção:

1. Considerar apenas assuntos sustentados por conteúdo efetivamente lido, com IDs de posts e data da ocorrência mais recente.
2. Contar cada post uma única vez por assunto. Normalizar equivalências já conhecidas; não unir temas diferentes só por compartilhar palavras.
3. Ordenar os assuntos recorrentes por quantidade de posts distintos e, em empate, ocorrência mais recente. Reservar até dois dos seis espaços da capa para assuntos que surgiram nos últimos sete dias; ocorrência única recebe a indicação “apareceu recentemente”. Preencher vagas restantes com a ordem geral.
4. Manter a lista completa de evidências separada da lista curta de exibição. Limite de seis chips não pode apagar o restante da análise.
5. Se não houver posts recentes lidos, mostrar explicitamente a última leitura disponível com seu período. Não apresentar assuntos antigos como atuais.

Para o aviso de assunto ausente, usar todas as evidências elegíveis do período e a cobertura. A frase deve ser **“Não identificado nos posts analisados deste período”**, sem concluir que a pessoa nunca falou do tema. Uma mudança na lista da capa não pode alterar esse diagnóstico.

**Aceite:** adicionar conteúdo recente lido pode mudar os assuntos mesmo com 12 assuntos antigos existentes; um assunto fora dos seis chips continua reconhecido na análise de ausência; um único tema novo aparece como observação, sem virar território ou narrativa automaticamente.

## Entrega 4 — Separar ganchos históricos de evolução recente

O card deve responder a três perguntas distintas, sem exigir três cards permanentes:

| Pergunta | Informação |
| --- | --- |
| Qual exemplo teve melhor resultado? | Melhor abertura dos 90 dias, com data, post de origem, métrica e tamanho da amostra |
| O que apareceu ou ganhou força recentemente? | Exemplo dos últimos 28 dias, comparado com os 28 anteriores quando houver base equivalente |
| Que jeito de começar se repetiu com bons resultados? | Mecanismo de abertura sustentado por posts distintos e pela política de evidência da entrega 5 |

Manter o detalhe histórico acessível. Se o vencedor for o mesmo, dizer **“Continua sendo seu melhor exemplo nos 90 dias”**. Se novos posts não alterarem a recomendação, mostrar quantos foram incorporados e a continuidade observada. Não inventar uma descoberta a cada atualização.

Antes de criar taxonomia ou leitura paga, avaliar o reaproveitamento de `hookPatternObservations`, das classificações existentes no relatório e das evidências de `PublishedContentEvidence`. Prefixos de texto usados em sinais de estilo não devem ser tratados automaticamente como mecanismos narrativos equivalentes. Registrar versão, fonte e confiança de qualquer agrupamento novo.

Quando houver apenas frase exata sem agrupamento confiável, mostrar “exemplo de abertura”. A mesma frase em dois posts pode contar como duas ocorrências verificadas, mas não permite inferir sozinha um mecanismo mais amplo. Abertura falada e título visual devem ter origem diferenciada.

Sem dados suficientes para comparar períodos, mostrar apenas os exemplos recentes e a limitação. Um resultado parcial não deve produzir seta de crescimento.

**Aceite:** o gancho antigo permanece consultável; um novo exemplo lido aparece no recorte recente mesmo sem ultrapassar o histórico; mecanismos repetidos contam posts distintos; a escolha e a ordem da capa usam a mesma política de pontuação do detalhe.

## Entrega 5 — Reduzir a certeza dos padrões e calibrar a comparação

Unificar os critérios usados pelo motor, pela capa, pelos detalhes e pelas barras de evolução. Substituir “regra” por **“padrão consistente”** apenas quando houver suporte; manter **“vale testar”** para hipóteses.

Critérios candidatos para o piloto, a validar retrospectivamente:

| Estado | Critério proposto |
| --- | --- |
| Ainda sem evidência | Falta comparação válida, leitura suficiente ou resultado acima da referência |
| Vale testar | Resultado promissor em amostra pequena, recente ou instável; exibir o número de posts |
| Padrão consistente | Ao menos 6 posts em 3 semanas distintas, índice mediano ≥ 1,20, vantagem em ao menos 2/3 das ocorrências comparáveis e ao menos 15 posts na referência |

Além desses cortes, exigir cobertura de ao menos 80% dos posts elegíveis na dimensão e na janela recente usada para afirmar consistência. Cobertura baixa permite apresentar evidências individuais, mas não promover o perfil como concluído. Essas condições não representam significância estatística comprovada; são hipóteses de política que precisam ser calibradas.

Comparação de desempenho:

- Separar vídeos de fotos/carrosséis quando a dimensão e os dados exigirem. Não atribuir a uma abertura falada o resultado de conteúdo sem fala.
- Fixar a métrica de comparação para o conjunto: usar compartilhamentos quando houver cobertura e referência válidas; caso contrário, escolher uma alternativa válida para todo o conjunto e identificá-la. Não misturar multiplicadores de métricas diferentes no mesmo ranking.
- Diferenciar ausência de métrica de zero. Referência zero ou amostra insuficiente não produz multiplicador.
- Para uma comparação de idade equivalente, testar snapshots em D7, usando o primeiro ponto entre 7 e 9 dias após publicação. Não inventar um ponto D7 para posts sem esse histórico. Enquanto a cobertura não sustentar essa comparação, manter o resultado acumulado identificado e sem promoção a padrão consistente.
- Resultados antes dessa idade podem aparecer como “em acompanhamento”; o reconhecimento de assuntos e cenas continua disponível.
- Verificar a estabilidade do achado ao retirar a semana de maior influência. Rebaixar a certeza se ela depender inteira de um período isolado.

Calibrar com criadores de volume baixo, médio e alto, contas com virais isolados, mudança de assunto, formatos mistos e cobertura incompleta. Usar snapshots realmente disponíveis no momento da previsão; métricas acumuladas de hoje não reproduzem o que se sabia meses atrás. Comparar decisões com períodos posteriores sem usar seus dados antecipadamente.

**Aceite:** três posts com 1% de vantagem não viram padrão consistente; um viral isolado não domina a recomendação firme; sinais com cobertura insuficiente permanecem provisórios; os critérios finais e suas limitações são registrados após o piloto.

## Entrega 6 — Permitir evolução do mapa com participação da criadora

Preservar a cadeia **asset → território → narrativa → pauta**. Assunto frequente não é automaticamente território, e narrativa continua sendo tensão ou missão, não resumo das legendas.

Criar propostas de mudança sustentadas por evidências, sem apagar a confirmação atual. Há lógica de reproposta em `mapConfirmationReproposalService`; a implementação deve integrá-la e corrigir seus limites, em vez de criar um segundo mecanismo independente.

Regras propostas:

- Salvar, ao confirmar, o valor e a revisão exatos que a criadora aceitou. Para confirmações antigas sem esse valor, registrar o mapa atual como referência de migração com origem explícita, sem atribuir a ele a data de uma aprovação antiga desconhecida.
- Separar **mapa confirmado** de **proposta pendente**. Uma divergência não deve rebaixar a confirmação e deixar outro enriquecimento sobrescrever a frase antes de a criadora decidir.
- Exigir duas leituras concordantes com evidência nova entre elas para firmar uma inferência não confirmada; repetir a análise do mesmo conjunto não conta duas vezes. A confirmação explícita continua sendo suficiente.
- Apresentar revisão quando a mudança tiver suporte em posts distintos e persistir entre leituras; parametrizar a cadência para criadores que postam pouco. Um vídeo isolado vira observação.
- Mostrar frase atual, sugestão, motivo e posts que a sustentam. Permitir aceitar, editar, manter atual ou revisar depois. A aceitação e suas evidências devem ser verificadas novamente se o mapa mudar durante a edição.
- Guardar candidatos novos mesmo quando o mapa atingir o limite visual. Os limites de exibição continuam; a proposta fica em “Sugestões para revisar”. Preservar escolhas existentes e remoções explícitas, com deduplicação e descarte controlado de candidatos não confirmados obsoletos.
- Registrar motivo e versão de propostas recusadas para não reapresentar a mesma sugestão a cada sincronização. Uma mudança material de evidência pode justificar outra proposta, explicada.
- Usar as evidências já extraídas como fonte preferencial. Enriquecer apenas quando houver mudança relevante de conteúdo; alteração de números não deve disparar nova análise narrativa paga.
- Persistir estado de tentativa, sucesso, falha e próxima tentativa do enriquecimento do mapa. Mostrar suas observações e data de revisão na tela correta.

**Aceite:** sete territórios detectados não causam perda do sétimo por limite de card; nenhum chip removido ressuscita; nenhuma proposta pendente altera o núcleo confirmado; a narrativa pode permanecer igual e a tela explicar que os novos posts a reforçam.

## Execução técnica e dependências

As unidades abaixo são propostas de mudanças revisáveis, não novas tarefas já criadas.

| Unidade | Escopo | Dependência |
| --- | --- | --- |
| A | Contrato de datas, cobertura por dimensão, estados de atualização e UI | Pode começar imediatamente |
| B | Encadeamento de jobs, recuperação idempotente, revisão de fontes e visibilidade operacional | Reutiliza o contrato A; execução paga depende da disponibilidade do provedor |
| C | Assuntos recentes e conjunto completo para análise de ausência | A e evidências disponíveis |
| D | Histórico e recorte recente de ganchos, origem por post | A/C; mecanismos consistentes dependem da política E |
| E | Comparação equivalente, política unificada de evidência e calibração | Cobertura suficiente da entrega B |
| F | Propostas de revisão do mapa, preservação das confirmações e candidatos | A/B e integração com confirmação existente |

Locais principais da implementação:

- `src/app/lib/creatorWeeklyReport/`: motor, contratos, seleção, estado de atualização e contexto dos padrões.
- `src/app/lib/relatorio/contentReadingState.ts` e workers de classificação/leitura: idempotência, motivo e conclusão por post.
- `src/app/lib/mapaSeed/`: enriquecimento, revisão de fontes, propostas e estabilidade.
- `src/app/models/`: extensão dos modelos vivos para metadados e propostas, quando necessária; evitar outro banco paralelo do perfil.
- `src/app/dashboard/boards/components/videoUpload/appPreview/`: experiência compartilhada de perfil, detalhe e narrativa.
- `src/app/dashboard/boards/videoUpload/mapConfirmationReproposalService.ts`: migração e integração da reproposta existente. Serviços novos de negócio ficam em `src/app/lib/`, não nesta pasta de tela.
- `src/app/api/worker/` e `src/app/api/cron/`: autenticação e delegação para serviços; processamento caro sempre pela fila.

Versionar o contrato novo e permitir leitura de payloads antigos. A revisão da fonte deve detectar mudanças de evidência, inclusão, exclusão e reclassificação, além de atualização de métricas; o maior `updatedAt` sozinho não é assinatura suficiente. Omitir informação desconhecida em vez de preenchê-la com a data da migração.

Manter a leitura durante a semana separada da série semanal. No piloto, calcular o candidato sem sobrescrever relatórios antigos. Adicionar versão da política ao contexto das barras e não traçar como evolução a diferença entre dois motores. Relatórios de reunião já fechados preservam seu retrato original.

Se uma flag ou variável nova for necessária, cadastrar `.env.local` e Vercel na mesma entrega. Evitar dependência operacional que exista só no ambiente de desenvolvimento.

## Validação e lançamento

### Cenários obrigatórios

| Cenário | Resultado esperado |
| --- | --- |
| Só números novos | Atualiza métricas, preserva data de análise |
| Sete posts sem cena e histórico antigo suficiente | Exibe atraso e cobertura recente incompleta |
| Provedor indisponível | Mantém histórico, explica atraso e conserva pendências |
| Assunto novo e lista antiga cheia | Mostra a evidência nova no recorte adequado |
| Assunto observado fora dos seis chips | Não afirma ausência com base na capa truncada |
| Gancho antigo ainda vencedor | Preserva o histórico e mostra a leitura dos novos posts |
| Novo post na semana corrente | Pode atualizar descrição recente; resultado ainda imaturo não vira padrão |
| Três posts com vantagem de 1% | Continua sem promoção a padrão consistente |
| Foto sem áudio | Não aparece como falha de transcrição |
| Narrativa confirmada com nova proposta | Mantém confirmação até decisão explícita |
| Dois workers terminam fora de ordem | Versão antiga não sobrescreve leitura mais nova |
| Reabertura do app e retorno ao foco | Mostra estado recente sem recarregamento manual obrigatório |
| Conta sem posts recentes ou com pouco histórico | Mostra período e limites, sem promessa de novidade |

1. Transformar as reproduções da auditoria em testes de regressão nos serviços e componentes responsáveis. Incluir os cenários de integração de fila e concorrência.
2. Validar o fluxo completo com dados controlados: importação → classificação → evidência → perfil → revisão da narrativa. Conferir computador e celular, rede e estados de erro.
3. Rodar testes focados, tipos e `npm run build` antes de enviar mudanças. Se prompts compartilhados de roteiro forem alterados, executar `npm run check:scripts-quality`. Atualizar cérebro e executar `npm run brain` se houver rota, modelo ou comando novo.
4. Usar o caso da Juliete como verificação de recuperação, mais um grupo de contas que represente os diferentes volumes e formatos. Não decidir a política só por uma conta.
5. Rodar política nova em paralelo, sem substituir a recomendação pública, por ao menos dois fechamentos semanais. Avaliar cobertura, estabilidade, escolhas explicáveis e casos em que a recomendação muda sem evidência nova.
6. Liberar primeiro datas/cobertura e seleção descritiva; depois ganchos/padrões calibrados e propostas do mapa. Falha na calibração não deve atrasar a correção do indicador falso de atualização.

### Indicadores de acompanhamento

- Tempo da publicação até importação e da importação até análise, com p50 e p95.
- Cobertura de 7/28/90 dias, por dimensão, e idade da pendência mais antiga.
- Falhas por motivo, custo por leitura aproveitada e repetições de extração paga.
- Tempo entre evidência salva e sua disponibilidade no Perfil.
- Quantidade de recomendações consistentes que mantêm vantagem no período seguinte.
- Taxa de propostas aceitas, editadas, mantidas e repetidas indevidamente.
- Reclamações de perfil parado e divergência entre estado da tela e estado real.

Troca de texto não é indicador de sucesso. O sucesso é incorporar nova evidência e explicar com precisão tanto mudança quanto continuidade.

### Reversão

Permitir desligar a nova política de seleção e de propostas preservando evidências, confirmações e edições da criadora. Manter a correção de datas e estados de atraso. Não apagar dados nem restaurar uma narrativa antiga por causa de reversão do motor. Pausar propostas novas se houver inconsistência, mantendo as decisões já tomadas.

## Critério de conclusão

O trabalho estará concluído quando uma publicação elegível percorrer todas as etapas com prazo e estado verificáveis, a tela refletir essa evidência, padrões fracos não receberem certeza excessiva e mudanças de identidade chegarem como propostas fundamentadas sob controle da criadora.

Este plano não executa recuperação, compra de saldo, alteração de conta, mudança de código de produção ou deployment.


## Registro da aplicação — 08/09/2026

Implementação na branch `codex/evolucao-perfil`. Não houve deployment, compra de saldo, reprocessamento pago ou alteração de dados de contas nesta tarefa.

| Entrega | Resultado no código |
| --- | --- |
| Recuperação | Classificação entrega o post à leitura; evidência salva enfileira Perfil e mapa. O cron recupera falhas de encadeamento. Os lotes priorizam 14 dias, reservam capacidade para 14–28 e para o passivo antigo e alternam criadores. |
| Atualização real | Contrato v2 separa importação, análise e revisão do mapa, com cobertura por período e abertura falada. Estado recente tem prioridade sobre a quantidade histórica. Foco e retorno ao app revalidam; polling tem limite. |
| Assuntos | Seleção descritiva de 28 dias inclui a semana corrente, reserva espaço para novidades e mantém o conjunto completo para análise de ausência. Evidências têm origem, frequência e data. |
| Ganchos | Histórico mantém data, origem e métrica; o recorte recente tem aberturas faladas e visuais. Mecanismos são agrupamentos descritivos versionados. A frequência entre dois períodos de 28 dias só aparece com cobertura suficiente; não é apresentada como ganho de desempenho. |
| Confiança | Uma métrica por ranking, comparação por formato, zero distinto de ausência e pontuação comum da capa e detalhe. Candidatos usam D7 real, cobertura, repetição em três semanas e estabilidade ao retirar semanas. **A promoção pública a consistente permanece desligada.** |
| Narrativa | Propostas preservam o núcleo existente, guardam candidatos além do limite de chips e respeitam remoções. Aceitar/editar valida a revisão e salva mapa e confirmação na mesma transação. Recusar fica registrado. Um núcleo vazio exige duas leituras com evidência nova para ser preenchido por inferência. |

Proteções adicionais: relatório usa assinatura das fontes e gravação condicional; conflitos não sobrescrevem a versão vencedora. O payload anterior é preservado na migração. O enriquecimento do Instagram fica em worker próprio, reutiliza cenas e checkpoints e registra tentativa/falha. Mudança apenas de números não altera sua revisão de conteúdo. O intervalo mínimo de 12 horas do mapa foi mantido; a leitura descritiva dos posts não depende dele. Confirmações legadas sem o texto exibido guardam referência com origem `migration`; decisões pela nova revisão guardam o texto efetivamente aceito.

### Conferência operacional

- Deployment de produção encontrado pronto: `dpl_3garEgt2pGXTuF8xiYH9VoMj5P1w`, criado em 07/09 às 23h44 de Brasília.
- Agendamentos de recuperação, cenas e relatório individual estão ativos. Foram encontrados dois agendamentos de sincronização do Instagram (diário e a cada 12 horas); não foram alterados nesta tarefa. A consolidação deve preservar a rotina de 12 horas durante o lançamento.
- Auditoria somente leitura às 00h57 de Brasília: Juliete com **0/7 leituras na semana fechada**, **6/32 em 28 dias** e **54/97 nos 90 dias corridos**. A pequena diferença em relação ao total da auditoria inicial vem do limite móvel de 90 dias, distinto da janela do relatório fechado.
- Os sete posts foram individualizados: quatro aguardam classificação; dois classificados aguardam leitura sob pausa do provedor; um tem tentativa adiada por falha temporária. O provedor global segue `paused/provider_balance`, com próxima tentativa registrada para 03h20 de Brasília. Essa data não comprova recuperação.
- Em amostra inicial de 12 outras contas, 11 têm pendências recentes e uma não tem posts elegíveis. A amostra serve para verificar comportamento e cobertura, **não valida a política de recomendações**.

Auditoria repetível, sem escrita e sem IA:

```bash
npm run audit:profile-evolution -- --user-id=69e8f96564be9f1592a5ca6e
npm run audit:profile-evolution -- --limit=12
```

O comando usa `.env.local`, lista cobertura, disponibilidade de D7, padrões candidatos e impedimentos por post da semana fechada. Relatórios das verificações locais ficaram em `tmp/profile-evolution-juliete.json` e `tmp/profile-evolution-cohort.json`.

### Validação e etapas restantes

- Testes de regressão dos serviços, filas, autenticação, conflitos e componentes: **228 testes em 28 suítes passaram**. Tipos, ESLint direto nos arquivos alterados e `npm run build` passaram. O lint integrado do Next ainda emite uma incompatibilidade preexistente de opções; a checagem direta do ESLint foi executada separadamente, sem erros.
- Navegador com dados fictícios: 390×844 e 1440×1000; datas/cobertura, histórico, proposta e edição. Um conflito 409 simulado mostrou o aviso e preservou a narrativa. A página temporária de teste foi removida.
- Ainda é necessário publicar a mudança para produzir efeito nas contas reais, restabelecer o provedor com orçamento autorizado e executar a recuperação. O fluxo com IA real e a meta de 95% em 24 horas não foram certificados com o provedor pausado.
- A calibração exige dois fechamentos futuros, uma amostra estratificada e resultado posterior ao momento da recomendação. Não habilitar `CONSISTENT_POLICY_VALIDATED` com base apenas nos testes unitários ou nesta amostra transversal.
- O lançamento deve seguir o faseamento acima. Em reversão, preservar evidências, confirmações, decisões de sugestões e a correção de datas; não restaurar mapas antigos a partir de payloads históricos.
