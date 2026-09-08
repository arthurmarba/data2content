# Radar — coleta gratuita e revisão administrativa

Atualização: 07/09/2026. Esta nota substitui o plano antigo onde fontes públicas eram automaticamente tratadas como coletáveis.

## Decisão de produto

Arthur pediu descoberta automática nas origens possíveis e complemento manual nos aplicativos.
Nenhuma coleta pode chamar API paga, serviço de scraping por volume, modelo de IA ou API de busca com cobrança.
Página pública, gratuita, sem login e sem proibição identificada pode receber revisão para descoberta interna.
A permissão de distribuir conteúdo continua separada: revisão editorial não substitui a autorização da fonte.

“Sem custo de API” não significa hospedagem ou banco gratuitos: o recurso utiliza a infraestrutura existente.

## Implementado

- `collectionPolicy.ts`: gratuidade, permissão, URLs exatas, evidência da revisão e validade de 30 dias.
- `guardedHttp.ts`: checagem antes da rede, robots, HTTPS, bloqueio de redirecionamentos, até 12 requisições/40 segundos por lote e resposta limitada a 2 MB. Nenhuma chave/API/intermediário.
- Coletor e auditoria respeitam o bloqueio. Falha de uma fonte não apaga os resultados das outras.
- `/admin/campaign-radar`: cadastro por texto/link, requisitos, entregas, cachê e prazo; edição; importação de lote JSON; paginação; revisão; indicadores; fontes e últimas execuções.
- `CampaignRadarCandidate`: caixa privada separada do catálogo, histórico das últimas 100 alterações (20 exibidas), revisão concorrente protegida por número de versão.
- Reenvio idêntico reúne avistamentos. Link de candidatura igual em outras entradas gera aviso de possível duplicidade; não junta campanhas diferentes cegamente. Parâmetros de rastreamento são ignorados, identificadores funcionais permanecem.
- Reencontros com a mesma chave comparam as condições com a última observação, sem considerar datas de execução e rastreamento. Mudança no texto, remuneração, requisitos ou estado retira a publicação e coloca a candidata em “Verificar novamente”, na mesma transação. Mudança de título ou prazo gera outra candidata com aviso de possível duplicidade; a união dessas variantes permanece manual.
- A captura original e a versão anterior ficam privadas para comparação. Edição preserva a data de descoberta e não inventa nova verificação. Reencontro idêntico preserva correções editoriais.
- Publicação e decisão são confirmadas na mesma transação. Editar, rejeitar, pedir nova verificação ou manter interno desativa a versão publicada.
- O MCP revalida a autorização atual da fonte na consulta, além de estado, revisão, prazo e última verificação. Revogar fonte vale para registros já importados.
- Importar lote editorial não desativa publicações individuais feitas pelo admin; troca de lote do mesmo dia desativa itens removidos.
- `/api/cron/campaign-radar`: rotina com `CRON_SECRET`, sem exceção de autenticação em desenvolvimento, limite diário por índice único e registro de execução, incluindo fontes consultadas e progresso parcial mesmo quando a persistência falha. Não dispara QStash nem contrata agendador.

## Fontes desta entrega

| Origem | Coleta | Distribuição |
| --- | --- | --- |
| Up!ABC, somente página de ajuda | Descoberta interna gratuita, revista em 07/09, validade até 07/10 | Pendente |
| Tijuca Geek Festival, somente página principal | Descoberta interna gratuita, revista em 07/09, validade até 07/10 | Pendente |
| Creator Ads / Linktree, Influencer Brasil, Animextreme / Linktree | Bloqueada | Bloqueada |
| Squid, PlayNest, 99Freelas | Desligada até revisão específica da coleta | Pendente |
| MIS e capturas manuais | Entrada manual privada | Restrita |
| X | Desligada: API paga | Desligada |
| Threads | Desligada: falta confirmar gratuidade e acesso no aplicativo | Desligada |

As duas revisões de coleta são limitadas às páginas consultadas; não declaram licença comercial nem revisão jurídica completa do domínio. Robots é verificado na execução. Falha, proteção, mudança de URL ou proibição interrompe a consulta.

O formulário externo do Up!ABC não foi liberado: a candidata usa somente a evidência da página de ajuda, sem inventar as condições do formulário. Nenhuma candidatura é enviada.

## Uso

