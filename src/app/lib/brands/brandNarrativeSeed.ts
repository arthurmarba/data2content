import type {
  BrandNarrativeSource,
  BrandNarrativeStatus,
  BrandNarrativeValidationStatus,
} from '@/app/models/BrandNarrativeProfile';

export interface BrandNarrativeSeedItem {
  brandName: string;
  category: string[];
  subcategories: string[];
  territories: string[];
  contexts: string[];
  narrativeForms: string[];
  contentIntents: string[];
  contentSignals: string[];
  tones: string[];
  proofStyles: string[];
  commercialModes: string[];
  products: string[];
  campaignKeywords: string[];
  avoidContexts: string[];
  insertionIdeas: string[];
  status: BrandNarrativeStatus;
  source: BrandNarrativeSource;
  validationStatus: BrandNarrativeValidationStatus;
  confidenceScore: number;
  notes?: string;
}

type NarrativeTemplate = Omit<
  BrandNarrativeSeedItem,
  'brandName' | 'products' | 'campaignKeywords' | 'confidenceScore' | 'notes'
>;

type BrandSeedDefinition = Pick<BrandNarrativeSeedItem, 'brandName' | 'products' | 'campaignKeywords'> &
  Partial<Pick<BrandNarrativeSeedItem, 'confidenceScore' | 'notes'>>;

const COMMON_STATUS = {
  status: 'observed_external',
  source: 'manual_seed',
  validationStatus: 'validated',
} satisfies Pick<BrandNarrativeSeedItem, 'status' | 'source' | 'validationStatus'>;

function buildSeedItems(template: NarrativeTemplate, brands: BrandSeedDefinition[]): BrandNarrativeSeedItem[] {
  return brands.map((brand) => ({
    ...template,
    brandName: brand.brandName,
    products: [...brand.products],
    campaignKeywords: [...brand.campaignKeywords],
    confidenceScore: brand.confidenceScore ?? 0.82,
    ...(brand.notes ? { notes: brand.notes } : {}),
    category: [...template.category],
    subcategories: [...template.subcategories],
    territories: [...template.territories],
    contexts: [...template.contexts],
    narrativeForms: [...template.narrativeForms],
    contentIntents: [...template.contentIntents],
    contentSignals: [...template.contentSignals],
    tones: [...template.tones],
    proofStyles: [...template.proofStyles],
    commercialModes: [...template.commercialModes],
    avoidContexts: [...template.avoidContexts],
    insertionIdeas: [...template.insertionIdeas],
  }));
}

const sportTemplate: NarrativeTemplate = {
  ...COMMON_STATUS,
  category: ['esporte', 'corrida', 'lifestyle'],
  subcategories: ['corrida de rua', 'performance', 'treino', 'lifestyle esportivo'],
  territories: ['corrida', 'movimento', 'performance', 'superação', 'preparação', 'conquista', 'comunidade'],
  contexts: ['corrida de rua', 'treino', 'prova esportiva', 'rotina saudável', 'lifestyle urbano'],
  narrativeForms: ['jornada', 'desafio', 'transformação', 'bastidores', 'conquista'],
  contentIntents: ['inspirar', 'conectar', 'demonstrar experiência', 'registrar jornada'],
  contentSignals: ['produto em uso real', 'rotina', 'preparação', 'antes e depois', 'experiência vivida'],
  tones: ['inspirador', 'aspiracional', 'humano', 'ativo'],
  proofStyles: ['performance orgânica', 'uso cotidiano', 'experiência real'],
  commercialModes: ['produto em uso', 'seeding', 'evento', 'desafio', 'experiência'],
  avoidContexts: ['promessa de performance garantida', 'alegações médicas sem base'],
  insertionIdeas: ['recebimento de kit', 'preparação para prova', 'look de treino', 'treino pré-evento', 'pós-prova emocional'],
};

