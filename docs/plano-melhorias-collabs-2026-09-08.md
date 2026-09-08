# Plano completo de melhorias de Collabs

Data: 08/09/2026. Status: **implementação local realizada; liberação e validação editorial do piloto pendentes**. Ver [implementação, verificações e liberação](implementacao-collabs-2026-09-08.md).

Base: [auditoria de Collabs](auditoria-collabs-2026-09-08.md). Abrange a página dedicada, a aba do Perfil e os serviços de inteligência compartilhados com o MCP. Os números abaixo são da auditoria, não uma nova medição.

## Resultado esperado

A criadora encontra uma pauta que faz sentido para o momento dela, entende por que foi sugerida e consegue gravar. Quando outra pessoa acrescenta algo concreto, a página apresenta uma proposta de parceria executável. Se as duas pessoas escolherem essa proposta, ambas veem a mesma ideia, cada uma com sua responsabilidade, e podem combinar a gravação pelo Instagram.

Salvar, descartar, demonstrar interesse e combinar são ações diferentes. Cada ação precisa sobreviver a uma atualização, troca de dispositivo, nova rodada e falha de rede.

## Princípios e decisões propostas

1. Manter o baralho como experiência principal de descoberta. Salvas e Combinadas permanecem acessíveis, inclusive com rodada vazia.
2. Manter interesse paralelo e privado. Ninguém vê que recebeu um interesse antes da reciprocidade. Não criar convite com cobrança de resposta, ranking público ou chat interno.
3. Uma parceria recomendada precisa ter contribuição concreta de cada pessoa. Similaridade temática sozinha não basta. Não aumentar artificialmente a quantidade de collabs para melhorar um indicador.
4. A confirmação da mesma pauta exige o mesmo identificador de proposta e versão. Mesmo território, sozinho, não representa aprovação de um plano comum.
5. Identidade confirmada orienta a geração. Novas leituras enriquecem pautas e propõem revisão do mapa, sem substituir silenciosamente a narrativa confirmada.
6. Separar informação declarada, conteúdo observado e hipótese criativa. Métrica importada não equivale a vídeo analisado.
7. Compartilhar regras e estados entre computador, celular e MCP. A apresentação pode variar; a identidade da sugestão e as permissões não.
8. Trabalho de IA vai para fila. Abrir a página deve carregar o que já está pronto e informar o que está sendo preparado.
9. Preservar salvas, interesses e combinações durante a evolução. Não regenerar silenciosamente uma proposta já aceita.

## Ponto de partida e como interpretar

Foram encontradas 964 pautas para 81 criadores. Das 150 com classificação nova, 148 são individuais e duas permitem collab. Cinco contas passam por plano e participação antes do filtro de avatar e da exclusão do próprio usuário. Não há matches confirmados registrados.

O objetivo não é transformar as 148 pautas individuais em parcerias. É retirar bloqueios desnecessários, permitir participação explícita, criar boas propostas para duplas compatíveis e medir se elas chegam aos dois lados. A distribuição antiga não permite concluir qual taxa de match seria saudável.

## Entrega 1 — Corrigir a integridade de sugestões e decisões

**Prioridade imediata. Pode sair antes do novo motor de inteligência.**

### Mudanças

- Registrar cada sugestão com ID, dono, parceiro, pauta, versão, contexto e justificativa. O cliente envia o ID e a ação; o servidor carrega e valida os dados de origem.
- Corrigir desde já o retorno de interesses pendentes: incluir parceiro e snapshot aceitos. A tela deixa de montar o parceiro usando o cache atual.
- Vincular contribuições, motivo e storyboard à dupla efetivamente escolhida. Se a prioridade de reciprocidade mudar o candidato, descartar os textos da escolha anterior e usar somente informações válidas para a dupla nova.
- Proteger transições. Uma decisão repetida devolve o mesmo resultado; não troca o parceiro de um match confirmado nem recoloca expiração no documento confirmado.
- Validar propriedade, versão, expiração e elegibilidade antes de aceitar nova intenção. Uma saída da descoberta bloqueia novas sugestões; não deve apagar o histórico de uma parceria que já existia.
- Usar identificadores estáveis de participantes nos novos storyboards. Para legado cuja orientação original seja conhecida, adaptar `viewer`/`partner` ao leitor; quando não for possível determinar os papéis, apresentar a divisão como pendente de revisão.
- Manter registro canônico único da combinação e enfileiramento único do aviso, mesmo com duas confirmações simultâneas. Operações relacionadas devem ser atômicas ou possuir reconciliação explícita.

