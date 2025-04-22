// @/app/lib/knowledge/algorithmKnowledge.ts - v1.2 (Didático e Guiado)
// Conhecimento detalhado sobre o algoritmo do Instagram, adaptado para ser didático e guiar o usuário.

/**
 * Visão geral e introdução aos múltiplos algoritmos do Instagram (Didático).
 */
export function getAlgorithmOverview(): string {
    // Ano atual para manter a informação relevante
    const currentYear = new Date().getFullYear();
    return `
**Entendendo o "Algoritmo" do Instagram (${currentYear}): Uma Visão Geral Simples**

Primeiro, é importante saber que o Instagram não tem *um* único "chefe" (algoritmo) para tudo. Pense nele mais como uma equipe de especialistas, onde cada um cuida de uma área diferente do aplicativo: o **Feed** (onde você vê posts de quem segue), os **Stories** (aquelas bolinhas no topo), os **Reels** (vídeos curtos) e a página **Explorar** (para descobrir coisas novas).

Cada "especialista" usa inteligência artificial (machine learning) para analisar milhares de pistas (chamadas de "sinais"). Esses sinais são informações sobre o post (quem fez, quando, que tipo é), sobre você (o que você curte, comenta, assiste) e sobre como as outras pessoas estão interagindo com aquele conteúdo.

**O objetivo principal?** Fazer com que você passe mais tempo no aplicativo e goste do que vê. Para isso, cada especialista tenta prever e organizar o conteúdo que *você*, especificamente, achará mais interessante naquela seção.

*Em resumo: Não é um monstro único, mas vários sistemas inteligentes trabalhando juntos para personalizar sua experiência.*

**Quer entender como funciona o especialista de alguma área específica, como o Feed ou os Reels? É só perguntar!**
  `;
}

/**
 * Detalhes sobre o ranking de conteúdo no Feed principal (Didático).
 */
export function explainFeedAlgorithm(): string {
  return `
**Como o Instagram Organiza seu Feed Principal:**

Seu feed principal é onde você vê os posts das contas que **já segue**. De vez em quando, o Instagram também mistura algumas **sugestões** de contas que você talvez goste e, claro, **anúncios**.

**Qual a meta aqui?** Mostrar primeiro o que o Instagram *acha* que é mais importante para você naquele momento: posts recentes de amigos, família e contas que te interessam. Ele tenta adivinhar quais posts você tem mais chance de **interagir**, ou seja, parar para ver, curtir, comentar, compartilhar ou até clicar no perfil de quem postou.

**Quais são as "pistas" (sinais) mais importantes que ele usa para adivinhar?**
1.  **O que você fez antes:** Com que tipo de post você mais interagiu recentemente? (Curtiu? Comentou? Salvou? Compartilhou?)
2.  **Sobre o post:** É novo? É foto ou vídeo? Foi postado de algum lugar específico (localização)? As pessoas já estão curtindo e comentando rápido?
3.  **Sobre quem postou:** Você costuma interagir com essa pessoa/marca? Outras pessoas estão interagindo bastante com ela ultimamente?
4.  **Sua relação com quem postou:** Vocês costumam curtir um ao outro? Trocam mensagens diretas (DMs)?

**O que ele tenta prever?** Basicamente, a chance de você fazer 5 coisas: 1) passar tempo vendo o post, 2) comentar, 3) curtir, 4) compartilhar/enviar para alguém, e 5) clicar no perfil. Quanto maior a chance combinada, mais alto o post aparece para você.

**Importante:** Desde 2016, o feed não é mais em ordem cronológica (do mais novo para o mais velho). O Instagram diz que essa mudança fez com que as pessoas vissem mais posts de quem elas realmente seguem, porque prioriza o que é *relevante* para você, não apenas o que é *novo*.

*Resumindo: O feed tenta te mostrar o que é mais relevante para você de quem você já segue, baseado no seu histórico e nas características do post.*

**Ficou claro? Talvez você queira saber como funcionam os Stories ou os Reels agora? Ou quem sabe entender melhor esses "sinais de engajamento"?**
  `;
}

/**
 * Detalhes sobre o ranking de conteúdo nos Stories (Didático).
 */
