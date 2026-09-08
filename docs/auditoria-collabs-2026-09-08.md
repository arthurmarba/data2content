# Auditoria de Collabs — 8 de setembro de 2026

A página tem uma base visual clara e bons componentes de gravação, mas a inteligência e o encontro entre criadores ainda não sustentam a promessa com consistência. As prioridades são corrigir a identidade das sugestões, preservar as parcerias e aumentar oportunidades reais de encontro. Uma troca de layout, isoladamente, não resolveria os principais problemas.

## Escopo e evidência

- Código da página `/dashboard/collabs`, aba Collabs do Perfil, cards, gavetas, plano de gravação, geração, descoberta, cache, interesses e notificações.
- Banco real consultado **somente para leitura**, em 08/09/2026, aproximadamente 01h15–01h19 de Brasília. Nenhuma geração de IA, mensagem, interesse ou match real foi acionado.
- Navegador local com o preview existente `/dev-collabs-preview`, em 390 × 844 e 1440 × 900: frente/verso, plano completo, salvar, avançar, Combinadas e teclado. O preview usa dados fictícios; não é um teste autenticado do serviço em produção. Erros 401 do status de plano nesse preview sem sessão não foram classificados como falhas de produção. Há inconsistências entre textos e storyboard dos próprios fixtures, também excluídas dos achados reais.
- 114 testes existentes passaram, em 11 suítes. Sete reproduções adicionais confirmaram os comportamentos defeituosos descritos abaixo, usando banco, IA e WhatsApp simulados. Os arquivos temporários também repetem 33 testes existentes: não devem ser somados como nova cobertura.
- Histórico de branches consultado. O aprimoramento de Collabs `a91a4b0a` já está contido no checkout auditado. Esta análise não afirma que todo o checkout está publicado.
- Nenhum código de produto foi alterado nesta auditoria. Alterações anteriores do trabalho sobre o Perfil foram preservadas.

## O que os dados mostram

| Medida | Resultado | Leitura correta |
| --- | --- | --- |
| Pautas armazenadas | 964, de 81 criadores | Inclui histórico, não apenas o que aparece hoje |
| Estado das pautas | 194 ativas, 86 salvas, 119 descartadas, 565 substituídas | O produto já preserva salvas ao trocar a rodada |
| Pautas com classificação nova de oportunidade | 150 | 148 individuais e apenas 2 com parceria opcional |
| Pautas sem essa classificação | 814 | Legado tem comportamento diferente no matching |
| Pautas com storyboard estruturado | 281 | Boa parte do acervo depende da apresentação legada |
| Criadores com decisões armazenadas | 11 | Há 8 interesses e 7 recusas atualmente armazenados; documentos podem expirar |
| Matches confirmados | 0 | Zero tanto no registro canônico quanto nos documentos de interesse |
| Contas que passam por plano + participação | 5 | Antes de excluir o próprio usuário e de exigir avatar; todas as cinco têm narrativa e território |
| Dessas cinco, com flag de participação `false` | 3 | Entram pelo histórico. `false` também é o padrão do modelo: não comprova que essas três pessoas pediram para sair |

**98,7% das pautas com a classificação nova são individuais.** A regra exclui essas pautas da busca de parceiros antes de comparar criadores. Não significa que devam virar collabs à força, mas é um forte sinal de desalinhamento entre oferta e promessa da página.

O script antigo `audit:collabs` consulta `opportunityKind` na raiz, enquanto o campo persistido é `opportunityBrief.kind`. Por isso ele reporta incorretamente todas as 964 como legado/elegíveis. Seu funil de 118 mapas com avatar também não aplica o filtro atual de plano e participação. Os números corrigidos acima vieram de consulta complementar. Zero matches não é, sozinho, prova de causalidade ou taxa de conversão: faltam exposições e o histórico de decisões é sujeito a expiração.

## Correções prioritárias

### 1. Não trocar a pessoa depois de registrar o interesse — alta

A decisão pendente é devolvida apenas com `pautaId` e `decision`. A interface recompõe o nome do parceiro usando o matching atual. Se o cache vencer e a pauta passar de Marina para João, um interesse em Marina pode aparecer como aguardando João. A decisão persistida continua apontando para Marina, criando contradição entre tela e banco.

**Correção:** devolver parceiro e snapshot da sugestão aceita; manter essa associação até cancelar, expirar ou confirmar. Só recalcular recomendações ainda não decididas. Referências: `collabInterestService.ts:397` e `DiagnosticoCollabsFeed.tsx:1051`.

### 2. Não usar a justificativa de um criador para recomendar outro — alta; reproduzida

O matching prioriza quem já demonstrou interesse, podendo substituir o candidato escolhido pela IA. O plano e o motivo respeitam essa troca, mas `viewerContribution` e `partnerContribution` continuam vindo da escolha original da IA. A reprodução escolheu `c2` e recebeu uma experiência explicitamente atribuída a `c1`.

