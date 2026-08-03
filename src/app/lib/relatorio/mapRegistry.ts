/**
 * mapRegistry.ts — o registro canônico que agrupa os mapas dos criadores.
 *
 * ARQUITETURA, e ela é o coração do relatório:
 *
 *   O MAPA é o dicionário.  A SEMANA é a medição.
 *
 * O card "Seu Mapa" registra, por criador, o território dele, a narrativa, os assets
 * de vida e o tom. Esse card muda devagar — é declaração, não medição. O relatório
 * pega os posts da última semana e avalia QUAIS desses elementos do mapa apareceram e
 * com que resultado. As categorias nunca são derivadas dos posts; os posts dizem quais
 * categorias se realizaram.
 *
 * Este arquivo existe porque o mapa é POR CRIADOR e o relatório é COLETIVO. Para dizer
 * "Paternidade · 58 criadores" ou "animal em cena puxa compartilhamento", os rótulos
 * livres de 56 mapas precisam cair em categorias compartilhadas. Medido na base
 * (criadores ativos nos últimos 90 dias): 221 rótulos distintos de território, 414 de
 * asset, 95 chips de tom.
 *
 * É AQUI QUE A REGRA 3 É APLICADA. O mapa real contém "a esposa (livia linhares)",
 * "a filha (liv)", "animais (cavalo)", "a criadora e seus quatro filhos (dois pares de
 * gemeos)". O relatório nunca pode dizer isso — ele diz "parceiro em cena", "filho em
 * cena", "animal em cena". A tendência é coletiva, o preenchimento é pessoal, e a
 * tradução de um para o outro acontece nesta tabela e em nenhum outro lugar.
 *
 * CURADORIA: as regras abaixo são uma proposta baseada nos rótulos que existem hoje,
 * não uma verdade. `npm run relatorio:auditar-mapa` mostra a cobertura e lista o que
 * ficou fora — é por ali que este arquivo cresce.
 */

/** Normalização compartilhada: sem acento, sem parênteses, espaço colapsado. */
export function normalizeMapLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface MatchRule {
  /** Casa quando o rótulo normalizado é exatamente um destes. */
  exact?: string[];
  /**
   * Casa por PALAVRA, não por substring solta. Ver `matchesKeyword` — casar por
   * substring fazia "fe" (de Fé) acender em "bem-estar feminino", "confeitaria" e
   * "café", e a auditoria mostrou Fé com 14 criadores de 14 rótulos diferentes,
   * quase todos falsos.
   *
   * Keyword com espaço ("vida familiar", "ar livre") casa como frase dentro do
   * rótulo; keyword de uma palavra casa a palavra inteira, e só aceita prefixo
   * quando tem 4+ caracteres — o que permite "relacionament" → "relacionamentos"
   * sem permitir "fe" → "feminino".
   */
  keywords?: string[];
}

/** Comprimento a partir do qual uma keyword de uma palavra também casa como prefixo. */
const MIN_PREFIX_LENGTH = 4;

function matchesKeyword(label: string, keyword: string): boolean {
  if (keyword.includes(" ")) return label.includes(keyword);
  const words = label.split(" ");
  return words.some(
    (word) =>
      word === keyword ||
      (keyword.length >= MIN_PREFIX_LENGTH && word.startsWith(keyword)),
  );
}

function matches(label: string, rule: MatchRule): boolean {
  if (rule.exact?.includes(label)) return true;
  return Boolean(rule.keywords?.some((keyword) => matchesKeyword(label, keyword)));
}

// ─── Territórios ─────────────────────────────────────────────────────────────

/**
 * Território é DOMÍNIO DE VIDA — substantivo, o recorte temático onde o criador
 * atua. "Paternidade", "Cozinha", "Treino". Não é tom, não é formato, não é valor.
 */
export interface CanonicalTerritory {
  id: string;
  label: string;
  rule: MatchRule;
}

/**
 * Ordem IMPORTA: a primeira regra que casa ganha. Mais específico antes de mais
 * genérico — "autocuidado materno" tem que cair em maternidade, não em autocuidado.
 */
