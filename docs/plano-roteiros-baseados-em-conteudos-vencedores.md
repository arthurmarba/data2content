# Plano — roteiros baseados nos conteúdos vencedores do criador

Data: 07/09/2026. Status: implementação local com testes automatizados; não publicado. As seções originais abaixo registram o plano e seus critérios, não uma afirmação de disponibilidade em produção.

## Registro da implementação

| Frente | Entrega no código | Validação externa ainda necessária |
| --- | --- | --- |
| Fundamentos | Origem real, autorização antes do corpus, engajamento correto, período/formato/IDs próprios, métricas atuais, zero/null, cobertura dos líderes | Linha de base atual do banco de produção |
| Escrita e crítica | `get_script_evidence_pack`, mesmo pacote no fallback e nas revisões, sessão privada para crítica, recibo por etapa | Conversas reais no Claude e no ChatGPT, incluindo escopos restritos e renovação de conexão |
| Voz e edição | Mapa, preferências expressas, estruturas citadas, comparação textual, rubrica e detecção de cópia | Avaliação humana cega de 10 perfis × 3 pedidos; meta de 70% ainda não medida |
| Operação | Lease, checkpoint, pausa compartilhada por saldo, distribuição de fila, manutenção sem IA e auditoria somente leitura por padrão | Índices Mongo/TTL e concorrência entre workers reais; latência/custo em carga representativa |
| Rastreabilidade | Pedido, fontes e métricas salvos; versões original/aprovada; feedback; vínculo e observações de resultado | Publicações reais e maturação das janelas de resultado |

Decisões de escopo desta entrega: orçamento de texto conservador (não contador exato de tokens); cache imutável de sessão por sete dias (não cache global de novas buscas); métricas atuais em cada pedido; DNA atualizado em fila e servido com aviso de defasagem. Janelas 1/7/30 são observações dentro de faixas de idade declaradas, não snapshots exatos retroativos. A revisão de voz é heurística com rubrica para o escritor/criador, não um juiz semântico independente certificado. Embeddings, fine-tuning, leitura de vídeo longo e comparação causal seguem deliberadamente fora da entrega.

Nenhum backfill, reconciliação ou benchmark V3 com banco/provedor real foi executado para implementar estas mudanças. O build usa o ambiente padrão do projeto e inicializa integrações existentes; isso não é validação de operação em produção.

Verificações locais em 07/09/2026: 65 suítes / 603 testes das áreas MCP, roteiros, relatório e adaptadores passaram; `check:scripts-quality` passou (65 testes e 6/6 casos do benchmark sem chamadas pagas); `typecheck:mcp` e `git diff --check` passaram. O build terminou com código de saída zero, mas a configuração existente do ESLint emite `Invalid Options: useEslintrc, extensions`; portanto, compilação/tipos aprovados não equivalem a lint aprovado. Inventário regenerado com `npm run brain`.

### Roteiro do piloto antes de liberar

1. Selecionar contas autorizadas de alta, média e baixa cobertura; auditar em modo somente leitura e registrar revisão Git, corpus, fontes e líderes sem leitura.
2. Em cada cliente: pedir um roteiro por engajamento, outro por compartilhamentos e outro com período/ID próprio explícito. Conferir os IDs/métricas contra a auditoria e que não houve segunda geração interna.
3. Pedir revisão com o mesmo `clientRequestId`; tentar ID de outra conta e sessão expirada. Confirmar recusas sem exposição de texto.
4. Mostrar o texto ao criador, salvar somente após confirmação, editar e registrar feedback. Conferir proveniência, não somente a mensagem de sucesso.
5. Comparar versões às cegas por naturalidade, briefing, especificidade, progressão, novidade e facilidade de gravação. Registrar A/B, preferência e motivos; não transformar notas automáticas em votos humanos.
6. Só com orçamento autorizado, testar recuperação de leitura e provedores reais. Conferir exclusão mútua, pausa, checkpoint, fila e ausência de repetição paga após falha de persistência.
7. Publicar conteúdo fora do MCP quando o criador decidir, ligar ao roteiro e aguardar janelas. Comparar resultados como associação, sem atribuir causalidade ao texto.