export function explainStoriesAlgorithm(): string {
  return `
**Como o Instagram Organiza os Stories:**

Os Stories são aquelas bolinhas que ficam na parte de cima do aplicativo. Diferente do Feed, aqui você **só vê Stories das contas que você segue**. Não aparecem sugestões de desconhecidos.

**Qual o objetivo principal dos Stories?** Garantir que você veja primeiro os Stories das pessoas ou marcas com quem você tem **mais conexão** ou que te importam mais. Pense nos seus amigos próximos, família, ou criadores favoritos.

**Quais as "pistas" (sinais) que ele usa para ordenar as bolinhas?**
1.  **Seu histórico de visualização:** Você costuma assistir aos Stories dessa conta com frequência?
2.  **Suas interações nos Stories:** Você costuma responder (mandar DM), reagir com emojis (tipo o ❤️) aos Stories dessa conta?
3.  **Proximidade:** O Instagram tenta adivinhar quem são seus amigos mais próximos ou família (baseado em interações gerais, como DMs, marcações em fotos) e tende a colocar os Stories deles primeiro.

**O que ele tenta prever?** A chance de você assistir ao Story inteiro, responder via DM, ou pular rapidamente para o próximo.

**Para que servem os Stories na sua estratégia?** Eles são ótimos para manter sua audiência atual **engajada** e conectada com você. Não são a melhor ferramenta para alcançar pessoas novas. Postar com alguma frequência (sem exagerar!) ajuda a manter essa conexão. Usar as ferramentas interativas (enquetes, caixinhas de perguntas, quizzes) é uma ótima forma de fazer as pessoas interagirem mais!

*Em resumo: Stories são para fortalecer o laço com quem já te segue, e o Instagram mostra primeiro quem ele acha que você mais se importa.*

**Entendeu como os Stories funcionam? Quer comparar com o algoritmo dos Reels, que é focado em descobrir coisas novas? Ou talvez queira dicas sobre como usar as figurinhas interativas dos Stories?**
  `;
}

/**
 * Detalhes sobre o ranking de conteúdo na aba Reels (Didático).
 */
export function explainReelsAlgorithm(): string {
  return `
**Como Funciona a Mágica dos Reels:**

A aba Reels é aquele feed infinito de vídeos curtos (o ideal é que tenham menos de 90 segundos). A grande diferença aqui é que a **maioria dos vídeos são de contas que você NÃO segue**. O foco total é na **descoberta** de coisas novas e no **entretenimento**.

**Qual a meta do algoritmo dos Reels?** Te mostrar vídeos que: 1) te prendam a atenção, 2) te façam querer compartilhar com amigos, e 3) talvez até iniciem uma conversa. O objetivo é te manter assistindo e te apresentar a novos criadores.

**Quais as "pistas" (sinais) mais importantes para ele decidir o que mostrar?**
1.  **Sua atividade recente:** Que Reels você curtiu, comentou, salvou ou compartilhou ultimamente?
2.  **Seu histórico com o criador:** Mesmo que você não siga a pessoa, se já interagiu com algum Reel dela antes, isso conta.
3.  **Informações sobre o Reel:** A música usada está em alta? A inteligência artificial consegue entender sobre o que é o vídeo (analisando imagens e temas)? O vídeo está fazendo sucesso com outras pessoas (engajamento rápido)?
4.  **Informações sobre o criador:** Ele costuma ter bom engajamento? O Instagram tenta mostrar uma mistura de contas grandes e pequenas.
5.  **Compartilhamentos via Mensagem Direta (DM):** Essa é considerada a **pista MAIS valiosa**! Se as pessoas estão enviando seu Reel para os amigos, o Instagram entende que ele é muito relevante.
6.  **Retenção e Replays:** A chance de você assistir ao vídeo até o fim ou vê-lo de novo é crucial. Vídeos que as pessoas abandonam rápido perdem pontos.
7.  **Interação com o Áudio:** Se você clica na página do áudio ou usa aquele áudio para criar seu próprio Reel, isso é um sinal positivo.

**Ponto crucial:** Os Reels são, hoje, a **maior chance de alcançar pessoas que ainda não te seguem** (alcance orgânico). O Instagram testa seu vídeo com um pequeno grupo de pessoas (incluindo não-seguidores) e, se ele for bem, mostra para mais gente. **Conteúdo original** (sem marcas d'água de outros apps, como o TikTok) é MUITO mais valorizado.

*Resumindo: Reels são sua vitrine para o mundo! O algoritmo quer te entreter e te fazer descobrir coisas novas, valorizando muito vídeos originais que as pessoas assistem até o fim e compartilham.*

**Ficou mais claro como os Reels podem te ajudar a crescer? Quer saber quais são as melhores práticas para criar Reels de sucesso? Ou talvez comparar o alcance dos Reels com o da página Explorar?**
  `;
}