export const CANONICAL_TERRITORIES: readonly CanonicalTerritory[] = [
  {
    // Mãe e pai no MESMO território. A base tem 15 mães e 2 pais; separados, a
    // paternidade nunca abre tela e os dois perdem — o recorte de vida é o mesmo
    // (criar filho), e a Regra 2 pede tendência entre criadores, não entre gêneros.
    id: "maternidade",
    label: "Maternidade/Paternidade",
    rule: {
      keywords: [
        "maternidade", "materno", "paternidade", "paterno",
        "gestacao", "gravidez", "puerperio", "parentalidade",
      ],
    },
  },
  {
    id: "vida-familiar",
    label: "Vida familiar",
    rule: {
      // "familia"/"familiar" como palavra: é o que faz "humor em família" e
      // "humor familiar" caírem aqui em vez de serem descartados como tom.
      keywords: [
        "familia", "familiar", "familiares", "educacao de filhos",
        "criacao de filhos", "rotina em familia",
      ],
    },
  },
  {
    id: "relacoes",
    label: "Relações",
    rule: {
      keywords: ["relacionamento", "vida a dois", "casamento", "casal", "amizade", "namoro"],
    },
  },
  {
    id: "beleza",
    label: "Beleza",
    rule: { keywords: ["beleza", "cabelo", "capilar", "skincare", "maquiagem", "perfume", "estetica"] },
  },
  {
    id: "moda",
    label: "Moda",
    rule: { keywords: ["moda", "estilo pessoal", "look", "looks", "vestuario", "roupa", "roupas"] },
  },
  {
    id: "cozinha",
    label: "Gastronomia",
    rule: {
      keywords: ["culinaria", "gastronomia", "receita", "comida", "alimentacao", "cozinhar", "confeitaria"],
    },
  },
  {
    id: "treino",
    label: "Treino",
    rule: {
      keywords: [
        "treino", "fitness", "corrida", "exercicio", "academia", "musculacao",
        "emagrecimento", "definicao corporal", "pilates", "esporte",
      ],
    },
  },
  {
    id: "futebol",
    label: "Futebol",
    rule: { keywords: ["futebol", "selecao brasileira", "copa", "time"] },
  },
  {
    id: "casa-real",
    label: "Casa real",
    rule: {
      keywords: ["decoracao", "lar", "vida domestica", "casa e", "organizacao da casa", "reforma"],
    },
  },
  {
    id: "viagem",
    label: "Viagem",
    rule: { keywords: ["viagem", "viagens", "destino", "turismo"] },
  },
  {
    id: "fe",
    label: "Fé",
    rule: {
      keywords: ["fe", "espiritualidade", "religiao", "religiosa", "religioso", "crista", "cristo", "evangel", "gospel"],
    },
  },
  // ── Os três recortes de cuidado ─────────────────────────────────────────────
  // Antes eram um só ("Bem-estar" engolia autocuidado e saúde), e isso dava 29 dos 56
  // criadores num único território — metade da base num recorte não separa ninguém, e
  // as telas de território são as 16 do meio do relatório. A ORDEM aqui é o mecanismo:
  // saúde mental primeiro (o mais específico), autocuidado depois, bem-estar como o
  // residual. Sem essa ordem, "autocuidado e bem-estar" cairia no genérico.
  {
    id: "saude-mental",
    label: "Saúde mental",
    rule: {
      keywords: [
        "saude mental", "ansiedade", "terapia", "psico", "depressao", "burnout",
        "saude emocional", "bem estar emocional", "bem-estar emocional",
      ],
    },
  },
  {
    id: "autocuidado",
    label: "Autocuidado",
    rule: { keywords: ["autocuidado", "cuidados pessoais", "cuidado pessoal", "autoamor"] },
  },
  {
    id: "bem-estar",
    label: "Bem-estar",
    rule: { keywords: ["bem estar", "bem-estar", "saude", "saudavel", "qualidade de vida"] },
  },
  {
    id: "desenvolvimento",
    label: "Desenvolvimento pessoal",
    rule: {
      keywords: [
        "autoconhecimento", "autodescoberta", "autodesenvolvimento", "autoestima",
        "crescimento pessoal", "superacao", "empoderamento", "autoaceitacao", "vida adulta",
      ],
    },
  },
  {
    id: "carreira",
    label: "Carreira",
    rule: {
      keywords: ["carreira", "criacao de conteudo", "estrategia", "metricas", "trabalho", "negocio"],
    },
  },
  {
    id: "cultura",
    label: "Cultura",
    rule: { keywords: ["cultura", "celebridade", "fofoca", "musica", "pagode", "cinema", "novela"] },
  },
  {
    id: "pets",
    label: "Pets",
    rule: { keywords: ["pet", "pets", "animais de estimacao", "cachorro", "cadela", "gato", "gata"] },
  },
  {
    id: "tecnologia",
    label: "Tecnologia",
    rule: { keywords: ["tecnologia", "gadget", "aplicativo", "inteligencia artificial"] },
  },
  {
    id: "consumo",
    label: "Consumo",
    rule: { keywords: ["consumo", "compras", "achadinho", "resenha de produto"] },
  },
  {
    id: "estudos",
    label: "Estudos",
    rule: { keywords: ["estudo", "medicina", "faculdade", "concurso", "vestibular"] },
  },
] as const;

/**
 * Rótulos que aparecem em `mapa.territorios` mas NÃO são território. Ficam
 * registrados com o campo a que pertencem, para a auditoria poder dizer
 * "isto está no campo errado" em vez de "isto não foi reconhecido".
 *
 * `humor` é o caso mais comum (7 + 5 criadores): humor é TOM, não domínio de vida.
 * Ninguém atua no território do humor — atua na paternidade COM humor.
 */
