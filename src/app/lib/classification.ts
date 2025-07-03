/**
 * classification.ts (v5.2 - Versão Definitiva)
 *
 * Esta é a versão mais robusta do sistema, combinando cinco dimensões de análise:
 * 1.  **Format:** O tipo de mídia.
 * 2.  **Proposal:** A intenção/propósito do conteúdo (com expansão máxima).
 * 3.  **Context:** O tópico principal do conteúdo (com expansão máxima e hierarquia).
 * 4.  **Tone:** A abordagem emocional e o sentimento do conteúdo.
 * 5.  **Reference:** Elementos específicos de cultura, geografia e sociedade (com categorias pré-definidas).
 */

export interface Category {
  id: string;
  label: string;
  description:string;
  keywords?: string[];
  subcategories?: Category[];
  examples?: string[]; // Exemplos concretos para guiar a IA
  conflictsWith?: string[]; // IDs de categorias mutuamente exclusivas
}

// --- Dimensão 1: Format ---
export const formatCategories: Category[] = [
  { id: 'reel', label: 'Reel', description: 'Vídeo curto e vertical, geralmente com música ou áudio em alta.', keywords: ['reel', 'vídeo curto', 'dança', 'trend'], examples: ["Meu novo reel com a trend do momento!", "Vídeo rápido mostrando 3 dicas de..."] },
  { id: 'photo', label: 'Foto', description: 'Uma única imagem estática.', keywords: ['foto', 'imagem', 'post', 'fotografia'], examples: ["Foto do pôr do sol de hoje.", "Um clique do nosso novo produto."] },
  { id: 'carousel', label: 'Carrossel', description: 'Post com múltiplas imagens ou vídeos que o usuário pode deslizar.', keywords: ['carrossel', 'sequência', 'álbum', 'deslize para o lado'], examples: ["Deslize para o lado para ver o antes e depois!", "Nosso novo catálogo em formato carrossel."] },
  { id: 'story', label: 'Story', description: 'Conteúdo efêmero, vertical, que desaparece após 24 horas.', keywords: ['story', 'stories', 'temporário'], examples: ["Acabei de postar nos stories!", "Bastidores do evento no meu story."] },
  { id: 'live', label: 'Live', description: 'Transmissão de vídeo ao vivo.', keywords: ['live', 'ao vivo', 'transmissão'], examples: ["Entro ao vivo às 20h para conversar com vocês.", "Live especial sobre o lançamento."] },
  { id: 'long_video', label: 'Vídeo Longo', description: 'Vídeo mais longo que não se encaixa no formato Reel (ex: IGTV, YouTube).', keywords: ['vídeo longo', 'igtv', 'youtube', 'documentário'], examples: ["Saiu vídeo novo no canal!", "Assista ao documentário completo."] },
];