### Critérios de aceite

- Aceitar Marina, vencer o cache e passar a sugerir João não altera o interesse em Marina.
- Trocar o candidato da IA não reaproveita a experiência de outra pessoa.
- Dois requests simultâneos ou repetidos não criam combinações/avisos duplicados.
- Um match confirmado continua sem expiração após retry.
- Não é possível registrar uma sugestão de outra conta ou fabricar uma proposta alterando o corpo do request.
- Cada etapa aparece com o responsável correto nos dois dispositivos.

## Entrega 2 — Unificar os dois acessos e garantir atualização

**Prioridade imediata, junto da entrega 1.**

### Mudanças

- Extrair um controlador comum de Collabs, consumido por `CollabsPinnedBoard` e `DiagnosticoRealShellClient`: carregamento, geração, decisões, cota, permissões, WhatsApp, erros e atualização.
- Separar quatro recursos: rodada de sugestões, ideias salvas, interesses próprios e combinações. A ausência ou falha de um não apaga os outros.
- Consultar Combinadas mesmo sem pautas ativas. Falha do matching não bloqueia plano salvo ou histórico confirmado.
- Verificar HTTP e corpo das respostas. Apresentar mapa incompleto, cota esgotada, processamento e indisponibilidade como estados diferentes.
- Revalidar decisões e combinações ao retornar à aba ou à janela. Como regra inicial, revalidar no retorno se a última leitura tiver mais de 30 segundos; permitir atualização manual. Não chamar IA nesse caminho.
- Durante uma ação ou geração pendente, consultar seu estado com intervalo limitado e recuo progressivo; interromper quando terminar ou a tela ficar oculta. Não manter polling de IA em segundo plano.
- Usar controle de versão/abort para uma resposta antiga não sobrescrever uma mais nova.
- Exibir sugestões novas em uma próxima rodada ou mediante ação explícita. Não mover um card durante leitura ou gesto.
- Consumir o vínculo real do WhatsApp e o estado de entrega, sem valores fixos.

### Critérios de aceite

O mesmo usuário encontra os mesmos salvos, interesses, parceiros e permissões nas duas entradas. Um 429 mostra cota; um 500 oferece nova tentativa. Uma combinação feita pelo outro lado aparece na próxima revalidação. Rodada vazia mantém histórico e ações de conta.

## Entrega 3 — Construir uma fonte comum de evidência

**Depende do contrato da entrega 1; integra as melhorias já implementadas localmente no Perfil.**

### O contexto de cada criadora

| Camada | Fonte e uso |
| --- | --- |
| Identidade confirmada | Narrativa, territórios e limites explicitamente aceitos; orientam a pauta |
| Sinais recentes | Conteúdo efetivamente lido nos últimos 28 dias; orienta atualidade |
| Histórico de resultados | Até 90 dias, com formatos e maturidade comparáveis; orienta exemplos de desempenho |
| Preferências | Ideias salvas, gravadas, recusadas e motivos opcionais; orientam variedade e execução |
| Condições práticas | Formato, modalidade e disponibilidade informados; orientam viabilidade da collab |

### Mudanças

- Guardar fonte, IDs dos posts, data da leitura, período, cobertura e versão do contexto. Separar capacidade de ler assunto, cena e abertura; ausência de áudio não é falha quando não se aplica.
- Usar o mesmo núcleo de evidência do Perfil e, onde couber, os seletores já existentes de roteiros. Reaproveitar dados e testes; não criar uma terceira interpretação independente do criador.
- Um novo post lido pode atualizar os assuntos recentes antes de ter métricas maduras. Afirmações sobre desempenho aguardam comparação adequada.
- Quando faltarem leituras recentes, continuar oferecendo ideias baseadas no mapa, identificadas como exploração. Não usar “confiança forte” por haver muitos números importados.
- Para ganchos, separar exemplo histórico, abertura recente e mecanismo recorrente. Nenhuma fala do parceiro oriunda de vídeo privado entra na sugestão para outro usuário.
- Versionar o contexto por mudança relevante de evidência ou confirmação; atualização de timestamp sem informação nova não dispara regeneração.

