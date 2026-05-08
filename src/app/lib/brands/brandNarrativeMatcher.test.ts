/** @jest-environment node */

import { BRAND_NARRATIVE_SEED } from '@/app/lib/brands/brandNarrativeSeed';
import {
  BRAND_NARRATIVE_MATCH_DISCLAIMER,
  normalizeNarrativeTerm,
  rankBrandNarrativeMatches,
  scoreBrandNarrativeMatch,
} from '@/app/lib/brands/brandNarrativeMatcher';
import type { BrandNarrativeSeedItem } from '@/app/lib/brands/brandNarrativeSeed';
import type { BrandNarrativeMatchInput } from '@/app/lib/brands/brandNarrativeMatchTypes';

function slugify(value: string): string {
  return normalizeNarrativeTerm(value).replace(/\s+/g, '-');
}

function makeBrand(seed: BrandNarrativeSeedItem, overrides: Record<string, unknown> = {}) {
  return {
    _id: slugify(seed.brandName),
    brandName: seed.brandName,
    slug: slugify(seed.brandName),
    category: seed.category,
    subcategories: seed.subcategories,
    territories: seed.territories,
    contexts: seed.contexts,
    narrativeForms: seed.narrativeForms,
    contentIntents: seed.contentIntents,
    contentSignals: seed.contentSignals,
    tones: seed.tones,
    proofStyles: seed.proofStyles,
    commercialModes: seed.commercialModes,
    products: seed.products,
    campaignKeywords: seed.campaignKeywords,
    avoidContexts: seed.avoidContexts,
    insertionIdeas: seed.insertionIdeas,
    confidenceScore: seed.confidenceScore,
    ...overrides,
  } as any;
}

const adidasSeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === 'Adidas')!;
const nikeSeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === 'Nike')!;
const asicsSeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === 'Asics')!;
const naturaSeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === 'Natura')!;
const boticarioSeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === 'O Boticário')!;
const lorealSeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === "L'Oréal Paris")!;
const johnsonsBabySeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === "Johnson's Baby")!;
const samsungSeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === 'Samsung')!;
const mundoVerdeSeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === 'Mundo Verde')!;
const sonySeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === 'Sony')!;
const jblSeed = BRAND_NARRATIVE_SEED.find((brand) => brand.brandName === 'JBL')!;

const runningInput: BrandNarrativeMatchInput = {
  decision: {
    contextId: 'fitness_sports',
    proposalId: 'lifestyle',
    toneId: 'inspirational',
    intentId: 'inspire',
    narrativeId: 'day_in_the_life',
    formatId: 'reel',
  },
  pauta: {
    title: 'Minha preparação para a meia maratona',
    description: 'Treino, corrida de rua, kit da prova e conquista pessoal no pós-prova.',
    reason: 'A audiência acompanha uma jornada real de superação.',
    theme: 'corrida e preparação',
    keywords: ['corrida', 'preparação', 'prova'],
  },
  categories: {
    context: ['fitness_sports'],
    contentIntent: ['inspire'],
    narrativeForm: ['day_in_the_life'],
  },
};

const smokeRunningInput: BrandNarrativeMatchInput = {
  decision: {
    contextId: 'corrida de rua',
    proposalId: 'preparacao para prova',
    toneId: 'inspirador',
    narrativeId: 'jornada',
    intentId: 'inspirar',
    formatId: 'reels',
    themeId: 'meia maratona',
  },
  pauta: {
    title: 'Preparacao para minha primeira meia maratona com treino de corrida',
    description:
      'Rotina de longao, escolha de tenis de corrida, hidratacao, pace, comunidade de corrida e bastidores da evolucao ate a prova de rua.',
    reason: 'Mostrar uma jornada real de preparacao, superacao, treino pre-prova e aprendizado antes da corrida.',
    theme: 'corrida de rua e preparacao para prova',
    keywords: [
      'corrida',
      'corrida de rua',
      'tenis de corrida',
      'treino',
      'longao',
      'pace',
      'hidratacao',
      'meia maratona',
      'prova esportiva',
      'performance',
    ],
  },
  categories: {
    context: ['corrida de rua', 'treino', 'prova esportiva'],
    narrativeForm: ['jornada', 'bastidores', 'conquista'],
    contentIntent: ['inspirar', 'registrar jornada', 'demonstrar experiencia'],
    contentSignals: ['produto em uso real', 'rotina', 'preparacao'],
    proofStyle: ['uso cotidiano', 'experiencia real'],
    commercialMode: ['produto em uso', 'seeding', 'evento'],
  },
  limit: 6,
};