const beautyTemplate: NarrativeTemplate = {
  ...COMMON_STATUS,
  category: ['beleza', 'skincare', 'cuidado pessoal'],
  subcategories: ['rotina de beleza', 'cabelo', 'autocuidado', 'maquiagem', 'dermocosmético acessível'],
  territories: ['autocuidado', 'autoestima', 'rotina', 'transformação', 'bem-estar', 'expressão pessoal'],
  contexts: ['rotina matinal', 'rotina noturna', 'banho', 'make do dia', 'cuidados com cabelo', 'pré-evento'],
  narrativeForms: ['rotina', 'tutorial', 'antes e depois', 'review', 'descoberta'],
  contentIntents: ['ensinar', 'inspirar', 'demonstrar uso', 'gerar identificação', 'reduzir dúvida'],
  contentSignals: ['textura do produto', 'aplicação real', 'resultado visível', 'uso recorrente', 'preferência pessoal'],
  tones: ['próximo', 'confiante', 'leve', 'cuidadoso'],
  proofStyles: ['uso cotidiano', 'teste real', 'comparação prática', 'experiência sensorial'],
  commercialModes: ['produto em uso', 'review', 'seeding', 'tutorial', 'combo de rotina'],
  avoidContexts: ['promessa de cura', 'alegações dermatológicas sem fonte', 'comparação depreciativa com concorrentes'],
  insertionIdeas: ['rotina de cuidado', 'teste por alguns dias', 'favoritos do mês', 'arrume-se comigo', 'necessaire comentada'],
};

const fashionTemplate: NarrativeTemplate = {
  ...COMMON_STATUS,
  category: ['moda', 'lifestyle', 'varejo'],
  subcategories: ['look do dia', 'moda acessível', 'calçados', 'estilo pessoal', 'guarda-roupa funcional'],
  territories: ['estilo', 'identidade', 'praticidade', 'autoexpressão', 'tendência', 'versatilidade'],
  contexts: ['look de trabalho', 'fim de semana', 'viagem curta', 'evento casual', 'rotina urbana'],
  narrativeForms: ['curadoria', 'transformação', 'tutorial', 'lista', 'bastidores'],
  contentIntents: ['inspirar', 'demonstrar combinação', 'facilitar escolha', 'traduzir tendência'],
  contentSignals: ['look completo', 'provador', 'peça em movimento', 'combinações reais', 'detalhe de acabamento'],
  tones: ['aspiracional acessível', 'leve', 'confiante', 'urbano'],
  proofStyles: ['uso cotidiano', 'curadoria pessoal', 'comparação de looks', 'versatilidade demonstrada'],
  commercialModes: ['provador', 'produto em uso', 'coleção', 'seeding', 'cupom'],
  avoidContexts: ['pressão estética', 'consumo irresponsável', 'promessa de status'],
  insertionIdeas: ['montagem de look', 'peças para repetir', 'provador comentado', 'mala cápsula', 'look de transição'],
};

const familyTemplate: NarrativeTemplate = {
  ...COMMON_STATUS,
  category: ['família', 'casa', 'maternidade'],
  subcategories: ['bebê', 'rotina familiar', 'cuidados domésticos', 'alimentação infantil', 'eletrodomésticos'],
  territories: ['cuidado', 'segurança', 'praticidade', 'afeto', 'organização', 'confiança'],
  contexts: ['rotina com bebê', 'casa em funcionamento', 'hora da refeição', 'banho', 'lavanderia', 'cozinha'],
  narrativeForms: ['rotina', 'dica prática', 'antes e depois', 'review', 'história real'],
  contentIntents: ['ajudar', 'reduzir atrito', 'demonstrar experiência', 'gerar confiança'],
  contentSignals: ['uso em casa', 'rotina familiar', 'problema resolvido', 'passo a passo', 'experiência de cuidado'],
  tones: ['acolhedor', 'prático', 'confiável', 'humano'],
  proofStyles: ['uso cotidiano', 'demonstração prática', 'relato pessoal', 'comparação antes e depois'],
  commercialModes: ['produto em uso', 'review', 'combo de rotina', 'seeding', 'demonstração'],
  avoidContexts: ['culpa parental', 'alegações médicas sem base', 'promessa de desenvolvimento infantil'],
  insertionIdeas: ['rotina real da manhã', 'organização da casa', 'kit de cuidados', 'solução para um perrengue', 'antes e depois doméstico'],
};