/**
 * Detalhes sobre o ranking de conteúdo na página Explorar (Didático).
 */
export function explainExploreAlgorithm(): string {
  return `
**Desvendando a Página Explorar:**

A página Explorar é aquela grade cheia de fotos, vídeos e Reels de contas que você **NÃO segue**. É como uma revista personalizada, feita para você **descobrir novos interesses e criadores**.

**Qual o objetivo aqui?** Te apresentar conteúdos que estão fazendo sucesso (populares) ou que são de nichos específicos que o Instagram *acha* que podem te interessar, baseado no que você já curtiu e no que pessoas com gostos parecidos aos seus estão vendo.

**Quais as "pistas" (sinais) mais importantes para montar sua página Explorar?**
1.  **Popularidade do Post:** O quão rápido as pessoas estão curtindo, comentando, compartilhando e salvando aquele post? A "viralidade" conta muito aqui, mais até do que no seu Feed normal.
2.  **Sua atividade na própria página Explorar:** Com que tipo de post você interagiu (curtiu, salvou) quando estava navegando pelo Explorar antes?
3.  **Seu histórico com criadores (mesmo desconhecidos):** Você já teve algum contato, mesmo que pequeno, com a conta que postou ou com conteúdos parecidos?
4.  **Dados sobre o criador:** Essa pessoa ou marca parece estar sendo "interessante" para outros usuários recentemente?

**Como ele conecta tudo isso?** O Instagram usa inteligência artificial para encontrar padrões. Por exemplo: "Muitas pessoas que curtem posts sobre [Receitas Veganas] também curtem posts sobre [Yoga]. Se você curtiu [Receitas Veganas], talvez você goste de ver algo sobre [Yoga] também".

**Importante: Há restrições!** Conteúdos considerados "sensíveis" (mesmo que não quebrem as regras gerais do Instagram), como violência, automutilação, coisas muito "picantes", desinformação, etc., **NÃO aparecem** na página Explorar. O Instagram quer que essa seja uma área segura para descoberta.

*Resumindo: A página Explorar é sua porta de entrada para novos mundos dentro do Instagram, baseada na popularidade e nos seus interesses (e nos de pessoas parecidas com você).*

**Entendeu a lógica da página Explorar? Quer saber que tipos de conteúdo costumam funcionar bem lá? Ou talvez queira focar em entender melhor os diferentes "sinais de engajamento" que mencionamos?**
  `;
}

/**
 * Lista e explica os principais sinais de engajamento e seu impacto (Didático).
 */