### Confiança proposta

- **Baseada no seu Mapa:** ideia coerente com informações confirmadas, sem alegação de desempenho.
- **Observada nos seus vídeos:** sustentada por conteúdo lido e exemplos rastreáveis; uma ocorrência pode ser mostrada, identificada como pontual.
- **Hipótese para testar:** variação criativa, formato novo ou associação ainda não sustentada por resultados comparáveis.
- **Padrão de resultado consistente:** somente após satisfazer a política compartilhada e sua validação de piloto. A implementação local do Perfil mantém essa promoção pública desativada; Collabs não deve antecipá-la.

Como ponto inicial de calibração, a política atual verifica pelo menos seis posts no grupo, 15 referências do mesmo formato, três semanas, cobertura recente e métricas comparáveis, além de estabilidade do sinal. Isso é critério operacional candidato, não certificado estatístico nem prova de causalidade.

### Critérios de aceite

Doze métricas sem cenas não geram evidência visual forte. Um post analisado recentemente pode atualizar a pauta sem reescrever a identidade. Todo motivo baseado em conteúdo permite identificar a fonte para seu proprietário. A pessoa sugerida como parceira não recebe dados privados da outra.

## Entrega 4 — Melhorar a qualidade e a variedade das pautas

**Depende da entrega 3 e da fila de geração da entrega 8.**

### Processo proposto

1. Montar o contexto de identidade, momento, evidências e preferências.
2. Gerar mais candidatos do que serão exibidos, dentro do orçamento configurado.
3. Validar cada candidato: narrativa + território, coerência do gancho com a história, filmabilidade, fontes e respeito aos limites pessoais.
4. Comparar com o histórico para retirar repetições de ideia, não apenas de palavras no título.
5. Compor uma rodada pequena e diversa, sem obrigar uma quantidade fixa de collabs.
6. Avaliar separadamente quais pautas podem ganhar algo com uma dupla real. Uma classificação preliminar da IA não pode encerrar sozinha essa análise.

### Regras editoriais

- A pauta precisa conter uma situação, tensão, pergunta ou demonstração concreta. “Fale sobre rotina” não é entrega suficiente.
- O gancho precisa prometer algo que o plano entrega. Evitar fórmulas recorrentes como “A verdade sobre...” sem um motivo editorial.
- Não escrever acontecimentos pessoais como fatos sem fonte. Quando a cena for proposta, deixar explícito: “Adapte para uma situação que você viveu”.
- Informar o que mostrar, a intenção de cada etapa, a virada e o fechamento. Duração é estimativa, não promessa de resultado.
- Explicar “por que agora” com evidência temporal. Sem cobertura suficiente, não afirmar que a criadora abandonou um tema ou publicou pouco sobre ele.
- Usar padrões vencedores como matéria-prima, sem manter a pessoa presa ao mesmo assunto. Exploração deve ter espaço próprio.
- Permitir direcionamento simples: assunto, formato e “quero algo diferente”. Motivo de descarte é opcional; não criar formulário a cada gesto.
- Separar recusa de parceiro de recusa da pauta. Recusar João não significa rejeitar o assunto ou excluir todos os criadores semelhantes.
- Transformar horário em sugestão de teste, compatível com formato e evidência. Com base insuficiente, omitir em vez de inventar precisão.

### Avaliação de qualidade

Preparar um conjunto fixo de pelo menos 30 cenários: mapas novos, antigos e alterados; poucas leituras; muitos vídeos; identidade divergente; pautas repetidas; limites pessoais; dupla sem ganho real; territórios equivalentes e palavras semelhantes com sentidos diferentes.

Rubrica de 0 a 2 por dimensão: coerência com o mapa, evidência honesta, especificidade, gancho/plano coerentes, viabilidade e diversidade. Nas pautas a dois, adicionar contribuição de cada pessoa e coerência do plano comum. Como corte inicial de piloto, nenhuma dimensão crítica pode receber zero; revisar qualitativamente a amostra, sem tratar nota automática como preferência humana comprovada.

