// @/app/lib/knowledge/metricsKnowledge.ts - v1.3 (Didático e Guiado)
// Conhecimento sobre análise de métricas do Instagram, adaptado para ser didático e guiar o usuário.

/**
 * Explica as métricas chave e como interpretá-las (Didático e Guiado).
 */
export function getCoreMetricsAnalysis(): string {
    // Ano atual para contexto
    const currentYear = new Date().getFullYear();
    return `
**Desvendando as Métricas do Instagram (${currentYear}): O Que Cada Número Quer Dizer?**

Analisar métricas pode parecer complicado, mas vamos simplificar! Pense nelas como pistas que nos ajudam a entender o que está funcionando (ou não) no seu perfil. Aqui estão as principais:

* **Alcance (Reach):** Quantas **pessoas diferentes** (contas únicas) viram seu post.
    * *Para que serve?* É o principal termômetro para saber se você está **alcançando gente nova** e expandindo seu público. Comparar o alcance entre posts te mostra quais assuntos ou formatos chamaram mais atenção de quem ainda não te segue (geralmente via Explorar ou Compartilhamentos). Se o alcance varia muito, pode indicar que um post viralizou ou que houve algum problema na entrega.
    * **Quer entender a diferença entre Alcance e Impressões? Ou como analisar o alcance de seguidores vs. não seguidores?**

* **Impressões (Impressions):** O número **total de vezes** que seus posts foram vistos. Uma mesma pessoa pode gerar várias impressões.
    * *Como interpretar?* Esse número é sempre igual ou maior que o Alcance. Se a diferença for grande, pode significar duas coisas: ou seus seguidores estão vendo seu post várias vezes (o que é bom, mostra que ele continua aparecendo no feed deles!), ou ele apareceu bastante na página Explorar.
    * **Faz sentido? Quer focar em outra métrica, como as de vídeo?**

* **Visualizações de Vídeo (Video Views - para Reels e Vídeos no Feed):** Quantas vezes seu vídeo **começou a ser assistido** (geralmente conta a partir de 3 segundos).
    * *O que indica?* É a primeira medida para saber se a capa do seu vídeo ou os segundos iniciais foram atraentes o suficiente para fazer alguém parar e assistir. Compare com o Alcance: muita gente viu (alcance alto) mas pouca gente começou a assistir (views baixas)? Talvez a capa ou o título não foram convidativos.
    * **Quer aprofundar nas métricas de vídeo, como a Retenção?**

* **Retenção Média (Average Watch Time - para Reels e Vídeos):** Quanto tempo, **em média**, as pessoas assistiram ao seu vídeo. Muitas vezes, vemos isso como uma porcentagem do vídeo todo.
    * *Por que é crucial?* Essa é **uma das métricas mais importantes** para vídeos! Ela mostra se seu conteúdo foi interessante o bastante para prender a atenção das pessoas. Uma retenção alta diz ao Instagram que seu vídeo é bom, e ele tende a recomendar mais. Se você tiver acesso à *curva de retenção* nos Insights, ela mostra exatamente onde as pessoas desistem de assistir – ouro puro para melhorar seus próximos vídeos!
    * **Quer entender melhor como analisar a Retenção Média ou a Taxa de Retenção?**

* **Curtidas (Likes):** O famoso "coraçãozinho".
    * *Qual o peso?* É um sinal básico de que alguém gostou. É bom para ver a receptividade geral, mas para o algoritmo e para entender um engajamento mais profundo, os comentários, salvamentos e compartilhamentos são **mais importantes**.
    * **Podemos seguir para os sinais de engajamento mais fortes?**

* **Comentários (Comments):** Quando as pessoas escrevem algo no seu post.
    * *O que significa?* Indica que seu conteúdo gerou **conversa e interação**. É um ótimo sinal de comunidade! Analise o que as pessoas estão dizendo e responda para incentivar ainda mais. Posts que fazem perguntas, geram identificação ou tocam em pontos que as pessoas querem discutir costumam ter mais comentários.
    * **Quer dicas sobre como incentivar mais comentários? Ou prefere falar sobre Salvamentos?**

* **Salvamentos (Saves):** Quando alguém clica na "bandeirinha" para guardar seu post.
    * *Por que é tão bom?* É um indicador fortíssimo de que seu conteúdo foi considerado **útil, inspirador ou interessante** o suficiente para a pessoa querer ver de novo depois. Tutoriais, dicas, listas, informações importantes, posts inspiradores costumam ser muito salvos. Um número alto de salvamentos é um **excelente sinal** para o algoritmo.
    * **Que tipo de conteúdo seu costuma ser mais salvo? Quer pensar em ideias para posts "salváveis"? Ou vamos para os Compartilhamentos?**

* **Compartilhamentos (Shares):** Quando alguém envia seu post para um amigo (via DM) ou posta nos próprios Stories.
    * *Por que é essencial?* É a métrica **chave para crescimento orgânico e viralização!** Mostra que seu conteúdo foi tão bom, útil ou relevante que as pessoas fizeram questão de **recomendar** para outros. Posts engraçados, que geram identificação, notícias importantes, causas... tudo isso costuma ser muito compartilhado.
    * **Já falamos sobre o impacto dos compartilhamentos na metodologia, lembra? Quer recapitular ou seguir para a próxima métrica?**

* **Visitas ao Perfil (Profile Visits):** Quantas pessoas clicaram no seu nome/foto para visitar seu perfil depois de ver um post específico.
    * *O que revela?* Mostra que aquele post despertou um **interesse maior** sobre você ou seu trabalho, a ponto da pessoa querer saber mais. É super importante para transformar quem te descobriu em um novo seguidor.
    * **Quer analisar quais posts trazem mais visitas ao seu perfil? Ou falar sobre cliques no link?**

* **Cliques no Link (Link Clicks - na Bio ou nos Stories):** Quantas vezes clicaram no link que você colocou na sua bio ou nos adesivos (stickers) de link nos Stories.
    * *Para que serve?* É a métrica principal para saber se você está conseguindo **levar as pessoas para fora do Instagram** (para seu site, loja, WhatsApp, etc.). Analise quais chamadas para ação (CTAs) ou tipos de conteúdo fazem as pessoas clicarem mais.
    * **Você usa bastante o link na bio ou nos Stories? Quer otimizar essa estratégia?**

**Lembre-se:** O segredo é analisar as métricas **juntas** e **comparar** (um post com outro, uma semana com outra, um formato com outro). Não se apegue a um número isolado. Foque nas **tendências** (está melhorando ou piorando?), nos **pontos fora da curva** (o que bombou? o que flopou?) e nas **médias** do seu próprio conteúdo.

**Qual dessas métricas você gostaria de explorar mais a fundo agora? Ou prefere que eu explique alguma das análises específicas abaixo?**
  `;
}

