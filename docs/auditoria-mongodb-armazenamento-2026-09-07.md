# Avaliação de armazenamento do MongoDB Atlas — 07/09/2026

Avaliação inicial realizada entre 21h06 e 21h11 de 07/09/2026, horário de Brasília (08/09 em UTC), somente com leituras. A execução posterior autorizada por Arthur está registrada abaixo.

## Limpeza executada e verificada

Em 07/09/2026, após autorização explícita de Arthur, a execução iniciada às 21h29 e concluída às 21h35 removeu:

- **129.238 snapshots / 81,03 MB**, anteriores a oito meses, preservando a referência de cada post.
- **51 PDFs vencidos / 70,29 MB**.
- **Total: 151,32 MB em documentos BSON**.

Permaneceram os **178.991 snapshots dentro da janela**, as **7.321 referências anteriores**, os **35.588 posts** e os **554 usuários**. Nenhuma outra coleção foi alvo de exclusão. A reexecução em simulação às 21h46 encontrou **zero snapshots e zero PDFs elegíveis**; nenhum registro alterado concorrentemente precisou ser excluído ou ignorado na execução inicial.

O índice `mediakitpdfcaches.expiresAt_1` foi convertido com `collMod` e conferido com `expireAfterSeconds: 0`: os PDFs passam a expirar automaticamente no MongoDB. A declaração duplicada do índice foi removida do modelo no código local; essa mudança de código não foi publicada, mas a correção do índice real já está aplicada.

Às 21h51, a ocupação lógica de dados + índices dos bancos `data2content` e `test` foi de **392,35 MB**, comparada com aproximadamente **517,3 MB** antes da limpeza: redução líquida observada de cerca de **125 MB / 24%**. Os índices cresceram durante as exclusões e continuaram alocados; portanto, a projeção anterior de 366 MB, que mantinha o tamanho dos índices constante, não se realizou nesta medição. Não foram removidos/recriados índices de snapshots nem executada compactação. O espaço físico em disco é outra medida.

Recuperação local: `output/mongodb-maintenance/2026-09-08T00-29-20-344Z-2945/`. A cópia `snapshots-removiveis.ejsonl.gz` tem **8.422.410 bytes**, contém os **129.238 documentos** e foi gravada, sincronizada a disco e lida integralmente antes das exclusões. SHA-256: `7a50162802218db2679fd46865e7d40ff666a171e84c38d8d740d6e554e93403`. O arquivo `resultado.json` registra os volumes e a verificação. Não apagar essa pasta se for necessário conservar possibilidade de recuperação.