### Critérios de aceite

Ausência de narrativa ou território bloqueia geração com orientação clara. Histórias pessoais sem fonte aparecem como propostas adaptáveis. Casos sem ganho de colaboração permanecem solo. A rodada não contém a mesma ideia apenas reescrita. O novo motor precisa superar os problemas do conjunto de referência antes de ser ampliado.

## Entrega 5 — Tornar a participação explícita e a descoberta viável

**Pode começar depois da entrega 1, enquanto a evidência é preparada.**

### Mudanças

- Adicionar “Disponível para collabs”, com explicação curta de como a pessoa aparece e como funciona a escolha privada.
- Oferecer modalidade: remoto, presencial ou ambos. Para presencial, usar cidade/região com consentimento, sem endereço exato. Não inferir disponibilidade só porque as cidades coincidem.
- Usar estado de descoberta que diferencie não informado, disponível e pausado. Guardar data e origem da escolha. Histórico de interesse não substitui uma pausa explícita.
- Não promover contas legadas automaticamente para “disponível” quando a intenção for ambígua. Solicitar escolha na próxima visita; mostrar status claro. Essa regularização pode reduzir o pool temporariamente e precisa ser medida.
- Aplicar elegibilidade antes da limitação de candidatos, incluindo direito atual de acesso e condições da proposta. Usar paginação/seleção estável para novos participantes não ficarem atrás de um corte arbitrário de mapas.
- Reservar oportunidade de exposição para participantes compatíveis pouco mostrados. Isso é regra interna de distribuição, não ranking público.
- Remover exigência de foto como bloqueio automático de uma conta elegível: oferecer avatar de iniciais quando faltar imagem. Identidade válida e perfil utilizável continuam necessários.
- Garantir que o contato por Instagram exista antes de prometer esse próximo passo. Se faltar, orientar a completar o perfil.
- Ao pausar, remover de novas sugestões e revalidar caches já produzidos. Interesses ainda pendentes deixam de formar novas combinações durante a pausa; histórico confirmado continua acessível.

### Critérios de aceite

Uma pessoa pode entrar na descoberta sem primeiro receber uma sugestão. Pausar impede novas aparições e confirmações de propostas pendentes, inclusive via MCP e cache. Nenhuma pessoa entra sem opção compatível com a migração. Candidatos sem foto podem aparecer de forma identificável. O tamanho do pool real é mensurável em cada etapa.

## Entrega 6 — Recomendar a dupla pela contribuição à pauta

**Depende das entregas 3, 5 e 8.**

### Seleção em duas etapas

**Primeiro, compatibilidade obrigatória:** participação, permissões, narrativa/território aplicáveis, modalidade, disponibilidade e ausência de restrição válida. Rejeição recente da parceria limita reapresentações equivalentes; não apaga a pauta solo.

**Depois, qualidade:** o que cada pessoa pode mostrar ou explicar, o que muda com a dupla, contraste útil, execução possível e evidência permitida. Equivalência de território deve usar IDs ou correspondências explícitas validadas. Palavras iguais com significados diferentes não comprovam encaixe.

### Mudanças

- Considerar tanto caminhos de parceria das pautas atuais quanto oportunidades reais entre mapas disponíveis. Não depender de a geração inicial emitir `collab_optional` para tentar descobrir uma boa proposta.
- Reservar espaço para reciprocidade antes do corte final, desde que a proposta continue válida. Priorizar a chance de encontro sem revelar que alguém já demonstrou interesse.
- Avaliar apenas um conjunto limitado de pautas indecisas por vez; salvas e matches não precisam gastar novamente com escolha de parceiro.
- Garantir explicação concreta: “Você mostra X; Marina acrescenta Y; juntas conseguem demonstrar Z”. Cada afirmação sobre a parceira deve ter fonte autorizada para descoberta.
- Não apresentar uma dupla como recomendação validada se só houve aproximação por palavras. Em indisponibilidade de IA, manter sugestões anteriores válidas, mostrar processamento ou continuar com pautas solo.
- Respeitar “sem boa parceria” quando esse for o resultado. Não fixar uma cota mínima de collabs por rodada.
- Registrar origem da seleção, versão do contexto, tempo e motivo de ausência. Calibrar pesos internos com avaliação, sem publicar uma porcentagem arbitrária de compatibilidade.