// --- Dimensão 2: Proposal ---
export const proposalCategories: Category[] = [
    { id: 'announcement', label: 'Anúncio', description: 'Comunica uma novidade importante, lançamento ou evento futuro.', keywords: ['anúncio', 'novidade', 'save the date', 'em breve', 'comunicado'], examples: ["Anúncio especial: estou grávida!", "Save the date para o nosso próximo lançamento."] },
    { id: 'behind_the_scenes', label: 'Bastidores', description: 'Mostra os bastidores de um projeto, evento ou da vida do criador.', keywords: ['bastidores', 'making of', 'por trás das câmeras'], examples: ["Os bastidores da gravação de hoje.", "Como foi organizar o evento."] },
    { id: 'call_to_action', label: 'Chamada', description: 'Incentiva o usuário a realizar uma ação específica (comprar, inscrever-se, comentar).', keywords: ['chamada', 'cta', 'link na bio', 'inscreva-se', 'compre agora'], examples: ["Clique no link da bio para garantir o seu!", "Comente aqui o que você achou."] },
    { id: 'clip', label: 'Clipe', description: 'Trecho ou clipe de um conteúdo maior, como um podcast ou vídeo.', keywords: ['clipe', 'trecho', 'corte', 'podcast'], examples: ["O melhor momento do nosso último podcast.", "Um corte da live de ontem."] },
    { id: 'comparison', label: 'Comparação', description: 'Compara dois ou mais produtos, serviços, ideias ou métodos.', keywords: ['comparação', 'vs', 'versus', 'qual é melhor'], examples: ["iPhone vs Android: qual escolher?", "Comparando os dois cremes mais famosos."] },
    { id: 'giveaway', label: 'Sorteio/Giveaway', description: 'Anúncio e regras de um sorteio ou concurso para a audiência.', keywords: ['sorteio', 'giveaway', 'concurso', 'prêmio'], examples: ["FOTO OFICIAL: Sorteio de um kit de maquiagem!", "Regras para participar do nosso giveaway."] },
    { id: 'humor_scene', label: 'Humor/Cena', description: 'Conteúdo cômico, esquete ou cena engraçada.', keywords: ['humor', 'comédia', 'engraçado', 'piada'], examples: ["Aquela situação quando você esquece o que ia dizer.", "Uma paródia da minha série favorita."], conflictsWith: ['positioning_authority', 'tips'] },
    { id: 'lifestyle', label: 'LifeStyle', description: 'Mostra o dia a dia, rotina e estilo de vida do criador.', keywords: ['lifestyle', 'rotina', 'dia a dia', 'vlog'], examples: ["Um pouco da minha rotina matinal.", "Vlog do meu final de semana."] },
    { id: 'message_motivational', label: 'Mensagem/Motivacional', description: 'Conteúdo inspirador, reflexivo ou com uma mensagem positiva.', keywords: ['motivação', 'inspiração', 'reflexão', 'mensagem'], examples: ["Uma mensagem para começar bem o dia.", "Reflexão sobre a importância de persistir."], conflictsWith: ['humor_scene', 'tips'] },
    { id: 'news', label: 'Notícia', description: 'Informa sobre um acontecimento ou novidade relevante.', keywords: ['notícia', 'novidade', 'últimas', 'aconteceu'], examples: ["Últimas notícias sobre o mundo da tecnologia.", "Fique por dentro do que aconteceu."] },
    { id: 'participation', label: 'Participação', description: 'Conteúdo que envolve a participação em eventos, colaborações ou projetos de outros.', keywords: ['participação', 'collab', 'feat', 'convidado'], examples: ["Participei do podcast do Fulano!", "Fui convidado para o evento da marca X."] },
    { id: 'positioning_authority', label: 'Posicionamento/Autoridade', description: 'Demonstra conhecimento e expertise em um tópico para construir autoridade.', keywords: ['autoridade', 'especialista', 'posicionamento', 'conhecimento'], examples: ["A verdade sobre o mercado de ações que ninguém te conta.", "Análise aprofundada das novas diretrizes de marketing."], conflictsWith: ['humor_scene', 'lifestyle'] },
    { id: 'publi_divulgation', label: 'Publi/Divulgação', description: 'Publicidade paga ou divulgação de uma marca, produto ou serviço.', keywords: ['publi', 'publicidade', '#ad', 'parceria paga'], examples: ["Recebidos de hoje da marca X.", "Essa dica é uma #publi, mas é de coração!"] },
    { id: 'q&a', label: 'Perguntas e Respostas', description: 'Sessão dedicada a responder perguntas enviadas pela audiência.', keywords: ['q&a', 'perguntas e respostas', 'perguntinhas', 'caixinha de perguntas'], examples: ["Respondendo as perguntas da caixinha de ontem.", "Q&A especial de 100k seguidores."] },
    { id: 'react', label: 'React', description: 'Reação a outro vídeo, notícia ou conteúdo.', keywords: ['react', 'reagindo', 'minha reação'], examples: ["Reagindo aos vídeos mais engraçados da semana.", "Minha reação ao novo trailer do filme."] },
    { id: 'review', label: 'Review', description: 'Análise ou avaliação de um produto, serviço ou experiência.', keywords: ['review', 'análise', 'avaliação', 'minha opinião'], examples: ["Minha opinião sincera sobre o novo celular X.", "Fui no restaurante Y e aqui está minha avaliação."] },
    { id: 'tips', label: 'Dicas', description: 'Fornece conselhos práticos, tutoriais ou "como fazer".', keywords: ['dica', 'tutorial', 'como fazer', 'passo a passo'], examples: ["3 dicas para organizar sua rotina.", "Passo a passo de como fazer uma maquiagem rápida."], conflictsWith: ['humor_scene', 'message_motivational'] },
    { id: 'trend', label: 'Trend', description: 'Participação em um desafio, meme ou tópico viral do momento.', keywords: ['trend', 'viral', 'desafio', 'challenge'], examples: ["Entrando na trend do momento.", "Fiz o desafio da dança!"] },
    { id: 'unboxing', label: 'Unboxing', description: 'Mostra a experiência de abrir um produto novo pela primeira vez.', keywords: ['unboxing', 'abrindo', 'recebidos'], examples: ["Unboxing do meu novo computador!", "Abrindo os recebidos da semana."] },
];