## 1. Objetivo e comportamento esperado

Quando o criador pedir «crie um roteiro baseado nos meus conteúdos que mais engajaram», a D2C deve selecionar referências do próprio criador com desempenho verificável, ler a fala efetivamente publicada, identificar padrões de voz e estrutura e fundamentar a criação de um roteiro novo.

A experiência precisa funcionar tanto com o modelo da conversa no Claude/ChatGPT quanto com o gerador interno da plataforma. A leitura multimodal de um vídeo e a escrita de um novo roteiro são operações independentes: consultar evidências existentes não exige assistir novamente ao vídeo.

Exemplo de resposta desejada, com números ilustrativos:

> Usei três vídeos seus dos últimos 90 dias, escolhidos pela taxa de interações sobre alcance. Dois começam com uma situação concreta e deixam a virada para o meio. Mantive suas frases curtas e o jeito de conversar com a audiência. Dos dez vídeos líderes, sete têm transcrição disponível. Aqui está o novo roteiro de 45 segundos…

O roteiro deve trazer fala pronta para gravar, progressão, direção visual quando pertinente e CTA coerente. As referências devem ser identificáveis, com links quando disponíveis. A resposta deve distinguir padrão observado de hipótese editorial; bom resultado histórico não demonstra que uma frase causou esse resultado.

## 2. Base validada e limites desta auditoria

- Foram inspecionados extração, armazenamento, seleção, DNA, geração, fallback, contratos MCP, salvamento, recuperação e testes do repositório.
- Os arquivos centrais de evidência, DNA e geração V3 não apresentam diferenças entre HEAD e a branch local `codex/script-intelligence-v3`; reaproveitar esse motor. A inspeção das referências Git disponíveis não equivale a uma atualização remota.
- As correções anteriores de transcrição/cenas no MCP e tratamento de falta de saldo estão no diretório de trabalho, ainda sem publicação confirmada. Este plano não deve ser interpretado como descrição de funcionalidades já em produção.
- Nesta auditoria não foram chamados Gemini/OpenAI, alterados dados de criadores nem executados novos testes de geração. Os resultados de testes da etapa anterior não comprovam as melhorias propostas aqui.
- Os números de cobertura e saldo observados anteriormente são históricos. Uma auditoria operacional nova deve estabelecer a linha de base antes da liberação.

### O que já podemos aproveitar

| Componente | Capacidade existente |
| --- | --- |
| `PublishedContentEvidence` | Texto, segmentos temporais, cenas, narrativa, sinais visuais, desempenho e vínculo com roteiro |
| `creatorScriptEvidencePack.ts` | Até três exemplares e um contraste; pondera desempenho, proximidade lexical e recência |
| `creatorScriptDnaV3.ts` | Expressões recorrentes, ritmo aproximado, ganchos, estruturas, tom e contexto visual |
| `creatorScriptGenerationV3.ts` | Prompt com textos extensos, fala literal, orçamento de duração e verificação de cópia |
| MCP | Consulta de dados, geração, crítica e salvamento separado do rascunho |
| `ScriptEntry`, `styleTraining.ts`, `outcomeTraining.ts` | Roteiros editáveis, vínculo com publicação e aprendizado de estilo/resultado já implementado em outros caminhos |
| Worker e recuperação | Leitura assíncrona, persistência de evidência antes de marcar a cena, recuperação periódica |

## 3. Problemas encontrados no fluxo atual