### Critérios de aceite

Casos como território equivalente com rótulos distintos podem ser encontrados; palavras ambíguas não geram parceiro inadequado. Reciprocidade válida não desaparece pelo corte inicial do pool. Uma falha de IA não fabrica justificativa. Toda collab tem benefício específico em relação à versão solo.

## Entrega 7 — Fazer os dois lados escolherem a mesma proposta

**Depende da integridade e do novo matching. Completa a promessa central do produto.**

### Objeto compartilhado

Criar uma proposta canônica para a dupla: ID, versão, participantes, território, ideia central, gancho, plano, responsáveis por usuário, modalidade, fontes permitidas, datas e validade. A pauta pessoal pode apontar para essa proposta, mas não é sua identidade compartilhada.

Os dois recebem a mesma ideia central e plano. O motivo personalizado pode mudar. A IA não gera uma segunda história incompatível para o outro lado.

### Estados e comportamento

| Situação | Experiência e regra |
| --- | --- |
| Sugestão disponível | Ambos podem conhecer a proposta; nenhum vê intenção alheia |
| Interesse de um lado | Somente quem escolheu vê seu próprio estado; o outro recebe uma recomendação privada normal |
| Recusa ou cancelamento | Encerramento silencioso para a outra pessoa; não mostrar rejeição nominal |
| Prazo encerrado | Interesse pendente perde validade; não gerar match posteriormente sem nova escolha |
| Dois interesses na mesma versão | Confirmar uma vez e apresentar Combinadas com o mesmo plano |
| Mudança material de proposta | Nova versão; os dois precisam escolher essa versão, sem migrar aceites antigos silenciosamente |
| Gravação/publicação | Status informado pelos participantes; link de publicação opcional e validado quando disponível |

Manter inicialmente os prazos existentes de 45 dias para interesse e 30 para recusa, revisando-os com dados de uso. A validade apresentada nunca deve ser promessa de resposta do outro lado.

Para combinações legadas sem proposta comum, preservar a relação como interesse mútuo confirmado e pedir revisão do plano quando necessário; não afirmar retroativamente que ambos aprovaram um roteiro que não viram.

### Critérios de aceite

Dois interesses no mesmo território, mas em propostas diferentes, não aprovam o mesmo plano. Os dois veem título e versão iguais, com tarefas corretas. Atualização do mapa não troca um plano aceito. Nenhuma tela revela recusa ou interesse unilateral de outra pessoa.

## Entrega 8 — Geração, custos, cotas, cache e avisos

**A fundação da fila deve ser feita após a entrega 2 e antes de ativar os novos motores das entregas 4 e 6.**

### Geração e cotas

- A ação cria ou reutiliza um pedido de geração; o worker monta evidências, chama IA, valida, persiste a rodada e informa conclusão.
- Usar chave de idempotência, trava por pedido, deduplicação por contexto e tentativas limitadas. Em falha de resposta após cobrança externa, não assumir que retry será gratuito; reutilizar resultado/checkpoint quando existir e registrar custo por tentativa.
- Enquanto prepara a rodada, manter os salvos e a rodada anterior. Atualizar o conjunto inteiro após persistência consistente.
- Reservar cota atomicamente antes do processamento. Consumir uma rodada quando houver entrega válida; liberar reserva em falha. Falhas podem ter custo operacional de IA mesmo sem consumir cota da criadora.
- Uma geração válida de uma a seis pautas representa uma rodada, conforme a regra atual declarada; não estimar cota por número de documentos dividido por três. Tornar entrega parcial explícita.
- Corrigir reset em dezembro. API e interface usam a mesma data e exibem saldo.
- Centralizar direitos comerciais. A referência atual da API é três rodadas gratuitas e 30 Pro por mês, com parcerias Pro; conferir a oferta publicada antes da liberação e eliminar a divergência entre entradas. O plano não muda preços ou assinaturas.
- Estabelecer limites explícitos por job, usuário e janela operacional; monitorar latência, tentativas e gasto. Nenhum aumento de orçamento está implícito nesta proposta.