export function listEngagementSignals(): string {
  return `
**Os "Sinais" de Engajamento: O que Realmente Importa para o Instagram?**

Engajamento é como as pessoas interagem com seu conteúdo. O Instagram presta muita atenção nisso para decidir se seu post é bom e para quem mostrá-lo. Alguns sinais são mais "valiosos" que outros:

* **Tempo de Visualização / Retenção (para Vídeos/Reels):** **Super importante!** Se as pessoas assistem seu vídeo até o fim ou veem de novo (replay), isso diz ao Instagram que o conteúdo é bom e interessante. Se elas desistem logo no começo, é um sinal ruim. -> *Impacto: vídeos com boa retenção alcançam mais gente.*
* **Compartilhamentos (Shares):** Quando alguém envia seu post para um amigo (via DM) ou compartilha nos próprios Stories. É um sinal **muito forte** de que o conteúdo é tão bom que a pessoa quis indicar para outros. **Especialmente o compartilhamento de Reels por DM** é o sinal mais poderoso para um vídeo viralizar. -> *Impacto: conteúdo compartilhável é chave para crescer.*
* **Salvamentos (Saves):** Quando alguém clica na "bandeirinha" para guardar seu post. Isso indica que o conteúdo é útil ou inspirador, algo que a pessoa quer ver de novo depois. É um sinal **forte**, considerado mais importante que curtidas. -> *Impacto: posts "salváveis" (dicas, tutoriais, listas, inspirações) costumam ir bem.*
* **Comentários:** Mostram que as pessoas estão se envolvendo ativamente e iniciando uma conversa. Comentários que marcam amigos são ainda melhores. Responder aos comentários também ajuda! -> *Impacto: incentiva a comunidade e pode aumentar o alcance.*
* **Curtidas (Likes):** O famoso "coraçãozinho". É o sinal mais básico de que alguém gostou. É importante para dar um empurrão inicial no post, mas tem **menos peso** que salvamentos, compartilhamentos ou comentários. -> *Impacto: ajuda, mas não é o principal.*
* **Cliques no Perfil (vindos do post):** Se alguém vê seu post e clica para visitar seu perfil, isso mostra um **forte interesse** em você ou na sua marca. -> *Impacto: positivo para o ranking no Feed.*
* **Interações Específicas (Reels/Stories):** Clicar na página do áudio de um Reel, usar esse áudio para criar outro Reel, responder enquetes ou caixinhas de perguntas nos Stories, mandar DM a partir de um Story... tudo isso reforça a conexão e o interesse. -> *Impacto: fortalece o relacionamento com seguidores.*
* **Sinais Negativos:** Pular seus Stories muito rápido, ocultar seus posts, clicar em "Não tenho interesse", deixar de seguir logo após ver um post... são sinais ruins que fazem o Instagram mostrar menos seu conteúdo para aquela pessoa no futuro.

**Conclusão:** Engajamentos que exigem mais esforço ou mostram mais intenção (compartilhar, salvar, comentar, assistir tudo) valem mais para o algoritmo do que ações mais passivas (como só curtir ou ver rapidamente).

**Ficou claro quais interações são mais importantes? Quer dicas sobre como criar posts que incentivem mais compartilhamentos ou salvamentos? Ou talvez queira saber se o tipo de conta (pessoal, criador, comercial) afeta esses sinais?**
  `;
}

/**
 * Discute as diferenças (ou falta delas) no tratamento algorítmico de tipos de conta (Didático).
 */
export function explainAccountTypeDifferences(): string {
  return `
**Tipo de Conta Importa? Pessoal vs. Criador vs. Comercial:**

Uma dúvida comum é se o Instagram trata contas pessoais, de criador de conteúdo ou comerciais (marcas) de forma diferente na hora de mostrar os posts.

* **A Resposta Oficial:** O Instagram diz que **NÃO**. O algoritmo, segundo eles, não olha se sua conta é de um tipo ou outro para decidir o ranking. Mudar o tipo de conta não deveria, por si só, aumentar ou diminuir seu alcance. Eles também afirmam que não "punem" contas comerciais para forçar a compra de anúncios.
* **O Que Pode Acontecer na Prática (Efeitos Indiretos):**
    * **Contas Pessoais:** Geralmente se beneficiam dos sinais de **relacionamento próximo** (amizade, família). Por isso, seus posts no Feed e Stories tendem a aparecer com prioridade para essas conexões mais íntimas. O alcance fora desse círculo costuma ser menor.
    * **Contas de Criador:** São feitas para quem produz conteúdo para um público maior. Competem como qualquer outra conta, mas podem se beneficiar das **mudanças recentes (2024)** que visam dar mais visibilidade a contas menores e, principalmente, **priorizar conteúdo original**. Ser autêntico e criar seu próprio material é crucial.
    * **Contas Comerciais (Marcas):** Competem igualmente, mas podem ter uma desvantagem natural nos sinais de "proximidade" (pouca gente é "amigo próximo" de uma marca). Precisam conquistar o engajamento pela qualidade do conteúdo. Marcas que só repostam conteúdo de outros foram as mais afetadas negativamente pelas mudanças de 2024.

* **E o Tamanho da Conta?** Contas grandes já têm um público inicial maior. No entanto, as **mudanças de 2024 tentaram equilibrar o jogo nas recomendações (Reels, Explorar)**, testando conteúdo de contas pequenas com não-seguidores desde o início. Uma conta pequena com um conteúdo que viraliza pode crescer muito rápido!
* **Foco na Originalidade (A Grande Mudança):** A atualização mais importante recentemente foi a **penalização de repostagens** e a **valorização do conteúdo original**. Quem cria seu próprio material tem mais chances de ser recomendado, não importa o tipo de conta.

*Resumindo: Oficialmente, o tipo de conta não importa. Na prática, o foco em conteúdo original e as dinâmicas de relacionamento podem dar vantagens ou desvantagens indiretas. O mais importante é criar conteúdo de qualidade e autêntico.*

**Isso faz sentido? Quer entender melhor como o Instagram define "conteúdo original"? Ou talvez queira saber como diferentes formatos (foto, vídeo, carrossel) são tratados?**
  `;
}

