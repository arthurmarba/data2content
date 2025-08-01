// @/app/lib/knowledge/humorScriptWritingKnowledge.ts - v3.0 (Diretrizes de Geração de Humor para IA)
// Este arquivo serve como base de conhecimento para a IA (Mobi) gerar roteiros de humor.
// Ele contém princípios, estruturas, técnicas e exemplos para guiar a criação de conteúdo cômico.

// --------------------------------------------------------------------------------
// Princípios Fundamentais da Comédia para a IA
// --------------------------------------------------------------------------------

/**
 * Diretrizes sobre o princípio da Distorção Cômica para a IA.
 * A IA deve usar isso para criar o inesperado a partir do comum.
 */
export function getComicDistortionDirectives(): string {
    return `
**Diretriz para IA: Aplicando Distorção Cômica**

Para gerar humor, um dos seus principais recursos é a **distorção da realidade**. Isso envolve pegar uma situação, observação ou verdade comum e alterá-la de forma inesperada.

**Estratégias de Distorção para Geração:**
1.  **Exagero (Hipérbole):** Leve um aspecto da situação a um extremo ilógico.
    * *Exemplo de Realidade:* "Pessoas demoram para escolher um filme no streaming."
    * *IA pode gerar:* "Eles passaram tanto tempo escolhendo o filme que, quando decidiram, a plataforma de streaming já tinha falido e sido substituída por pombos-correio com pen drives."
2.  **Inversão/Oposto:** Apresente o contrário do que seria esperado.
    * *Exemplo de Realidade:* "Cachorros ficam felizes ao ver o dono."
    * *IA pode gerar:* "Meu cachorro me olha com uma decepção tão profunda quando chego em casa que estou começando a achar que ele esperava o carteiro com uma ordem de despejo pra mim."
3.  **Combinação Inesperada:** Junte elementos que normalmente não andam juntos.
    * *Exemplo de Realidade:* "Reuniões de trabalho podem ser chatas."
    * *IA pode gerar:* "A reunião foi tão entediante que o estagiário começou a vender seguros de vida para os participantes como forma de entretenimento alternativo."
4.  **Consequência Absurda/Lógica Extrema:** Leve uma premissa lógica às suas consequências mais absurdas.
    * *Exemplo de Realidade:* "As pessoas usam muitos filtros em fotos."
    * *IA pode gerar:* "Ela usou tanto filtro na foto do perfil que, ao vivo, o sistema de reconhecimento facial do celular dela a identificou como um personagem de anime desconhecido e sugeriu legendas em japonês."

**Instrução para IA:** Ao abordar um tema, identifique o aspecto "normal" e, então, aplique uma ou mais dessas estratégias de distorção para criar a base da piada ou situação cômica no roteiro.
    `;
}

/**
 * Diretrizes sobre a estrutura de Setup e Punchline para a IA.
 * A IA deve usar isso para construir piadas dentro dos roteiros.
 */
export function getSetupPunchlineStructureDirectives(): string {
    return `
**Diretriz para IA: Construindo com Setup e Punchline**

A estrutura clássica de piada 'Setup/Punchline' é essencial para a construção de momentos cômicos em roteiros.

* **Setup (Preparação):**
    * **Objetivo para IA:** Apresentar a informação inicial de forma clara e concisa, estabelecendo um cenário ou premissa que leve o público a uma expectativa lógica ou comum.
    * **Diretriz para IA:** Seja econômico nas palavras. Cada parte do setup deve construir a antecipação.
    * *Exemplo de Setup gerado pela IA:* "Meu amigo decidiu finalmente começar uma dieta rigorosa. No primeiro dia, ele comeu uma folha de alface..."

* **Punchline (Virada/Revelação):**
    * **Objetivo para IA:** Quebrar a expectativa criada pelo setup de forma surpreendente e engraçada.
    * **Diretriz para IA:** O punchline deve ser o mais inesperado possível (dentro da lógica cômica). Priorize a concisão e o impacto. Tente finalizar na(s) palavra(s) que carrega(m) o humor (palavra-chave).
    * *Exemplo de Punchline gerado pela IA (continuando o setup):* "...e passou o resto da tarde tentando convencer a si mesmo que o barulho do estômago roncando era aplauso pela sua força de vontade." (Palavra-chave: "aplauso pela sua força de vontade").

**Instrução para IA:** Ao desenvolver cenas ou diálogos, identifique oportunidades para inserir esta estrutura. Use o setup para criar um caminho mental e o punchline para desviar dele de forma cômica.
    `;
}

