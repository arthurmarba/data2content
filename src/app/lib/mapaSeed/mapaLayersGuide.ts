// src/app/lib/mapaSeed/mapaLayersGuide.ts
//
// Gabarito ÚNICO das camadas do mapa narrativo, compartilhado pelos três
// geradores de IA (onboarding declarativo, enriquecimento de Instagram e de
// vídeo). Antes, só o onboarding tinha a definição rigorosa de cada camada; os
// enrichers usavam instruções fracas e produziam:
//   - narrativa em 3ª pessoa descrevendo o CONTEÚDO ("Criadores usando IA...")
//     em vez da IDENTIDADE do dono da conta ("um estrategista que defende a
//     autonomia criativa");
//   - territórios verbosos com sufixo "...para criadores";
//   - temas que ecoavam os territórios (ou nem eram gerados).
//
// Centralizar o gabarito mantém os três caminhos coerentes: a mesma cadeia
// Narrativa → Território → Tema → Asset, com as mesmas regras de forma.

/**
 * Definição canônica das camadas + a cadeia de exemplo. É o miolo reutilizável
 * dos prompts. Cada gerador adiciona ao redor o seu contexto de fonte (o que
 * declarou / o que o Instagram revelou / o que os vídeos mostram).
 */
export const MAPA_LAYERS_GUIDE = `A cadeia do mapa, num único exemplo do começo ao fim:
    Narrativa "sair do piloto automático"
      → Território "paternidade"
        → Tema "sair do escritório a tempo de ver os filhos acordados"
          → Asset de vida "casado, pai de dois"
Mais adiante, os TEMAS se cruzam com os ASSETS e com os interesses da AUDIÊNCIA
para virar pautas. Por isso temas e assets precisam ser CONCRETOS — cenas e
elementos reais da vida, não conceitos abstratos.

NARRATIVA CENTRAL
  O fio condutor — a IDENTIDADE do criador: quem ELE é e de que lugar ELE fala.
  É sempre sobre o DONO da conta, na forma de uma MISSÃO ("democratizar o
  conhecimento financeiro") ou de uma TENSÃO / JORNADA DE VIDA ("sair do piloto
  automático", "se reconstruir depois de uma virada", "um estrategista que
  defende a autonomia criativa").
  • É SOBRE A PESSOA, não sobre o conteúdo dela. NUNCA descreva o que os posts/
    vídeos falam ("Criadores de conteúdo usando IA para atrair marcas") — isso é
    descrição de conteúdo, não narrativa. Reescreva como a identidade de QUEM
    publica ("um criador que usa IA para defender a própria autonomia").
  • NUNCA em 3ª pessoa genérica sobre "os criadores"/"as pessoas". O mapa é do
    criador olhando o PRÓPRIO mapa: fale dele.
  • NUNCA confunda narrativa com território (o assunto). "sair do piloto
    automático" é a narrativa; "paternidade" é o território onde ela ganha palco.
  Frase curta (máx. 12 palavras). Sem aspas, sem ponto final.

TERRITÓRIOS
  Os ASSUNTOS (nichos) que o criador ocupa com LEGITIMIDADE. Pense: "se isso
  fosse um nicho de conteúdo, qual seria?".
  • FORMA: substantivo / sintagma nominal curto e OBJETIVO (1 a 3 palavras).
    Bons territórios: "paternidade", "publicidade", "inteligência artificial",
    "estratégias de conteúdo", "vida de solteiro", "finanças pessoais".
  • NUNCA adicione sufixo de público ("...para criadores", "...para marcas").
    O território é o assunto cru: "publicidade", não "publicidade e marcas para
    criadores"; "inteligência artificial", não "IA para criadores de conteúdo".
  • NUNCA comece com verbo. "Monetizar conteúdo", "Encontrar a narrativa" são
    OBJETIVOS/AÇÕES — reduza ao assunto-raiz ("Monetização" → melhor ainda:
    "Publicidade"; "Encontrar a narrativa pessoal" → "Narrativa pessoal").
  • Nada de rótulos genéricos ("cultura", "lifestyle", "dicas").
  • 2 a 4 itens, ancorados na narrativa.

TEMAS
  O CRUZAMENTO entre um território e a narrativa — uma CENA concreta, quase
  filmável, que só existe porque ESTE criador (com SUA narrativa) ocupa AQUELE
  território. NÃO é o território repetido em gerúndio.
  • Errado (eco do território): território "paternidade" → tema "ser pai".
  • Certo (território × narrativa): território "paternidade" + narrativa "sair do
    piloto automático" → tema "sair do trabalho e ir correndo pra casa ver a
    família". O "automático" é o trabalho; ser pai é o que o puxa pra casa.
  Cada tema é uma situação real que daria um vídeo. 2 a 4 itens.

ASSETS DE VIDA
  ELEMENTOS REAIS da vida do criador que viram matéria-prima — o que existe DE
  FATO e pode ser cruzado com os temas: papéis e relações (casado, pai de dois),
  trajetória (ex-corporativo, autodidata), contexto (mora no interior, trabalha
  de casa), objetos e cenários recorrentes. NÃO é o assunto nem uma credencial
  abstrata — é vida concreta. Prefira itens específicos e curtos.`;