const wellnessDigitalInput: BrandNarrativeMatchInput = {
  decision: {
    contextId: 'Estilo de Vida e Bem-Estar',
    proposalId: 'rotina real',
    toneId: 'leve',
    narrativeId: 'rotina',
    intentId: 'conectar',
    formatId: 'reels',
    themeId: 'Estilo de Vida e Bem-Estar',
  },
  pauta: {
    title: 'Quando você tenta relaxar e o celular não para de tocar',
    description:
      'Pauta sobre rotina, descanso, excesso de notificações, autocuidado e relação com o celular no dia a dia.',
    reason: 'Mostrar uma tensão real entre pausa, cuidado pessoal e estímulos digitais constantes.',
    theme: 'Estilo de Vida e Bem-Estar',
    keywords: ['relaxar', 'celular', 'notificações', 'descanso', 'autocuidado', 'bem-estar digital'],
  },
  categories: {
    context: ['Estilo de Vida e Bem-Estar'],
    narrativeForm: ['rotina', 'história real'],
    contentIntent: ['conectar', 'gerar identificação'],
    contentSignals: ['uso cotidiano', 'rotina real', 'autocuidado'],
    proofStyle: ['experiência real', 'uso cotidiano'],
    commercialMode: ['produto em uso'],
  },
  limit: 6,
};

const wellnessChaosInput: BrandNarrativeMatchInput = {
  decision: {
    contextId: 'Estilo de Vida e Bem-Estar',
    proposalId: 'rotina real',
    toneId: 'humor cotidiano',
    narrativeId: 'pov',
    intentId: 'conectar',
    formatId: 'reels',
    themeId: 'Estilo de Vida e Bem-Estar',
  },
  pauta: {
    title: 'POV: tentando relaxar enquanto a obra começa',
    description:
      'Uma narrativa de humor cotidiano sobre tentar descansar, mas ser interrompido por barulho de obra, caos doméstico e rotina real.',
    reason: 'Mostrar autocuidado imperfeito, frustração leve e pausa possível mesmo em meio ao caos.',
    theme: 'Estilo de Vida e Bem-Estar',
    keywords: ['relaxar', 'obra', 'barulho', 'descanso', 'autocuidado', 'rotina real', 'caos doméstico'],
  },
  categories: {
    context: ['Estilo de Vida e Bem-Estar'],
    narrativeForm: ['pov', 'humor cotidiano', 'rotina real'],
    contentIntent: ['conectar', 'gerar identificação'],
    contentSignals: ['rotina real', 'humor cotidiano', 'autocuidado', 'pausa'],
    proofStyle: ['experiência real', 'uso cotidiano'],
    commercialMode: ['produto em uso real', 'ritual', 'experiência'],
  },
  limit: 6,
};

const wellnessFamilyChaosInput: BrandNarrativeMatchInput = {
  ...wellnessChaosInput,
  pauta: {
    ...wellnessChaosInput.pauta,
    title: 'POV: tentando relaxar enquanto o bebê dorme e a obra começa',
    description:
      'Uma narrativa de humor cotidiano sobre tentar descansar enquanto o bebê dorme, mas ser interrompido por barulho de obra, caos doméstico e rotina familiar.',
    reason: 'Mostrar uma pausa possível em uma casa com bebê, cuidado familiar e rotina real.',
    keywords: [
      'relaxar',
      'bebê',
      'obra',
      'barulho',
      'descanso',
      'autocuidado',
      'rotina familiar',
      'casa com criança',
    ],
  },
  categories: {
    ...wellnessChaosInput.categories,
    context: ['Estilo de Vida e Bem-Estar', 'família', 'maternidade'],
    contentSignals: ['rotina familiar', 'cuidado infantil', 'pausa'],
  },
};