**Correção:** usar contribuição da IA somente quando ela foi escrita para a dupla efetivamente selecionada. Referência: `perPautaCollabMatchingService.ts:256`.

### 3. Garantir um plano conjunto com papéis corretos — alta; reproduzida parcialmente

A reciprocidade compara o par de pessoas e o texto normalizado do território, não uma proposta compartilhada. Duas pautas distintas de paternidade podem virar match. A tela diz que os dois escolheram a mesma ideia, embora isso não esteja garantido.

Além disso, o storyboard de quem topou primeiro é copiado para os dois sem inverter `viewer`/`partner`. Como a interface traduz `viewer` para “Você”, ambos podem receber a mesma responsabilidade. A reprodução confirmou essa cópia sem ajuste.

**Correção:** registrar uma proposta comum, versionada, com responsáveis identificados por usuário. Até existir aprovação desse plano pelos dois, a mensagem deve afirmar interesse mútuo na parceria, sem dizer que a mesma pauta foi aprovada. Referências: `collabInterestService.ts:270–325`, `DiagnosticoIdeaDetailSheet.tsx:47` e `DiagnosticoCollabsFeed.tsx:396`.

### 4. Preservar matches em reenvios, listas vazias e retorno à aba — alta

- O upsert por usuário+pauta sobrescreve parceiro e recoloca `expiresAt`, mesmo se o documento já tiver `matchedAt`. Um reenvio pode tornar um match confirmado sujeito à exclusão automática; mudar o parceiro pode conservar indevidamente a confirmação antiga. Reproduzido com mocks.
- No Perfil, quando `collabsPautas.length === 0`, o shell zera matches e nem consulta o histórico. Combinadas deve continuar acessível independentemente de haver pautas disponíveis.
- A assinatura de bootstrap já carregada impede nova busca ao retornar à aba com as mesmas pautas. Um match feito pelo outro lado pode não aparecer nessa sessão. Invalidar o cache no servidor não atualiza esse estado do navegador.

**Correção:** transições condicionais e idempotentes; histórico separado da rodada; revalidação de interesses/matches ao voltar à aba ou à janela. Referências: `collabInterestService.ts:230`, `DiagnosticoRealShellClient.tsx:499` e `:535`.

### 5. Respeitar a escolha de aparecer e oferecer um jeito claro de participar — alta

A elegibilidade aceita `collabDiscoveryOptIn: true` **ou** interesse histórico vigente. Assim, o `false` enviado à API de saída não é soberano. Matches sem expiração também podem manter essa elegibilidade histórica. A mesma regra aparece no MCP.

A interface examinada não oferece um controle de participação; o primeiro “quero fazer” liga o opt-in. Com apenas cinco contas passando no filtro inicial, isso cria uma barreira para formar a rede.

**Correção:** distinguir migração legada de retirada explícita; saída deve prevalecer e invalidar caches que contenham a pessoa. Oferecer “Disponível para collabs”, modalidade e disponibilidade sem depender de uma sugestão prévia. Referências: `narrativeCollabMatchingService.ts:335–352`, `collabs/interest/route.ts:156–166` e `src/app/lib/mcp/collabIntelligence.ts:86`.

### 6. Corrigir os erros escondidos na página dedicada — alta; geração reproduzida

Em `/dashboard/collabs`, `handleGenerate` não verifica o HTTP nem o corpo da resposta. Um 403, 429 ou 500 pode terminar como recarga normal das mesmas pautas. Também são fixados `whatsappLinked={false}` e o bloqueio de geração apenas pelo plano.

A aba no Perfil já tem tratamento de falha, cota, mapa incompleto e vínculo real do WhatsApp. Portanto, o problema não deve ser generalizado como se as duas entradas fossem iguais.

**Correção:** compartilhar carregamento, permissões, cota, erros e estado de WhatsApp entre as entradas. Referências: `CollabsPinnedBoard.tsx:477–539`, `DiagnosticoRealShellClient.tsx:1162` e `:2108`.

### 7. Conferir no servidor se a proposta e o parceiro são válidos — alta

A API exige autenticação e Pro, mas aceita do cliente pauta, parceiro, território e plano. O serviço valida formato dos IDs e auto-match; não verifica antes do upsert a propriedade da pauta nem a elegibilidade atual do parceiro. A rota de matching também recebe o conteúdo das pautas do navegador.

**Correção:** receber um identificador da sugestão e carregar a versão autorizada no servidor. Isso impede que dados editados no request sejam tratados como uma proposta realmente recomendada. Referências: `collabs/interest/route.ts:61–87` e `collabInterestService.ts:209–253`. Não foram enviados requests adulterados ao ambiente real.