/**
 * Regra de coerência hierárquica — fecho comum dos prompts.
 */
export const MAPA_COERENCIA_RULE = `Coerência hierárquica obrigatória: a narrativa é a identidade do criador; os
territórios derivam dela; os temas são o cruzamento território × narrativa
(cenas, não ecos); os assets são elementos da vida real que alimentam os temas.`;

/**
 * Regra de PRESERVAÇÃO — compartilhada pelos enrichers (Instagram e vídeo).
 *
 * Invariante do produto: o mapa é do criador. O enriquecimento NUNCA remove um
 * chip — só o criador remove. A fonte apenas REFINA (a redação) ou ADICIONA. Isso
 * mantém o mapa estável e confiável (reduz a ansiedade de "vão apagar o que é meu")
 * e ainda assim crescendo. O código aplica isto como invariante dura (união); esta
 * regra alinha o LLM para que ele não tente cortar nem duplicar.
 */
export const MAPA_PRESERVATION_RULE = `PRESERVAÇÃO (regra inviolável): o mapa atual pertence ao criador. Você NUNCA
remove um chip existente de nenhuma camada (territórios, temas, narrativas
adjacentes, assets, formatos) — só o criador remove. Seu papel é apenas:
1) MANTER cada chip existente exatamente como está;
2) ADICIONAR chips genuinamente novos que a fonte revele.
Refino é só de redação: se a fonte traz o MESMO conceito de um chip que já existe
(ainda que com outras palavras), NÃO crie um chip novo nem o reescreva — mantenha
o existente. Só adicione quando for de fato um conceito novo.`;

/**
 * Regra de FORMA do tom — compartilhada pelos três geradores.
 *
 * O tom é renderizado como CHIPS no card ("Como cria"), não como parágrafo. Antes
 * a IA produzia uma frase descritiva ("Didático, com foco em estratégias e
 * insights sobre o universo digital, intercalado com momentos pessoais e humor
 * leve") que estourava o card e repetia o contexto que territórios/temas já dão.
 * Esta regra força descritores objetivos e curtos, separados por vírgula.
 */
export const MAPA_TOM_RULE = `de 1 a 3 descritores objetivos e curtos do JEITO de falar (reflexivo, técnico, íntimo, direto, irônico, provocativo, acolhedor…), SEPARADOS POR VÍRGULA, cada um com no máximo 3 palavras (ex.: "Didático e analítico, Humor leve"). É só o jeito de comunicar — NUNCA o conteúdo, nunca o contexto de territórios/temas/assuntos (eles já contextualizam o mapa). Nunca uma frase corrida; sem ponto final. Errado: "Didático, com foco em estratégias e insights sobre o universo digital, intercalado com momentos pessoais e humor leve". Certo: "Didático e analítico, Humor leve".`;
