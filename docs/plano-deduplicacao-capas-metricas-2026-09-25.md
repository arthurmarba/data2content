# Deduplicar capa e miniatura dos posts sem mudar a experiência

Plano de 25/09/2026. **Este documento não autoriza nem executa a alteração dos dados.** O objetivo é guardar `Metric.coverUrl` uma só vez quando `Metric.thumbnailUrl` contiver a mesma string, mantendo os dois campos nas respostas que os consumidores esperam. URLs diferentes devem continuar separadas. Não apagar `coverUrl`, `mediaUrl`, `thumbnail_url` legado ou mídias de outras coleções.

## Medida e limite do ganho

Leitura somente de `metrics` no banco `data2content` em 25/09/2026:

| Situação | Posts |
| --- | ---: |
| `thumbnailUrl` e `coverUrl` não vazias e exatamente iguais | 23.641 |
| Ambas presentes e diferentes | 0 |
| Só `thumbnailUrl` | 0 |
| Só `coverUrl` | 13.692 |
| Nenhuma | 130 |

Total: 37.463 posts. Os elementos BSON `thumbnailUrl` duplicados somam aproximadamente **14.751.672 bytes**, ou **14,75 MB decimais**. É tamanho lógico de campo, não promessa de igual queda imediata na cota do Atlas: conferir `dataSize`, `storageSize`, `indexSize` e o painel após a migração. A distribuição de hoje não garante que os próximos posts terão URLs iguais.

## Por que apagar o campo agora quebraria coisas

O escritor de sincronização em `src/app/lib/instagram/db/metricActions.ts` preenche os dois campos para Reels. Se só limpar o banco, a próxima sincronização pode recriar a duplicação. `src/app/api/v1/users/[userId]/videos/list/route.ts` já consegue usar `coverUrl` como alternativa, e o mídia kit público consome essa rota. Porém `src/app/mediakit/[token]/MediaKitView.tsx` só desenha o card quando recebe `thumbnailUrl`. Outros leitores projetam ou consultam a miniatura diretamente: `postReviewsService.ts`, `postsService.ts` (busca global), `discover/feed/route.ts`, `creatorWeeklyReport`, `relatorio`, `scripts/reuniao`, `scripts/revista` e suas renderizações. `.lean()` e agregações MongoDB não usam um getter/virtual do Mongoose; mudar apenas o modelo é insuficiente.

O MCP textual exclui `thumbnailUrl` do contrato em `src/app/lib/mcp/intelligenceContract.ts`, mas consultas ligadas ao conteúdo e relatórios precisam de comparação antes/depois. A URL pode expirar na origem: deduplicar uma string não conserta imagem vencida. O caso de conta desconectada deve funcionar sem tentar buscar outra URL na Meta.

## Contrato a preservar

1. Dentro de `Metric`, `coverUrl` continua sendo a capa principal. `thumbnailUrl` só fica gravada quando for **não vazia e diferente** de `coverUrl`, ou quando for a única imagem disponível. Comparar strings completas; não deduplicar por aparência, domínio ou URL sem parâmetros.
2. Fora do banco, manter `thumbnailUrl` nas respostas existentes: `thumbnailUrl original || coverUrl || fallback legado`, respeitando o fallback já usado em cada rota. Para os 23.641 duplicados, a URL entregue deve ser byte a byte a mesma de antes. Um `coverUrl` já passado pelo proxy não pode ser passado pelo proxy de novo.
3. Um `thumbnailUrl` diferente tem prioridade sobre `coverUrl` onde tinha antes. Não alterar `coverUrl`, `mediaUrl`, legenda, métricas, classificação, links, `updatedAt` ou outras coleções na migração.
4. A ausência de uma imagem continua ausência; não inventar URL e não expor URL privada no MCP. Imagem vencida é um problema separado.

## Sequência de implementação

### 1. Preparar as leituras, sem alterar o banco

Criar um resolvedor pequeno e testável para a URL efetiva. Aplicá-lo nas saídas de `Metric`, não no componente visual isoladamente. Nos `find().lean()`, incluir `coverUrl` nas projeções e montar o campo de resposta. Nas agregações, usar `$ifNull` na ordem original com `coverUrl` como reserva, ou normalizar os resultados antes de retorná-los. Auditar os leitores encontrados por `rg -n 'thumbnailUrl' src scripts` e confirmar a origem do campo: `Metric` versus outros modelos, fixtures ou saída de terceiros.

Portas mínimas: lista de vídeos e `charts-batch`; mídia kit público (`view-data`, tela e PDF); busca global, avaliações e feed Discover; relatório semanal, relatório de marca, reunião e revista; telas que consomem essas saídas. Preservar nomes e tipos das respostas, inclusive `thumbnailUrl` para clientes já abertos. Não depender de virtual Mongoose, pois `.lean()` e agregações o ignoram. Não mudar a lógica de renovação das URLs vencidas nesta etapa.

### 2. Provar compatibilidade e publicar essa versão primeiro