export const MISPLACED_TERRITORY_LABELS: readonly {
  rule: MatchRule;
  belongsTo: "tom" | "tema" | "valor";
  reason: string;
}[] = [
  {
    rule: { keywords: ["humor", "comedia", "ironia", "sarcasmo", "deboche"] },
    belongsTo: "tom",
    reason: "Humor é como se fala, não onde se atua.",
  },
  {
    rule: {
      exact: ["estilo de vida", "lifestyle", "cotidiano", "rotina", "vida real", "dia a dia"],
    },
    belongsTo: "tema",
    reason: "Genérico demais para ser recorte — não separa um criador de outro.",
  },
  {
    rule: {
      keywords: ["autenticidade", "autonomia criativa", "conexao", "proposito", "verdade", "leveza"],
    },
    belongsTo: "valor",
    reason: "É um valor da narrativa, não um domínio de vida.",
  },
] as const;

export type TerritoryResolution =
  | { kind: "canonical"; territoryId: string; label: string }
  | { kind: "misplaced"; belongsTo: "tom" | "tema" | "valor"; reason: string }
  | { kind: "unmatched" };

/**
 * Resolve UM rótulo de `mapa.territorios`.
 *
 * TERRITÓRIO CANÔNICO PRIMEIRO, campo errado só depois. A ordem importa e é sutil:
 * `humor` sozinho é tom, mas `humor de casal` e `humor em família` carregam um domínio
 * de vida DENTRO do rótulo — o criador está dizendo que atua em relações, ou na vida
 * familiar, com humor. Descartar o rótulo inteiro por causa da palavra "humor" jogaria
 * fora o território junto com o tom.
 *
 * Então: se alguma regra de território casa, o território ganha. "Campo errado" é o
 * destino de quem não tem domínio nenhum dentro — `humor`, `estilo de vida`,
 * `autenticidade`.
 */
export function resolveTerritoryLabel(raw: string): TerritoryResolution {
  const label = normalizeMapLabel(raw);
  if (!label) return { kind: "unmatched" };

  for (const territory of CANONICAL_TERRITORIES) {
    if (matches(label, territory.rule)) {
      return { kind: "canonical", territoryId: territory.id, label: territory.label };
    }
  }
  for (const misplaced of MISPLACED_TERRITORY_LABELS) {
    if (matches(label, misplaced.rule)) {
      return { kind: "misplaced", belongsTo: misplaced.belongsTo, reason: misplaced.reason };
    }
  }
  return { kind: "unmatched" };
}

const TERRITORY_BY_ID = new Map(CANONICAL_TERRITORIES.map((t) => [t.id, t]));

export function canonicalTerritoryById(id: string): CanonicalTerritory | null {
  return TERRITORY_BY_ID.get(id) ?? null;
}

export function canonicalTerritoryIds(): string[] {
  return CANONICAL_TERRITORIES.map((t) => t.id);
}

// ─── Papéis de asset de vida (Regra 3) ───────────────────────────────────────

/**
 * Asset de vida do relatório é PAPEL, nunca indivíduo. O mapa do criador diz
 * "a esposa (livia linhares)"; o relatório diz "parceiro em cena". Cada criador
 * encaixa o que tem dentro da categoria.
 */
export interface CanonicalAssetRole {
  id: string;
  label: string;
  /** "vida" = gente e relação · "cenario" = lugar · "objeto" = coisa em cena. */
  group: "vida" | "cenario" | "objeto";
  rule: MatchRule;
}

/**
 * Ordem IMPORTA. Gente antes de lugar: "a criadora e o marido em casa" é
 * "parceiro em cena", não "casa". "a propria criadora" sozinha vem depois de todas as
 * outras pessoas, senão engoliria "a criadora e seus filhos".
 */
