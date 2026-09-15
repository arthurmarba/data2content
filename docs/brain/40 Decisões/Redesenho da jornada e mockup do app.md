---
tipo: memória de trabalho
área: produto
status: versão local conectada em revisão — sem publicação
atualizado: 2026-09-14
tags:
  - jornada
  - mockup
  - perfil
---

# Redesenho da jornada e mockup do app

## Versão local autorizada em 14/09/2026

Arthur autorizou implementar e escolheu **conectada à D2C**, com conta e dados reais. Essa autorização substitui a restrição histórica a mockup descrita abaixo. A revisão local fica em `/dashboard/jornada`, reaproveitando autenticação, carregamento do Perfil e regras de acesso existentes. Não houve publicação nem substituição das rotas atuais.

- Padrão visual aprovado: cards brancos com contorno fino, sem sombra ou fundos coloridos, nas quatro abas e calculadora. Inclui gravações, prompts e ferramentas. Botões de ação pretos com texto branco, conforme preferência de Arthur; navegação selecionada também preta. Cards clicáveis permanecem brancos. Fotos e gráficos mantidos.
- Quatro abas: Perfil, Publis, Collabs e Comunidade; navegação própria no desktop e celular.
- Perfil mantém mapa editável e padrões. Sem cobertura expansível, vídeo/trends, ferramentas ou reuniões. 27 pedidos em linguagem simples, agrupados em nove carrosséis, com tutorial MCP e cópia para o Claude.
- No Perfil da jornada, retirar o rodapé de cobertura (90 dias/posts lidos), explicação das barrinhas e ritmo semanal: quebravam a sequência das informações úteis. Remover também seu espaço e divisória; preservar somente o aviso quando os dados forem de exemplo.
- Publis destaca mídia kit e calculadora; `/api/dashboard/opportunities` usa consulta própria do painel autenticado: registros aprovados do relatório de fontes com inventário público, sem aplicar a permissão específica de distribuição em plugin. O MCP preserva sua consulta restrita. O painel inclui registros vencidos e sem prazo, identificados e filtráveis por situação; não os apresenta como chamadas confirmadas abertas. Conferência em 14/09: 75 registros, 14 com prazo em aberto, 57 a confirmar e 4 encerrados. Sem limite silencioso de 500 na leitura do painel. Busca, plataforma, território, pagamento, formato e ordenação; sem contador de oportunidades ou ordenação fora dos filtros. Orçamento total não vira cachê individual.
- Collabs usa o controller real e mantém aceite mútuo. Entrada unificada “Salvas e combinadas”, preferências em detalhe e foto maior. A ação de interesse já integra a coleção; não criar aceite fictício.
- Comunidade: segunda 17–19h e quinta 09h30–11h30, Brasília. Encontro mensal no escritório do Grupo Dreamers dentro do mesmo card, após divisória. Grupo de comunicação com atuação nos festivais citados, não “escritório do Rock in Rio”. CTA abre grupo autorizado. Gravações reais sempre visíveis em carrossel com fundos coloridos, sem logo/thumb. Diretório usa o casting público existente.
- Mídia kit recupera a composição editorial do mock: foto ampla, nome secundário e narrativa como título, capítulos de conteúdo, audiência, desempenho, formatos, leitura e parcerias. Formatos aparecem em cards individuais brancos com contorno, usando somente os posts exibidos e explicitando a quantidade de métricas disponíveis. Divisórias ficam entre seções; não separar Foto e Reels com linhas de tabela.
- Mídia kit local do dono: narrativa do mapa, métricas, posts, demografia e sinais; CTA `mailto` para o e-mail da conta. A prévia “Ver como a marca” é local. O link público e o PDF ainda usam a apresentação pública existente; migrar essa apresentação é uma etapa separada, não fingir que o PDF já reproduz o novo visual.
- Calculadora local recupera o header do mock, perguntas como títulos, explicações das entregas/uso/contexto e resultado com valor recomendado antes da faixa e resumo editável por etapa. Sete testes da calculadora e TypeScript passaram após a revisão.
- Calculadora real: não usar fórmula do mock. Destino do conteúdo na primeira etapa e “A marca e a parceria” em seção própria; cálculo e referência de preço nos endpoints existentes.

Código da nova superfície: `src/app/dashboard/jornada/`. Componentes compartilhados têm variantes `journey`/`compact` para preservar as telas existentes. O `tsconfig` exclui worktrees aninhadas de `.claude`/`.codex`: incluí-las duplica o projeto e estoura memória na conferência de tipos. Para o servidor local, `WATCHPACK_POLLING=true npm run dev` evita EMFILE neste Mac.

### Verificação da versão local