Testes do resolvedor para cinco casos: URLs iguais, diferentes, só capa, só miniatura, nenhuma; acrescentar URL já proxied e URL vencida sem acesso à Meta. Testes de contrato com `Metric` sem `thumbnailUrl` para cada saída acima. Comparar JSON antes/depois de posts representativos, exigindo mesmos IDs, números, ordenação, capa entregue e estado de acesso. Conferir visualmente desktop e celular, mídia kit público de conta conectada e desconectada, PDF, Discover e ao menos um relatório/reunião/revista gerado.

Executar testes focados, `npm run test:mcp`, o smoke MCP administrativo quando houver acesso, e `npm run build` antes do deploy. No Claude, comparar as respostas das ferramentas de conteúdo e listas para os mesmos posts, incluindo um post cuja miniatura será simulada como ausente no banco; nenhum texto, métrica, cobertura ou permissão deve mudar. A comparação do MCP é uma salvaguarda mesmo que a URL não integre seu contrato textual.

Publicar **somente a camada de leitura** e aguardar todas as instâncias antigas saírem de circulação, além dos caches do mídia kit (resposta com até 5 minutos de cache e 10 minutos de stale; PDF até 30 minutos). Observar por pelo menos 24 horas erros de imagem, respostas `thumbnailUrl:null` onde havia capa e falhas de PDF. Se houver regressão, corrigir essa camada sem tocar os dados.

### 3. Parar a duplicação em novas sincronizações

Alterar `metricActions.ts` para gravar `thumbnailUrl` apenas se ela for distinta da capa recebida no mesmo payload. Quando forem iguais, retirar o campo duplicado de forma atômica no update; quando diferentes, preservar ambos. Se a Meta não trouxer uma das URLs, não apagar às cegas uma miniatura previamente distinta. Rever o `default: null` de `Metric.thumbnailUrl` e o `setDefaultsOnInsert`, para que novos upserts não recriem o campo vazio; testar `findOneAndUpdate` com `upsert`. Não usar `$set` e `$unset` no mesmo caminho. Liberar essa escrita só depois de a versão de leitura estar comprovadamente ativa. Se houver um novo controle por variável de ambiente, cadastrá-lo em `.env.local` e na Vercel no mesmo dia.

Rodar a sincronização de amostra e verificar que novos posts iguais não têm duplicata, URLs diferentes continuam distintas e o contrato de saída é igual. Pausar a migração se surgir qualquer exceção não entendida.

### 4. Limpar apenas as cópias iguais, com recuperação

Criar script em `scripts/` com `--dry-run` por padrão; `--apply` exige `--expected-db=data2content`. Antes de escrever, conferir banco, contagens por categoria, candidatos e espaço; criar arquivo local recuperável com `_id`, `coverUrl`, `thumbnailUrl` e `updatedAt` em EJSON canônico, calcular SHA-256, reler e validar contagem/hash. Guardar em `output/mongodb-maintenance/<execução>/` com permissão restrita. Nunca logar URLs ou credenciais.

Executar primeiro lote piloto de até 100 posts de contas e formatos variados, depois lotes pequenos de até 250, com pausas de observação entre piloto, 1%, 10% e restante; esperar pelo menos 24 horas após o piloto. Cada exclusão usa o driver nativo, `writeConcern: majority` e filtro condicional em `_id`, `coverUrl`, `thumbnailUrl` e `updatedAt` iguais aos valores arquivados; faz **somente** `$unset: { thumbnailUrl: '' }`, sem tocar `updatedAt`. Mudança concorrente implica *pular e relatar*, jamais forçar. Revalidar hash e integridade antes de cada retomada. O processo é idempotente e pode ser interrompido entre lotes.

Após cada etapa, conferir: registros modificados versus previstos; URLs diferentes ou exclusivas intocadas; quantidade de posts e de capas intacta; nenhum `thumbnailUrl` duplicado novo fora de sincronizações concorrentes; saídas efetivas de amostra iguais às anteriores; erros de imagem, 5xx e PDF sem aumento. Observar também contas desconectadas. A economia líquida deve ser medida depois de o Atlas refletir as atualizações; evitar `compact` ou rebuild de índice só para forçar número menor.

### 5. Volta segura

Se uma saída mudar, **parar os lotes** e desativar a nova escrita antes de novos testes. Restaurar somente documentos listados no backup cujo `thumbnailUrl` segue ausente e cujo `coverUrl` ainda é exatamente o arquivado; não sobrescrever uma URL renovada por sincronização. Conferir hash do arquivo antes da restauração e recontar os documentos. Se o defeito estiver na camada de leitura, restaurar os dados afetados **antes** de voltar para uma versão antiga do aplicativo que espera `thumbnailUrl` gravada. Manter backup e relatório até a validação final.

## Condição para dizer que deu certo

Nenhuma tela ou documento perde uma capa que antes aparecia; IDs, números, ordenação, permissões e respostas do MCP continuam iguais; sincronização não recria cópias idênticas; exceções com URLs diferentes são preservadas; backup e restauração piloto foram testados; o Atlas mostra o efeito real sobre a cota. Se qualquer uma dessas condições falhar, não avançar para o próximo lote.