// --- Dimensão 3: Context ---
export const contextCategories: Category[] = [
  {
    id: 'lifestyle_and_wellbeing',
    label: 'Estilo de Vida e Bem-Estar',
    description: 'Abrange tópicos sobre a vida pessoal, saúde e aparência.',
    subcategories: [
      { id: 'fashion_style', label: 'Moda/Estilo', description: 'Looks, tendências de moda, dicas de estilo.', keywords: ['look do dia', 'outfit', 'tendência'], examples: ["Meu look para o evento de hoje.", "5 tendências de moda para o verão."] },
      { id: 'beauty_personal_care', label: 'Beleza/Cuidados Pessoais', description: 'Maquiagem, skincare, cabelo.', keywords: ['skincare', 'maquiagem', 'cabelo'], examples: ["Minha rotina de skincare noturna.", "Tutorial de maquiagem para festas."] },
      { id: 'fitness_sports', label: 'Fitness/Esporte', description: 'Exercícios, treinos, esportes, vida saudável.', keywords: ['academia', 'treino', 'crossfit', 'corrida', 'dieta'], examples: ["Meu treino de pernas de hoje.", "O que eu como em um dia de dieta."], conflictsWith: ['food_culinary'] },
      { id: 'food_culinary', label: 'Alimentação/Culinária', description: 'Receitas, restaurantes, dicas de culinária.', keywords: ['receita', 'comida', 'restaurante'], examples: ["Receita de bolo de chocolate super fácil.", "Fomos conhecer o novo restaurante italiano."], conflictsWith: ['fitness_sports'] },
      { id: 'health_wellness', label: 'Saúde/Bem-Estar', description: 'Saúde mental, bem-estar físico, meditação.', keywords: ['saúde mental', 'meditação', 'bem-estar', 'psicologia'], examples: ["Dicas para lidar com a ansiedade.", "5 hábitos para uma vida mais saudável."] },
    ]
  },
  {
    id: 'personal_and_professional',
    label: 'Pessoal e Profissional',
    description: 'Abrange tópicos sobre relacionamentos, carreira e desenvolvimento.',
    subcategories: [
      { id: 'relationships_family', label: 'Relacionamentos/Família', description: 'Família, amizades, relacionamentos amorosos.', keywords: ['família', 'casal', 'amigos', 'relacionamento'], examples: ["Um dia especial com a família.", "Como manter amizades à distância."] },
      { id: 'parenting', label: 'Parentalidade', description: 'Dicas e experiências sobre criar filhos.', keywords: ['maternidade', 'paternidade', 'filhos', 'crianças'], examples: ["A realidade da maternidade.", "Atividades para fazer com as crianças."] },
      { id: 'career_work', label: 'Carreira/Trabalho', description: 'Desenvolvimento profissional, vida corporativa.', keywords: ['carreira', 'trabalho', 'produtividade', 'home office'], examples: ["Como pedi um aumento e consegui.", "Dicas para ser mais produtivo no home office."] },
      { id: 'finance', label: 'Finanças', description: 'Investimentos, finanças pessoais, economia.', keywords: ['dinheiro', 'investimento', 'finanças', 'economia'], examples: ["Onde investir 1000 reais em 2025.", "Como organizar suas finanças pessoais."] },
      { id: 'personal_development', label: 'Desenvolvimento Pessoal', description: 'Autoconhecimento, produtividade, habilidades.', keywords: ['desenvolvimento', 'hábito', 'leitura', 'autoconhecimento'], examples: ["Livros que mudaram minha vida.", "Como criar um novo hábito."] },
      { id: 'education', label: 'Educação/Estudos', description: 'Conteúdo focado em aprendizado, vida acadêmica, dicas de estudo.', keywords: ['estudos', 'vestibular', 'faculdade', 'aprender idioma', 'concurso'], examples: ["Minha rotina de estudos para o vestibular.", "Como aprender inglês sozinho."] },
    ]
  },
  {
    id: 'hobbies_and_interests',
    label: 'Hobbies e Interesses',
    description: 'Abrange tópicos sobre lazer, cultura e entretenimento.',
    subcategories: [
      { id: 'travel_tourism', label: 'Viagem/Turismo', description: 'Destinos, dicas de viagem, roteiros.', keywords: ['viagem', 'turismo', 'férias', 'roteiro'], examples: ["Roteiro de 3 dias em Paris.", "Minha viagem para o nordeste."] },
      { id: 'home_decor_diy', label: 'Casa/Decor/DIY', description: 'Decoração, organização e "faça você mesmo".', keywords: ['decoração', 'casa', 'diy', 'reforma'], examples: ["Tour pela minha casa nova.", "DIY: como fazer uma prateleira."] },
      { id: 'technology_digital', label: 'Tecnologia/Digital', description: 'Gadgets, aplicativos, redes sociais.', keywords: ['tecnologia', 'app', 'gadget', 'celular', 'review'], examples: ["Review do novo iPhone.", "5 aplicativos que vão mudar sua vida."] },
      { id: 'art_culture', label: 'Arte/Cultura', description: 'Música, cinema, livros, teatro.', keywords: ['filme', 'série', 'livro', 'música', 'exposição'], examples: ["Minha crítica sobre o filme do ano.", "Top 5 séries para maratonar."] },
      { id: 'gaming', label: 'Games/Jogos', description: 'Conteúdo sobre videogames, gameplays, streaming, e-sports.', keywords: ['games', 'videogame', 'gameplay', 'twitch', 'esports', 'jogando'], examples: ["Jogando o lançamento do ano.", "Melhores momentos da minha live de ontem."] },
      { id: 'automotive', label: 'Automotivo', description: 'Carros, motos e o universo automotivo.', keywords: ['carro', 'moto', 'automóvel', 'review de carro'], examples: ["Testando o novo carro elétrico.", "Tudo sobre a nova moto X."] },
      { id: 'pets', label: 'Animais de Estimação', description: 'Conteúdo focado em pets, cuidados, adestramento, dia a dia com animais.', keywords: ['pet', 'cachorro', 'gato', 'animal de estimação', 'adestramento'], examples: ["Tudo que meu cachorro come em um dia.", "Dicas para viajar com seu pet."], conflictsWith: ['nature_animals'] },
      { id: 'nature_animals', label: 'Natureza/Animais Selvagens', description: 'Meio ambiente, sustentabilidade, vida selvagem.', keywords: ['natureza', 'sustentabilidade', 'ecologia', 'animais selvagens'], examples: ["A importância de reciclar.", "Documentário sobre a vida na savana."], conflictsWith: ['pets'] },
    ]
  },
  {
    id: 'science_and_knowledge',
    label: 'Ciência e Conhecimento',
    description: 'Abrange tópicos sobre divulgação científica, fatos históricos e curiosidades.',
    subcategories: [
        { id: 'science_communication', label: 'Divulgação Científica', description: 'Explicação de conceitos científicos de forma acessível.', keywords: ['ciência', 'física', 'biologia', 'química', 'astronomia'], examples: ["Como funcionam os buracos negros?", "A ciência por trás das vacinas."] },
        { id: 'history', label: 'História', description: 'Fatos, eventos e narrativas sobre o passado.', keywords: ['história', 'histórico', 'antiguidade', 'guerras mundiais'], examples: ["A história da Roma Antiga em 5 minutos.", "Como a Segunda Guerra Mundial começou."] },
        { id: 'curiosities', label: 'Curiosidades', description: 'Fatos interessantes, "você sabia?" e conhecimentos gerais.', keywords: ['curiosidades', 'você sabia', 'fatos', 'conhecimento geral'], examples: ["5 curiosidades aleatórias que vão explodir sua mente.", "Você sabia que os polvos têm três corações?"] }
    ]
  },
  {
    id: 'social_and_events',
    label: 'Social e Eventos',
    description: 'Abrange tópicos sobre eventos, celebrações e causas.',
    subcategories: [
      { id: 'events_celebrations', label: 'Eventos/Celebrações', description: 'Cobertura de festas, casamentos, feriados e eventos.', keywords: ['evento', 'festa', 'casamento', 'show', 'festival'], examples: ["Tudo sobre o show de ontem.", "Meus preparativos para o Natal."] },
      { id: 'social_causes_religion', label: 'Social/Causas/Religião', description: 'Ativismo, causas sociais, voluntariado e tópicos religiosos.', keywords: ['causa social', 'ativismo', 'voluntariado', 'religião'], examples: ["A importância de apoiar o comércio local.", "Um pouco sobre minha fé."] },
    ]
  },
  { id: 'general', label: 'Geral', description: 'Tópicos abrangentes que não se encaixam em uma categoria específica.' },
];