export const CANONICAL_ASSET_ROLES: readonly CanonicalAssetRole[] = [
  {
    id: "filho_em_cena",
    label: "Filho em cena",
    group: "vida",
    rule: { keywords: ["filho", "filha", "crianca", "bebe", "gemeo", "enteado"] },
  },
  {
    id: "parceiro_em_cena",
    label: "Parceiro em cena",
    group: "vida",
    // "casal" e "casais" precisam estar AQUI. Sem eles, `casa` os captura por prefixo
    // (casa|l) lá embaixo, e "O casal (Thaís e Alex)" vira cenário doméstico —
    // um casal contado como parede. Mesma família do bug de "fé" em "confeitaria".
    rule: {
      keywords: [
        "marido", "esposa", "parceir", "namorad", "companheir", "conjuge",
        "casal", "casais", "a dois",
      ],
    },
  },
  {
    id: "familia_em_cena",
    label: "Família em cena",
    group: "vida",
    rule: {
      keywords: [
        "familia", "familiares", "mae", "maes", "pai", "pais", "irma", "irmas",
        "irmao", "irmaos", "avo", "avos", "sogra", "sogro", "primo", "prima",
      ],
    },
  },
  {
    id: "amigo_em_cena",
    label: "Amigo em cena",
    group: "vida",
    rule: { keywords: ["amig", "colega", "equipe", "socio"] },
  },
  {
    id: "animal_em_cena",
    label: "Animal em cena",
    group: "vida",
    rule: { keywords: ["animal", "animais", "pet", "cachorro", "cadela", "gato", "cavalo"] },
  },
  {
    id: "sozinho_na_cena",
    label: "Sozinho na cena",
    group: "vida",
    rule: { keywords: ["propria criadora", "propria autora", "a criadora", "o criador", "proprio criador"] },
  },
  {
    id: "corpo_em_movimento",
    label: "Corpo em movimento",
    group: "vida",
    rule: { keywords: ["treino", "corrida", "exercicio", "pilates", "danca", "alongamento"] },
  },
  {
    id: "fe_em_cena",
    label: "Fé em cena",
    group: "vida",
    rule: { keywords: ["religios", "igreja", "culto", "oracao", "biblia"] },
  },
  // ── Cenários ──
  {
    id: "cabelo_em_cena",
    label: "Cabelo em cena",
    group: "vida",
    rule: { keywords: ["cabelo", "cacheado", "crespo", "dread", "trancas", "loiro"] },
  },
  {
    id: "rotina_de_autocuidado",
    label: "Rotina de autocuidado",
    group: "vida",
    rule: { keywords: ["rotina de autocuidado", "rotinas de autocuidado", "skincare", "autocuidado"] },
  },
  {
    id: "cozinha",
    label: "Gastronomia",
    group: "cenario",
    rule: { keywords: ["cozinha", "fogao", "bancada"] },
  },
  {
    // Fora de ordem de propósito: `movel_em_cena` é objeto, mas precisa ser testado
    // ANTES de `casa`, senão "itens de organização doméstica" e "móveis DIY" viram
    // cenário. Um móvel é coisa que se mostra e se compra; casa é onde se está.
    // Para quem faz Casa real, o sofá É o assunto — não o pano de fundo.
    id: "movel_em_cena",
    label: "Móvel em cena",
    group: "objeto",
    rule: {
      keywords: [
        "movel", "movei", "colchao", "colchoes", "estante", "armario",
        "organizacao domestica", "decoracao",
      ],
    },
  },
  {
    id: "casa",
    label: "Casa",
    group: "cenario",
    rule: {
      keywords: [
        "casa", "domestic", "sala", "quarto", "sofa", "lar", "varanda", "banheiro",
        "apartamento", "ambientes internos", "cenarios internos",
      ],
    },
  },
  {
    id: "academia",
    label: "Academia",
    group: "cenario",
    rule: { keywords: ["academia", "pista", "box", "quadra", "espaco de treino"] },
  },
  {
    id: "trabalho",
    label: "Trabalho",
    group: "cenario",
    rule: { keywords: ["escritorio", "consultorio", "clinica", "salao", "loja", "bastidor", "estudio"] },
  },
  {
    id: "carro",
    label: "Carro",
    group: "cenario",
    rule: { keywords: ["carro", "volante", "transito", "moto"] },
  },
  {
    id: "rua",
    label: "Rua",
    group: "cenario",
    rule: { keywords: ["rua", "urbano", "cidade", "calcada"] },
  },
  {
    id: "natureza",
    label: "Natureza",
    group: "cenario",
    rule: { keywords: ["praia", "natureza", "ar livre", "parque", "area verde", "campo", "mar"] },
  },
  {
    id: "viagem_em_cena",
    label: "Viagem em cena",
    group: "cenario",
    rule: { keywords: ["aeroporto", "viagem", "hotel", "vinicola", "destino"] },
  },
  {
    id: "estabelecimento",
    label: "Estabelecimento",
    group: "cenario",
    rule: { keywords: ["restaurante", "mercado", "cafe", "bar", "padaria", "feira"] },
  },
  // ── Objetos ──
  {
    id: "comida_em_cena",
    label: "Comida em cena",
    group: "objeto",
    rule: { keywords: ["comida", "alimento", "ingrediente", "receita", "doce", "bebida", "prato"] },
  },
  {
    id: "produto_em_cena",
    label: "Produto em cena",
    group: "objeto",
    rule: { keywords: ["produto", "frasco", "cosmetico", "embalagem", "recebido"] },
  },
  {
    // NÃO é "estar vestido" — todo mundo grava vestido, e como papel isso não
    // significaria nada. É a roupa como ASSUNTO: o look montado, a peça mostrada, a
    // marca citada. Os rótulos reais que caem aqui são de criadoras de moda:
    // "Roupas da Farm", "looks do dia", "bolsas e acessórios".
    id: "look_montado",
    label: "Look montado",
    group: "objeto",
    rule: {
      keywords: ["roupa", "acessorio", "look", "looks", "bolsa", "figurino", "fantasia", "peca"],
    },
  },
  {
    id: "equipamento_em_cena",
    label: "Equipamento em cena",
    group: "objeto",
    rule: {
      keywords: ["microfone", "camera", "equipamento", "relogio", "celular", "computador", "notebook", "tripe"],
    },
  },
  {
    // Brinquedo é o objeto mais frequente da base e não é "objeto qualquer": ele diz
    // que a criança está no vídeo COMO criança, brincando, e não só de corpo presente.
    id: "brinquedo_em_cena",
    label: "Brinquedo em cena",
    group: "objeto",
    rule: { keywords: ["brinquedo", "boneca", "pelucia", "lego"] },
  },
  {
    // Balde de resto, e assumido como tal. Um rótulo que cai aqui é um rótulo que o
    // mapa não soube nomear — inclusive os dois criadores cujo mapa diz, literalmente,
    // "objetos do cotidiano". A saída para isso não é mais keyword: é o vídeo dizer
    // QUE objeto é (ver `objetosObservados` na avaliação de cena).
    id: "objeto_do_cotidiano",
    label: "Objeto do cotidiano",
    group: "objeto",
    rule: {
      keywords: ["objeto", "utensilio", "adesivo", "album", "figurinha", "aderec", "caderno", "caneta"],
    },
  },
] as const;