const noisyNeighborRelaxInput: BrandNarrativeMatchInput = {
  decision: {
    contextId: 'Estilo de Vida e Bem-Estar',
    proposalId: 'rotina real',
    toneId: 'humor cotidiano',
    narrativeId: 'pov',
    intentId: 'conectar',
    formatId: 'reels',
    themeId: 'Estilo de Vida e Bem-Estar',
  },
  pauta: {
    title: 'Quando você se deita pra relaxar e o vizinho liga o som',
    description:
      'Pauta de humor cotidiano sobre tentativa de descanso interrompida por barulho, vizinho, som alto, ruído doméstico e rotina real.',
    reason: 'Mostrar tentativa frustrada de relaxar, ruído doméstico, casa barulhenta e pausa interrompida.',
    theme: 'Estilo de Vida e Bem-Estar',
    keywords: ['relaxar', 'vizinho', 'som', 'barulho', 'descanso', 'ruído', 'casa', 'conforto', 'humor cotidiano'],
  },
  categories: {
    context: ['Estilo de Vida e Bem-Estar'],
    narrativeForm: ['pov', 'humor cotidiano', 'rotina real'],
    contentIntent: ['conectar', 'gerar identificação'],
    contentSignals: ['humor cotidiano', 'rotina real', 'pausa interrompida', 'caos doméstico'],
    proofStyle: ['experiência real', 'uso cotidiano'],
    commercialMode: ['produto em uso real', 'experiência', 'rotina doméstica'],
  },
  limit: 6,
};