| Prioridade | Evidência no código | Consequência | Correção proposta |
| --- | --- | --- | --- |
| P0 | `inferGoal` não reconhece engajamento genérico e termina em `attention` | O pedido pode selecionar retenção ou visualizações/alcance em vez de engajamento | Objetivo e métrica explícitos, com regras para linguagem natural |
| P0 | O fallback V3 chama `generateScriptFromPrompt` com prompt original e contexto agregado, sem o pacote V3 | As transcrições selecionadas deixam de chegar à escrita no fallback | Contexto editorial compartilhado entre provedores |
| P0 | O resultado V3 retorna `pack.receipt` também no fallback | Contagem de exemplos montados pode parecer prova de uso pelo gerador | Separar evidência disponível, selecionada, enviada e usada em validação |
| P0 | `transcript.fullText` pode conter `stored_script`; o seletor chama qualquer texto desse campo de `observed` | Roteiro planejado pode ser apresentado como fala real | Classificação por origem, não apenas presença de texto |
| P0 | `includePrivateIntelligence=false` suprime o contexto agregado, mas a chamada V3 ainda constrói o pacote privado | A restrição de capacidade não é propagada até a leitura privada | Aplicar autorização antes de recuperar evidência, em todos os caminhos; testar com conta sem capacidade. Isso não demonstra acesso entre usuários |
| P1 | Desempenho é copiado para a evidência durante a leitura; os leitores V3 usam essa cópia | Um vídeo que cresceu depois pode ser ranqueado por métricas antigas | Consultar `Metric` atualizado ou manter snapshot de desempenho com atualização independente |
| P1 | `lookbackDays` vai ao contexto agregado, mas não ao pacote V3; até 500 evidências recentes são buscadas sem corte por período | Janela pedida pelo criador pode não valer para os exemplares | Um contrato de período aplicado à seleção e ao recibo |
| P1 | Seleção começa pelas evidências disponíveis, não pelo conjunto de posts do período | «Melhores» significa melhores entre os já analisados; vencedores sem leitura ficam invisíveis | Calcular cobertura dos líderes e distinguir ranking geral de ranking com transcrição |
| P1 | Pontuação substitui resultado zero por interações; `authority` combina taxas de escalas diferentes | Zero e dado ausente se confundem; objetivos ficam inconsistentes | Null explícito, normalização por objetivo e comparação com baseline do criador |
| P1 | Não há piso de desempenho para `winningExemplars`; o contraste é o pior do conjunto sem exigir comparabilidade | Conteúdo apenas relevante pode ser chamado de vencedor; contraste pode ser de outro tema/formato | Separar exemplo de voz, vencedor e contraste comparável |
| P1 | «Transcrição completa» usa basicamente presença e mínimo de oito palavras; há cortes por tamanho | Texto parcial pode ser tratado como integral | Estados de extração, qualidade, truncamento e cobertura temporal |
| P1 | `critiqueCreatorScriptV3` usa duração, cópia e qualidade técnica; não compara semanticamente voz/estrutura com os exemplos | Passar na crítica não comprova aderência ao criador | Rubrica de voz e estrutura com evidência, separada das verificações mecânicas |
| P1 | Salvamento MCP guarda título/conteúdo, mas não o recibo V3; mudança de vínculo atualiza outros perfis, sem sincronização explícita da evidência V3 nesse caminho | Perde-se a origem do roteiro e o vínculo pode ficar defasado | Persistir proveniência da geração e atualizar vínculos de modo independente da leitura |
| P2 | O DNA pode ser reconstruído e persistido durante a consulta, com TTL de seis horas | Latência variável e perfil temporariamente antigo após novas evidências | Atualização em fila, revisão de corpus e cache invalidado por mudança relevante |
| P2 | O prompt compacto pode repetir `fullText` e texto observado/planejado | Tokens redundantes aumentam latência e custo | Uma representação por fonte, com orçamento explícito |

Há duas diferenças adicionais relevantes: o extrator atual limita vídeos a 180 segundos e usa miniaturas para filhos de vídeo em carrosséis. Essa cobertura visual não comprova leitura do áudio desses filhos. Além disso, o MCP aceita duração alvo até 600 segundos, enquanto outras partes foram ajustadas para vídeos curtos; os limites precisam ser coerentes por formato.

## 4. Arquitetura proposta

Um serviço comum deve preparar a mesma evidência para todos os pontos de entrada:

1. Resolver conta autorizada, pedido, objetivo, período, assunto, formato e duração.
2. Consultar métricas atuais e construir o ranking do próprio criador.
3. Cruzar líderes com evidências disponíveis; medir o que está faltando.
4. Selecionar exemplos comparáveis, respeitando origem e qualidade da transcrição.
5. Montar pacote com referências, voz, estrutura, mapa, restrições e recibo.
6. Escrever pelo modelo da conversa ou pelo provedor interno configurado.
7. Validar novo texto, devolver limites e referências; salvar quando solicitado.
8. Ao publicar e receber métricas, fechar o ciclo de aprendizado.