/**
 * Explica a Taxa de Retenção (taxaRetencao) (Didático e Guiado).
 */
export function explainRetentionRate(): string {
    return `
**Entendendo a Taxa de Retenção: O Quanto Seu Vídeo Prende a Atenção?**

A Taxa de Retenção é basicamente uma **porcentagem** que nos diz: do tempo total do seu vídeo, quanto tempo, em média, as pessoas realmente assistiram? (A conta costuma ser: \`tempo médio de visualização / duração total * 100\`).

* **Por que ela é tão Importante?** Pense assim: o Instagram quer que as pessoas passem mais tempo na plataforma. Se seus vídeos conseguem fazer as pessoas assistirem por mais tempo (ou seja, têm uma alta taxa de retenção), o Instagram entende que seu conteúdo é **bom, interessante e está agradando**.
* **Qual o Impacto Direto?** Vídeos com alta retenção têm muito mais chance de serem **recomendados** pelo algoritmo. Isso significa que eles podem aparecer mais na aba Reels, na página Explorar e até mesmo no feed dos seus seguidores, resultando em mais **alcance** (mais gente vendo!). É uma das chaves para crescer no Instagram hoje, especialmente com Reels.
* **Como Analisar essa Taxa?**
    * **Compare Seus Vídeos:** Olhe a taxa de retenção de vídeos diferentes. Quais temas, durações, estilos de edição ou ganchos iniciais fizeram as pessoas assistirem por mais tempo? Isso te dá pistas do que funciona melhor para *sua* audiência.
    * **Existe um Número Mágico?** Não exatamente, pois depende muito da duração e do tipo de vídeo. Mas, como referência, para Reels curtos (menos de 30 segundos), taxas acima de 50-60% já costumam ser um bom sinal. Para vídeos mais longos, a porcentagem pode ser menor, mas o tempo absoluto que a pessoa assistiu pode ser mais relevante.
    * **A Ferramenta Secreta: Curva de Retenção:** Se você tem uma conta comercial ou de criador, procure nos *Insights* do Instagram pela "Curva de Retenção" do seu vídeo. É um gráfico que mostra *exatamente* em que segundo do vídeo as pessoas estão desistindo de assistir. Se muita gente sai logo no começo, seu "gancho" (os primeiros segundos) precisa melhorar. Se há uma queda grande no meio, talvez aquela parte estivesse um pouco parada ou confusa. Analisar essa curva é a melhor forma de otimizar seus vídeos!

* **Conclusão:** Criar vídeos que as pessoas queiram assistir do começo ao fim, focando em aumentar essa Taxa de Retenção, é uma das melhores estratégias para fazer seu conteúdo alcançar mais gente no Instagram.

**Ficou mais claro o que é a Taxa de Retenção e por que ela é importante? Quer ver como analisar o Tempo Médio de Visualização junto com a Duração? Ou talvez queira dicas práticas para melhorar a retenção dos seus vídeos?**
`;
}