### Cache e atualização

- Versionar resultado por regras, proposta, participantes, fontes e contexto relevante.
- Invalidar por nova evidência pertinente, confirmação de mapa, disponibilidade, localização, permissão, recusa ou expiração. Para mudanças de elegibilidade, também revalidar no momento de servir/aceitar; não depender só de invalidar cache.
- Manter snapshots aceitos estáveis. Invalidar uma sugestão indecisa não reescreve uma parceria já confirmada.
- Registrar motivos de cache vazio e falha. “Sem parceiro” e “não foi possível calcular” são estados diferentes.

### Avisos

- Manter aviso dentro do aplicativo como canal básico.
- Integrar WhatsApp a template apropriado, vínculo e consentimento vigentes, deduplicação e fila com retry. Não depender de texto livre para uma notificação proativa.
- Exibir “avisos ativos” somente com configuração operacional válida. Falha do aviso não desfaz nem esconde o match.
- Contato segue pelo Instagram, sem criação de chat. Não considerar clique em “Chamar” como prova de mensagem enviada.

### Critérios de aceite

Cliques repetidos criam um pedido; concorrência não ultrapassa a cota. Falha não remove salvas nem conta uma rodada entregue. Janeiro avança o ano corretamente. Pausar descoberta invalida a elegibilidade imediatamente mesmo com cache. Cada match gera no máximo um aviso por destinatário e tipo, com estado de entrega verificável.

## Entrega 9 — Refinar a experiência completa

**Aplicar sobre o controlador comum. Ajustes de acessibilidade e texto podem sair já na entrega 2.**

### Organização

Manter **Collabs** como nome e explicar na entrada: “Ideias para gravar sozinho ou com alguém que acrescenta ao seu conteúdo”. Dar acesso claro a Descobrir, Salvas e Combinadas sem criar uma quarta área obrigatória. Interesses próprios ficam em Salvas, com parceiro e validade visíveis apenas para seu dono.

### Card e ações

- Frente: título concreto, formato, duração estimada, solo/parceria e uma frase de motivo. Se houver collab, pessoa e contribuição principal já aparecem.
- Verso: benefício da dupla ou da pauta, gancho e uma evidência útil. Detalhe completo mantém cenas, checklist, cópia e fontes do proprietário.
- Pauta solo: “Quero gravar” e “Não é pra mim”. Parceria: “Quero fazer com [nome]” e “Não agora”; preservar opção de gravar solo.
- Ao descartar ou salvar, feedback discreto com “Desfazer”. Desfazer de interesse obedece ao estado atual: se os dois já confirmaram, apresentar a ação de encerrar a parceria em vez de apagar o match como se nunca tivesse existido.
- Permitir “Outra ideia neste assunto” e “Quero explorar outro assunto”. Gerar somente mediante ação e informação clara sobre cota quando aplicável.

### Salvas e Combinadas

- Biblioteca paginada independente da rodada e do limite de 30. Busca simples por título/assunto e distinção entre solo, aguardando e gravada.
- Não acumular números públicos ou comparação entre criadores. Contadores privados servem à navegação.
- Em Combinadas: pessoa, pauta comum, quem grava cada parte, modalidade, contato e próximo passo. Histórico deve continuar disponível após trocar rodada ou perder acesso a novas recomendações, respeitando as regras de acesso aos próprios dados.

### Estados de exceção

| Estado | Resposta da página |
| --- | --- |
| Mapa insuficiente | Explicar o elemento ausente e levar à ação correspondente no Perfil |
| Vídeos ainda em leitura | Mostrar progresso/cobertura e oferecer ideias baseadas no mapa quando válidas |
| Sem boa parceria | Informar ausência de oportunidade agora; continuar com ideias solo e participação acessível |
| IA indisponível | Preservar conteúdo existente e mostrar tentativa/retorno possível |
| Cota esgotada | Mostrar saldo e data de renovação; manter biblioteca e histórico |
| Sem Instagram para contato | Orientar a completar o dado, sem link quebrado |
| Falha ao salvar/interessar | Reverter otimismo, manter o card e oferecer retry idempotente |
| Tudo decidido | Indicar fim da rodada, abrir salvas e oferecer novas ideias |