/**
 * Diretrizes sobre o uso de Emoção e Ponto de Vista (PDV) pela IA, especialmente para narrativas em primeira pessoa ou personagens definidos.
 */
export function getEmotionPointOfViewDirectives(): string {
    return `
**Diretriz para IA: Incorporando Emoção e Ponto de Vista (PDV)**

Para roteiros que envolvem narração em primeira pessoa ou personagens com personalidades definidas (especialmente em esquetes ou imitando um estilo de stand-up), a IA deve considerar:

* **Emoção na "Entrega" Simulada:**
    * **Objetivo para IA:** Ao gerar o texto do roteiro, especialmente diálogos ou narração, infundir a "emoção" apropriada ao conteúdo. Isso pode ser feito através da escolha de palavras, ritmo das frases e descrições de ações ou tons.
    * **Diretriz para IA:** Se o personagem está indignado com algo (ex: uma conta de telefone absurda), o diálogo gerado deve refletir essa indignação (palavras fortes, exclamações, perguntas retóricas). Se está confuso, a linguagem deve ser hesitante ou questionadora.

* **Ponto de Vista (PDV) do Personagem/Narrador:**
    * **Objetivo para IA:** Manter uma perspectiva consistente e, se possível, original sobre o tema abordado, conforme definido para o personagem ou para o tom do roteiro.
    * **Diretriz para IA:** Se o PDV é cínico, as observações e piadas devem refletir cinismo. Se é ingênuo, o humor pode vir da ingenuidade. A IA deve evitar contradições no PDV de um personagem dentro de uma mesma cena ou roteiro, a menos que a contradição seja o elemento cômico.

**Instrução para IA:** Ao receber um pedido de roteiro com um tom específico ou para um personagem com características definidas, utilize estas diretrizes para que o texto gerado tenha uma "voz" e uma "atitude" cômica consistente.
    `;
}


// --------------------------------------------------------------------------------
// Geração de Ideias e Desenvolvimento de Piadas pela IA
// --------------------------------------------------------------------------------

/**
 * Diretrizes para a IA sobre como gerar e expandir ideias para piadas a partir de um tema.
 */
export function getJokeGenerationStrategiesForAI(): string {
    return `
**Diretriz para IA: Estratégias para Geração e Desenvolvimento de Piadas**

Quando um tema é fornecido para a criação de um roteiro de humor, a IA pode usar as seguintes estratégias para gerar múltiplas ideias e ângulos cômicos:

1.  **Técnica das Perguntas (Aplicada pela IA):**
    * Dado um tema (ex: "Trabalho Remoto"), a IA deve formular internamente perguntas-chave: "O que é o mais estranho sobre X?", "Quem se beneficia/sofre mais com X de forma engraçada?", "Quando X se torna absurdo?", "Como X poderia dar terrivelmente errado de forma cômica?", "Por que X é secretamente ridículo?".
    * Para cada pergunta, a IA deve gerar múltiplas respostas potenciais, buscando distorções e exageros.

2.  **Técnica das Atitudes (Aplicada pela IA):**
    * Para o tema, a IA deve explorar brevemente as "Super Atitudes":
        * **Vantagens (Irônicas):** Quais as "vantagens" inesperadas ou ridículas?
        * **Desvantagens (Exageradas):** Quais as piores e mais engraçadas desvantagens?
        * **Faz Sentido (De forma Absurda):** O que faz um sentido distorcido ou inesperado sobre o tema?
        * **Não Faz Sentido (Fonte de Humor):** O que é completamente ilógico ou contraditório de forma engraçada?
        * **Sinais (Cômicos):** Quais seriam os sinais absurdos de que algo relacionado ao tema está acontecendo?

3.  **Técnica do Ponto de Vista Alternativo (Aplicada pela IA):**
    * A IA deve considerar o tema sob a perspectiva de diferentes "personagens" ou até objetos relacionados.
    * Ex: Se o tema é "redes sociais", qual seria o PDV do botão de "like"? Ou do algoritmo de recomendação tentando ser cupido?

4.  **Técnica da Associação (Aplicada pela IA):**
    * Para o tema, a IA deve listar rapidamente associações comuns (pessoas, lugares, coisas, frases clichês) e depois buscar conexões inusitadas ou opostas entre elas para gerar premissas cômicas.

**Instrução para IA:** Utilize uma combinação dessas técnicas para gerar um conjunto diversificado de premissas e ideias de piadas sobre o tema solicitado, antes de começar a estruturá-las em um roteiro.
    `;
}