### Escrita dentro do Claude/ChatGPT

Recomendo adicionar uma ferramenta de leitura, nome proposto `get_script_evidence_pack`, para entregar ao modelo da conversa um conjunto pequeno e autorizado de referências. Assim ele pode escrever e revisar usando os dados da D2C, sem chamar o gerador interno a cada ajuste.

Isso muda a decisão documentada em `script-intelligence-v3.md`, que concentra toda geração no motor interno e evita entregar o corpus ao cliente. A proposta expõe somente as referências selecionadas do próprio criador, não o acervo inteiro, mantendo contratos e validação comuns. Essa mudança deve aparecer explicitamente na documentação e nas políticas MCP.

O caminho `generate_script_draft` continua disponível para a plataforma e para quem pede geração pelo motor D2C. Descrições das ferramentas devem explicar quando preparar evidência e quando gerar, evitando duas gerações para o mesmo pedido.

A ferramenta consegue comprovar quais textos foram entregues ao cliente; não consegue garantir, sozinha, que o Claude/ChatGPT seguiu todas as instruções. Esse comportamento exige testes de conversação no cliente e validação do roteiro final.

### Contrato proposto do pacote

- `request`: objetivo, métrica, período solicitado/resolvido, formato, duração, assunto e referências próprias opcionais.
- `selection`: versão do ranking, critério, componentes, baseline, motivos de escolha e eventuais ampliações de janela.
- `examples`: IDs e links, data do post, métricas e data de captura, origem do texto, transcrição, roteiro planejado em campo separado, segmentos relevantes, gancho, estrutura, CTA e qualidade da extração.
- `creatorStyle`: padrões recorrentes sustentados por referências, confiança e preferências confirmadas pelo criador.
- `editorialContext`: território, narrativa e nível de confirmação; pauta já existente quando selecionada.
- `receipt`: ID/revisão do pacote, cobertura global e dos líderes, fontes selecionadas, truncamentos e limitações.
- `generationReceipt`: modo de escrita, provedor quando interno, revisão do pacote entregue e resultado das validações. Esse recibo é produzido depois da preparação.

Usar IDs vinculados à conta autenticada; referências próprias não devem reutilizar o namespace de inspirações de terceiros. No caminho privado, manter as permissões de leitura e capacidades verificadas no serviço. Conteúdo de vídeos deve ser tratado como material de referência, nunca como instrução que altera a operação das ferramentas.

## 5. Seleção dos conteúdos que realmente deram resultado

### Regra para engajamento

Padrão proposto para o pedido genérico: taxa de interações sobre alcance, mostrando também interações absolutas e volume de alcance. Explicitar a regra na resposta. Se o usuário pedir «maior número de interações», usar a contagem absoluta.

Não somar `total_interactions` com comentários, compartilhamentos e salvamentos: esses componentes já podem fazer parte do total. Quando o total não existir, usar apenas uma decomposição compatível e verificada; registrar o método. Se alcance faltar, não fabricar uma taxa usando denominador igual a um.

| Intenção | Medida proposta |
| --- | --- |
| Engajamento | Interações / alcance, com volume e confiança |
| Compartilhamento | Compartilhamentos / alcance |
| Salvamento | Salvamentos / alcance |
| Conversa | Comentários / alcance |
| Atenção | Retenção ou tempo médio / duração; visualizações / alcance identificadas como proxy quando utilizadas |
| Crescimento | Seguidores atribuídos / alcance, quando mensurável |
| Conversão comercial | Resultado comercial atribuível, se existir; seguidores não devem ser chamados de vendas |
| Autoridade | Objetivo editorial com sinais observáveis separados; qualquer índice composto deve ter escalas normalizadas e pesos versionados |

Manter o ajuste já existente para baixo alcance, corrigindo o tratamento de dados ausentes. Comparar por formato e duração e, quando os dados permitirem, estágio de maturação do post. Não afirmar controle de mídia paga se o banco não informar impulsionamento.

### Busca e variedade