### Celular, computador e acessibilidade

No celular, manter um card por vez e ações ao alcance sem sobrepor navegação. No computador, reduzir altura vazia e usar espaço para contexto/plano ao lado, preservando a decisão principal. Verificar no shell autenticado, pois a auditoria visual usou preview.

Todos os diálogos devem receber foco, contê-lo enquanto abertos, fechar com Escape e devolver foco ao acionador. Frente oculta não recebe interação. Gesto tem botão equivalente; animação respeita preferência por movimento reduzido; textos longos e zoom não escondem ações.

### Critérios de aceite

Concluir descoberta → salvar → abrir plano → demonstrar interesse → confirmar → contato em celular e computador. Repetir com teclado, rede lenta, erro e retorno ao foco. Mais de 30 salvas continuam acessíveis. O usuário consegue distinguir ideia solo, sugestão de parceiro, interesse próprio e parceria confirmada.

## Entrega 10 — Migração, testes e publicação gradual

### Migração sem inventar histórico

1. Corrigir a auditoria operacional para ler `opportunityBrief.kind` e o funil real de elegibilidade. Contar eventos antes da expiração dos documentos, respeitando retenção e minimizando dados pessoais.
2. Inventariar decisões e combinações existentes no momento da execução; a auditoria encontrou zero matches, mas o plano não pode assumir que continuarão sendo zero.
3. Criar contratos e índices novos de forma aditiva. Leitura aceita versão antiga e nova durante a transição.
4. Preparar script idempotente com `--dry-run`, totais de afetados, ambiguidades e possibilidade de retomada. Não inferir consentimento ou aprovação de plano com base em ausência de informação.
5. Recuperar snapshot de interesse a partir do documento histórico, nunca do parceiro recomendado atualmente. Registros irrecuperáveis ficam identificados para revisão.
6. Não converter todas as pautas antigas para o formato novo nem reprocessar tudo com IA. Reavaliar pautas indecisas em lotes limitados; salvas e propostas aceitas permanecem reconhecíveis.
7. Invalidar apenas caches de sugestão incompatíveis. Manter legado legível e registrar resultados da migração.

### Verificação

- Transformar as sete reproduções da auditoria em testes permanentes que exijam o comportamento corrigido. Remover a duplicação temporária da contagem de cobertura.
- Testar propriedade e versão de proposta, troca de parceiro, concorrência, replay, expiração, pausa, saída/retorno, biblioteca vazia, disponibilidade de contato e permissões das duas entradas/MCP.
- Incluir testes de persistência/concorrência em banco isolado; mocks sozinhos não demonstram atomicidade e comportamento de índices.
- Avaliar o conjunto editorial antes/depois e revisar fontes, histórias pessoais e justificativas da dupla.
- Verificar os dois shells autenticados com dados controlados, desktop e mobile. Testar teclado, textos longos, loading, falha, cota, estados legados e conta sem mapa.
- Rodar testes pertinentes, tipos, lint e `npm run build` antes de envio. Se alterar prompts de roteiros ou peças compartilhadas com eles, executar `npm run check:scripts-quality`; a geração de pautas também precisa de benchmark específico.
- Rotas/modelos/comandos novos entram no inventário via `npm run brain`; variáveis novas são documentadas e configuradas nos ambientes necessários.

### Liberação

Publicar primeiro contratos compatíveis e correções de integridade. Habilitar nova geração e propostas comuns para um grupo controlado somente depois dos testes e da configuração de filas/provedores. Ampliar após observar resultados, sem prazo fictício para obter reciprocidade em uma base pequena.

Pausar a ampliação diante de troca de parceiro, vazamento de intenção unilateral, perda de histórico, invasão de cota ou associação de evidência à pessoa errada. Recuar a geração nova por configuração, mantendo leitura dos documentos criados e as proteções de integridade. Nunca fazer rollback para uma versão incapaz de ler propostas já aceitas.

## Medição de sucesso