const foodWellnessTemplate: NarrativeTemplate = {
  ...COMMON_STATUS,
  category: ['alimentação', 'saúde', 'bem-estar'],
  subcategories: ['comida prática', 'snacks saudáveis', 'suplementação', 'mercado saudável', 'delivery'],
  territories: ['energia', 'equilíbrio', 'praticidade', 'rotina saudável', 'sabor', 'conveniência'],
  contexts: ['pré-treino', 'lanche da tarde', 'marmita', 'compras da semana', 'home office', 'pós-treino'],
  narrativeForms: ['rotina', 'receita', 'review', 'desafio', 'lista'],
  contentIntents: ['ensinar', 'facilitar rotina', 'inspirar escolha', 'demonstrar uso'],
  contentSignals: ['preparo real', 'consumo na rotina', 'ingredientes', 'comparação prática', 'resultado de conveniência'],
  tones: ['leve', 'prático', 'informativo', 'realista'],
  proofStyles: ['uso cotidiano', 'experiência real', 'demonstração de preparo', 'comparação de rotina'],
  commercialModes: ['produto em uso', 'receita', 'cupom', 'seeding', 'pedido na rotina'],
  avoidContexts: ['promessa de emagrecimento', 'alegações médicas sem base', 'substituição de orientação profissional'],
  insertionIdeas: ['marmita da semana', 'pedido em dia corrido', 'lanche pré-treino', 'receita simples', 'compras saudáveis comentadas'],
};

const travelTemplate: NarrativeTemplate = {
  ...COMMON_STATUS,
  category: ['viagem', 'mobilidade', 'experiência'],
  subcategories: ['transporte', 'hospedagem', 'viagem nacional', 'mobilidade urbana', 'serviço de conveniência'],
  territories: ['descoberta', 'liberdade', 'planejamento', 'conveniência', 'experiência', 'tempo bem usado'],
  contexts: ['fim de semana fora', 'viagem a trabalho', 'aeroporto', 'road trip', 'deslocamento urbano', 'check-in'],
  narrativeForms: ['diário de viagem', 'guia prático', 'bastidores', 'review', 'roteiro'],
  contentIntents: ['inspirar', 'orientar decisão', 'mostrar experiência', 'reduzir atrito'],
  contentSignals: ['serviço em uso', 'trajeto real', 'checklist', 'antes e depois da viagem', 'experiência vivida'],
  tones: ['explorador', 'prático', 'confiável', 'leve'],
  proofStyles: ['experiência real', 'demonstração de serviço', 'registro de jornada', 'comparação prática'],
  commercialModes: ['serviço em uso', 'cupom', 'experiência', 'review', 'roteiro patrocinável'],
  avoidContexts: ['promessa de disponibilidade garantida', 'incentivo a direção insegura', 'informação regulatória sem checagem'],
  insertionIdeas: ['roteiro de fim de semana', 'checklist de viagem', 'diário de aeroporto', 'trajeto sem atrito', 'review de hospedagem'],
};

const techFinanceTemplate: NarrativeTemplate = {
  ...COMMON_STATUS,
  category: ['tecnologia', 'finanças', 'serviços'],
  subcategories: ['smartphone', 'pagamentos', 'banco digital', 'investimentos', 'telecom', 'produtividade'],
  territories: ['autonomia', 'organização', 'conectividade', 'segurança', 'produtividade', 'vida prática'],
  contexts: ['rotina de trabalho', 'organização financeira', 'criação de conteúdo', 'pagamento do dia a dia', 'viagem', 'home office'],
  narrativeForms: ['tutorial', 'review', 'comparativo', 'rotina', 'guia prático'],
  contentIntents: ['ensinar', 'simplificar decisão', 'demonstrar uso', 'gerar confiança'],
  contentSignals: ['tela em uso', 'fluxo real', 'antes e depois operacional', 'recurso demonstrado', 'caso prático'],
  tones: ['claro', 'confiável', 'moderno', 'prático'],
  proofStyles: ['demonstração prática', 'uso cotidiano', 'comparação de recursos', 'experiência real'],
  commercialModes: ['produto em uso', 'tutorial', 'review', 'benefício demonstrado', 'cupom'],
  avoidContexts: ['promessa de rentabilidade', 'aconselhamento financeiro individual', 'garantia de cobertura ou sinal'],
  insertionIdeas: ['setup de trabalho', 'organização do mês', 'tutorial de recurso', 'review honesto', 'dia produtivo com tecnologia'],
};

