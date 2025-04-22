// @/app/lib/knowledge/pricingKnowledge.ts - v1.2 (Didático e Guiado)
// Conhecimento sobre Precificação e Negociação na Creator Economy Brasileira (2025), adaptado para ser didático e guiar o usuário.

/**
 * Retorna faixas de preço estimadas para publis no Instagram (Didático e Guiado).
 */
export function getInstagramPricingRanges(): string {
    // Ano atual para contexto
    const currentYear = new Date().getFullYear();
    return `
**Quanto Cobrar por um Post no Instagram? (Estimativas Brasil, ${currentYear})**

Definir o preço de uma publicidade (publi) pode parecer um bicho de sete cabeças, né? Existe uma "regra de bolso" que algumas pessoas usam (tipo, R$500 para cada 10 mil seguidores), mas a verdade é que **o valor real varia MUITO**. Depende do seu engajamento, do seu nicho, do que a marca pede, etc.

Mas para te dar uma ideia, aqui estão algumas **faixas de preço *estimadas* por post no feed** (lembre-se, são só estimativas!):

* **Nano Influenciador (1 mil a 10 mil seguidores):** Geralmente entre R$ 500 e R$ 7.000 por uma campanha completa (a média fica mais perto de R$ 4-5 mil). É comum fazer posts isolados ou até permuta (receber o produto/serviço em troca da divulgação).
* **Micro Influenciador (10 mil a 50 mil):** Algo entre R$ 1.000 e R$ 10.000 (média por volta de R$ 7.700). Um combo de post no feed + stories pode ficar na faixa de R$ 4-8 mil. O nicho (assunto que você fala) influencia bastante aqui.
* **Médio Influenciador (50 mil a 100 mil):** Faixa de R$ 5.000 a R$ 15.000 (a média para quem tem até 200 mil seguidores fica em torno de R$ 15.600).
* **Macro Influenciador (100 mil a 500 mil):** Entre R$ 15.000 e R$ 50.000 (média de R$ 25.600 para quem tem até 500 mil). Perfis maiores que isso já podem passar dos R$ 50 mil.
* **Mega Influenciador (1 milhão ou mais):** A partir de R$ 50.000, podendo facilmente passar de R$ 100 mil ou até R$ 180 mil para os criadores mais famosos ou celebridades.

**E os outros formatos?**
* **Reels:** Geralmente custam um valor parecido com o post no feed, porque têm um potencial de alcance muito alto.
* **Stories (sequência):** Costumam ser mais baratos, algo como 40% a 50% do valor de um post no feed. Por exemplo, um pacote de 3 stories para um perfil médio pode custar alguns milhares de reais.
* **Live (Ao Vivo):** O preço pode ser parecido ou até maior que um post no feed, dependendo de quanto tempo dura e quanta gente assiste.
* **Combos (Ex: 1 Post no Feed + 3 Stories):** São super comuns! Os preços variam muito, desde R$ 1.000-R$ 3.000 para quem está começando até bem mais que isso para perfis estabelecidos.

*Lembre-se: Esses números são baseados em pesquisas de mercado e podem mudar. O mais importante é entender o *seu* valor, baseado no seu engajamento, nicho e no que a marca está pedindo.*

**Essas faixas de preço te ajudam a ter uma noção? Quer comparar com os preços do TikTok ou entender como o seu nicho específico influencia nesses valores?**
  `;
}

/**
 * Retorna faixas de preço estimadas para publis no TikTok (Didático e Guiado).
 */
export function getTikTokPricingRanges(): string {
    // Ano atual para contexto
    const currentYear = new Date().getFullYear();
    return `
**E no TikTok? Quanto Cobrar por Vídeo? (Estimativas Brasil, ${currentYear})**

O TikTok é conhecido por ter um engajamento muito alto, e às vezes os preços por lá podem ser até maiores que no Instagram para um alcance parecido. O valor médio global por um vídeo patrocinado gira em torno de R$ 13-14 mil!

Aqui estão algumas faixas **estimadas** para o Brasil:

* **Nano (1 mil a 10 mil seguidores):** Valores mais simbólicos, talvez R$ 100 a R$ 500, ou permuta.
* **Micro (10 mil a 100 mil):** Entre R$ 500 e R$ 3.000. O foco aqui é o nicho e o engajamento alto que esses perfis costumam ter.
* **Médio (100 mil a 500 mil):** Faixa de R$ 3.000 a R$ 12.000 (a média global fica perto de R$ 6 mil). Campanhas maiores podem chegar a valores bem mais altos.
* **Macro (500 mil a 1 milhão):** A partir de R$ 12.000, podendo chegar a R$ 25.000 ou mais.
* **Mega (1 milhão ou mais):** Começa em R$ 25.000 e pode facilmente passar dos R$ 50 mil para perfis bem conhecidos.

**Pontos importantes sobre o TikTok:**
* O foco total é em **vídeos curtos**. Lives ou outros formatos são negociados separadamente.
* É comum as marcas pedirem pacotes que incluem postar no **TikTok e também no Instagram (Reels)**. Geralmente, adiciona-se uns 20-30% no valor para incluir o TikTok.
* O **alto engajamento** da plataforma e o acesso a um público mais jovem ajudam a manter os preços aquecidos.

*Lembre-se: Assim como no Instagram, são estimativas. Seu nicho, engajamento e a complexidade do vídeo influenciam muito.*

**Esses valores do TikTok fazem sentido para você? Quer entender como o setor em que você atua (moda, games, comida, etc.) afeta os preços em ambas as plataformas? Ou prefere falar sobre como negociar esses valores com as marcas?**
  `;
}