- Aplicar primeiro conta, período e formato. Desempates devem ser determinísticos.
- Cruzar desempenho, proximidade com o assunto e confiabilidade da evidência. Pesos iniciais são parâmetros a avaliar, não uma verdade de produto.
- Manter até três exemplos integrais inicialmente; selecionar diversidade de abertura e progressão quando houver material suficiente.
- Exemplo de voz pode ser útil mesmo sem alto desempenho, mas deve receber esse nome.
- Contraste deve ter tema, formato e duração comparáveis; se não houver, omitir.
- Aceitar IDs de posts próprios que o usuário indicar e explicar quando não possuem transcrição.
- Expandir para busca semântica somente depois de medir os erros da busca lexical; embeddings devem ser incrementais, privados por conta e avaliados pelo ganho de seleção.

## 6. Aprender voz, estrutura e direção de gravação

Separar a voz recorrente do criador dos recursos dos conteúdos vencedores. Preservar vocabulário, comprimento típico de frase, tratamento da audiência, humor, ritmo, transições e maneira de concluir. Uma campanha isolada ou áudio de terceiro não deve redefinir o estilo pessoal.

Estrutura deve representar funções narrativas: situação → tensão → exemplo → virada → conclusão, por exemplo. Cada padrão deve apontar para trechos que o sustentam. Segmentar falantes quando necessário e distinguir fala do criador, convidado e texto em tela; onde o dado não permitir, reduzir a confiança.

Usar `MapaSeed`/serviço canônico para carregar narrativa, território, assets e confirmação no mesmo pacote. O snapshot MCP já contém resumo de mapa, mas esse resumo não é carregado explicitamente pelo pacote V3 inspecionado. Escolher uma pauta nova deve respeitar narrativa + território; um briefing explícito do usuário deve ser preservado e contextualizado.

Definir precedência: pedido atual e preferências confirmadas → contexto editorial → padrões recorrentes → referências de desempenho. Isso permite evoluir o estilo sem ficar preso ao histórico. Experiências pessoais, produtos usados e resultados do criador não podem ser inventados para preencher um roteiro.

## 7. Dados, cobertura e operação

### Sem novo processamento Gemini

1. Consultar métricas atuais em `Metric` para ranking e registrar o snapshot usado.
2. Corrigir a interpretação de `transcript.source`; separar `observed`, `planned`, `caption`, `none` e os estados de qualidade.
3. Recalcular cobertura por interseção: post com transcrição observada utilizável **e** métrica utilizável. O mínimo de duas contagens separadas não garante que sejam os mesmos posts.
4. Reconciliar vínculos confirmados e reconstruir DNA com dados existentes em lotes idempotentes, com modo de auditoria antes da escrita.
5. Medir quais líderes não têm evidência e o motivo: pendente, sem fala, incompleto, mídia indisponível, fora do formato suportado, falha de provedor.

### Quando novas leituras forem retomadas

Priorizar lacunas nos líderes e material necessário para formar a voz de cada criador, equilibrando distribuição por conta. Evitar que uma conta monopolize a fila ou que os mesmos posts impossíveis ocupem todas as tentativas.

Persistir estado, número de tentativas, próxima tentativa e motivo. A correção anterior de falta de saldo encerra a tentativa imediata, mas a rotina de recuperação ainda pode voltar a enfileirar. Adicionar pausa compartilhada por provedor, teste controlado de recuperação e retomada gradual.

Separar expiração de URL, token inválido, exclusão de mídia, falha temporária e formato incompatível. Proteger o trabalho com exclusão mútua por post/revisão; checar também existência e qualidade da evidência, não apenas a versão em `Metric.sceneElements`. Reaproveitar resultado já persistido se apenas a marcação final falhar.

Não elevar simplesmente o limite de 180 segundos: vídeos longos e carrosséis com vídeos exigem política de custo, leitura por partes quando apropriada e avaliação de completude. Nenhuma mudança de métrica de ranking deve provocar nova leitura de vídeo.

## 8. Otimização de custo e latência