export const BRAND_NARRATIVE_SEED: BrandNarrativeSeedItem[] = [
  ...buildSeedItems(sportTemplate, [
    { brandName: 'Adidas', products: ['tênis de corrida', 'camiseta esportiva', 'shorts', 'jaqueta', 'acessórios'], campaignKeywords: ['meia maratona', 'corrida', 'treino', 'prova', 'superação'], confidenceScore: 0.85 },
    { brandName: 'Nike', products: ['tênis de performance', 'roupas de treino', 'top esportivo', 'moletom', 'boné'], campaignKeywords: ['movimento', 'treino', 'corrida', 'atleta do cotidiano', 'lifestyle esportivo'], confidenceScore: 0.86 },
    { brandName: 'Asics', products: ['tênis de corrida', 'meias esportivas', 'viseira', 'camiseta técnica'], campaignKeywords: ['corrida de rua', 'pace', 'longão', 'conforto', 'preparação'], confidenceScore: 0.84 },
    { brandName: 'Olympikus', products: ['tênis nacional', 'roupas de treino', 'chinelo', 'acessórios esportivos'], campaignKeywords: ['corrida acessível', 'brasilidade', 'treino real', 'movimento diário'], confidenceScore: 0.83 },
    { brandName: 'Garmin', products: ['relógio esportivo', 'monitor cardíaco', 'ciclocomputador', 'smartwatch'], campaignKeywords: ['dados de treino', 'performance', 'evolução', 'prova', 'consistência'], confidenceScore: 0.86 },
    { brandName: 'Strava', products: ['app de treino', 'assinatura premium', 'clubes', 'desafios'], campaignKeywords: ['comunidade', 'registro de treino', 'desafio mensal', 'mapa de corrida'], confidenceScore: 0.82 },
    { brandName: 'Decathlon', products: ['equipamentos esportivos', 'roupas de treino', 'mochila', 'garrafa', 'acessórios'], campaignKeywords: ['esporte acessível', 'primeiro treino', 'kit iniciante', 'vida ativa'], confidenceScore: 0.83 },
    { brandName: 'Centauro', products: ['tênis', 'camiseta esportiva', 'bola', 'mochila', 'equipamentos'], campaignKeywords: ['compra esportiva', 'volta aos treinos', 'prova de rua', 'kit performance'], confidenceScore: 0.81 },
    { brandName: 'Gatorade', products: ['isotônico', 'garrafa esportiva', 'bebida para treino'], campaignKeywords: ['hidratação', 'treino intenso', 'prova', 'recuperação', 'calor'], confidenceScore: 0.82 },
    { brandName: 'Track&Field', products: ['leggings', 'tops', 'camisetas', 'shorts', 'eventos de corrida'], campaignKeywords: ['corrida premium', 'bem-estar', 'treino em comunidade', 'lifestyle ativo'], confidenceScore: 0.84 },
  ]),
  ...buildSeedItems(beautyTemplate, [
    { brandName: 'Natura', products: ['hidratante', 'perfume', 'sabonete', 'óleo corporal', 'linha Ekos'], campaignKeywords: ['beleza brasileira', 'autocuidado', 'presente', 'sustentabilidade', 'rotina sensorial'], confidenceScore: 0.87 },
    { brandName: 'O Boticário', products: ['perfume', 'creme corporal', 'maquiagem', 'sabonete', 'kit presente'], campaignKeywords: ['presenteável', 'perfumaria', 'rotina de beleza', 'datas comemorativas'], confidenceScore: 0.86 },
    { brandName: 'Eudora', products: ['perfume', 'maquiagem', 'linha capilar', 'hidratante'], campaignKeywords: ['beleza confiante', 'arrume-se comigo', 'cabelo tratado', 'make fácil'], confidenceScore: 0.83 },
    { brandName: 'Dove', products: ['sabonete', 'desodorante', 'shampoo', 'condicionador', 'hidratante'], campaignKeywords: ['cuidado real', 'autoestima', 'banho', 'pele macia', 'beleza sem filtro'], confidenceScore: 0.84 },
    { brandName: 'Nivea', products: ['protetor labial', 'hidratante corporal', 'creme facial', 'protetor solar'], campaignKeywords: ['hidratação', 'cuidado diário', 'pele no inverno', 'rotina simples'], confidenceScore: 0.83 },
    { brandName: "L'Oréal Paris", products: ['skincare', 'coloração', 'máscara capilar', 'maquiagem', 'protetor térmico'], campaignKeywords: ['beleza de expert', 'cabelo em casa', 'skincare acessível', 'transformação'], confidenceScore: 0.85 },
    { brandName: 'Garnier', products: ['máscara facial', 'água micelar', 'shampoo', 'condicionador', 'vitamina C'], campaignKeywords: ['rotina prática', 'limpeza de pele', 'cabelo leve', 'skincare rápido'], confidenceScore: 0.82 },
    { brandName: 'Sallve', products: ['limpador facial', 'hidratante', 'sérum', 'protetor solar', 'tônico'], campaignKeywords: ['skincare brasileiro', 'pele real', 'rotina descomplicada', 'teste de textura'], confidenceScore: 0.84 },
    { brandName: 'Quem Disse, Berenice?', products: ['batom', 'base', 'máscara de cílios', 'blush', 'paleta'], campaignKeywords: ['make colorida', 'autoexpressão', 'arrume-se comigo', 'beleza divertida'], confidenceScore: 0.82 },
    { brandName: 'Pantene', products: ['shampoo', 'condicionador', 'ampola', 'máscara capilar'], campaignKeywords: ['cabelo forte', 'cronograma capilar', 'brilho', 'banho premium'], confidenceScore: 0.82 },
    { brandName: 'Seda', products: ['shampoo', 'condicionador', 'creme de pentear', 'máscara capilar'], campaignKeywords: ['cabelo do dia', 'rotina acessível', 'finalização', 'cachos e lisos'], confidenceScore: 0.81 },
    { brandName: 'Salon Line', products: ['creme de pentear', 'gelatina', 'máscara capilar', 'ativador de cachos'], campaignKeywords: ['cachos', 'finalização', 'day after', 'transição capilar', 'texturas reais'], confidenceScore: 0.84 },
  ]),
  ...buildSeedItems(fashionTemplate, [
    { brandName: 'Renner', products: ['vestidos', 'calças', 'camisas', 'bolsas', 'moda praia'], campaignKeywords: ['moda acessível', 'look de trabalho', 'tendência', 'provador'], confidenceScore: 0.84 },
    { brandName: 'C&A', products: ['jeans', 'camisetas', 'vestidos', 'moda infantil', 'acessórios'], campaignKeywords: ['look acessível', 'guarda-roupa real', 'provador', 'moda democrática'], confidenceScore: 0.83 },
    { brandName: 'Riachuelo', products: ['roupas casuais', 'moda casa', 'lingerie', 'calçados', 'acessórios'], campaignKeywords: ['look completo', 'moda para rotina', 'casa e estilo', 'coleção'], confidenceScore: 0.82 },
    { brandName: 'Farm', products: ['vestidos estampados', 'moda praia', 'bolsas', 'macacão', 'camisas'], campaignKeywords: ['brasilidade', 'estampa', 'verão', 'festival', 'viagem'], confidenceScore: 0.85 },
    { brandName: 'Arezzo', products: ['sandálias', 'bolsas', 'scarpin', 'botas', 'rasteiras'], campaignKeywords: ['calçado feminino', 'look elegante', 'evento', 'bolsa desejo'], confidenceScore: 0.84 },
    { brandName: 'Schutz', products: ['sapatos', 'bolsas', 'sandálias', 'botas', 'sneakers'], campaignKeywords: ['moda premium', 'look de noite', 'calçado statement', 'produção fashion'], confidenceScore: 0.84 },
    { brandName: 'Havaianas', products: ['chinelo', 'sandália', 'slide', 'bolsa de praia', 'acessórios'], campaignKeywords: ['verão', 'praia', 'brasilidade', 'conforto', 'férias'], confidenceScore: 0.86 },
    { brandName: 'Reserva', products: ['camisetas', 'camisas', 'calças', 'bermudas', 'tênis casual'], campaignKeywords: ['moda masculina', 'casual urbano', 'fim de semana', 'brasilidade'], confidenceScore: 0.82 },
    { brandName: 'Youcom', products: ['jeans', 'camisetas', 'jaquetas', 'vestidos', 'acessórios'], campaignKeywords: ['moda jovem', 'street casual', 'look de festival', 'provador'], confidenceScore: 0.81 },
    { brandName: 'Zinzane', products: ['vestidos', 'blusas', 'saias', 'macacões', 'moda praia'], campaignKeywords: ['look feminino', 'verão', 'estampa', 'moda leve', 'provador'], confidenceScore: 0.81 },
  ]),
  ...buildSeedItems(familyTemplate, [
    { brandName: 'Pampers', products: ['fraldas', 'lenços umedecidos', 'pants', 'kit bebê'], campaignKeywords: ['rotina do bebê', 'troca de fralda', 'noite tranquila', 'maternidade real'], confidenceScore: 0.84 },
    { brandName: 'Huggies', products: ['fraldas', 'lenços umedecidos', 'roupinha de banho', 'pants'], campaignKeywords: ['cuidado do bebê', 'troca fora de casa', 'rotina prática', 'maternidade'], confidenceScore: 0.83 },
    { brandName: 'Granado Bebê', products: ['sabonete', 'colônia', 'talco líquido', 'hidratante', 'kit presente'], campaignKeywords: ['banho do bebê', 'cheirinho de bebê', 'presente maternidade', 'cuidado delicado'], confidenceScore: 0.84 },
    { brandName: "Johnson's Baby", products: ['shampoo infantil', 'sabonete', 'óleo', 'hidratante', 'lenços'], campaignKeywords: ['banho', 'cuidado infantil', 'rotina de sono', 'pele delicada'], confidenceScore: 0.83 },
    { brandName: 'Nestlé', products: ['cereais', 'iogurtes', 'fórmulas', 'achocolatado', 'snacks'], campaignKeywords: ['lanche em família', 'rotina alimentar', 'cozinha afetiva', 'praticidade'], confidenceScore: 0.82 },
    { brandName: 'Danone', products: ['iogurte', 'bebida láctea', 'produtos infantis', 'proteicos'], campaignKeywords: ['lancheira', 'café da manhã', 'rotina familiar', 'nutrição prática'], confidenceScore: 0.82 },
    { brandName: 'MAM Baby', products: ['mamadeira', 'chupeta', 'copo de transição', 'mordedor'], campaignKeywords: ['enxoval', 'rotina do bebê', 'introdução alimentar', 'puericultura prática'], confidenceScore: 0.81 },
    { brandName: 'Electrolux', products: ['aspirador', 'geladeira', 'lavadora', 'air fryer', 'purificador'], campaignKeywords: ['casa prática', 'limpeza', 'cozinha real', 'organização doméstica'], confidenceScore: 0.84 },
    { brandName: 'Brastemp', products: ['geladeira', 'fogão', 'lava-louças', 'forno', 'máquina de lavar'], campaignKeywords: ['cozinha dos sonhos', 'casa funcional', 'receber amigos', 'rotina doméstica'], confidenceScore: 0.84 },
  ]),
  ...buildSeedItems(foodWellnessTemplate, [
    { brandName: 'Liv Up', products: ['marmitas congeladas', 'snacks', 'caldos', 'pratos saudáveis'], campaignKeywords: ['marmita prática', 'sem tempo para cozinhar', 'rotina saudável', 'home office'], confidenceScore: 0.83 },
    { brandName: 'Jasmine', products: ['granola', 'cookies integrais', 'pães', 'snacks sem glúten'], campaignKeywords: ['lanche saudável', 'café da manhã', 'ingredientes naturais', 'mercado consciente'], confidenceScore: 0.81 },
    { brandName: 'Taeq', products: ['orgânicos', 'snacks', 'iogurtes', 'grãos', 'congelados'], campaignKeywords: ['compras saudáveis', 'rotina equilibrada', 'mercado da semana', 'comida prática'], confidenceScore: 0.81 },
    { brandName: 'Mãe Terra', products: ['cookies', 'granola', 'snacks', 'cereais', 'biscoitos integrais'], campaignKeywords: ['lanche natural', 'ingredientes do bem', 'café da manhã', 'rotina leve'], confidenceScore: 0.82 },
    { brandName: 'Growth Supplements', products: ['whey protein', 'creatina', 'pré-treino', 'vitaminas'], campaignKeywords: ['suplementação', 'pós-treino', 'rotina fitness', 'consistência'], confidenceScore: 0.84 },
    { brandName: 'Integralmedica', products: ['whey protein', 'creatina', 'barras proteicas', 'pré-treino'], campaignKeywords: ['performance', 'musculação', 'suplemento na rotina', 'treino pesado'], confidenceScore: 0.83 },
    { brandName: 'Bio Mundo', products: ['produtos naturais', 'suplementos', 'snacks', 'grãos', 'vitaminas'], campaignKeywords: ['loja saudável', 'compras conscientes', 'rotina de bem-estar', 'mercado natural'], confidenceScore: 0.8 },
    { brandName: 'Mundo Verde', products: ['suplementos', 'snacks saudáveis', 'chás', 'produtos naturais'], campaignKeywords: ['vida saudável', 'loja de naturais', 'lanche funcional', 'bem-estar'], confidenceScore: 0.81 },
    { brandName: 'iFood', products: ['delivery de comida', 'mercado', 'clube de benefícios', 'cupons'], campaignKeywords: ['pedido prático', 'dia corrido', 'comida em casa', 'cupom', 'fim de semana'], confidenceScore: 0.84 },
    { brandName: 'Rappi', products: ['delivery', 'mercado', 'farmácia', 'restaurantes', 'assinatura'], campaignKeywords: ['conveniência', 'pedido urgente', 'mercado em casa', 'rotina corrida'], confidenceScore: 0.82 },
  ]),
  ...buildSeedItems(travelTemplate, [
    { brandName: 'Localiza', products: ['aluguel de carros', 'app de reserva', 'carro por assinatura'], campaignKeywords: ['road trip', 'fim de semana', 'viagem flexível', 'retirada de carro'], confidenceScore: 0.83 },
    { brandName: 'Movida', products: ['aluguel de carros', 'carro por assinatura', 'reserva pelo app'], campaignKeywords: ['mobilidade', 'viagem de carro', 'feriado', 'trajeto prático'], confidenceScore: 0.82 },
    { brandName: 'Azul', products: ['passagens aéreas', 'programa de pontos', 'bagagem', 'serviço de bordo'], campaignKeywords: ['viagem nacional', 'aeroporto', 'férias', 'conexão regional'], confidenceScore: 0.84 },
    { brandName: 'LATAM', products: ['passagens aéreas', 'programa de pontos', 'pacotes', 'bagagem'], campaignKeywords: ['viagem internacional', 'aeroporto', 'milhas', 'roteiro de férias'], confidenceScore: 0.84 },
    { brandName: 'Gol', products: ['passagens aéreas', 'programa de milhas', 'bagagem', 'check-in digital'], campaignKeywords: ['viagem nacional', 'bate-volta', 'aeroporto', 'milhas'], confidenceScore: 0.83 },
    { brandName: 'Airbnb', products: ['hospedagens', 'experiências', 'casas de temporada', 'quartos'], campaignKeywords: ['casa fora de casa', 'fim de semana', 'hospedagem única', 'roteiro local'], confidenceScore: 0.86 },
    { brandName: 'Booking.com', products: ['hotéis', 'pousadas', 'apartamentos', 'reservas de viagem'], campaignKeywords: ['planejamento de viagem', 'hotel', 'review de hospedagem', 'roteiro'], confidenceScore: 0.84 },
    { brandName: 'Uber', products: ['corridas', 'Uber Black', 'Uber Comfort', 'entregas'], campaignKeywords: ['mobilidade urbana', 'chegada segura', 'rotina na cidade', 'evento'], confidenceScore: 0.83 },
    { brandName: '99', products: ['corridas urbanas', '99Moto', '99Entrega', 'app de mobilidade'], campaignKeywords: ['deslocamento diário', 'mobilidade acessível', 'correria urbana', 'volta para casa'], confidenceScore: 0.81 },
    { brandName: 'Sem Parar', products: ['tag de pedágio', 'estacionamento', 'abastecimento', 'drive-thru'], campaignKeywords: ['viagem sem fila', 'estrada', 'pedágio', 'rotina de carro'], confidenceScore: 0.82 },
  ]),
  ...buildSeedItems(techFinanceTemplate, [
    { brandName: 'Apple', products: ['iPhone', 'Apple Watch', 'MacBook', 'AirPods', 'iPad'], campaignKeywords: ['setup criativo', 'produtividade', 'ecossistema', 'foto e vídeo', 'rotina premium'], confidenceScore: 0.88 },
    { brandName: 'Samsung', products: ['Galaxy', 'Galaxy Watch', 'Galaxy Buds', 'tablet', 'TV'], campaignKeywords: ['casa conectada', 'smartphone', 'produtividade', 'foto e vídeo', 'ecossistema'], confidenceScore: 0.86 },
    { brandName: 'Motorola', products: ['smartphones', 'fones', 'carregadores', 'acessórios'], campaignKeywords: ['celular acessível', 'bateria', 'rotina conectada', 'custo-benefício'], confidenceScore: 0.82 },
    { brandName: 'Nubank', products: ['conta digital', 'cartão', 'caixinhas', 'empréstimo', 'investimentos'], campaignKeywords: ['organização financeira', 'vida sem burocracia', 'cartão roxinho', 'controle pelo app'], confidenceScore: 0.86 },
    { brandName: 'PicPay', products: ['carteira digital', 'Pix', 'cartão', 'pagamentos', 'cashback'], campaignKeywords: ['pagamento prático', 'cashback', 'vaquinha', 'Pix na rotina'], confidenceScore: 0.82 },
    { brandName: 'Mercado Pago', products: ['maquininha', 'conta digital', 'Pix', 'cartão', 'link de pagamento'], campaignKeywords: ['empreendedorismo', 'venda online', 'pagamento fácil', 'negócio pequeno'], confidenceScore: 0.83 },
    { brandName: 'Itaú', products: ['conta corrente', 'cartão', 'investimentos', 'seguros', 'app bancário'], campaignKeywords: ['organização financeira', 'banco tradicional', 'planejamento', 'vida adulta'], confidenceScore: 0.83 },
    { brandName: 'XP', products: ['investimentos', 'conta investimento', 'assessoria', 'conteúdo financeiro'], campaignKeywords: ['educação financeira', 'investimentos', 'planejamento de futuro', 'carteira'], confidenceScore: 0.82 },
    { brandName: 'Claro', products: ['plano móvel', 'internet residencial', 'TV', '5G', 'combo'], campaignKeywords: ['conectividade', 'home office', 'internet rápida', 'família conectada'], confidenceScore: 0.82 },
    { brandName: 'Vivo', products: ['plano móvel', 'fibra', '5G', 'serviços digitais', 'combo'], campaignKeywords: ['internet em casa', 'conexão confiável', 'rotina digital', 'trabalho remoto'], confidenceScore: 0.82 },
  ]),
];