1. Abrir `/admin/campaign-radar` com uma conta administrativa.
2. Adicionar texto e links, identificar a origem e preencher apenas as condições conhecidas.
3. Usar “Somente interno”, “Verificar novamente” ou “Rejeitadas”, sempre com nota.
4. “Aprovar e publicar” exige fonte com distribuição liberada, tipo apropriado, prazo válido e confirmação de chamada aberta. No registro atual nenhuma fonte tem distribuição liberada; o botão permanece indisponível.
5. Para revisar uma coleta local, executar `npm run campaign-radar:collect -- --output=/private/tmp/radar-candidatas.json` e importar esse JSON pela tela.

Importações aceitam o contrato `campaign_radar_batch_v1`, até 500 itens/2 MB por requisição. A importação é incremental e idempotente por candidata: se falhar no meio, reenviar o mesmo arquivo é seguro. Aprovações trazidas no arquivo não são aceitas como revisão administrativa; todas as entradas novas nascem pendentes.

Para rodar no servidor, configurar um agendador existente e gratuito para chamar GET `/api/cron/campaign-radar`, com `Authorization: Bearer <CRON_SECRET>`, uma vez ao dia. A publicação deste código não ativa o agendamento. Chamadas repetidas no mesmo dia não fazem nova coleta, inclusive após falha. Uma execução interrompida requer inspeção; não há botão de repetição que contorne esse limite.

## Publicação e manutenção

A primeira escrita confirma os índices dos novos modelos por `ensureRadarIndexes`: `CampaignRadarCandidate` (chave única) e `CampaignRadarRun` (dia único), independentemente do `autoIndex` do ambiente. Se a criação falhar, a operação não prossegue sem essas garantias. O teste integrado usa Mongo local efêmero com replica set e nunca o `MONGODB_URI` de produção. As transações exigem replica set, como o banco já usado pelo importador.

As flags existentes do MCP e da interface pública continuam como estavam. Disponibilidade no site/Claude/ChatGPT depende de deploy, configuração e autorização das fontes; a tela administrativa funciona independentemente dessas flags.

Revisar as origens até 07/10/2026. A validade vencida bloqueia a coleta. Detectar mudanças contratuais automaticamente com garantia não é possível: avisos operacionais e revisão periódica são os controles disponíveis.

## Próximas entregas condicionadas a evidência

1. Revisar outras páginas públicas e gratuitas do registro e ampliar a lista de URLs por origem, mantendo os limites.
2. Integrar feeds RSS/JSON oficiais quando houver uma origem concreta revisada. Não cadastrar URLs arbitrárias pelo navegador.
3. Confirmar no painel da Meta o acesso gratuito de busca do Threads antes de desenvolver/ativar o conector; X permanece fora.
4. Receber chamadas diretamente de marcas e agências, com autorização documentada. Nenhum contato externo foi enviado nesta entrega.
5. Avaliar anexos de captura de tela com armazenamento privado e política de retenção; esta versão recebe texto, links e lotes JSON, sem OCR pago.
6. Medir tempo de revisão, rendimento por fonte e candidaturas com dados reais. Não apresentar estimativa de chance de contratação como número confirmado.

## Verificação

- Testes do Radar e MCP: `npm test -- --runInBand src/app/lib/campaignRadar src/app/lib/mcp/campaignRadar.test.ts`.
- Teste de integração em `adminService.integration.test.ts`: usa apenas `MCP_ADMIN_TEST_MONGO_URI` apontando a `127.0.0.1`, banco efêmero `d2c_admin_test`; ignorado na suíte comum.
- Verificação de produção: `npm run build`.
- Coleta pública local de 07/09/2026: duas candidatas, Up!ABC e Tijuca Geek, sem API paga e sem gravação em produção.

### Continuação verificada em 07/09/2026

- Build de produção concluído; 69 testes de Radar/MCP aprovados e cinco testes com Mongo efêmero aprovados separadamente.
- Navegador com o componente real e API fictícia: cadastro, revisão interna, bloqueio de publicação de fonte restrita, edição e retorno à fila pendente conferidos.
- Tela inspecionada em computador e celular de 390 px. Capturas locais em `output/playwright/radar-continuacao/`.
- A verificação de interface não autentica uma conta real nem grava no banco de produção; autorização e transações foram verificadas pelos testes específicos.
- Código permanece local nesta continuação. Deploy e agendamento não foram executados.