## Qualidade da inteligência

### Confiança exagerada e fonte pouco visível — alta; reproduzida

O contexto criativo usa até 60 vídeos em 90 dias, mas a confiança é calculada pela quantidade de métricas com alcance. Não exige que as cenas estejam lidas. Doze vídeos sem nenhuma cena produzem confiança `high`, depois convertida em evidência `strong`. O texto “Usamos o seu Mapa e N vídeos recentes” não diferencia métricas de leitura do conteúdo.

A seleção de padrões olha os 35% com melhor engajamento profundo; um assunto presente em uma única cena pode ganhar o rótulo de padrão mais forte. Não há contraste com o restante dos vídeos para demonstrar que aquele elemento contribui para o resultado.

**Melhoria:** aplicar à geração a política de cobertura e confiança do Perfil; separar confirmado, observado e hipótese; guardar IDs e datas dos exemplos. Cada pauta deve poder responder: “qual observação sustentou este gancho?” Referências: `creatorEngagementBaselineService.ts:144–160`, `contentIdeasGenerationService.ts:263`.

### Parcerias passam por um funil estreito e podem terminar genéricas — alta

O pool varre 150 mapas sem ordenação explícita, filtra participantes e reduz para 30. A prioridade de interesse recebido só funciona se o remetente já estiver nesse pool. Hoje há 137 mapas, portanto o corte de 150 é risco de crescimento, não a causa observada do funil atual.

A IA tem 3,5 segundos para atribuir parceiros e planos, com saída de 3.600 tokens para até 30 pautas. Ao faltar resposta, o fallback usa palavras em comum e um plano genérico por território. A interface não informa se houve análise semântica ou essa aproximação. Um retorno explícito de “sem fit” é respeitado, o que é bom.

**Melhoria:** filtrar elegibilidade antes de limitar; reservar espaço para reciprocidade; avaliar a dupla contra a pauta concreta; permitir ausência de sugestão quando faltar contribuição comprovável; processar a parte pesada em fila. Medir tempo, uso de fallback e aceitação, em vez de assumir que o fallback é raro. Referências: `narrativeCollabMatchingService.ts:39`, `:324`, `:716` e `perPautaCollabMatchingService.ts:188–259`.

### Atualização e memória precisam ser compartilhadas

O cache de 12 horas considera narrativa e conteúdo das pautas, mas não revisões do parceiro, mudança de localização ou retirada da descoberta. A geração prioriza a narrativa da síntese de vídeos antes do MapaSeed; o pool também pode usar a última leitura de vídeo do parceiro. Essas fontes precisam respeitar a identidade confirmada e a mesma política de atualização do Perfil.

Na aba do Perfil já existe regeneração quando não há pautas, passam sete dias ou o mapa é marcado como mais novo. Não é correto dizer que o produto nunca atualiza automaticamente. A página dedicada não compartilha toda essa lógica. Também é necessário verificar se a atualização trouxe leitura nova, e não apenas mudou um timestamp.

**Melhoria:** versão comum de contexto, invalidação por evento e data/fonte visíveis. Preservar decisões e propostas aceitas quando a inteligência evoluir.

### Bons fundamentos que merecem ser mantidos

- Geração exige narrativa e território; audiência funciona como complemento.
- Validação restringe territórios, assets e âncoras do mapa.
- Seleção tenta variar território, formato e gesto criativo; títulos ativos, salvos e publicados ajudam a evitar repetição.
- Rodada nova substitui pautas ativas e preserva salvas.
- Storyboard com cenas, abertura, fechamento, checklist e cópia é útil para transformar ideia em gravação.

As seis pautas recentes inspecionadas tinham alguma ancoragem temática, mas também fórmulas repetidas como “A verdade sobre...” e ganchos autobiográficos. Isso não prova invenção de experiências: seria necessário conferir cada história contra suas fontes. É uma oportunidade de exigir evidência para acontecimentos pessoais e oferecer “adapte para uma situação sua” quando forem apenas propostas.

### Horário e cotas — média; cotas reproduzidas

O horário usa interações absolutas de até 180 dias, sem restringir o formato da pauta, e pode receber confiança alta com três posts no melhor intervalo. Esse dado é útil como sugestão de teste, mas não sustenta uma regra forte para uma nova pauta.

A cota é estimada dividindo o total de pautas por três. Uma rodada de seis consome duas; rodadas curtas contam de forma diferente. Em dezembro, `resetAt` aponta janeiro do mesmo ano. Ambos foram reproduzidos.

**Melhoria:** contar eventos de geração com reserva atômica; avançar o ano corretamente; mostrar saldo e falhas sem consumir silenciosamente tentativas. Referências: `contentIdeasOpportunityContext.ts:32–52`, `contentIdeasGenerationQuota.ts:56–60` e `:81–82`.