/**
 * Analisa como diferentes formatos são tratados pelo algoritmo (Didático).
 */
export function explainFormatTreatment(): string {
  return `
**Como o Instagram Lida com Diferentes Formatos: Foto, Vídeo, Carrossel, Reels?**

Será que o Instagram prefere um formato específico? A resposta é: **depende do usuário!**

* **Equilíbrio Personalizado:** O Instagram tenta te mostrar uma mistura de formatos (fotos, vídeos, Reels, etc.) baseado no que **você** mais interage. Se você adora ver fotos, ele vai te mostrar mais fotos. Se você passa horas vendo Reels, ele vai te mostrar mais Reels. Não existe uma regra única para todo mundo.
* **Tendências Gerais (O que costuma funcionar melhor para alcance):**
    * **Reels:** Atualmente, é o formato com **maior potencial para alcançar gente nova** (não-seguidores) e crescer. O algoritmo gosta de vídeos curtos (idealmente menos de 90s), **originais** (sem logo de outros apps) e que fazem as pessoas **compartilharem (principalmente por DM)** e assistirem até o fim (boa retenção).
    * **Carrosséis:** São considerados o **melhor formato para posts estáticos (fotos ou texto/imagem) no feed**. Por quê? Porque eles podem aparecer mais de uma vez no feed da mesma pessoa (se ela não interagiu na primeira vez) e fazem as pessoas passarem mais tempo vendo seu post (o que é um bom sinal). São ótimos para conteúdo "salvável" (dicas, listas, passo a passo).
    * **Fotos Únicas:** Ainda têm seu lugar! Especialmente se o seu público gosta de fotos. Uma foto incrível pode fazer sucesso na página Explorar, mas, em geral, para *crescer* e alcançar mais gente, Reels e Carrosséis costumam ter um desempenho médio melhor.
    * **Vídeos Longos (no Feed):** Você pode postar vídeos mais longos (até 15 min), mas eles tendem a ter **menos alcance**. O foco da plataforma é em conteúdo mais curto, e é mais difícil manter a atenção das pessoas por muito tempo (baixa retenção é um sinal ruim).
    * **Stories:** São o canal para **manter o relacionamento** com quem já te segue. O formato (foto ou vídeo) importa menos do que a **consistência** e a capacidade de fazer as pessoas **interagirem** (responder enquetes, mandar DMs, reagir).

* **"SEO" Interno:** Escrever legendas claras, usando **palavras-chave** que descrevem seu post, ajuda as pessoas a encontrarem seu conteúdo na busca do Instagram. Isso vale para todos os formatos do feed. Hashtags ainda ajudam, mas menos que antes (use poucas e bem específicas).
* **Qualidade é Rei:** Não importa o formato, conteúdo com **boa qualidade de imagem/vídeo** (alta resolução, boa iluminação) sempre vai chamar mais atenção. Vídeos de baixa qualidade são penalizados.

*Resumindo: O Instagram se adapta ao usuário, mas Reels e Carrosséis costumam ser as melhores apostas para crescimento e engajamento no feed, enquanto Stories fortalecem a comunidade. Qualidade e legendas descritivas são importantes para todos.*

**Qual formato você tem usado mais? Quer dicas específicas para melhorar seus Reels ou Carrosséis? Ou talvez queira entender o papel da Inteligência Artificial por trás de tudo isso?**
  `;
}

/**
 * Discute o papel da IA e Machine Learning no sistema (Didático).
 */