/**
 * Descreve benchmarks de investimento por setor de mercado (Didático e Guiado).
 */
export function getSectorBenchmarks(): string {
    // Ano atual para contexto
    const currentYear = new Date().getFullYear();
    return `
**O Assunto Importa? Como o Seu Nicho Afeta o Preço (Benchmarks por Setor, ${currentYear})**

Sim, o assunto sobre o qual você fala (seu nicho) influencia bastante quanto as marcas estão dispostas a pagar. Alguns setores investem mais ou buscam coisas diferentes:

* **Moda e Beleza:** É o setor que **mais faz campanhas** com influenciadores. Por isso, a **variação de preços é enorme**: vai desde permuta ou cachês baixos para quem está começando (nano/micro) até valores de centenas de milhares de reais para as mega influenciadoras de marcas de luxo. Nesse setor, ter um nicho bem definido (ex: moda sustentável, beleza negra) e credibilidade pode valer mais do que só ter muitos seguidores.
* **Tecnologia e Games:** Aqui, as marcas buscam **autoridade e conhecimento técnico**. Se você entende muito do assunto, pode conseguir cobrar um pouco a mais (talvez 20-30% acima de outros nichos). Campanhas de lançamento de produtos podem ter orçamentos altos. Reviews de produtos geralmente envolvem receber o produto e mais um cachê. O setor de apostas e jogos online também costuma pagar bem.
* **Alimentação, Lifestyle (Estilo de Vida), Viagem, Fitness, Casa e Decor:** É uma mistura grande:
    * **Comida/Bebida:** Muitas parcerias locais (restaurantes com micro influenciadores, com cachês menores + refeição) e campanhas grandes de marcas conhecidas com influenciadores maiores.
    * **Viagem:** É comum a permuta (receber a viagem paga) mais um cachê (que varia com o tamanho do influenciador e o destino).
    * **Casa/Decor:** Um nicho que tem crescido! Desde micro influenciadores especializados até nomes conhecidos com cachês mais altos.
    * **Fitness/Saúde:** Muitas parcerias com produtos (suplementos, roupas). Grandes influenciadores fitness podem cobrar valores altos, parecidos com os de moda.

**O que isso nos diz?** As marcas estão valorizando cada vez mais a **especialização** e se o seu público é *exatamente* quem elas querem atingir. Não é só sobre números, é sobre o *encaixe* perfeito.

**Seu nicho se encaixa em algum desses exemplos? Quer discutir como seu nicho específico pode influenciar sua precificação ou como se posicionar melhor dentro dele? Ou prefere entender como funcionam as negociações e os contratos na prática?**
  `;
}

/**
 * Detalha a estrutura comum de negociação e contratos (Didático e Guiado).
 */
