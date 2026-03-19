/*
================================================================================
ARQUIVO 4/4: classification.ts
FUNÇÃO: Define as categorias e os filtros usados em toda a aplicação.
STATUS: ATUALIZADO. Foi adicionada a nova função auxiliar 'getCategoryWithSubcategoryIds'
no final do arquivo. Essa função é essencial para a correção no back-end.
================================================================================
*/

export interface Category {
  id: string;
  label: string;
  description: string;
  keywords?: string[];
  subcategories?: Category[];
  examples?: string[];
  conflictsWith?: string[];
}

export type CategoryType = 'format' | 'proposal' | 'context' | 'tone' | 'reference';
export const CATEGORY_TYPES: CategoryType[] = ['format', 'proposal', 'context', 'tone', 'reference'];

// --- Dimensão 1: Format ---
export const formatCategories: Category[] = [
  { id: 'reel', label: 'Reel', description: 'Vídeo curto e vertical, geralmente com música ou áudio em alta.', keywords: ['reel', 'vídeo curto', 'dança', 'trend'], examples: ["Meu novo reel com a trend do momento!", "Vídeo rápido mostrando 3 dicas de..."] },
  { id: 'photo', label: 'Foto', description: 'Uma única imagem estática.', keywords: ['foto', 'imagem', 'post', 'fotografia'], examples: ["Foto do pôr do sol de hoje.", "Um clique do nosso novo produto."] },
  { id: 'carousel', label: 'Carrossel', description: 'Post com múltiplas imagens ou vídeos que o usuário pode deslizar.', keywords: ['carrossel', 'sequência', 'álbum', 'deslize para o lado'], examples: ["Deslize para o lado para ver o antes e depois!", "Nosso novo catálogo em formato carrossel."] },
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


// --- Funções Auxiliares (Existentes) ---

type FlatCategory = Category & {
  parentIds: string[];
  parentLabels: string[];
};

const flattenCategories = (
  categories: Category[],
  parentIds: string[] = [],
  parentLabels: string[] = []
): FlatCategory[] => {
  return categories.flatMap((cat) => {
    const { subcategories, ...node } = cat;
    const flatNode: FlatCategory = {
      ...node,
      parentIds,
      parentLabels,
    };
    return [
      flatNode,
      ...(subcategories ? flattenCategories(subcategories, [...parentIds, cat.id], [...parentLabels, cat.label]) : []),
    ];
  });
};

const flatFormatCategories = flattenCategories(formatCategories);
const flatProposalCategories = flattenCategories(proposalCategories);
const flatContextCategories = flattenCategories(contextCategories);
const flatToneCategories = flattenCategories(toneCategories);
const flatReferenceCategories = flattenCategories(referenceCategories);

const normalizeCategoryLookupKey = (value?: string | null) => {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/[_./\\|:>#~\[\]-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
};

const buildLookupVariants = (value?: string | null): string[] => {
  if (!value) return [];
  const base = String(value).trim();
  if (!base) return [];

  const variants = new Set<string>();
  const push = (candidate?: string | null) => {
    const normalized = normalizeCategoryLookupKey(candidate);
    if (normalized) variants.add(normalized);
  };

  push(base);

  const withoutParentheses = base.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (withoutParentheses && withoutParentheses !== base) push(withoutParentheses);

  const parentheticalMatches = base.matchAll(/\(([^)]*)\)/g);
  for (const match of parentheticalMatches) {
    push(match[1] || "");
  }

  return Array.from(variants);
};

const normalizeContextId = (value?: string | null) => normalizeCategoryLookupKey(value).replace(/\s+/g, "_");

const CATEGORY_DEPRECATED_ALIAS_TARGETS: Partial<Record<CategoryType, Record<string, string>>> = {
  proposal: {
    life_style: 'lifestyle',
    msg_motivational: 'message_motivational',
    trends: 'trend',
  },
  context: {
    personal_and_professional_relationships_family: 'relationships_family',
    'Relacionamentos e Família': 'relationships_family',
    'personal_and_professional.relationships_family': 'relationships_family',
    'personal_and_professional/relationships_family': 'relationships_family',
    event_celebration: 'events_celebrations',
    eventos_celebrations: 'events_celebrations',
    'hobbies_and_interests.autos': 'automotive',
    'hobbies_and_interests.sports': 'fitness_sports',
    sports: 'fitness_sports',
    'hobbies_and_interests.trave_tourism': 'travel_tourism',
    professional_and_personal: 'personal_and_professional',
    'personal_and_professional.parents': 'parenting',
    personal_and_professional_development: 'personal_development',
    lifestyle_and_wellbeingbeauty_personal_care: 'beauty_personal_care',
    lifestyle_and_wellbeingfashion_style: 'fashion_style',
  },
  reference: {
    geographycity: 'city',
  },
};

type CategoryAliasEntry = {
  category: FlatCategory;
  normalized: string;
};

const contextLabelMap = new Map<string, string>();
flatContextCategories.forEach((cat) => {
  const key = normalizeContextId(cat.id);
  if (key) contextLabelMap.set(key, cat.label);
});
const contextLabelKeys = Array.from(contextLabelMap.keys());

const humanizeContextLabel = (raw?: string | null) => {
  const base = raw ?? "";
  const cleaned = base.replace(/[_./]+/g, " ").trim();
  if (!cleaned) return "Contexto";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

export const resolveContextLabel = (raw?: string | null): { value: string; label: string } | null => {
  const resolved = raw ? getCategoryByValue(raw, 'context') : undefined;
  if (resolved) return { value: resolved.id, label: resolved.label };

  const normalized = normalizeContextId(raw);
  if (!normalized) return null;

  const direct = contextLabelMap.get(normalized);
  if (direct) return { value: normalized, label: direct };

  const suffix = contextLabelKeys.find(
    (id) => normalized === id || normalized.endsWith(`_${id}`) || normalized.endsWith(`.${id}`),
  );
  if (suffix) {
    const label = contextLabelMap.get(suffix);
    if (label) return { value: suffix, label };
  }

  return { value: normalized, label: humanizeContextLabel(raw) };
};

const getFlatCategoriesByType = (
  type: CategoryType
): FlatCategory[] => {
  switch (type) {
    case 'format':
      return flatFormatCategories;
    case 'proposal':
      return flatProposalCategories;
    case 'context':
      return flatContextCategories;
    case 'tone':
      return flatToneCategories;
    case 'reference':
      return flatReferenceCategories;
    default:
      return [];
  }
};

const buildCategoryAliasEntries = (type: CategoryType): CategoryAliasEntry[] => {
  const categories = getFlatCategoriesByType(type);
  const entries: CategoryAliasEntry[] = [];

  for (const category of categories) {
    const aliasCandidates = new Set<string>([category.id, category.label]);

    if (category.parentIds.length > 0) {
      const idPath = [...category.parentIds, category.id];
      const labelPath = [...category.parentLabels, category.label];
      for (const separator of ['.', '/', '_', '|'] as const) {
        aliasCandidates.add(idPath.join(separator));
        aliasCandidates.add(labelPath.join(separator));
        aliasCandidates.add(`${category.parentIds[category.parentIds.length - 1]}${separator}${category.id}`);
        aliasCandidates.add(`${category.parentLabels[category.parentLabels.length - 1]}${separator}${category.label}`);
      }
    }

    for (const alias of aliasCandidates) {
      for (const normalized of buildLookupVariants(alias)) {
        entries.push({ category, normalized });
      }
    }
  }

  return entries.sort((left, right) => right.normalized.length - left.normalized.length);
};

const categoryAliasEntriesByType: Record<CategoryType, CategoryAliasEntry[]> = {
  format: buildCategoryAliasEntries('format'),
  proposal: buildCategoryAliasEntries('proposal'),
  context: buildCategoryAliasEntries('context'),
  tone: buildCategoryAliasEntries('tone'),
  reference: buildCategoryAliasEntries('reference'),
};

const deprecatedAliasTargetByType: Partial<Record<CategoryType, Map<string, string>>> = Object.fromEntries(
  Object.entries(CATEGORY_DEPRECATED_ALIAS_TARGETS).map(([type, aliases]) => [
    type,
    new Map(
      Object.entries(aliases || {}).flatMap(([alias, target]) =>
        buildLookupVariants(alias).map((normalized) => [normalized, target] as const)
      )
    ),
  ])
) as Partial<Record<CategoryType, Map<string, string>>>;

export const getCategoryById = (
  id: string,
  type: CategoryType
): Category | undefined => {
  return getFlatCategoriesByType(type).find((cat) => cat.id === id);
};

export const getCategoryByValue = (
  value: string,
  type: CategoryType
): Category | undefined => {
  const candidates = buildLookupVariants(value);
  if (candidates.length === 0) return undefined;

  const deprecatedAliases = deprecatedAliasTargetByType[type];
  for (const candidate of candidates) {
    const deprecatedTarget = deprecatedAliases?.get(candidate);
    if (deprecatedTarget) {
      const category = getCategoryById(deprecatedTarget, type);
      if (category) return category;
    }
  }

  const entries = categoryAliasEntriesByType[type];
  for (const candidate of candidates) {
    const exact = entries.find((entry) => entry.normalized === candidate);
    if (exact) return exact.category;
  }

  for (const candidate of candidates) {
    const suffix = entries.find((entry) => candidate.endsWith(` ${entry.normalized}`));
    if (suffix) return suffix.category;
  }

  return undefined;
};

export const isValidCategoryId = (
  id: string,
  type: CategoryType
): boolean => {
  return Boolean(getCategoryByValue(id, type));
};

export function toCanonicalCategoryId(value: string | null | undefined, type: CategoryType): string | null {
  if (!value) return null;
  return getCategoryByValue(value, type)?.id ?? null;
}

export function canonicalizeCategoryValues(
  values: unknown,
  type: CategoryType,
  options?: { includeUnknown?: boolean }
): string[] {
  const rawValues = Array.isArray(values) ? values : typeof values === 'string' ? [values] : [];
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const rawValue of rawValues) {
    if (typeof rawValue !== 'string') continue;
    const trimmed = rawValue.trim();
    if (!trimmed) continue;

    const canonicalId = toCanonicalCategoryId(trimmed, type);
    const nextValue = canonicalId || (options?.includeUnknown ? trimmed : null);
    if (!nextValue || seen.has(nextValue)) continue;

    seen.add(nextValue);
    normalized.push(nextValue);
  }

  return collapseHierarchicalCategoryValues(normalized, type);
}

export function idsToLabels(ids: string[] | undefined, type: CategoryType): string[] {
  return (ids ?? []).map((id) => getCategoryByValue(id, type)?.label ?? id);
}

export function commaSeparatedIdsToLabels(ids: string | string[] | undefined, type: CategoryType): string {
  if (!ids) return '';
  const idList = Array.isArray(ids) ? ids : ids.split(',');
  return idList
    .map((id) => id.trim())
    .filter((id) => id.length > 0)
    .map((id) => getCategoryByValue(id, type)?.label ?? id)
    .join(', ');
}


// ================== INÍCIO DA ADIÇÃO ==================
// Nova função auxiliar adicionada para suportar a filtragem hierárquica.

const getAllCategoryIds = (category: Category): string[] => {
  let ids = [category.id];
  if (category.subcategories && category.subcategories.length > 0) {
    ids = ids.concat(
      category.subcategories.flatMap(sub => getAllCategoryIds(sub))
    );
  }
  return ids;
};

export const getCategoryWithSubcategoryIds = (
  id: string,
  type: CategoryType
): string[] => {
  const canonicalId = toCanonicalCategoryId(id, type) ?? id;
  // Define a lista de categorias de nível raiz com base no tipo
  const categories =
    type === 'context' ? contextCategories :
      type === 'proposal' ? proposalCategories :
        type === 'format' ? formatCategories :
          type === 'tone' ? toneCategories :
            referenceCategories;

  // Função recursiva para encontrar a categoria pelo ID em uma árvore
  const findCategory = (cats: Category[], catId: string): Category | undefined => {
    for (const cat of cats) {
      if (cat.id === catId) return cat;
      if (cat.subcategories) {
        const found = findCategory(cat.subcategories, catId);
        if (found) return found;
      }
    }
    return undefined; // Retorna undefined se não encontrar
  };

  const rootCategory = findCategory(categories, canonicalId);
  if (!rootCategory) {
    return canonicalId ? [canonicalId] : []; // Se não encontrar a categoria (fallback), retorna o valor canônico em um array
  }

  // Se encontrou a categoria, retorna todos os seus IDs descendentes
  return getAllCategoryIds(rootCategory);
};

export function collapseHierarchicalCategoryValues(
  values: string[],
  type: CategoryType
): string[] {
  if (values.length <= 1) return values;

  const normalizedValues = values
    .map((value) => value.trim())
    .filter(Boolean);

  if (normalizedValues.length <= 1) return normalizedValues;

  const selectedSet = new Set(normalizedValues);

  return normalizedValues.filter((value) => {
    const descendants = getCategoryWithSubcategoryIds(value, type);
    return !descendants.some((descendant) => descendant !== value && selectedSet.has(descendant));
  });
}

export function getStoredCategoryFilterValues(
  value: string,
  type: CategoryType
): string[] {
  const ids = getCategoryWithSubcategoryIds(value, type);
  const labels = idsToLabels(ids, type);
  return Array.from(new Set([...ids, ...labels]));
}

export function findCategoryMatchesAcrossTypes(value: string): Array<{
  type: CategoryType;
  id: string;
  label: string;
}> {
  if (!value?.trim()) return [];

  return CATEGORY_TYPES.flatMap((type) => {
    const category = getCategoryByValue(value, type);
    return category ? [{ type, id: category.id, label: category.label }] : [];
  });
}
// =================== FIM DA ADIÇÃO ===================