A automação **Retenção diária do MongoDB**, ID `reten-o-di-ria-do-mongodb`, está **ativa diariamente às 10h**, no horário local desta configuração (São Paulo). Executa o comando de manutenção neste projeto com a mesma política e cópia recuperável; execuções normais ficam silenciosas e falhas são informadas. **Depende do computador ligado, do aplicativo aberto, do projeto e das credenciais locais disponíveis**. Não foi criada uma rota/agenda de produção na Vercel ou no QStash. A expiração dos PDFs, por outro lado, independe do computador porque está no banco. Referência: [tarefas agendadas locais](https://learn.chatgpt.com/docs/automations?surface=app).

Validação: seis testes de proteção passaram (`npm run test:mongo-storage`), cópia de recuperação conferida, preservação verificada no banco e simulação posterior sem candidatos. O cérebro foi regenerado. Não houve push ou publicação da aplicação.

O restante deste documento preserva o diagnóstico e as alternativas avaliadas antes da execução. Limpeza de órfãos, remoção de índices e exclusão de usuários não foram executadas.

## Conclusão

Começar pelos PDFs temporários vencidos, não pela exclusão de usuários. Há **70,29 MB de cache vencido** que a aplicação já ignora. Depois, revisar **12,72 MB ligados a usuários ausentes** e **8,76 MB em dois índices candidatos à remoção**. As três frentes representam aproximadamente **91,77 MB**, com níveis diferentes de validação necessários.

Para sustentar a redução, corrigir a expiração real dos PDFs e definir uma política para o histórico diário. Uma simulação de manter 180 dias e um registro anterior por post reduz **119,21 MB**, mas elimina detalhe histórico. Esse cenário se sobrepõe à limpeza de dados órfãos e de ex-assinantes; os ganhos não devem ser somados integralmente.

## Simulação complementar: oito meses

A pedido do Arthur, nova leitura às 21h21 de 07/09/2026 simulou **oito meses de calendário**, no fuso de São Paulo, mantendo um snapshot anterior ao corte por post. Corte exato: 07/01/2026 às 21h21 de Brasília. Nenhuma limpeza foi executada.

| Ação simulada | Registros removíveis | Redução em dados |
| --- | ---: | ---: |
| Histórico diário anterior a oito meses, preservando uma referência por post | 129.238 | 81,03 MB |
| PDFs vencidos | 51 | 70,29 MB |
| **Total sem sobreposição** | **129.289** | **151,32 MB** |

O cenário mantém 7.321 snapshots anteriores ao corte (4,59 MB). Preserva usuários, posts, métricas consolidadas, análises, roteiros, relatórios e registros financeiros; não inclui limpeza adicional de órfãos ou remoção de índices.

Dados + índices dos bancos `data2content` e `test` na nova leitura: **517,31 MB**. Mantendo o tamanho dos índices constante, a projeção fica em **365,99 MB**, redução de **29,25%**. A economia é de dados BSON sem compressão, não promessa de redução idêntica do espaço físico em disco. Eventuais ganhos nos índices não estão contabilizados. Evidência: `output/mongodb-storage-audit/eight-months.json`.

## Volume medido

MB nesta avaliação significa 1.000.000 bytes. Os valores por coleção abaixo são documentos BSON sem compressão; índices aparecem separadamente.

| Coleção / conteúdo | Documentos | Dados |
| --- | ---: | ---: |
| Histórico diário por post (`daily_metric_snapshots`) | 315.550 | 197,88 MB |
| Posts e respectivas análises (`metrics`) | 35.588 | 113,07 MB |
| PDFs temporários (`mediakitpdfcaches`) | 51 | 70,29 MB |
| Histórico de contas (`accountinsights`) | 31.236 | 31,84 MB |
| Cadastros (`users`) | 554 | 4,90 MB |
| Demais coleções | — | 30,24 MB |
| **Dados do banco principal** | **429.078** | **448,22 MB** |
| **Índices do banco principal** | **510 índices** | **67,15 MB** |

Há 86 coleções no banco `data2content`. O banco `test`, no mesmo cluster, tem 57 documentos, 10 coleções e 78 índices: **1,49 MB de dados + índices**. Seu nome não comprova que pode ser apagado; alguns scripts conectam sem fixar o nome do banco.

Total dos dois bancos: **516,86 MB / 492,92 MiB**, usando dados lógicos + índices. Se a cota do cluster for 512 MiB, isso corresponde a **96,27%**, com aproximadamente 19,08 MiB livres. Somente remover os PDFs vencidos levaria a cerca de **83,18%**. O plano e a cota contratada não foram confirmados na interface do Atlas.

Em Free/Flex, a cota considera dados sem compressão e índices; `storageSize` sozinho não representa essa ocupação. Nos clusters dedicados, a ocupação física tem outra interpretação, e apagar documentos não equivale necessariamente a devolver imediatamente o mesmo volume ao disco. Referências: [limites Free](https://www.mongodb.com/docs/atlas/reference/free-shared-limitations/), [armazenamento no Atlas](https://www.mongodb.com/docs/atlas/reference/faq/storage/).

## Oportunidades, em ordem recomendada

### 1. PDFs vencidos: 70,29 MB, baixo impacto

Os 51 documentos tinham `expiresAt` do tipo data e anterior à auditoria. O vencimento mais antigo é de 10/02/2026. O código usa validade de **30 minutos** e lê apenas PDFs ainda válidos (`src/app/api/mediakit/[token]/pdf/route.ts:22`, `:264`). PDFs vencidos já são regenerados quando solicitados; apagá-los não remove o mídia kit ou seus dados de origem.

O modelo declara duas vezes o índice de `expiresAt`: uma declaração simples no campo e outra com TTL (`src/app/models/MediaKitPdfCache.ts:20`, `:24`). No banco, `expiresAt_1` existe **sem `expireAfterSeconds`**. Portanto, não expira documentos automaticamente. A duplicidade é uma hipótese consistente para a divergência, não uma causa comprovada por logs históricos.

A implementação futura deve remover a ambiguidade do modelo e migrar explicitamente o índice existente. Adicionar TTL ao código não converte, por si só, um índice comum já existente. Ativar TTL já autoriza exclusão automática dos vencidos: é uma ação de limpeza, não apenas de metadados. Referência: [índices TTL](https://www.mongodb.com/docs/manual/core/index-ttl/).

### 2. Dados ligados a usuários ausentes: 12,72 MB

Nas oito coleções cruzadas, **13.985 documentos apontam para 33 IDs de usuários ausentes**:

| Conteúdo | Documentos | Dados |
| --- | ---: | ---: |
| Posts | 1.277 | 3,81 MB |
| Histórico diário desses posts | 11.060 | 6,92 MB |
| Histórico de conta | 1.334 | 1,31 MB |
| Demografia, caches, relatórios, inspirações e pautas | 314 | 0,68 MB |

Não foram encontrados snapshots cujo post estivesse ausente; neste caso, os posts ainda existem e seus usuários é que não existem. A contagem é parcial para o banco inteiro: foram cruzadas as oito coleções de maior relevância para histórico e criação, não todas as relações financeiras e de produto.

Antes de excluir, revisar referências de comunidade, relatórios e eventuais migrações/fusões de contas. Dados sem dono cadastrado são candidatos fortes, mas não prova automática de ausência de uso.

Há duas falhas no código que podem gerar sobras:

- `src/app/api/account/delete/route.ts:202` exclui o usuário sem limpar as coleções associadas. O modelo de usuário não contém uma cascata de exclusão que complete essa operação.
- `src/app/api/auth/delete-user-data/route.ts:116` apaga os posts **antes** de buscar seus IDs para excluir snapshots (`:122`). Essa segunda busca já não encontra os posts.

Existe um serviço que obtém os IDs antes de apagar (`src/app/lib/dataService/userService.ts:470`), mas cobre apenas parte dos modelos atuais. Não usar uma dessas rotas como ferramenta de limpeza em massa sem corrigir e validar as dependências. Não foi possível atribuir os órfãos atuais a uma dessas rotas com certeza.

### 3. Índices candidatos: 8,76 MB

Em `daily_metric_snapshots`, `metric_1` ocupa **2,92 MB** e `idx_metric_history` ocupa **5,84 MB**. O primeiro é prefixo de índices compostos existentes; o segundo usa `{metric:1,date:-1}`, enquanto o índice único `{metric:1,date:1}` pode percorrer datas ao contrário quando o post é fixado.

Uma consulta real de último snapshot foi verificada com `explain`, forçando o índice único: percorreu o índice ao contrário, examinou uma chave e um documento, sem ordenação adicional. Os dois candidatos tinham zero acessos desde 04/09/2026 no nó observado; o índice único tinha 27.624. Essa janela curta e de um único nó **não comprova desuso global**. A auditoria também pode afetar contadores de leitura.

Validar as demais consultas, ordenações e eventual necessidade de cobertura antes da remoção. Manter o índice único. Não propor excluir indiscriminadamente os 510 índices. Referência: [índices compostos e prefixos](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/).

### 4. Reduzir o detalhe histórico: maior ganho, decisão de produto

- Snapshots com mais de 180 dias: **200.405 registros / 125,66 MB**.
- Mantendo o snapshot mais recente anterior ao corte para cada post: preservar 10.290 registros / 6,45 MB e remover **190.115 / 119,21 MB**.
- Uma alternativa é consolidar períodos antigos em semanas ou meses, preservando dados cumulativos e os marcos usados nas análises. Esse ganho específico não foi medido.

A retenção muda gráficos, comparação de crescimento, consulta de posts antigos, análises de comunidade e regras que usam a evolução diária. Manter só um registro antigo não preserva toda essa experiência. A estatística atual do post continua em `metrics`, mas não substitui sua curva histórica.

De 26/08 a 07/09, o histórico recebeu aproximadamente **0,71 MB/dia** de novos documentos, sem contar índices, alterações em posts e outras coleções. É crescimento bruto dessa coleção, não previsão do crescimento líquido do cluster. Uma limpeza pontual não substitui retenção.

### 5. Oportunidades secundárias

- Cache de recomendações: **396 registros / 3,90 MB** com `frozenAt` anterior a 30 dias. O TTL do modelo é opcional e não existe no banco. Trinta dias é uma proposta, não prazo contratado de expiração. Regerar pode mudar recomendações antigas que estavam congeladas.
- Histórico de contas: há **13.774 registros adicionais no mesmo dia/usuário**, somando **14,01 MB** se apenas o último registro do dia fosse mantido. São medições em horários diferentes, não duplicatas necessariamente idênticas. Revisar usos intradiários e identidade da conta do Instagram antes de consolidar.
- `strategicreports` também possui índice comum onde o modelo declara TTL, mas seus três vencidos somam só 0,012 MB. `threads` também tem divergência entre o TTL parcial declarado e o índice real; sua regra protege favoritos e usa a última atividade, não simplesmente a data de criação.
- Logs Gemini já têm TTL de 60/90 dias nos índices reais. Não são a prioridade desta limpeza.

## Usuários antigos e não assinantes

O status de assinatura abaixo é o gravado no MongoDB; **não houve reconciliação com Stripe**. O volume associado soma oito coleções, exclui o próprio cadastro e índices e não mede todas as relações possíveis.

| Status no banco | Usuários | Dados associados medidos |
| --- | ---: | ---: |
| `active` | 83 | 122,83 MB |
| `non_renewing` | 7 | 8,70 MB |
| `past_due` | 6 | 8,57 MB |
| `inactive` | 360 | 88,74 MB |
| `canceled` | 74 | 110,89 MB |
| `incomplete_expired` | 24 | 3,04 MB |

**Não usar `planStatus != active` como filtro de exclusão.** Cancelamento pode conservar acesso até o fim do período; há inadimplência recuperável, trials, acessos administrativos, agências e histórico financeiro a preservar. Além disso, um ex-assinante pode continuar entrando: a conta de maior volume nesta amostra estava cancelada e teve atividade em 27/08.

Uma separação conservadora encontrou:

- **103 usuários protegidos** por status, prazo de acesso, trial, administração ou agência.
- **94 outros usuários com identificador de assinatura ou histórico de comissão**, que exigem revisão financeira separada.
- **56 usuários sem esses sinais, mas com atividade nos últimos 90 dias**.
- **301 sem esses sinais e sem data de atividade conhecida**, dos quais 300 foram criados há mais de 90 dias e 275 há mais de 180 dias. Seus dados associados somam **80,88 MB**, além de 1,40 MB em cadastros. Isso é volume para revisão, não lista aprovada para exclusão.

A cobertura de atividade é incompleta: só 129 de 554 têm `lastLoginAt`, 56 têm `lastActiveAt` e 150 têm `lastMapVisitAt`. `updatedAt` não demonstra visita, pois processos automáticos também atualizam usuários. Para decidir abandono, cruzar eventos de uso, sessões MCP, criação de conteúdo, mídia kit, contratos, comissões e contatos recentes. A separação acima não fez essa revisão individual completa.

O cron `src/app/api/cron/refresh-instagram-data/route.ts:99` seleciona contas conectadas sem filtrar assinatura/atividade. Há 51 usuários marcados como conectados nesta leitura; apenas cinco estão fora do grupo conservador protegido. Logo, bloquear atualização de todos os não assinantes não parece a maior economia imediata de crescimento. O enfileiramento real depende também da existência de token e ID de Instagram.

## Encaminhamento

1. Limpar somente PDFs comprovadamente vencidos e corrigir o índice TTL real, conferindo o volume depois.
2. Revisar os órfãos e as dependências, definir o lote exato e corrigir as rotas que deixam sobras.
3. Validar os dois índices candidatos nas consultas do produto.
4. Decidir o nível de histórico que deve continuar disponível; preservar exportação recuperável antes de reduzir histórico útil.
5. Tratar exclusão de contas antigas como uma decisão separada, com critério de inatividade demonstrável e revisão de relações financeiras.

Os itens acima são propostas; não foram executados.

## Evidência e limites da medição

Resultados locais em `output/mongodb-storage-audit/stats.json`, `detail.json` e `scenarios.json`. As consultas usaram o driver nativo, sem importar modelos da aplicação, criar índices, executar `$out`/`$merge` ou alterar documentos. Agregações limitadas a 30 segundos, sem uso de disco, e conexão com até duas sessões de pool. Dados pessoais e conteúdo dos documentos não foram exportados; a saída contém metadados e agregados.

O banco continuou funcionando durante a leitura: os totais são um retrato aproximado no tempo, não um snapshot transacional. Ganhos de documentos foram calculados com `$bsonSize`; ganhos de índices são tamanhos informados pelo banco, sujeitos à validação operacional. A redução física final de índices e arquivos só pode ser confirmada após manutenção. A coleta do Atlas pode demorar para refletir a mudança.