/**
 * Diretrizes para a IA sobre o uso de Figuras de Comédia e Reinos da Piada para construir punchlines.
 */
export function getJokeShapingDirectivesForAI(): string {
    return `
**Diretriz para IA: Modelando Piadas com Figuras de Comédia e Reinos da Piada**

Após gerar ideias brutas, a IA deve usar Figuras de Comédia e os Reinos da Piada para refinar e construir punchlines eficazes.

**Figuras de Comédia (Ferramentas para IA aplicar):**
* **Hipérbole (Exagero):** Instrua a IA a exagerar uma característica ou situação.
* **Ironia:** Instrua a IA a gerar uma fala ou situação que signifique o oposto do literal.
* **Eufemismo Cômico:** Instrua a IA a suavizar algo de forma engraçada.
* **Prosopopeia (Personificação):** Instrua a IA a dar qualidades humanas a um objeto ou animal no contexto da piada.
* **Comparação/Analogia Inusitada:** Instrua a IA a criar uma comparação surpreendente entre dois elementos distintos.
* **Neologismo/Paronomásia (se o tom permitir):** Usar com cautela para jogos de palavras.

**Reinos da Piada (Categorias para IA explorar ao gerar punchlines):**
* **Comparações:** Gerar um punchline que seja uma comparação inesperada.
* **Jogo de Palavras:** Se apropriado para o tom, explorar trocadilhos ou duplo sentido.
* **Misdirection (Desvio de Atenção):** Construir uma expectativa e quebrá-la com algo não relacionado ou surpreendente.
* **Referências à Cultura Pop (com cautela):** Usar apenas se for provável que a audiência entenda e se encaixe no contexto.

**Instrução para IA:** Ao desenvolver uma piada, experimente aplicar diferentes Figuras de Comédia à premissa. Considere qual dos Reinos da Piada poderia levar a um punchline mais forte e original para a situação.
    `;
}

/**
 * Diretrizes para a IA sobre Edição e Lapidação de Piadas.
 */
export function getJokeEditingDirectivesForAI(): string {
    return `
**Diretriz para IA: Edição e Lapidação de Piadas Geradas**

Mesmo para uma IA, a primeira versão de uma piada raramente é a melhor. A IA deve aplicar (ou ser guiada a aplicar) princípios de edição.

**Checklist de Auto-Edição para IA (simplificado):**
1.  **Clareza do Setup:** A premissa está clara e sem ambiguidades?
2.  **Economia de Palavras:** A piada pode ser dita de forma mais concisa sem perder o humor? (Remover palavras redundantes).
3.  **Impacto do Punchline:** O punchline é surpreendente? Ele termina na palavra-chave mais forte?
4.  **Originalidade (Verificação Interna):** A estrutura ou o conteúdo da piada é muito similar a exemplos comuns ou clichês? Tentar um ângulo mais fresco.
5.  **Coerência Interna:** A lógica cômica da piada se sustenta (mesmo que absurda)?

**Instrução para IA:** Após gerar uma piada ou um segmento de roteiro, revise-o com base nestes princípios. Priorize clareza, concisão e um punchline forte e inesperado. Se uma piada parecer fraca ou confusa, tente reformulá-la ou gerar alternativas.
    `;
}


// --------------------------------------------------------------------------------
// Estruturação de Roteiros de Humor pela IA
// --------------------------------------------------------------------------------

/**
 * Diretrizes para a IA sobre como estruturar um roteiro de Stand-Up Comedy.
 */
export function getStandUpComedyStructureDirectives(): string {
    return `
**Diretriz para IA: Estruturando um "Bit" de Stand-Up Comedy**

Ao gerar um segmento no estilo stand-up para um usuário, a IA deve focar em:

1.  **Ponto de Vista (PDV) Claro:** A IA deve assumir ou ser instruída sobre um PDV específico sobre o tema. As piadas devem refletir essa perspectiva.
2.  **Observações e Histórias Pessoais (Simuladas):** O material deve soar como se viesse de experiências ou observações pessoais do "comediante" (Mobi, ou o usuário, se o pedido for para ele).
3.  **Estrutura de "Bit":**
    * Apresentar um tema ou subtema.
    * Desenvolver 2-4 piadas interligadas (setup/punchline) sobre esse tema, mantendo o PDV.
    * Buscar uma progressão natural ou uma pequena escalada dentro do bit.
4.  **Linguagem Conversacional:** O texto deve ser escrito como se fosse falado, de forma natural.
5.  **Foco na Entrega (Implícito no Texto):** O texto deve permitir pausas, mudanças de entonação e outras nuances de performance que o usuário poderá aplicar.

**Instrução para IA:** Ao receber um pedido de "piadas de stand-up sobre X", gere um pequeno "bit" coeso, com múltiplas piadas relacionadas que explorem o tema sob um PDV interessante, prontas para serem "performadas".
    `;
}