describe('brandNarrativeMatcher', () => {
  it('normaliza removendo acentos e caixa alta', () => {
    expect(normalizeNarrativeTerm('  PREPARAÇÃO   para CORRIDAS  ')).toBe('preparacao para corrida');
    expect(normalizeNarrativeTerm('tênis de corrida')).toBe('tenis de corrida');
  });

  it('classifica Adidas como match alto para pauta de corrida', () => {
    const match = scoreBrandNarrativeMatch(makeBrand(adidasSeed), smokeRunningInput);

    expect(match?.brandName).toBe('Adidas');
    expect(match?.matchLevel).toBe('alto');
    expect(match?.matchedSignals).toEqual(
      expect.arrayContaining(['prova esportiva', 'corrida de rua'])
    );
    expect(match?.matchedSignals).not.toContain('preparacao');
  });

  it('penaliza marca com avoidContext relevante', () => {
    const baseBrand = makeBrand(adidasSeed);
    const penalizedBrand = makeBrand(adidasSeed, {
      avoidContexts: ['corrida', 'preparação', 'meia maratona'],
    });

    const base = scoreBrandNarrativeMatch(baseBrand, runningInput);
    const penalized = scoreBrandNarrativeMatch(penalizedBrand, runningInput);

    expect(base?.matchScore).toBeGreaterThan(penalized?.matchScore ?? 0);
  });

  it('respeita limit e ordena por score desc', () => {
    const matches = rankBrandNarrativeMatches(
      [makeBrand(naturaSeed), makeBrand(adidasSeed), makeBrand(nikeSeed)],
      runningInput,
      2
    );

    expect(matches).toHaveLength(2);
    expect(matches[0]!.matchScore).toBeGreaterThanOrEqual(matches[1]!.matchScore);
    expect(matches.map((match) => match.brandName)).toContain('Adidas');
  });

  it('prioriza marcas esportivas para payload de corrida e meia maratona do smoke', () => {
    const expectedSportBrands = new Set([
      'Adidas',
      'Nike',
      'Asics',
      'Garmin',
      'Olympikus',
      'Decathlon',
      'Gatorade',
      'Track&Field',
      'Centauro',
      'Strava',
    ]);
    const brands = BRAND_NARRATIVE_SEED.map((seed) => makeBrand(seed));
    const matches = rankBrandNarrativeMatches(brands, smokeRunningInput, 6);
    const brandNames = matches.map((match) => match.brandName);

    expect(matches).toHaveLength(6);
    expect(brandNames.every((brandName) => expectedSportBrands.has(brandName))).toBe(true);
    expect(brandNames).not.toContain('Natura');
    expect(matches[0]!.matchScore).toBeLessThan(1);
    expect(matches.flatMap((match) => match.matchedSignals)).toEqual(
      expect.arrayContaining(['corrida de rua', 'treino'])
    );
  });

  it('não coloca Natura acima de marcas esportivas para corrida', () => {
    const natura = scoreBrandNarrativeMatch(makeBrand(naturaSeed), smokeRunningInput);
    const sportMatches = [adidasSeed, nikeSeed]
      .map((seed) => scoreBrandNarrativeMatch(makeBrand(seed), smokeRunningInput))
      .filter(Boolean);

    expect(natura?.matchLevel).not.toBe('alto');
    for (const sportMatch of sportMatches) {
      expect(sportMatch!.matchScore).toBeGreaterThan(natura?.matchScore ?? 0);
    }
  });

  it('limita marca sem âncora de domínio em pauta esportiva clara', () => {
    const genericBrand = makeBrand(naturaSeed, {
      brandName: 'Marca Genérica',
      slug: 'marca-generica',
      category: ['lifestyle'],
      subcategories: ['rotina'],
      territories: ['rotina', 'experiencia', 'jornada', 'preparacao', 'bem-estar'],
      contexts: ['rotina', 'preparacao', 'experiencia real'],
      products: ['kit de rotina'],
      campaignKeywords: ['jornada', 'preparacao', 'experiencia'],
      confidenceScore: 0.95,
    });

    const match = scoreBrandNarrativeMatch(genericBrand, smokeRunningInput);

    expect(match?.matchScore).toBeLessThanOrEqual(0.55);
    expect(match?.matchLevel).not.toBe('alto');
  });

  it('termos genéricos sozinhos não geram match alto', () => {
    const genericInput: BrandNarrativeMatchInput = {
      pauta: {
        title: 'Jornada de rotina, preparação e experiência real',
        description: 'Conteúdo sobre inspiração, cuidado, transformação e conexão humana.',
        keywords: ['rotina', 'experiência', 'jornada', 'preparação', 'cuidado'],
      },
      categories: {
        narrativeForm: ['jornada'],
        contentIntent: ['inspirar', 'demonstrar experiencia'],
        contentSignals: ['rotina', 'preparacao'],
      },
    };
    const genericBrand = makeBrand(naturaSeed, {
      territories: ['rotina', 'experiencia', 'jornada', 'preparacao', 'cuidado'],
      contexts: ['rotina', 'experiencia real'],
      contentSignals: ['rotina', 'preparacao'],
      campaignKeywords: ['jornada', 'experiencia', 'cuidado'],
      confidenceScore: 0.95,
    });

    const match = scoreBrandNarrativeMatch(genericBrand, genericInput);

    expect(match?.matchScore).toBeLessThan(0.7);
    expect(match?.matchLevel).not.toBe('alto');
  });

  it('não promove tokens genéricos como sinais principais', () => {
    const genericInput: BrandNarrativeMatchInput = {
      pauta: {
        title: 'Bem-estar, vida e resultado da semana',
        description: 'Uma pauta sobre estar bem, base de rotina, dia a dia e experiência real.',
        keywords: ['bem-estar', 'vida', 'base', 'semana', 'resultado', 'estar'],
      },
      categories: {
        contentSignals: ['rotina'],
        contentIntent: ['inspirar'],
      },
    };
    const genericBrand = makeBrand(naturaSeed, {
      category: ['lifestyle'],
      subcategories: ['rotina'],
      territories: ['bem-estar', 'vida', 'resultado', 'rotina', 'experiencia'],
      contexts: ['dia a dia', 'semana', 'estar bem'],
      narrativeForms: ['jornada'],
      contentIntents: ['inspirar'],
      contentSignals: ['rotina'],
      tones: ['humano'],
      proofStyles: ['experiencia real'],
      commercialModes: ['produto em uso'],
      products: ['base'],
      campaignKeywords: ['base', 'vida', 'bem-estar'],
      insertionIdeas: ['rotina'],
      confidenceScore: 0.95,
    });

    const match = scoreBrandNarrativeMatch(genericBrand, genericInput);

    expect(match?.matchLevel).toBe('baixo');
    expect(match?.matchedSignals).not.toEqual(
      expect.arrayContaining(['estar', 'vida', 'bem', 'base', 'bem estar'])
    );
  });

  it('reconhece pauta de relaxamento e celular como lifestyle wellness com matches úteis', () => {
    const brands = BRAND_NARRATIVE_SEED.map((seed) => makeBrand(seed));
    const matches = rankBrandNarrativeMatches(brands, wellnessDigitalInput, 6);
    const panelVisibleMatches = matches.filter((match) => match.matchLevel === 'alto' || match.matchLevel === 'medio');
    const signals = panelVisibleMatches.flatMap((match) => match.matchedSignals);

    expect(panelVisibleMatches.length).toBeGreaterThan(0);
    expect(panelVisibleMatches.every((match) => match.matchLevel !== 'baixo')).toBe(true);
    expect(signals).not.toEqual(expect.arrayContaining(['bem', 'estar', 'vida']));
    expect(signals.some((signal) =>
      ['relaxar', 'celular', 'smartphone', 'autocuidado', 'rotina saudavel', 'tecnologia', 'rotina digital'].includes(signal)
    )).toBe(true);
  });

  it('considera tecnologia cotidiana para pauta de celular e notificações', () => {
    const samsung = scoreBrandNarrativeMatch(makeBrand(samsungSeed), wellnessDigitalInput);

    expect(samsung?.matchLevel).not.toBe('baixo');
    expect(samsung?.matchedSignals).toEqual(
      expect.arrayContaining(['celular'])
    );
    expect(samsung?.insertionAngle).toContain('tecnologia faz parte da rotina');
  });

  it('considera autocuidado e bem-estar para pauta de relaxamento', () => {
    const natura = scoreBrandNarrativeMatch(makeBrand(naturaSeed), wellnessDigitalInput);
    const mundoVerde = scoreBrandNarrativeMatch(makeBrand(mundoVerdeSeed), wellnessDigitalInput);

    expect(natura?.matchLevel).not.toBe('baixo');
    expect(natura?.matchedSignals).toEqual(expect.arrayContaining(['autocuidado']));
    expect(mundoVerde?.matchLevel).not.toBe('baixo');
    expect(mundoVerde?.matchedSignals.length).toBeGreaterThan(0);
  });

  it('não gera match alto para rotina genérica da semana sem domínio claro', () => {
    const genericWeeklyInput: BrandNarrativeMatchInput = {
      pauta: {
        title: 'Minha rotina da semana',
        description: 'Pauta simples sobre vida, dia a dia e bastidores da rotina.',
        theme: 'rotina',
        keywords: ['rotina', 'semana', 'vida'],
      },
      categories: {
        contentSignals: ['rotina'],
      },
    };
    const matches = rankBrandNarrativeMatches(BRAND_NARRATIVE_SEED.map((seed) => makeBrand(seed)), genericWeeklyInput, 6);

    expect(matches.every((match) => match.matchLevel !== 'alto')).toBe(true);
    expect(matches.flatMap((match) => match.matchedSignals)).not.toEqual(expect.arrayContaining(['bem', 'estar', 'vida']));
  });

  it('não promove marca esportiva para pauta de descanso interrompido por vizinho e som', () => {
    const asics = scoreBrandNarrativeMatch(makeBrand(asicsSeed), noisyNeighborRelaxInput);
    const matches = rankBrandNarrativeMatches(BRAND_NARRATIVE_SEED.map((seed) => makeBrand(seed)), noisyNeighborRelaxInput, 6);
    const panelVisibleMatches = matches.filter((match) => match.matchLevel === 'alto' || match.matchLevel === 'medio');

    expect(asics?.matchLevel).toBe('baixo');
    expect(asics?.matchScore).toBeLessThan(0.4);
    expect(panelVisibleMatches.map((match) => match.brandName)).not.toContain('Asics');
  });

  it('retorna marcas coerentes para barulho, vizinho, som e descanso interrompido', () => {
    const matches = rankBrandNarrativeMatches(BRAND_NARRATIVE_SEED.map((seed) => makeBrand(seed)), noisyNeighborRelaxInput, 6);
    const panelVisibleMatches = matches.filter((match) => match.matchLevel === 'alto' || match.matchLevel === 'medio');
    const brandNames = panelVisibleMatches.map((match) => match.brandName);
    const signals = panelVisibleMatches.flatMap((match) => match.matchedSignals);

    expect(panelVisibleMatches.length).toBeGreaterThan(0);
    expect(brandNames).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Sony|JBL|Bose|Philips|Emma Colchão|Zissou|Leroy Merlin|Natura|O Boticário|L'Oréal Paris|Samsung|Apple|Motorola/),
      ])
    );
    expect(signals).toEqual(expect.arrayContaining(['barulho', 'vizinho', 'som']));
    expect(signals).not.toEqual(['relaxar']);
  });

  it('relaxar sozinho não sustenta match médio ou alto', () => {
    const relaxOnlyInput: BrandNarrativeMatchInput = {
      pauta: {
        title: 'Quero relaxar',
        description: 'Uma pauta simples sobre relaxar sem contexto específico.',
        keywords: ['relaxar'],
      },
      categories: {
        context: ['Estilo de Vida e Bem-Estar'],
      },
    };
    const matches = rankBrandNarrativeMatches(
      [naturaSeed, boticarioSeed, lorealSeed, asicsSeed].map((seed) => makeBrand(seed)),
      relaxOnlyInput,
      4
    );

    expect(matches.every((match) => match.matchLevel === 'baixo')).toBe(true);
  });

  it('barulho, vizinho, som e descanso geram domínio específico de ruído e conforto', () => {
    const sony = scoreBrandNarrativeMatch(makeBrand(sonySeed), noisyNeighborRelaxInput);
    const jbl = scoreBrandNarrativeMatch(makeBrand(jblSeed), noisyNeighborRelaxInput);

    expect(sony?.matchLevel).not.toBe('baixo');
    expect(jbl?.matchLevel).not.toBe('baixo');
    expect(sony?.matchedSignals).toEqual(expect.arrayContaining(['barulho', 'som']));
    expect(sony?.rationale).toContain('descanso interrompido pelo som do vizinho');
  });

  it('diferencia justificativas e entregáveis para marcas de autocuidado em pauta de obra e pausa interrompida', () => {
    const matches = [naturaSeed, boticarioSeed, lorealSeed]
      .map((seed) => scoreBrandNarrativeMatch(makeBrand(seed), wellnessChaosInput))
      .filter(Boolean);
    const [natura, boticario, loreal] = matches;

    expect(matches).toHaveLength(3);
    expect(matches.every((match) => match!.matchLevel === 'alto' || match!.matchLevel === 'medio')).toBe(true);
    expect(new Set(matches.map((match) => match!.rationale)).size).toBe(3);
    expect(new Set(matches.map((match) => match!.insertionAngle)).size).toBe(3);
    expect(new Set(matches.map((match) => match!.suggestedDeliverables.join('|'))).size).toBe(3);

    expect(natura!.rationale).toContain('autocuidado natural');
    expect(boticario!.rationale).toContain('fragrância');
    expect(loreal!.rationale).toContain('pele ou cabelo');
    expect(natura!.insertionAngle).toContain('barulho da obra');
    expect(boticario!.insertionAngle).toContain('caos doméstico');
    expect(loreal!.insertionAngle).toContain('obra acontecendo');

    for (const match of matches) {
      expect(match!.matchedSignals).toEqual(
        expect.arrayContaining(['obra', 'barulho'])
      );
      expect(match!.matchedSignals).not.toEqual(expect.arrayContaining(['bem', 'estar', 'vida']));
      expect(match!.suggestedDeliverables).toEqual(
        expect.arrayContaining([
          '1 Reels narrativo com tentativa de pausa interrompida pela obra',
        ])
      );
    }
  });

  it('não promove marca infantil para pauta de autocuidado adulto sem sinal de bebê ou família', () => {
    const johnsonsBaby = scoreBrandNarrativeMatch(makeBrand(johnsonsBabySeed), wellnessChaosInput);
    const adultCareMatches = [naturaSeed, boticarioSeed, lorealSeed]
      .map((seed) => scoreBrandNarrativeMatch(makeBrand(seed), wellnessChaosInput))
      .filter(Boolean);
    const rankedMatches = rankBrandNarrativeMatches(
      [naturaSeed, boticarioSeed, lorealSeed, johnsonsBabySeed].map((seed) => makeBrand(seed)),
      wellnessChaosInput,
      4
    );

    expect(johnsonsBaby?.matchLevel).toBe('baixo');
    expect(johnsonsBaby?.matchScore).toBeLessThan(0.4);
    expect(adultCareMatches.every((match) => match!.matchLevel === 'medio' || match!.matchLevel === 'alto')).toBe(true);
    expect(adultCareMatches.every((match) => match!.matchScore > (johnsonsBaby?.matchScore ?? 0))).toBe(true);
    expect(rankedMatches.slice(0, 3).map((match) => match.brandName)).not.toContain("Johnson's Baby");
  });

  it('permite marca infantil quando a pauta tem âncora de bebê ou família', () => {
    const johnsonsBaby = scoreBrandNarrativeMatch(makeBrand(johnsonsBabySeed), wellnessFamilyChaosInput);

    expect(johnsonsBaby?.matchLevel).not.toBe('baixo');
    expect(johnsonsBaby?.matchedSignals).toEqual(
      expect.arrayContaining(['bebe'])
    );
  });

  it('inclui disclaimer em todos os resultados', () => {
    const matches = rankBrandNarrativeMatches([makeBrand(adidasSeed), makeBrand(nikeSeed)], runningInput, 2);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches.every((match) => match.disclaimer === BRAND_NARRATIVE_MATCH_DISCLAIMER)).toBe(true);
  });
});