// --- Dimensão 4: Tom e Sentimento ---
export const toneCategories: Category[] = [
  { id: 'humorous', label: 'Humorístico', description: 'O conteúdo tem a intenção primária de ser engraçado, cômico ou satírico.', keywords: ['humor', 'comédia', 'piada', 'engraçado', 'paródia'], examples: ["Uma paródia da minha série favorita.", "Quando o estagiário responde o email do chefe."] },
  { id: 'inspirational', label: 'Inspirador/Motivacional', description: 'O conteúdo busca inspirar, motivar ou transmitir uma mensagem positiva.', keywords: ['inspiração', 'motivação', 'reflexão', 'sonhos', 'superação'], examples: ["Uma mensagem para você não desistir dos seus sonhos."] },
  { id: 'educational', label: 'Educacional/Informativo', description: 'O conteúdo tem o objetivo de ensinar, informar ou explicar algo de forma clara.', keywords: ['educacional', 'informativo', 'aprender', 'tutorial'], examples: ["Como funciona um buraco negro?", "Tutorial de como usar a nova ferramenta."] },
  { id: 'critical', label: 'Crítico/Analítico', description: 'O conteúdo faz uma análise crítica, opina ou questiona um tópico.', keywords: ['crítica', 'análise', 'opinião', 'polêmica', 'debate'], examples: ["Minha análise crítica sobre o último filme do diretor X."] },
  { id: 'promotional', label: 'Promocional/Comercial', description: 'O conteúdo tem um claro objetivo de vender ou promover um produto/serviço.', keywords: ['promoção', 'venda', 'desconto', 'compre agora', 'publi'], examples: ["Aproveite nosso desconto de 50% só hoje!"] },
  { id: 'neutral', label: 'Neutro/Descritivo', description: 'O conteúdo descreve fatos ou eventos sem uma carga emocional ou opinativa forte.', keywords: ['descritivo', 'neutro', 'relato', 'notícia'], examples: ["O evento acontecerá na próxima semana."] },
];