| Indicador | Definição e objetivo |
| --- | --- |
| Elegibilidade real | Quantas contas passam em cada filtro; corrigir bloqueios e estimular participação explícita |
| Tempo para primeira oportunidade | Desde estar elegível até ver uma proposta válida; separar ausência de dupla de atraso de processamento |
| Cobertura de exposição | Propostas que chegaram aos dois lados elegíveis durante a validade |
| Interesse | Escolhas positivas divididas por exposições únicas válidas, segmentadas por origem da sugestão |
| Reciprocidade | Propostas confirmadas pelos dois sobre propostas efetivamente mostradas aos dois; considerar tempo e expiração |
| Utilidade da pauta | Salvamento e gravação declarada, com motivo opcional; não assumir que salvar é publicar |
| Contato/publicação | Clique no Instagram separado de contato declarado; publicação vinculada separada de intenção |
| Qualidade | Avaliação editorial, repetição, contribuição concreta, cobertura e correção das fontes |
| Confiabilidade | Erros, latência, tentativas, cota, cache inválido e custo por rodada entregue |

Metas de integridade: zero troca de parceiro, zero atribuição a pessoa errada, zero perda de combinação por retry e nenhuma revelação unilateral. Para conversão e retenção, colher uma linha de base antes de fixar porcentagens. O piloto deve ser analisado por criadores únicos e propostas únicas, sem inflar resultados por reabertura da página.

## Sequência de implementação

| Marco | Entregas | Condição para avançar |
| --- | --- | --- |
| A — Confiabilidade | 1 e 2, incluindo mensagens e teclado críticos | Reproduções corrigidas; entradas consistentes |
| B — Base compartilhada | 3, 5 e fundação de fila/cota da 8 | Evidência versionada, participação inequívoca e jobs controlados |
| C — Qualidade das sugestões | 4 e 6 | Avaliação editorial e regressões aprovadas |
| D — Proposta realmente comum | 7 e conclusão da 8 | Dupla escolhe mesma versão; avisos idempotentes |
| E — Experiência e adoção | 9 | Fluxos completos nas duas superfícies |
| F — Expansão | 10 e leitura dos indicadores | Migração verificada, custo controlado e piloto sem falhas de integridade |

Medição, testes e compatibilidade de dados acompanham todos os marcos. Estimativas de calendário só devem ser feitas após decompor os marcos em mudanças e confirmar dependências operacionais; ativação de template, disponibilidade de IA e participação de criadores não têm prazo garantido por código.

## Mapa técnico da implementação

Código novo de negócio vai em `src/app/lib/collabs/` e, para pautas/evidência, no domínio correspondente sob `src/app/lib/`, com adaptadores para os serviços históricos. Evitar copiar regras para mais arquivos dentro de `boards/videoUpload`. Rotas permanecem finas.

| Área | Ponto atual e destino |
| --- | --- |
| Controlador de interface | Unificar comportamento de `CollabsPinnedBoard` e `DiagnosticoRealShellClient`; manter apresentação no dashboard |
| Decisões e propostas | Evoluir `CollabInterest` e `CollabMatch`; adicionar persistência de sugestão/proposta versionada se necessária, sem usar pautaId como identidade única de uma dupla |
| Descoberta e ranking | Serviço comum consumido por `narrativeCollabMatchingService`, `perPautaCollabMatchingService` e MCP |
| Evidência | Reutilizar política do Perfil e seletores aplicáveis de roteiros; adaptar `creatorEngagementBaselineService` e `contentIdeasOpportunityContext` |
| Geração | Adaptar `contentIdeasGenerationService`, prompt, diversidade e validação; execução por worker |
| Estado de trabalho e cota | Persistir evento de geração e resultado de entrega; reserva atômica e recuperação |
| Cache | Evoluir `PerPautaCollabCache` com versões e revalidação de elegibilidade |
| Biblioteca e histórico | Paginação independente em leitura de pautas e consulta própria de combinações |
| Notificações | Evento durável de match e envio pelo serviço existente de WhatsApp com template |

## Definição de conclusão

O plano estará concluído quando a pessoa conseguir usar as duas entradas com estado consistente, receber pautas sustentadas por seu mapa e evidências, encontrar uma dupla por contribuição real, confirmar a mesma proposta que a outra pessoa e recuperar tudo depois. A operação precisa mostrar falhas e custos, e os testes precisam cobrir os defeitos encontrados. A quantidade de cards produzidos não é critério suficiente de sucesso.