export type AssetResolution =
  | { kind: "canonical"; roleId: string; label: string; group: "vida" | "cenario" | "objeto" }
  | { kind: "unmatched" };

/** Resolve UM rótulo de `mapa.assets` no papel coletivo. */
export function resolveAssetLabel(raw: string): AssetResolution {
  const label = normalizeMapLabel(raw);
  if (!label) return { kind: "unmatched" };
  for (const role of CANONICAL_ASSET_ROLES) {
    if (matches(label, role.rule)) {
      return { kind: "canonical", roleId: role.id, label: role.label, group: role.group };
    }
  }
  return { kind: "unmatched" };
}

const ASSET_BY_ID = new Map(CANONICAL_ASSET_ROLES.map((r) => [r.id, r]));

/**
 * Chaves de papel que já foram gravadas no banco e depois renomeadas.
 *
 * `Metric.sceneElements` guarda a CHAVE, não o rótulo, então renomear um papel deixa os
 * registros antigos órfãos — e o slide passa a imprimir "roupa_em_cena" cru, que é a
 * Regra 3 vazando. Este mapa é a ponte; ele nunca encolhe, só cresce.
 */
const LEGACY_ASSET_ROLE_IDS: Readonly<Record<string, string>> = {
  roupa_em_cena: "look_montado",
};

export function canonicalAssetRoleById(id: string): CanonicalAssetRole | null {
  const canonical = LEGACY_ASSET_ROLE_IDS[id] ?? id;
  return ASSET_BY_ID.get(canonical) ?? null;
}

/** Normaliza uma chave gravada para a chave atual. Usar antes de agrupar. */
export function currentAssetRoleId(id: string): string {
  return LEGACY_ASSET_ROLE_IDS[id] ?? id;
}

// ─── Assuntos (mapa.temas) ───────────────────────────────────────────────────

/**
 * ASSUNTO é o que o criador fala DE FATO, e vem de `mapa.temas` — não de
 * `contentIntent`.
 *
 * A diferença importa: `contentIntent` é INTENÇÃO ("Ensinar", "Converter", "Entreter"),
 * que descreve o que o post tenta fazer, não sobre o que ele é. Os temas do card são o
 * assunto real: "Sair do trabalho a tempo de viver a vida familiar", "Celebrar a beleza
 * do cabelo crespo em cada fase da transição". Numa reunião, a segunda lista é a que
 * gera conversa.
 *
 * Como os temas são frases próprias (203 distintas em 56 mapas), o registro agrupa por
 * assunto compartilhado — mesma mecânica dos territórios e dos papéis de asset.
 */
export interface CanonicalSubject {
  id: string;
  label: string;
  rule: MatchRule;
}