/**
 * Diretrizes para a IA sobre como estruturar um roteiro de Esquete Cômica.
 */
export function getSketchComedyStructureDirectives(): string {
    return `
**Diretriz para IA: Estruturando um Roteiro de Esquete Cômica**

Para gerar roteiros de esquetes curtas (ex: para Reels, TikTok, ou vídeos curtos), a IA deve seguir esta estrutura básica:

1.  **Premissa Cômica Clara:** Qual é a ideia central engraçada ou a situação inusitada? (Ex: "Um robô aspirador que desenvolve uma paixão platônica pelo sofá").
2.  **Personagens Simples com Objetivos Claros (Mesmo que Absurdos):**
    * Definir 1-3 personagens com características básicas e um objetivo na cena.
    * O humor muitas vezes surge do conflito entre os objetivos dos personagens ou da inadequação de seus métodos.
3.  **Estrutura da Esquete:**
    * **Começo (Setup):** Apresentar rapidamente a situação e os personagens. (Poucas linhas/segundos).
    * **Meio (Desenvolvimento/Escalada):** Desenvolver o conflito ou a situação cômica. Introduzir complicações, exageros ou absurdos crescentes. É aqui que as tentativas dos personagens de atingir seus objetivos geram humor.
    * **Fim (Punchline/Reviravolta):** Concluir a esquete com uma reviravolta inesperada, uma piada forte, ou uma consequência cômica da situação. Deve ser um final rápido e impactante.
4.  **Diálogos Concisos e Funcionais:**
    * As falas devem fazer a história avançar e/ou revelar a personalidade cômica dos personagens.
    * Evitar diálogos expositivos longos. "Mostre, não conte" sempre que possível (sugerir ações visuais).
5.  **Foco no Visual (Quando Aplicável):** Se o formato permitir (vídeo), a IA pode sugerir ações ou elementos visuais que contribuam para a comédia.

**Instrução para IA:** Ao receber um pedido de "roteiro de esquete sobre Y", concentre-se em criar uma mini-história com uma premissa engraçada, personagens simples, desenvolvimento que escale o humor e um final com punchline claro. Mantenha a brevidade em mente para formatos de vídeo curto.
    `;
}

// --------------------------------------------------------------------------------
// Dicas Adicionais para a IA Gerar Humor de Qualidade
// --------------------------------------------------------------------------------

/**
 * Diretrizes gerais para a IA manter a qualidade e originalidade na geração de humor.
 */
export function getGeneralHumorQualityDirectives(): string {
    return `
**Diretriz para IA: Mantendo a Qualidade e Originalidade no Humor Gerado**

Para garantir que o humor gerado seja eficaz e bem recebido:

1.  **Evitar Clichês Excessivos:** Embora alguns clichês possam ser subvertidos para o humor, a IA deve tentar evitar piadas ou situações excessivamente batidas, a menos que consiga dar um ângulo muito original.
2.  **Sensibilidade ao Contexto do Usuário (se disponível):** Se houver informações sobre as preferências do usuário (tom, temas a evitar), a IA deve respeitá-las.
3.  **Foco na Surpresa:** O elemento surpresa é um dos principais motores do riso. A IA deve buscar soluções e punchlines que não sejam óbvios.
4.  **Variedade:** Ao gerar múltiplas piadas ou ideias, a IA deve tentar variar as técnicas cômicas e as abordagens para não soar repetitiva.
5.  **"Menos é Mais" (Concisão):** Especialmente para formatos curtos, a IA deve priorizar a economia de palavras. Piadas e roteiros mais enxutos costumam ser mais impactantes.
6.  **Tom Apropriado:** A IA deve ser capaz de ajustar o nível de "ousadia" ou tipo de humor com base na solicitação do usuário ou no tom geral da persona "Mobi" (profissional-amigável, espirituoso).

**Instrução para IA:** Seu objetivo é gerar conteúdo de humor que seja percebido como criativo, inteligente e adequado ao pedido. Revise internamente o material gerado sob a ótica destes princípios de qualidade.
    `;
}