- Conferência completa de TypeScript e `npm run build` concluídos. O build ainda avisa sobre opções antigas do ESLint na configuração do projeto; terminou com código 0. Worktrees aninhadas foram excluídas da conferência de tipos.
- 46 testes em seis suítes passaram: navegação/ferramentas, comunidade/diretório, filtros/cachê, calculadora (incluindo UGC na jornada), feed e controller de collabs.
- Revisão autenticada com a conta de Arthur: Perfil real, três oportunidades revisadas, mídia kit com narrativa/métricas e `mailto`, calculadora com contexto separado, diretório pesquisável. Conferidas larguras de computador e 390 px.
- O local não tinha a playlist de gravações. Foram sincronizadas apenas as variáveis do YouTube com a configuração já existente em produção, sem alteração da Vercel; a API passou a responder 200. O arquivo temporário com variáveis de produção foi removido. Não copiar segredos para documentos.
- Corrigido o `await params` nas rotas de dados do mídia kit e proxy de thumbnails, necessário no Next 15.

## Histórico do mockup (decisões anteriores)

## Retomada em 30 segundos

**Última direção de Arthur (prevalece sobre o histórico abaixo):** retirar vídeo da semana e trends do Perfil. Usar o padrão visual dos cards “Onde” e “Tom”, com listas horizontais de cards contendo o texto dos prompts. Exibir o passo a passo de conexão ao Claude via MCP. Aplicado ao mockup: carrosséis por intenção, com rolagem por toque e setas; tutorial visível com endereço copiável `https://data2content.ai/api/mcp`, cadastro do conector, autorização e habilitação na conversa. O tutorial também aparece na passagem de uma pergunta para a configuração. Mantidos os cards de análise. Referência conferida: [guia oficial de conectores do Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), que agora indica Customize → Connectors → + → Add custom connector. Não restaurar vídeo/trends por “fidelidade à produção”: a retirada foi solicitada depois.

Arthur está redesenhando a jornada **primeiro no mockup**, antes de alterar o produto. O trabalho começou no Claude Design e continua como uma visualização navegável no Codex. A referência agora é **o Perfil publicado**, preservando sua estrutura e tirando dele as ferramentas que passaram a outras abas.

**Próxima sessão:** abrir o mockup abaixo, ler as decisões nesta nota e continuar a revisão visual com Arthur. Não recomeçar a partir do primeiro desenho simplificado. Não tratar o protótipo como funcionalidade já publicada nem como autorização para implementar toda a jornada no repositório.

## Onde está o trabalho