- Separar custo da leitura multimodal, preparação da evidência, geração textual e revisão.
- Eliminar duplicação de texto no prompt. Enviar roteiro planejado junto da fala observada apenas quando a comparação agregar valor.
- Aplicar orçamento de tokens, preservando exemplos completos quando couberem; se cortar, declarar texto parcial e oferecer leitura segmentada. A presença de um campo `fullText` não garante integralidade.
- Preparar o DNA em fila e servir revisão disponível com indicador de atualização. Invalidar por nova evidência, métricas relevantes, confirmação de mapa ou preferência de voz.
- Cache do pacote deve incluir conta/capacidade, pedido normalizado, período, IDs pedidos e revisões de corpus, métricas e preferências. Fazer projeção leve antes de carregar textos extensos.
- Configurar provedor textual e política de fallback independentemente do provedor de vídeo. Falha de saldo não deve provocar chamadas sabidamente inúteis em cada etapa.
- Medir p50/p95, tamanho dos pacotes, tokens, custo por etapa, cache e quantas tentativas um roteiro exigiu. Fixar metas após a linha de base; a escrita no cliente tem custo/limites do cliente e não deve ser anunciada como gratuita.

## 9. Validação e aprendizado após a publicação

Reaproveitar os validadores mecânicos, distinguindo duração/cópia de avaliação de voz. Adicionar rubrica para naturalidade, aderência ao briefing, especificidade do criador, progressão, direção de gravação e novidade. Exigir referência para afirmações sobre o histórico.

A detecção atual de oito palavras iguais é um sinal útil, mas não mede toda a originalidade nem deve proibir automaticamente um bordão próprio aprovado. Avaliar repetição de estrutura/conteúdo e casos legítimos separadamente. Revisões automáticas devem continuar recebendo o contexto necessário; hoje uma revisão posterior pode reduzir o contexto ao texto e às restrições técnicas.

No salvamento, persistir versão do pacote, referências, objetivo, versões do gerador/avaliador e edições relevantes, aproveitando `aiVersionId` onde couber. A ligação com o post publicado deve guardar roteiro aprovado e fala publicada como versões distintas.

Capturar feedback simples: «parece comigo», trecho editado, motivo de rejeição e direção preferida. Medir desempenho em janelas comparáveis após publicação. Não confundir roteiro salvo, escolhido, publicado e bem-sucedido. Um único resultado fraco não deve apagar um padrão de voz; atribuição causal exige desenho de avaliação específico.

## 10. Sequência de entrega

| Etapa | Escopo | Arquivos/áreas principais | Critério de saída |
| --- | --- | --- | --- |
| 0 — Linha de base | Confirmar revisão a liberar; auditar cobertura/origens/métricas e consolidar correções anteriores | Auditoria de evidência, MCP, documentação | Diagnóstico reproduzível por criador e separação entre mudanças locais e produção |
| 1 — Correção fundamental | Origem, autorização, objetivo, período, métricas atuais, contexto comum no fallback e recibo honesto | `creatorScriptEvidencePack.ts`, `creatorScriptGenerationV3.ts`, `publishedContentEvidence.ts`, `catalog.ts`, `server.ts` | Pedidos equivalentes usam referências corretas em todo caminho interno; nenhuma alegação de uso falso |
| 2 — Escrita no cliente | Ferramenta de preparação, pacote limitado, referências próprias, política de uso e crítica | MCP, serviço comum de evidência, contratos e testes de conversa | Claude/ChatGPT recuperam referências, escrevem e revisam sem geração interna duplicada |
| 3 — Qualidade editorial | Voz/estrutura com trechos de apoio, mapa, contraste comparável, diversidade e feedback | DNA, evidência, avaliador, preferências | Melhora demonstrada em avaliação cega, com limitações explícitas |
| 4 — Cobertura e eficiência | Estados de fila, recuperação, atualização de métricas/vínculos, cache, custos | Worker, cron, sincronização, observabilidade | Falhas diagnosticáveis; sem releitura para atualizar métricas; retomada controlada |
| 5 — Aprendizado contínuo | Proveniência salva, publicação, edições e avaliação de resultados | `ScriptEntry`, perfis de estilo/resultado, telemetria | É possível rastrear pedido → referências → roteiro → edição → post → métricas |