export const CANONICAL_SUBJECTS: readonly CanonicalSubject[] = [
  {
    id: "criacao_dos_filhos",
    label: "Criar filho",
    rule: { keywords: ["filho", "filhos", "crianca", "criancas", "bebe", "maternidade", "paternidade", "parto", "amamenta"] },
  },
  {
    id: "vida_em_familia",
    label: "Vida em família",
    rule: { keywords: ["familia", "familiar", "parente", "avo", "irmao", "irma"] },
  },
  {
    id: "vida_a_dois",
    label: "Vida a dois",
    rule: { keywords: ["casal", "a dois", "marido", "esposa", "namorad", "casamento", "parceir"] },
  },
  {
    id: "rotina_da_casa",
    label: "Rotina da casa",
    rule: {
      keywords: [
        "domestic", "reforma", "decoracao", "organiza", "faxina", "lar", "ambiente",
        "casa", "apartamento", "movel", "moveis",
      ],
    },
  },
  {
    id: "cozinhar",
    label: "Cozinhar",
    rule: { keywords: ["receita", "receitas", "cozinha", "culinaria", "comida", "prato", "confeitar"] },
  },
  {
    id: "corpo_e_treino",
    label: "Corpo e treino",
    rule: { keywords: ["treino", "treinos", "esporte", "corrida", "exercicio", "academia", "limites", "condicionamento"] },
  },
  {
    id: "beleza_e_cabelo",
    label: "Beleza e cabelo",
    rule: { keywords: ["cabelo", "crespo", "cacheado", "beleza", "maquiagem", "skincare", "pele", "transicao"] },
  },
  {
    id: "estilo_e_look",
    label: "Estilo e look",
    rule: { keywords: ["roupa", "roupas", "look", "looks", "moda", "customiz", "estilo", "acessorio"] },
  },
  {
    id: "trabalho_e_renda",
    label: "Trabalho e renda",
    rule: { keywords: ["renda", "lucro", "negocio", "trabalho", "carreira", "anunciante", "marca", "marcas", "publicidade", "monetiz"] },
  },
  {
    id: "criar_conteudo",
    label: "Criar conteúdo",
    rule: { keywords: ["conteudo", "criador", "criadores", "algoritmo", "metrica", "metricas", "criativo", "voz", "bastidor", "bastidores"] },
  },
  {
    id: "consumo_e_achados",
    label: "Consumo e achados",
    rule: { keywords: ["produto", "produtos", "recomendar", "recomenda", "comercio", "compra", "achado", "achados", "servico"] },
  },
  {
    id: "viajar",
    label: "Viajar",
    rule: { keywords: ["viagem", "viagens", "viajar", "destino", "lugares", "turismo", "hospedagem"] },
  },
  {
    id: "fe_e_proposito",
    label: "Fé e propósito",
    rule: { keywords: ["fe", "gratidao", "proposito", "espiritual", "oracao", "deus", "religios"] },
  },
  {
    id: "crescer_por_dentro",
    label: "Crescer por dentro",
    rule: { keywords: ["crescimento", "reinventar", "amadurecimento", "autoconhecimento", "superar", "superando", "bloqueio", "identidade", "coragem", "vulnerabilidade"] },
  },
  {
    id: "cuidar_de_si",
    label: "Cuidar de si",
    rule: { keywords: ["autocuidado", "bem-estar", "bem estar", "saude", "lazer", "descanso", "equilibrio", "cansaco"] },
  },
  {
    id: "o_cotidiano",
    label: "O cotidiano",
    rule: { keywords: ["dia a dia", "cotidiano", "rotina", "inusitado", "situacoes", "pequenas alegrias"] },
  },
  {
    id: "cultura_e_famosos",
    label: "Cultura e famosos",
    rule: { keywords: ["famoso", "famosos", "fofoca", "fofocas", "noticia", "noticias", "cinema", "atuacao", "novela", "musica"] },
  },
  {
    id: "amizade_e_afeto",
    label: "Amizade e afeto",
    rule: { keywords: ["amigo", "amigos", "amiga", "afeto", "pessoas proximas", "relacoes humanas", "conselho", "conselhos"] },
  },
  {
    id: "lugar_de_origem",
    label: "Lugar de origem",
    rule: { keywords: ["local", "locais", "regiao", "carioca", "nordestin", "mineiro", "cidade", "costumes"] },
  },
  {
    id: "saude_e_corpo",
    label: "Saúde do corpo",
    rule: { keywords: ["cannabis", "medicina", "medico", "clinico", "tratamento", "terapia", "diagnostico"] },
  },
];

export type SubjectResolution =
  | { kind: "canonical"; subjectId: string; label: string }
  | { kind: "unmatched" };

export function resolveSubjectLabel(raw: string): SubjectResolution {
  const label = normalizeMapLabel(raw);
  if (!label) return { kind: "unmatched" };
  for (const subject of CANONICAL_SUBJECTS) {
    if (matches(label, subject.rule)) {
      return { kind: "canonical", subjectId: subject.id, label: subject.label };
    }
  }
  return { kind: "unmatched" };
}

const SUBJECT_BY_ID = new Map(CANONICAL_SUBJECTS.map((s) => [s.id, s]));

export function canonicalSubjectById(id: string): CanonicalSubject | null {
  return SUBJECT_BY_ID.get(id) ?? null;
}