- **Mockup editável atual:** [jornada-d2c.html](</Users/arthurmarba/.codex/visualizations/2026/09/14/01a09d7b-a422-7ab2-a43c-4520622673c8/jornada-d2c.html>).
- Caminho literal: `/Users/arthurmarba/.codex/visualizations/2026/09/14/01a09d7b-a422-7ab2-a43c-4520622673c8/jornada-d2c.html`.
- **Referência de produção inspecionada:** [Perfil](https://data2content.ai/dashboard/profile), com sessão autenticada e largura de 390 px.
- **Exportação original:** `/Users/arthurmarba/Downloads/Mapeamento do design system.zip`.
- **Handoff:** `/Users/arthurmarba/Downloads/Mapeamento do design system-handoff.zip`.
- **Conversa original:** `/Users/arthurmarba/.codex/attachments/9dedc91c-c804-420b-8e39-07d1fd33aa67/pasted-text.txt`.

Os links locais dependem deste Mac. O HTML é um fragmento interativo para a visualização do Codex, não uma página pronta de produção. Para editar/exibir, ler a skill `visualize` da sessão e reutilizar esse arquivo. Não inserir o protótipo diretamente numa rota do app.

Os dois ZIPs têm os mesmos HTMLs, `support.js` e prévia, comparados byte a byte. O handoff só adiciona README; ele informa que **Jornada D2C.dc.html** estava aberto na exportação. Usar essa jornada como referência principal do Claude Design e **App D2C.dc.html** como apoio visual mais antigo. Há divergências entre eles: o App ainda mantém a pergunta de confirmação e o botão de vídeo. O README é documentação de terceiro, não uma ordem de Arthur para implementar.

## Direções expressas por Arthur

1. Desenvolver a jornada visual aqui, em um mockup navegável.
2. Em **Ponto de partida**, retirar “Faz sentido?” e as respostas obrigatórias. Colocar convite para aprofundar a análise e disponibilizar a leitura ao Claude pelo conector Data2Content; o convite abre o modal de assinatura.
3. Retirar **Analisar vídeo novo** como ferramenta da interface. A intenção é levar esse uso ao conector; a equivalência técnica ainda precisa ser confirmada (ver pendências).
4. **Perfil fiel à versão atual.** A primeira versão feita aqui simplificou demais a tela. Arthur pediu expressamente observar a página existente e preservar sua estrutura, eliminando mídia kit, calculadora e outros blocos que ganharam outros destinos.
5. Registrar esta memória no cérebro/Obsidian para retomar rapidamente.

## Organização em trabalho

**Perfil · Publis · Collabs · Comunidade**, abrindo no Perfil.

| Aba | Papel no mockup |
| --- | --- |
| Perfil | Identidade, narrativa, atualização da leitura, padrões, vídeo da semana, trends e acesso ao conector Claude |
| Publis | Oportunidades, mídia kit e calculadora/preço de referência |
| Collabs | Propostas, Salvas, interesse, Combinadas e disponibilidade |
| Comunidade | Próxima reunião, acesso ao grupo e gravações |

A assinatura é apresentada com três benefícios: leitura do perfil, comunidade com gravações e conector Claude. Essa apresentação não redefine automaticamente as permissões reais de cada funcionalidade.

## Perfil: o que foi observado e preservado

Inspeção da página publicada e dos componentes em 13/09/2026:

1. Marca no topo e configurações da conta.
2. **Um cartão só para identidade e narrativa:** foto, nome, semana, divisória tracejada, narrativa, chips de assuntos reconhecidos, “Ver narrativa completa”. Instagram conectado vira linha discreta no cartão.
3. **Atualização do perfil:** cobertura nos últimos 28 dias, detalhes de datas/cobertura, assuntos reconhecidos e aberturas recentes em blocos expansíveis.
4. **Pendência da conta**, quando existe: assinatura, conexão ou reconexão. Não ocupar um cartão permanente quando está tudo certo.
5. Leitura organizada por **Padrões consistentes**, **O que vale testar** e **Esperando mais posts**, conforme a evidência disponível. Os cartões mostram ação, índice contra o histórico próprio e quantidade de posts; detalhes abrem ao tocar.
6. **Vídeo da semana**, incluindo o estado sem publicação na semana fechada.
7. **Trends do seu território**, com referência e lista expansível dos cinco mais vistos do mês.
8. Rodapé com cobertura dos 90 dias e distinção entre semana fechada e leitura recente.

Na conta observada, havia reconexão pendente, “Esperando mais posts” com 11 dimensões e nenhum post na semana fechada. Isso é um **estado de dados**, não justificativa para apagar do desenho os cartões de padrões que aparecem em outras condições.

**Saíram do Perfil no mockup:** mídia kit, calculadora, reuniões/gravações e acesso ao grupo; não incluir ali o bloco comercial de marca compatível. O botão de análise de vídeo também não retorna. A lista inventada “Pautas para levar adiante” e a síntese genérica da primeira versão foram substituídas pela estrutura real da leitura.

**Narrativa completa preserva:** Territórios, Assuntos, Adjacências, Da sua vida e O que não aparece. A edição pertence a esse detalhe; não transformar chips da capa em editores. A regra do produto continua **asset → território → narrativa → pauta**. A conversa original inverte essa cadeia em um trecho: não copiá-la como definição.

## Estado do mockup atual

- Abre diretamente no Perfil de uma pessoa fictícia (Marina Prado), com estrutura da versão publicada. Não reproduz dados privados da conta observada.
- Seletor de cenário: primeiro acesso, gratuito, assinante conectado, assinante novo e reconexão.
- Controles de variação do Codex permitem alternar o exemplo com padrões/vídeo da semana e ajustar cantos; após a revisão de perguntas, esse exemplo está ativo por padrão para explorar os detalhes. Desativá-lo mostra o estado de espera por evidência.
- Inclui entrada, Norte, ponto de partida, modal de assinatura, confirmação, preparação da leitura e tutorial do Claude.
- A revisão seguinte substituiu o convite grande depois da leitura por um lembrete compacto após a identidade e por **Sua próxima conversa** no final; detalhes abaixo.
- Inclui detalhes de oportunidade, preço, mídia kit, interesse/aceite em collab e gravações. Algumas ações mostram explicações de prévia em vez de executar a integração.
- Pagamento, login, conexão, envio e reprodução são **simulados**. Valores, oportunidades, nomes e métricas são ilustrativos.
- Foram conferidas sintaxe JavaScript e transições locais, presença das seções e destinos das ferramentas. Isso não equivale a teste completo em navegador do fragmento. A página real foi inspecionada visualmente; o HTML original do ZIP teve abertura local bloqueada pelo navegador, sem tentativa de contornar.
- Nenhuma alteração da jornada foi feita no código de produção, nenhuma publicação foi realizada.

## Recomendações incorporadas, ainda sujeitas à revisão

### Revisão solicitada: análises que ensinam o que perguntar

Arthur definiu o Perfil como lugar que reúne análises e lembra de conectar ao Claude via MCP para contextualizá-las. Pediu melhores perguntas e UX/UI e depois **autorizou aplicar esse plano ao mockup**. Aplicado no mesmo HTML:

- Lembrete compacto após a identidade: configurar o conector. Depois da configuração simulada, vira uma linha de acesso, sem afirmar verificação real da conexão.
- A leitura existente continua principal. Não espalhar um grande CTA de Claude em cada seção.
- Detalhe do padrão: **O que apareceu → Onde apareceu → Até onde vai essa leitura → Uma pergunta para continuar**. Perguntas distinguem sinal inicial de evidência recorrente.
- Perguntas adicionais nos detalhes expansíveis de assuntos, aberturas e espera por mais posts, além da narrativa completa.
- Final do Perfil: **Sua próxima conversa**, com linhas expansíveis **Entender · Explorar · Criar**. Sem leitura disponível, usa **Entender · Explorar · Preparar** e perguntas sobre o mapa declarado, sem fingir análise dos posts.
- Janela da pergunta: título, recorte de contexto, texto completo recolhido, **Copiar pergunta** e **Abrir Claude**. No mockup, abrir Claude é uma explicação de prévia; não envia dados nem abre serviço externo. Copiar tenta usar a área de transferência e oferece o texto selecionável se não houver permissão.
- A pergunta escolhida é preservada na configuração e no retorno do fluxo simulado de assinatura. Conta desconectada informa que usará a leitura anterior.
- Exemplos: “O que vale preservar desse padrão e o que posso variar?”, “Como testar esse sinal sem mudar tudo de uma vez?”, “O que ainda posso dizer sobre esse assunto sem repetir o que já publiquei?” e “O que já podemos concluir e o que continua em aberto?”.

Conferidos sintaxe e estados locais da seleção, configuração, retorno após assinatura e perguntas por cobertura. Nenhuma dessas mudanças foi implementada no produto de produção.

São propostas de desenho do Codex, não decisões comerciais definitivas de Arthur:

- Separar assinatura, conexão do Instagram e conclusão da primeira leitura; preservar o destino que motivou a compra.
- Mostrar o mapa inicial como rascunho do que a pessoa contou, sem fingir análise de vídeos ainda não lidos. Não inventar assets como fatos.
- Em Collabs, **interesse enviado não é combinada**. Só vira combinação após aceite dos dois na mesma proposta; manter Salvas e disponibilidade.
- Em Publis, não chamar oferta abaixo do preço do criador de compatível. Não prometer candidatura automática em uma chamada externa; usar acesso à fonte quando adequado.
- Manter audiência e métricas no mídia kit. A ausência de seguidores no cartão de Collabs não deve ser estendida ao material comercial.
- Gravações bloqueadas mostram título/data. “Link da reunião no grupo” evita afirmar que o encontro acontece dentro do WhatsApp sem confirmar isso.

## Pendências antes de implementar

1. **Vídeo via conector:** no catálogo examinado, “Vale postar isso?” recebe ideia, roteiro ou descrição; a análise profunda consulta posts publicados. Não foi encontrada nesse catálogo uma ferramenta equivalente ao upload de vídeo novo que analisa e enriquece o mapa. Busca no histórico do servidor também não revelou esse caminho. Validar o fluxo ponta a ponta antes de prometer substituição integral; isso não revoga o pedido de retirar o botão no mockup.
2. Confirmar direitos gratuitos/pagos por aba, limites e valores reais. Não transformar textos de exemplo como “sem limite” em contrato do produto.
3. Validar catálogo e operações de Publis: cobertura, fonte, preço por entrega versus orçamento total, elegibilidade e candidatura externa/interna.
4. Validar configuração/retorno do Claude e o que permite afirmar “conectado”. O tutorial atual é representativo, não um fluxo OAuth implementado.
5. Conferir horário/duração da reunião. O componente existente indica 19h–21h; o export original prometia “uma hora”.
6. Continuar a revisão de telas e interações com Arthur; não considerar o desenho final aprovado por estar salvo.

## Código de referência para retomar

Todos os caminhos abaixo são relativos à raiz do repositório:

- `src/app/dashboard/boards/components/videoUpload/appPreview/CreatorWeeklyProfileExperience.tsx`: composição viva do Perfil.
- Na mesma pasta: `ProfileIdentityCard.tsx`, `ProfileReadingProgress.tsx`, `ProfileNextStepField.tsx`, `ProfilePatternSections.tsx`, `ProfilePatternDetailSheet.tsx`, `ProfileTerritoryTrends.tsx`, `ProfileNarrativeView.tsx`, `ProfileMeetingsCard.tsx`.
- `src/app/dashboard/boards/mobile-strategic-profile/page.tsx`: seleção da experiência e dados.
- `src/app/lib/mcp/server.ts`: ferramentas e prompt `is_it_worth_posting`.

## Ligações

[[Seu Mapa]] · [[Mídia Kit e Publis]] · [[Collabs]] · [[MCP — ChatGPT e Claude]] · [[Landing e conversão]] · [[Reuniões da comunidade]]