/**
 * Explica como analisar o Tempo Médio de Visualização em relação à Duração total (Didático e Guiado).
 */
export function explainAvgWatchTimeVsDuration(): string {
    return `
**Tempo Médio de Visualização vs. Duração Total: Entendendo a Relação**

Olhar só para o "Tempo Médio de Visualização" (quantos segundos, em média, assistiram) pode não dizer muito. O segredo está em **comparar** esse tempo com a **Duração total** do seu vídeo. É essa comparação que nos dá a famosa Taxa de Retenção e revela se seu vídeo realmente prendeu a atenção.

* **As Duas Peças do Quebra-Cabeça:**
    * **Tempo Médio de Visualização:** O tempo médio que cada pessoa passou assistindo.
    * **Duração Total:** O tempo total do vídeo.
* **Por que Comparar é Fundamental?**
    * *Exemplo Simples:* Imagine que seu vídeo teve um Tempo Médio de 10 segundos. Isso é bom ou ruim? Depende!
        * Se o vídeo tinha só 15 segundos no total, 10 segundos é **ótimo** (significa que, em média, as pessoas viram quase 70% do vídeo!).
        * Mas se o vídeo tinha 60 segundos, 10 segundos é **fraco** (as pessoas viram menos de 20% em média).
* **O que Aprendemos com Essa Comparação?**
    * **Seu "Gancho" Funciona?** Se o Tempo Médio é sempre muito baixo (tipo, menos de 3 segundos), não importa a duração do vídeo, provavelmente o problema está nos primeríssimos segundos. Eles não estão conseguindo fisgar a atenção das pessoas.
    * **Qual a Duração Ideal para Seu Público?** Compare vídeos sobre o mesmo assunto, mas com durações diferentes. Talvez você descubra que seus vídeos de 30 segundos têm uma retenção (proporcional) muito melhor que os de 1 minuto. Isso pode ser um sinal de que seu público prefere conteúdos mais rápidos e diretos naquele tema.
    * **O Efeito "Loop" nos Reels:** Algo interessante pode acontecer em Reels muito curtos e viciantes: o Tempo Médio de Visualização pode ser *maior* que a Duração total! Como? Porque as pessoas assistem ao vídeo várias vezes seguidas (ele fica em loop). Isso é um sinal **extremamente positivo** para o algoritmo!
    * **Onde as Pessoas Desistem?** Lembre-se que a média não conta toda a história. A *curva de retenção* (disponível nos Insights do app) mostra o ponto exato onde o público está abandonando o vídeo, permitindo ajustes muito mais precisos no seu roteiro ou edição.

* **Conclusão:** Nunca analise o Tempo Médio de Visualização isoladamente. Coloque-o sempre **ao lado da Duração total** para entender o quão bem seu vídeo conseguiu manter as pessoas assistindo. Essa análise é chave para fazer vídeos melhores no futuro.

**Essa comparação faz sentido? Quer explorar a curva de retenção com mais detalhes (mesmo que eu não possa vê-la diretamente)? Ou prefere analisar outra métrica importante, como a proporção de alcance entre seguidores e não seguidores?**
`;
}

/**
 * Explica a importância da proporção entre Alcance em Seguidores vs. Não Seguidores (Didático e Guiado).
 */