// --- Dimensão 5: Referências e Elementos ---
export const referenceCategories: Category[] = [
  {
    id: 'pop_culture',
    label: 'Cultura Pop',
    description: 'Referências a obras de ficção, celebridades ou memes da internet.',
    subcategories: [
      { id: 'pop_culture_movies_series', label: 'Filmes e Séries', description: 'Referências a filmes e séries.', keywords: ['filme', 'série', 'personagem', 'marvel', 'disney', 'netflix', 'harry potter'], examples: ["Imitando uma cena de 'O Poderoso Chefão'.", "Se os personagens de Friends vivessem no Brasil.", "Análise de 'Casa de Papel'."] },
      { id: 'pop_culture_books', label: 'Livros', description: 'Referências a livros e universos literários.', keywords: ['livro', 'autor', 'saga'], examples: ["Como seria se o Harry Potter usasse o Instagram.", "Uma análise do universo de 'O Senhor dos Anéis'."] },
      { id: 'pop_culture_games', label: 'Games', description: 'Referências a jogos de videogame.', keywords: ['game', 'videogame', 'playstation', 'xbox', 'nintendo'], examples: ["Imitando o jeito de andar do personagem de GTA.", "Gameplay de 'The Last of Us'."] },
      { id: 'pop_culture_music', label: 'Música', description: 'Referências a artistas, bandas ou músicas.', keywords: ['música', 'artista', 'banda', 'show'], examples: ["Analisando a letra da nova música da Anitta."] },
      { id: 'pop_culture_internet', label: 'Cultura da Internet', description: 'Referências a memes, virais e personalidades da internet.', keywords: ['meme', 'viral', 'influenciador', 'youtuber'], examples: ["Recriando o meme do 'bentô cake'.", "Uma paródia do Casimiro."] },
    ]
  },
  {
    id: 'people_and_groups',
    label: 'Pessoas e Grupos',
    description: 'Referências a grupos sociais, profissões ou estereótipos.',
    subcategories: [
      { id: 'regional_stereotypes', label: 'Estereótipos Regionais', description: 'Imitações ou referências a sotaques e costumes de uma região.', keywords: ['sotaque', 'estereótipo', 'imitação', 'carioca', 'paulista', 'baiano', 'mineiro'], examples: ["Como um carioca pede informação.", "As gírias que só um baiano entende.", "O jeito que o paulista fala 'meu'."] },
      { id: 'professions', label: 'Profissões', description: 'Referências a comportamentos típicos de uma profissão.', keywords: ['médico', 'advogado', 'programador', 'engenheiro', 'publicitário'], examples: ["O que todo publicitário fala.", "Tipos de cliente que todo designer atende."] },
    ]
  },
  {
    id: 'geography',
    label: 'Geografia',
    description: 'Referências a lugares específicos como cidades, estados ou países.',
    subcategories: [
      { id: 'city', label: 'Cidade', description: 'Conteúdo que se passa ou se refere a uma cidade específica.', keywords: ['são paulo', 'rio de janeiro', 'salvador', 'belo horizonte'], examples: ["Coisas que só quem mora em São Paulo entende.", "Um roteiro de 24h no Rio de Janeiro."] },
      { id: 'country', label: 'País', description: 'Conteúdo que se refere a um país, sua cultura ou costumes.', keywords: ['brasil', 'eua', 'japão', 'itália'], examples: ["Como é a vida de um brasileiro na Itália."] },
    ]
  },
];