// ─── Tom de fala ─────────────────────────────────────────────────────────────

export interface CanonicalTone {
  id: string;
  label: string;
  rule: MatchRule;
}

/** Chips reais mais comuns: humor leve(11), casual e direto(6), bem-humorado(5)… */
export const CANONICAL_TONES: readonly CanonicalTone[] = [
  {
    id: "humor",
    label: "Humor",
    rule: { keywords: ["humor", "divertid", "engracad", "comic", "ironi", "deboche", "sarcas"] },
  },
  {
    id: "acolhedor",
    label: "Acolhedor",
    rule: { keywords: ["acolhedor", "afetiv", "carinhos", "materno", "empatic", "gentil"] },
  },
  {
    id: "direto",
    label: "Direto",
    rule: { keywords: ["direto", "assertiv", "objetiv", "franco", "sem rodeio"] },
  },
  {
    id: "casual",
    label: "Casual",
    rule: { keywords: ["casual", "informal", "descontraid", "leve", "espontane"] },
  },
  {
    id: "reflexivo",
    label: "Reflexivo",
    rule: { keywords: ["reflexiv", "introspectiv", "filosofic", "pensativ", "profund"] },
  },
  {
    id: "vulneravel",
    label: "Vulnerável",
    rule: { keywords: ["vulnerab", "vulneravel", "sincer", "honest", "cru", "verdade nua"] },
  },
  {
    id: "inspirador",
    label: "Inspirador",
    rule: { keywords: ["inspirador", "motivacional", "motivador", "encoraj", "esperanc"] },
  },
  {
    id: "didatico",
    label: "Didático",
    rule: { keywords: ["didatic", "educativ", "explicativ", "tecnic", "informativ"] },
  },
  {
    id: "energetico",
    label: "Energético",
    rule: { keywords: ["energetic", "vibrante", "animad", "intens", "empolgad"] },
  },
  {
    id: "critico",
    label: "Crítico",
    rule: { keywords: ["critic", "questionador", "provocativ", "polemic"] },
  },
] as const;

export type ToneResolution =
  | { kind: "canonical"; toneId: string; label: string }
  | { kind: "unmatched" };

export function resolveToneLabel(raw: string): ToneResolution {
  const label = normalizeMapLabel(raw);
  if (!label) return { kind: "unmatched" };
  for (const tone of CANONICAL_TONES) {
    if (matches(label, tone.rule)) {
      return { kind: "canonical", toneId: tone.id, label: tone.label };
    }
  }
  return { kind: "unmatched" };
}

const TONE_BY_ID = new Map(CANONICAL_TONES.map((t) => [t.id, t]));

export function canonicalToneById(id: string): CanonicalTone | null {
  return TONE_BY_ID.get(id) ?? null;
}

/**
 * `mapa.tom` é uma string escalar que a UI trata como lista separada por vírgula
 * (ver EditableTomField no card). Aqui a quebra é a mesma.
 */
export function splitToneField(tom: string | null | undefined): string[] {
  if (!tom) return [];
  return tom
    .split(/[,;]+/)
    .map((chip) => chip.trim())
    .filter(Boolean);
}

/* ────────────────────────────────────────────────────────────────────────────
 * LUGARES — o único vocabulário deste arquivo que NÃO vem do mapa.
 *
 * O mapa do criador diz "Ambientes domésticos" e para por aí: a criadora não
 * escreve "sala" no card, ela escreve "casa". Mas o vídeo sabe que é a cozinha.
 * Então o lugar exato é a única categoria que se lê do VÍDEO com pergunta aberta,
 * porque a lista é global, fechada e igual para todo mundo — e por isso continua
 * comparável entre criadores, que é a condição para entrar num ranking.
 *
 * Não confundir com o asset `casa`: aquele é o mapa declarando "eu gravo em casa";
 * este é a semana respondendo "em que cômodo, afinal".
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CanonicalPlace {
  id: string;
  label: string;
  /** true quando é cômodo de casa — o recorte que o mapa não consegue dar. */
  indoor: boolean;
  /**
   * O que conta como este lugar. Vai literal para o prompt, e não é enfeite: sem hint,
   * um vídeo na PRAIA foi classificado como "Rua" — o rótulo sozinho deixa o modelo
   * adivinhar a fronteira entre categorias vizinhas.
   */
  hint: string;
}