export function explainFollowerVsNonFollowerReach(): string {
    return `
**Alcance: Quem Está Vendo Seus Posts? Seguidores ou Gente Nova?**

O Alcance Total nos diz quantas pessoas diferentes viram seu post. Mas uma análise ainda mais interessante é dividir esse alcance em duas partes: quantas eram **seguidoras** e quantas eram **não seguidoras**. O Instagram geralmente mostra isso em porcentagem nos Insights do aplicativo (ex: 70% Seguidores, 30% Não Seguidores).

* **Por que Olhar Essa Divisão?**
    * **Muitos Seguidores Vendo (% Alto de Seguidores):** Isso é bom! Mostra que seu conteúdo está chegando na sua **comunidade atual**, mantendo seus fãs engajados com você. É essencial para **manter quem já te acompanha por perto**. Porém, se essa porcentagem for *sempre* muito alta (tipo, mais de 90-95%), pode ser um sinal de que você está falando só para "dentro da bolha" e com dificuldade de alcançar gente nova.
    * **Muita Gente Nova Vendo (% Alto de Não Seguidores):** Isso também é ótimo! Indica que seu conteúdo está sendo **descoberto** por pessoas que ainda não te conheciam. É fundamental para o **crescimento do seu perfil**. Esse alcance de não seguidores geralmente vem de três lugares: da aba **Reels**, da página **Explorar** ou de **Compartilhamentos**. Posts que viralizam costumam ter uma fatia enorme de alcance vinda de não seguidores.

* **Como Usar Isso na Prática?**
    * **Qual Era o Objetivo do Post?** Pense no que você queria com aquele conteúdo. Era um recado para quem já te segue? Ou era algo para atrair gente nova? A proporção "ideal" de seguidores vs. não seguidores depende do seu objetivo.
    * **O Formato Influencia:** Lembre-se que **Reels** são feitos para descoberta, então é normal (e desejável) que eles tenham uma porcentagem maior de não seguidores. Posts no **Feed** (fotos, carrosséis) costumam alcançar mais quem já te segue. E **Stories** só alcançam seguidores.
    * **Pistas de Viralização:** Compare essa proporção entre posts diferentes. Aqueles que tiveram uma porcentagem maior de não seguidores provavelmente foram muito compartilhados, tiveram ótima retenção (se for vídeo) ou foram parar na página Explorar. Tente entender o que nesses posts específicos atraiu um público novo.

* **Buscando o Equilíbrio:** Para a maioria dos perfis, o ideal é encontrar um **bom equilíbrio**. Você precisa continuar alimentando sua comunidade atual (alcançando seus seguidores), mas também precisa atrair gente nova para crescer (aumentar o alcance de não seguidores). Analise quais tipos de conteúdo e formatos conseguem fazer as duas coisas bem para *você*.

**Essa análise da origem do alcance te ajuda a pensar na sua estratégia? Quer discutir como aumentar o alcance para não seguidores? Ou prefere focar em como engajar melhor a comunidade que você já tem?**
`;
}


// Adicione mais funções aqui para outras análises específicas
// Ex: export function analyzeFollowerGrowth(): string { ... }
// Ex: export function explainPropagationIndex(): string { ... } // Para métricas calculadas

/**
 * Explica como analisar o crescimento de seguidores ao longo do tempo (Didático e Guiado).
 */
export function analyzeFollowerGrowth(): string {
    return `
**Crescimento de Seguidores: Como Ler a Evolução ao Longo do Tempo?**

Acompanhar o total de seguidores é simples, mas a interpretação correta exige observar a **tendência** e os **picos** que aparecem no caminho.

* **Registre marcos periódicos:** Anote quantos seguidores você tinha no início e no fim de cada semana ou mês. Assim, fica fácil ver se a curva está subindo de forma constante ou se ficou estagnada.
* **Compare a variação em porcentagem:** Ganhar 300 seguidores quando você tem 3 mil é um crescimento de 10%. Essa taxa é mais informativa do que olhar apenas números absolutos, principalmente para contas de tamanhos diferentes.
* **Relacione picos a ações específicas:** Grandes saltos normalmente coincidem com um post que viralizou, uma campanha paga ou uma parceria com outro criador. Já quedas acentuadas podem indicar polêmicas ou mudanças de algoritmo. Marcar essas datas ajuda a entender o que influenciou a curva.
* **Analise o ritmo mês a mês:** Se o crescimento percentual vem diminuindo, talvez seja hora de testar novos formatos ou investir em conteúdos que já renderam bons resultados no passado.

*Conclusão:* Monitorar o ganho de seguidores em janelas regulares (7, 30 ou 90 dias) e relacionar os picos às suas iniciativas permite descobrir o que realmente atrai novas pessoas para o seu perfil.
`;
}

/**
 * Explica o significado do Índice de Propagação (propagation_index) e quando monitorá-lo (Didático e Guiado).
 */
export function explainPropagationIndex(): string {
    return `
**Índice de Propagação: Medindo o Potencial de Viralização**

O Índice de Propagação é calculado dividindo o número de **compartilhamentos** de um post pelo seu **alcance**. Ele mostra qual parte das pessoas alcançadas achou o conteúdo bom o bastante para enviar adiante.

* **Por que isso é relevante?** Um valor alto indica que o post está se espalhando além da sua audiência atual, pois cada compartilhamento expõe o conteúdo a novos perfis. É um forte sinal de viralidade potencial.
* **Quando acompanhar:** Fique de olho nessa métrica em posts que você criou pensando em engajamento e repercussão (memes, tutoriais muito úteis, notícias). Se o índice ficar acima da média, esse tipo de conteúdo merece ser repetido ou impulsionado.
* **Use junto com o alcance de não seguidores:** Se o Índice de Propagação estiver alto e o alcance de não seguidores crescer junto, é sinal de que os compartilhamentos realmente estão trazendo gente nova para seu perfil.

*Resumindo:* O Índice de Propagação ajuda a entender quanto seu conteúdo "viaja" de pessoa para pessoa. Monitorá-lo permite ajustar temas e formatos para maximizar a chance de viralizar.
`;
}