## Experiência da página

| Etapa | Avaliação | Melhoria recomendada |
| --- | --- | --- |
| Entrada | Interface limpa; título de decisão claro, mas uma collab não aparece necessariamente primeiro | Explicar que há ideias solo e parcerias; mostrar quando não há parceiros disponíveis |
| Escolher | Um card por vez reduz distração; gestos têm botões equivalentes | Mostrar benefício da pauta e motivo da parceria antes de pedir a decisão |
| Explorar | Verso e plano trazem informação útil, mas o raciocínio fica vários passos abaixo | Antecipar uma evidência concreta, mantendo detalhes sob demanda |
| Salvar | A ação funcionou no preview e atualizou o contador | Dar nome visível a “Salvas”; permitir desfazer descarte acidental |
| Recusar parceiro | Regra preserva a pauta como possibilidade solo | Separar claramente “não quero esta parceria” de “não quero esta ideia” na linguagem visível |
| Aguardar | Depende de descobrir a decisão na área de salvas | Mostrar parceiro correto, status, validade e opção de cancelar sem apagar a pauta |
| Combinadas | Existe entrada permanente e orientação para chamar no Instagram | Histórico independente das pautas, plano comum, papéis corretos e status da gravação |
| Sem dados/erro | Há componentes de vazio, falha e retry; integração difere por entrada | Distinguir mapa incompleto, falta de parceiro, erro técnico e cota; não bloquear pauta solo por falha do matching |
| Computador | Componente compartilhado permanece estreito e alto, com grande área vazia no preview | Usar espaço para contexto ou seleção lateral; validar depois no shell autenticado dedicado |
| Teclado | Plano completo recebeu foco e fechou com Escape | Combinadas abriu com foco fora do diálogo e não fechou com Escape; unificar modais com foco contido e restauração |

O shell mobile aguarda matching e interesses juntos antes de liberar a rodada; a página dedicada também encadeia todas as consultas. É compreensível evitar cards que mudam depois de aparecer, mas isso não deve impedir acesso a pautas salvas ou histórico se apenas a recomendação falhar.

Há uma promessa explícita de aviso pelo WhatsApp, mas o serviço de match chama texto livre; o próprio serviço bloqueia esse envio em produção salvo configuração específica e documenta uso em janela de conversa. O template de Collabs já consta como pendência no cérebro. Não foi testada entrega real nem verificada a configuração publicada. É preciso resolver o canal e ter estado de entrega/retry antes de tratar o aviso como garantido.

O acervo é limitado aos 30 itens mais recentes, misturando ativos, salvos e publicados. Pautas salvas antigas podem desaparecer da listagem conforme o uso cresce. A consulta atual não encontrou usuário com mais de 30 itens visíveis; é risco futuro confirmado pelo limite, não perda de dados observada. Separar rodada e biblioteca paginada.

## Ordem sugerida para melhorar

1. **Confiabilidade:** identidade do parceiro, contribuições, papéis, idempotência, histórico vazio, atualização de matches, erros e saída da descoberta.
2. **Oportunidades reais:** participação explícita, disponibilidade, reciprocidade alcançável e propostas conjuntas concretas. Não forçar colaboração em toda pauta.
3. **Inteligência sustentada:** evidência por pauta, leitura recente, identidade confirmada, calibragem de confiança e qualidade do fallback.
4. **Experiência e operação:** integrar as duas entradas, teclado, desfazer, acervo, notificações, cotas e processamento assíncrono.

Medir: exposição a parceria, abertura do motivo, interesse, encontro recíproco, contato e gravação/publicação; qualidade por origem da sugestão; tempo até a primeira oportunidade e até reciprocidade. Evitar usar só quantidade de pautas ou cliques como sucesso.

Critérios mínimos para considerar resolvido: interesse nunca troca de pessoa; cada dupla vê os responsáveis corretos; match sobrevive a retry e a rodada vazia; sair da descoberta remove de novas sugestões; erros são claros nas duas entradas; confiança depende de conteúdo efetivamente lido; cada sugestão tem uma contribuição verificável; navegação por teclado funciona nas gavetas.

## Artefatos da revisão

- Consulta complementar: `tmp/collabs-audit-data.ts`; saída `tmp/collabs-audit-data.json`.
- Suítes existentes: `tmp/collabs-audit-tests.log`.
- Reproduções: `tmp/collabs-audit-{matching,interest,board,evidence}.test.*`; logs `tmp/collabs-audit-repros.log` e `tmp/collabs-audit-repros-extra.log`. Esses testes afirmam o defeito atual para demonstrá-lo; uma correção deve inverter as expectativas.
- Capturas: `output/playwright/collabs-audit-mobile.png` e `output/playwright/collabs-audit-wide.png`.