export const CANONICAL_PLACES: readonly CanonicalPlace[] = [
  { id: "cozinha_local", label: "Cozinha", indoor: true, hint: "fogão, pia, bancada, geladeira" },
  { id: "sala", label: "Sala", indoor: true, hint: "sofá, TV, sala de estar ou de jantar" },
  { id: "quarto", label: "Quarto", indoor: true, hint: "cama, guarda-roupa, quarto de criança" },
  { id: "banheiro", label: "Banheiro", indoor: true, hint: "pia com espelho, box, banheira" },
  {
    id: "varanda_quintal",
    label: "Varanda ou quintal",
    indoor: true,
    hint: "área externa DA PRÓPRIA CASA: varanda, quintal, piscina de casa, churrasqueira",
  },
  { id: "area_de_servico", label: "Área de serviço", indoor: true, hint: "tanque, máquina de lavar, varal" },
  { id: "escritorio_casa", label: "Escritório em casa", indoor: true, hint: "mesa de trabalho dentro de casa" },
  { id: "carro_local", label: "Carro", indoor: false, hint: "dentro do carro, dirigindo ou parado" },
  {
    id: "rua_local",
    label: "Rua",
    indoor: false,
    hint: "via pública urbana: calçada, avenida, prédios ao redor. NÃO use para praia nem parque",
  },
  {
    id: "natureza_local",
    label: "Natureza",
    indoor: false,
    hint: "praia, mar, piscina de clube, parque, mata, campo, cachoeira, trilha",
  },
  { id: "academia_local", label: "Academia", indoor: false, hint: "academia, box de crossfit, quadra, pista" },
  {
    id: "estabelecimento_local",
    label: "Estabelecimento",
    indoor: false,
    hint: "restaurante, café, bar, loja, mercado, salão — lugar comercial de terceiros",
  },
  { id: "trabalho_local", label: "Local de trabalho", indoor: false, hint: "escritório, consultório, clínica, bastidor" },
  { id: "estudio", label: "Estúdio ou fundo neutro", indoor: false, hint: "fundo liso, cenário montado, sem contexto" },
] as const;

const PLACE_BY_ID = new Map(CANONICAL_PLACES.map((p) => [p.id, p]));

export function canonicalPlaceById(id: string): CanonicalPlace | null {
  return PLACE_BY_ID.get(id) ?? null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * ENQUADRAMENTO e ESTÉTICA — como foi gravado.
 *
 * Duas listas fixas e globais, pela mesma razão dos lugares: são finitas por
 * natureza (um vídeo é close ou não é) e iguais para todo criador, então rendem
 * comparação. Tudo o que NÃO é finito por natureza — assunto, objeto, frase — foi
 * deliberadamente deixado aberto, e vem do vídeo em texto livre.
 * ──────────────────────────────────────────────────────────────────────────── */

export interface CanonicalTrait {
  id: string;
  label: string;
  /** O que a IA precisa ver para marcar. Vai literalmente para o prompt. */
  hint: string;
}

export const CANONICAL_FRAMINGS: readonly CanonicalTrait[] = [
  { id: "close", label: "Close no rosto", hint: "o rosto ocupa a maior parte da tela" },
  { id: "plano_medio", label: "Plano médio", hint: "da cintura ou do peito para cima" },
  { id: "plano_aberto", label: "Plano aberto", hint: "corpo inteiro ou o ambiente todo" },
  { id: "selfie_no_braco", label: "Selfie no braço", hint: "a própria pessoa segura o celular" },
  { id: "camera_fixa", label: "Câmera fixa", hint: "tripé ou apoiada, sem se mexer" },
  { id: "camera_na_mao", label: "Câmera na mão", hint: "imagem balança, alguém andando com ela" },
  { id: "pov", label: "POV", hint: "primeira pessoa, o que os olhos da pessoa veem" },
  { id: "gravado_por_outro", label: "Gravado por outra pessoa", hint: "alguém de fora segura a câmera" },
] as const;

export const CANONICAL_AESTHETICS: readonly CanonicalTrait[] = [
  { id: "luz_natural", label: "Luz natural", hint: "luz de janela ou de sol" },
  { id: "luz_artificial", label: "Luz artificial", hint: "ring light, luz montada, estúdio" },
  { id: "caseiro", label: "Caseiro", hint: "sem produção, do jeito que estava" },
  { id: "produzido", label: "Produzido", hint: "cenário montado, arrumado para gravar" },
  { id: "corte_rapido", label: "Corte rápido", hint: "muitos cortes, ritmo acelerado" },
  { id: "plano_unico", label: "Plano único", hint: "uma tomada só, sem corte" },
  { id: "legenda_na_tela", label: "Legenda na tela", hint: "texto acompanhando a fala" },
  { id: "com_musica", label: "Com música", hint: "trilha audível por baixo" },
] as const;

const FRAMING_BY_ID = new Map(CANONICAL_FRAMINGS.map((t) => [t.id, t]));
const AESTHETIC_BY_ID = new Map(CANONICAL_AESTHETICS.map((t) => [t.id, t]));

export function canonicalFramingById(id: string): CanonicalTrait | null {
  return FRAMING_BY_ID.get(id) ?? null;
}
export function canonicalAestheticById(id: string): CanonicalTrait | null {
  return AESTHETIC_BY_ID.get(id) ?? null;
}