Autorização e origem da evidência são pré-requisitos da etapa 2. Iniciar os estados de falha e diagnóstico da etapa 4 junto da etapa 1; não é necessário esperar o aprendizado contínuo para recuperar a operação.

Estimativa inicial de planejamento: etapa 0, 0,5–1 dia; etapa 1, 3–5 dias; etapa 2, 2–4 dias; etapa 3, 3–5 dias; etapa 4, 2–4 dias; etapa 5, 3–5 dias. Dias de engenharia focada, sujeitos à qualidade dos dados e dos testes; não incluem prazos externos nem tempo necessário para maturar resultados de posts.

## 11. Testes e critérios de aceite

### Contratos e regressões — sem chamadas pagas

1. Retenção alta e engajamento baixo não vencem automaticamente um pedido de engajamento.
2. Taxa e contagem absoluta obedecem à intenção; zero é diferente de métrica ausente; nenhum componente é contado duas vezes.
3. Texto `stored_script` nunca conta como fala observada. Texto truncado ou incompleto não é anunciado como integral.
4. Período, formato e referências próprias são respeitados; ampliação da busca aparece no recibo.
5. Alterar métricas atualiza seleção sem chamar leitor de vídeo.
6. Fallback recebe os mesmos exemplos autorizados; o recibo diferencia preparado, enviado e indisponível.
7. Sem capacidade privada, o serviço não lê corpus privado. IDs de outra conta são recusados em consulta, geração, crítica e salvamento.
8. Sem exemplos suficientes, a resposta permanece utilizável e declara a limitação, sem inventar voz aprendida.
9. Recibo salvo referencia a revisão efetiva do pacote; vínculo atualizado não exige reler vídeo.
10. Entrega duplicada do job não duplica leitura; saldo esgotado ativa pausa; recuperação não fica presa nos mesmos itens impossíveis.
11. Conteúdo de referência contendo comandos não altera a autorização nem provoca chamadas externas.

Adicionar testes do seletor e do fallback real com provedores simulados. Os testes atuais do motor MCP simulam o V3, e os testes V3 inspecionados cobrem principalmente utilitários de duração e cópia; eles não exercitam essas garantias ponta a ponta.

### Qualidade editorial e experiência

Construir amostra de pelo menos 10 perfis com vozes diferentes, três pedidos por perfil e casos de baixa cobertura. Comparar versão atual e proposta às cegas: parece com o criador, atende ao briefing, usa estrutura sustentada, traz novidade e está pronto para gravação.

Meta inicial proposta: preferência humana pela nova versão em pelo menos 70% das comparações, tratada como sinal de piloto e não prova estatística de melhora de engajamento. Exigir zero referência inventada e zero troca de origem nos casos de aceite. Cobertura baixa deve aparecer em 100% dos casos preparados para esse teste.

Rodar `npm run check:scripts-quality`, testes novos do seletor/provedores, `npm run test:mcp`, `npm run typecheck:mcp` e `npm run build` na implementação. O benchmark V3 atual chama provedor e banco real: executá-lo somente na etapa controlada de validação, com orçamento definido. Testes simulados comprovam o fluxo, mas não substituem avaliação editorial com modelos reais.

## 12. Liberação e conclusão

Versionar contratos e introduzir mudanças de forma compatível. Fazer piloto com contas controladas, acompanhar origem correta, cobertura dos líderes, falhas, latência e preferência humana. O retorno à versão anterior deve preservar recibos e dados; correções de autorização e proveniência não devem ser desativadas junto com um experimento de ranking.

Atualizar as notas de MCP e Roteiros, revisar `script-intelligence-v3.md` e regenerar o inventário se surgirem modelos, comandos, rotas ou variáveis. Variáveis novas precisam existir no ambiente local e na Vercel conforme a regra do projeto.

O primeiro marco funcional é a conclusão das etapas 0–2: selecionar referências corretas, manter origem e período, entregar o pacote ao escritor escolhido e permitir inspeção das fontes. As etapas seguintes melhoram personalidade, cobertura, operação e aprendizado. Busca vetorial, fine-tuning e expansão indiscriminada de leitura devem esperar evidência de necessidade e benefício.