// --- Funções Auxiliares (Atualizadas para todas as dimensões) ---

const flattenCategories = (categories: Category[]): Category[] => {
  return categories.flatMap(cat => {
    const { subcategories, ...parent } = cat;
    return [parent, ...(subcategories ? flattenCategories(subcategories) : [])];
  });
};

const flatFormatCategories = flattenCategories(formatCategories);
const flatProposalCategories = flattenCategories(proposalCategories);
const flatContextCategories = flattenCategories(contextCategories);
const flatToneCategories = flattenCategories(toneCategories);
const flatReferenceCategories = flattenCategories(referenceCategories);

export const getCategoryById = (id: string, type: 'format' | 'proposal' | 'context' | 'tone' | 'reference'): Category | undefined => {
  let list: Category[];
  switch (type) {
    case 'format': list = flatFormatCategories; break;
    case 'proposal': list = flatProposalCategories; break;
    case 'context': list = flatContextCategories; break;
    case 'tone': list = flatToneCategories; break;
    case 'reference': list = flatReferenceCategories; break;
    default: return undefined;
  }
  return list.find(cat => cat.id === id);
};

export function idsToLabels(ids: string[] | undefined, type: 'format'|'proposal'|'context'|'tone'|'reference'): string[] {
  return (ids ?? []).map(id => getCategoryById(id, type)?.label ?? id);
}

export function idsStringToLabelsString(idsString: string, type: 'format'|'proposal'|'context'|'tone'|'reference'): string {
  if (!idsString) return idsString;
  const ids = idsString.split(',').map(id => id.trim()).filter(Boolean);
  return idsToLabels(ids, type).join(', ');
}