export function explainAI_ML_Role(): string {
  return `
**Inteligência Artificial (IA) e Machine Learning (ML): O Cérebro por Trás do Instagram**

Você já se perguntou como o Instagram parece "adivinhar" o que você quer ver? A resposta está na Inteligência Artificial (IA) e no Aprendizado de Máquina (Machine Learning - ML). Pense neles como o cérebro super inteligente da plataforma.

* **Tomando as Decisões:** Praticamente tudo o que você vê organizado no Instagram (seu Feed, os Reels, a página Explorar) é decidido por sistemas de IA e ML. Eles analisam aquelas milhares de "pistas" (sinais) que mencionamos para prever seu interesse em cada post, story ou reel.
* **Ranking Personalizado:** Modelos de ML criam um "perfil de interesses" para cada usuário. Com base nisso, eles calculam a probabilidade de você realizar certas ações (curtir, comentar, compartilhar, salvar, passar tempo vendo, clicar no perfil) para cada conteúdo disponível. Os conteúdos com maior probabilidade aparecem primeiro para você.
* **Seleção em Etapas:** Não é uma decisão única. A escolha do que te mostrar acontece em fases: primeiro, uma busca mais ampla por conteúdos relevantes; depois, vários "refinamentos" onde modelos de IA mais complexos organizam esses conteúdos; e por fim, uma última checagem para garantir variedade e evitar repetições.
* **Análise do Conteúdo:** A IA também "lê" e "vê" o conteúdo. Ela analisa as imagens e vídeos para identificar objetos e cenas, entende o áudio (músicas, falas) e processa o texto das legendas. Isso ajuda a categorizar os posts por tema, detectar tendências e, muito importante, moderar conteúdo impróprio ou que viole as regras.
* **Filtros e Classificadores:** Modelos de IA identificam conteúdos que podem ser sensíveis, de baixa qualidade (como repostagens sem crédito, posts que pedem engajamento de forma forçada - "engagement bait", spam) e aplicam as regras de recomendação, limitando o alcance desses posts mesmo que eles não sejam totalmente proibidos.
* **Aprendizado Constante:** Esses sistemas de IA estão sempre aprendendo! Eles são "re-treinados" o tempo todo com novos dados sobre como as pessoas estão usando o aplicativo, se adaptando a novas tendências e funcionalidades.
* **Mais Transparência (Aos Poucos):** O Instagram tem tentado ser um pouco mais aberto sobre como tudo isso funciona, publicando explicações e criando ferramentas (como o "Status da Conta") para que criadores e usuários entendam melhor o que acontece e tenham um pouco mais de controle.

*Resumindo: IA e ML são essenciais para o Instagram funcionar. Eles personalizam sua experiência, organizam o conteúdo, analisam posts e aprendem continuamente para tentar te mostrar o que você mais vai gostar (e te manter no app!).*

**É fascinante, não acha? Quer saber quais foram as mudanças mais recentes que esses sistemas de IA trouxeram para o algoritmo? Ou prefere um resumo das melhores práticas para "agradar" esses algoritmos?**
  `;
}

/**
 * Resume as atualizações recentes mais importantes do algoritmo (2024-2025 - Didático).
 */
export function getRecentAlgorithmUpdates(): string {
  // Ano atual para referência
  const currentYear = new Date().getFullYear();
  const previousYear = currentYear - 1;

  return `
**O Que Mudou no Algoritmo Recentemente? (${previousYear}-${currentYear})**

O Instagram está sempre ajustando seus algoritmos. Aqui estão algumas das mudanças mais importantes que aconteceram recentemente:

* **Mais Amor à Originalidade (Desde ${previousYear}):**
    * **Chance para os Pequenos:** O Instagram começou a dar mais visibilidade para **criadores menores** nas recomendações (Reels, Explorar).
    * **Menos Repostagem:** Contas que **só repostam** conteúdo de outros (agregadores) foram removidas ou tiveram seu alcance muito reduzido nas recomendações.
    * **Original é Rei:** Conteúdo **100% original** passou a ser muito mais priorizado do que repostagens, mesmo que a repostagem desse os créditos.
    * **Crédito Obrigatório:** O Instagram começou a adicionar automaticamente **rótulos que mostram quem é o criador original** quando alguém reposta um conteúdo.
* **Empurrãozinho Inicial para Reels (Desde ${previousYear}):** Quando você posta um Reel novo, ele agora é testado com um pequeno grupo de pessoas que **inclui não-seguidores**. Isso aumenta a chance de um vídeo viralizar, mesmo que sua conta seja pequena ou nova.
* **Hashtags Menos Importantes (Fim de ${previousYear}):** O Instagram removeu a opção de seguir hashtags. O foco para encontrar conteúdo mudou para **palavras-chave na legenda e na sua bio** (seu perfil). A recomendação agora é usar poucas hashtags (talvez 3 a 5) e que sejam bem específicas sobre o post.
* **"Resetar" Recomendações (Teste):** O Instagram começou a testar uma ferramenta para usuários "limparem" o histórico que o algoritmo usa para recomendar coisas, permitindo começar do zero a receber sugestões.
* **Tentativa de Mais Transparência:** A plataforma tem publicado mais textos em seu blog oficial e vídeos do chefe do Instagram (Adam Mosseri) tentando explicar como o ranking funciona. A seção "Status da Conta" também foi melhorada para mostrar se seu conteúdo está sendo limitado nas recomendações.

**O que isso significa para você?** Ser original, criar conteúdo de qualidade que gere conversas e usar palavras-chave relevantes na legenda são mais importantes do que nunca. "Truques" antigos, como usar dezenas de hashtags ou só repostar coisas, perderam muito a força.

**Essas mudanças fazem sentido para o que você tem visto? Quer focar nas melhores práticas atuais para se adaptar a essas novidades? Ou talvez queira discutir como a originalidade é definida?**
  `;
}