export function getNegotiationStructureInfo(): string {
    // Ano atual para contexto
    const currentYear = new Date().getFullYear();
    return `
**Como Funciona a Negociação com as Marcas? (Contratos em ${currentYear})**

O mercado de influência está bem mais profissional. Não é só combinar um post e pronto. Veja os pontos que geralmente entram na conversa e no contrato:

* **Pacotes, Não Posts Isolados:** É raro vender só um story ou só um post. O mais comum são **combos** (Ex: 1 Reel + 3 Stories). Pacotes que incluem mais de uma plataforma (Instagram + TikTok) também são frequentes.
* **O Que e Por Quanto Tempo? (Escopo e Duração):** Quantos posts serão? A campanha vai durar uma semana, um mês, mais tempo? Tudo isso afeta o preço. Parcerias longas (ser "embaixador" da marca) costumam ter um custo por post um pouco menor (um desconto pelo volume).
* **Exclusividade:** É normal ter uma cláusula no contrato que te impede de trabalhar com marcas concorrentes por um tempo. Quanto maior o tempo ou a restrição, mais isso deve **aumentar seu cachê** (pode adicionar 20-30% ou mais), afinal, você está abrindo mão de outras oportunidades.
* **Quem Pode Usar o Conteúdo? (Direitos de Uso):** A marca quer usar seu vídeo ou foto nos canais dela ou em anúncios pagos? Isso geralmente **custa um valor adicional** ou precisa estar bem claro no contrato por quanto tempo e onde eles podem usar. Negocie isso!
* **Entregas e Aprovação:** O contrato vai dizer o que você precisa entregar (ex: relatório com os resultados do post) e, normalmente, a marca pede para **aprovar o conteúdo** antes de você postar (geralmente dão um feedback).
* **Foco no Resultado (ROI e KPIs):** As marcas estão cada vez mais preocupadas com o retorno que o investimento nelas vai trazer. Elas usam métricas para avaliar se valeu a pena. É comum usarem links rastreáveis ou cupons de desconto para medir vendas diretas geradas pela sua publi.
* **Ganhando por Performance (Modelos Híbridos):** Está crescendo a ideia de pagar um valor fixo + uma comissão se você gerar vendas, ou um bônus se atingir certas metas. Isso alinha os interesses e diminui o risco para a marca.
* **Tudo no Papel (Formalização):** Contratos detalhados, emissão de nota fiscal (muitos criadores precisam ter MEI ou outra empresa), regras claras sobre o que acontece se alguém desistir, e seguir as regras de publicidade (colocar #publi) são o padrão hoje.

*Resumindo: A negociação hoje é mais estratégica. Precisa ter clareza sobre o que será entregue, usar dados para justificar seu preço e agir com profissionalismo.*

**Você já teve experiência com contratos assim? Algum desses pontos te gera mais dúvida? Quer focar em como negociar direitos de uso ou cláusulas de exclusividade? Ou prefere ver as tendências gerais de preço no mercado?**
  `;
}

/**
 * Apresenta as tendências recentes na precificação de influência (Didático e Guiado).
 */
export function getPricingTrends(): string {
    // Ano atual para contexto
    const currentYear = new Date().getFullYear();
    return `
**Para Onde o Mercado de Preços Está Indo? (Tendências ${currentYear-1}-${currentYear})**

O mercado de influência não para de mudar, e a forma como os preços são definidos também. Ficar de olho nessas tendências te ajuda a se posicionar melhor:

* **Mais Profissionalismo:** O mercado está mais maduro. As marcas planejam mais, querem ver resultados (ROI - Retorno sobre Investimento) e os orçamentos estão crescendo. Menos "chute", mais estratégia.
* **Plataformas Ajudando na Conexão:** Estão crescendo as plataformas online (tipo marketplaces como Influu, Squid, BrandLovrs) que conectam marcas e criadores. Isso ajuda a ter uma ideia melhor dos preços praticados (benchmarking) e a padronizar um pouco as coisas.
* **Preço Baseado em Dados, Não Só em Seguidores:** O número de seguidores ainda importa, mas o que pesa mais agora é o **engajamento real**, o alcance que você tem dentro do seu público, quem são seus seguidores (demografia) e se seu nicho combina com a marca. As marcas querem eficiência!
* **Modelos de Pagamento por Resultado:** Como falamos, está aumentando o número de acordos onde você ganha um fixo + uma parte variável que depende do seu desempenho (vendas geradas, metas batidas). Isso mostra que as marcas querem compartilhar o risco e o sucesso com o criador.
* **Micro e Médios em Alta:** As marcas perceberam que nem sempre o maior influenciador é o melhor negócio. Elas estão buscando mais os micro e médios influenciadores que têm um nicho forte, bom engajamento e um custo-benefício melhor. A demanda está mais distribuída.
* **Pacotes Multiplataforma e Novos Formatos:** É cada vez mais comum as marcas pedirem pacotes que incluem diferentes redes (Instagram + TikTok, por exemplo) e formatos diferentes (vídeos curtos, webséries, filtros de realidade aumentada, participação em eventos). Isso pode tornar os contratos mais complexos e, potencialmente, mais valiosos.
* **Criador como Parceiro:** Os influenciadores estão deixando de ser vistos só como "outdoors ambulantes". Muitos se posicionam como parceiros estratégicos das marcas, ajudando a criar produtos ou campanhas, o que vai muito além de uma simples "publi".

*Conclusão: O mercado hoje valoriza (e paga por) dados concretos, estratégia bem definida, profissionalismo e resultados que podem ser comprovados.*

**O que você acha dessas tendências? Como você pode usar os dados do seu perfil para justificar melhor seu preço? Quer discutir como se adaptar aos modelos de pagamento por performance ou como se posicionar como um parceiro estratégico para as marcas?**
  `;
}

// Funções auxiliares removidas (getPricingStrategies, getNegotiationTips) pois
// seu conteúdo foi integrado nas funções principais para melhor fluxo.