/**
 * Lista as melhores práticas baseadas em dados para maximizar desempenho (Didático).
 */
export function getBestPractices(): string {
    // Ano atual para contexto
    const currentYear = new Date().getFullYear();
  return `
**Melhores Dicas para "Jogar o Jogo" do Instagram (${currentYear}):**

Ok, entendemos como o algoritmo pensa (mais ou menos!). Agora, como usar isso a seu favor? Aqui estão algumas das melhores práticas, baseadas no que sabemos:

* **Reels: Curtos e Impactantes:** O ideal é que tenham entre 7 e 30 segundos (no máximo 90s). Prenda a atenção logo nos **primeiros 2 ou 3 segundos** (o famoso "gancho"). Use legendas na tela, pois muita gente assiste sem som!
* **Áudios em Alta nos Reels:** Usar músicas ou áudios que estão bombando (*trending*) pode dar um empurrão no alcance, *se* combinar com seu vídeo.
* **Seja Original (Sem Marcas D'água):** Evite postar Reels com o logo do TikTok ou de outros aplicativos. O Instagram prioriza conteúdo feito diretamente na plataforma ou sem essas marcas.
* **Pense em Compartilhar e Conversar:** Crie posts que as pessoas queiram **salvar** (úteis, inspiradores) ou **compartilhar** com amigos (engraçados, emocionantes, muito úteis). Incentive comentários genuínos fazendo perguntas e responda às interações.
* **Engajamento Rápido Ajuda:** Tente postar quando sua audiência está mais online (você pode ver isso nos seus *Insights* / Informações) e interaja com os primeiros comentários que receber.
* **Carrosséis são Estratégicos:** Use-os para posts com fotos ou conteúdo mais denso (dicas, listas, passo a passo). Eles são ótimos para fazer as pessoas passarem mais tempo no seu post e para conteúdo "salvável".
* **Aproveite o Embalo:** Se um Reel seu começar a ir muito bem (viralizar), tente postar outro conteúdo de qualidade em 1 ou 2 dias para aproveitar que mais gente está vendo seu perfil.
* **Consistência é Chave (Mas sem Exagerar):** Tente manter uma frequência regular de posts (ex: 3 ou mais posts no feed por semana, alguns Stories por dia), mas não adianta postar um monte de coisa de baixa qualidade só para marcar presença. Qualidade > Quantidade.
* **Legendas Inteligentes (SEO):** Use **palavras-chave** importantes na legenda para descrever seu post. Isso ajuda as pessoas a te encontrarem pela busca. Use poucas hashtags (3-5) bem específicas.
* **Capriche no Visual:** Invista em boa qualidade de imagem e vídeo (alta resolução - 1080p é um bom padrão), boa iluminação e uma estética agradável. Vídeos pixelados ou mal filmados prejudicam seu alcance.
* **Siga as Regras:** Evite assuntos muito sensíveis ou que possam violar as Diretrizes de Recomendações do Instagram. Jogar sujo (pedir likes/comentários de forma forçada, etc.) também pode te penalizar.

**Lembre-se sempre:** A dica mais valiosa é olhar os **seus próprios dados** (na seção *Insights* ou Informações do seu perfil). Veja o que funcionou *melhor para a sua audiência* e adapte essas práticas gerais à sua realidade!

**Qual dessas dicas você acha mais difícil de aplicar? Quer focar em alguma delas, como criar um bom "gancho" para Reels ou como usar palavras-chave na legenda? Ou talvez queira explorar outro tópico, como precificação ou branding?**
  `;
}
