import {
  canonicalizeCategoryValues,
  contextCategories,
  findCategoryMatchesAcrossTypes,
  getCategoryByValue,
  getStoredCategoryFilterValues,
  getCategoryWithSubcategoryIds,
  idsToLabels,
  isValidCategoryId,
  toCanonicalCategoryId,
} from '@/app/lib/classification';

describe('classification canonicalization', () => {
  it('resolves context aliases, separators and labels to one canonical id', () => {
    expect(toCanonicalCategoryId('Moda/Estilo', 'context')).toBe('fashion_style');
    expect(toCanonicalCategoryId('moda estilo', 'context')).toBe('fashion_style');
    expect(toCanonicalCategoryId('fashion_style', 'context')).toBe('fashion_style');
    expect(toCanonicalCategoryId('lifestyle_and_wellbeing.fashion_style', 'context')).toBe('fashion_style');
    expect(toCanonicalCategoryId('lifestyle_and_wellbeing/fashion_style', 'context')).toBe('fashion_style');
    expect(toCanonicalCategoryId('lifestyle_and_wellbeing|fashion_style', 'context')).toBe('fashion_style');
  });

  it('collapses deprecated duplicate context ids into the canonical category', () => {
    expect(toCanonicalCategoryId('Relacionamentos e Família', 'context')).toBe('relationships_family');
    expect(toCanonicalCategoryId('personal_and_professional_relationships_family', 'context')).toBe('relationships_family');
    expect(toCanonicalCategoryId('personal_and_professional/relationships_family', 'context')).toBe('relationships_family');
  });

  it('exposes only one canonical relationships/family option in the context taxonomy', () => {
    const flatten = (categories: typeof contextCategories): Array<{ id: string; label: string }> =>
      categories.flatMap((category) => [
        { id: category.id, label: category.label },
        ...((category.subcategories ?? []).map((subcategory) => ({ id: subcategory.id, label: subcategory.label }))),
      ]);

    const relationshipOptions = flatten(contextCategories).filter(
      (category) => toCanonicalCategoryId(category.id, 'context') === 'relationships_family'
    );

    expect(relationshipOptions).toEqual([
      { id: 'relationships_family', label: 'Relacionamentos/Família' },
    ]);
  });

  it('resolves reference and tone aliases to canonical ids', () => {
    expect(toCanonicalCategoryId('geography.city', 'reference')).toBe('city');
    expect(toCanonicalCategoryId('geography/city', 'reference')).toBe('city');
    expect(toCanonicalCategoryId('geography_city', 'reference')).toBe('city');
    expect(toCanonicalCategoryId('geography.cidade', 'reference')).toBe('city');
    expect(toCanonicalCategoryId('geography#city', 'reference')).toBe('city');
    expect(toCanonicalCategoryId('geographycity', 'reference')).toBe('city');
    expect(toCanonicalCategoryId('promotional (Promocional/Comercial)', 'tone')).toBe('promotional');
  });

  it('resolves newly observed typo and separator aliases from quarantine', () => {
    expect(toCanonicalCategoryId('life_style', 'proposal')).toBe('lifestyle');
    expect(toCanonicalCategoryId('msg_motivational', 'proposal')).toBe('message_motivational');
    expect(toCanonicalCategoryId('eventos_celebrations', 'context')).toBe('events_celebrations');
    expect(toCanonicalCategoryId('lifestyle_and_wellbeing>beauty_personal_care', 'context')).toBe('beauty_personal_care');
    expect(toCanonicalCategoryId('lifestyle_and_wellbeing#fashion_style', 'context')).toBe('fashion_style');
    expect(toCanonicalCategoryId('personal_and_professional[parenting]', 'context')).toBe('parenting');
    expect(toCanonicalCategoryId('hobbies_and_interests.autos', 'context')).toBe('automotive');
  });

  it('canonicalizes arrays and drops unknown values for new writes', () => {
    expect(
      canonicalizeCategoryValues(
        ['Moda/Estilo', 'moda estilo', 'fashion_style', 'lifestyle_and_wellbeing.fashion_style', 'desconhecido'],
        'context'
      )
    ).toEqual(['fashion_style']);

    expect(canonicalizeCategoryValues(['announcement', 'Reel'], 'format')).toEqual(['reel']);
    expect(canonicalizeCategoryValues(['geography', 'city'], 'reference')).toEqual(['city']);
    expect(canonicalizeCategoryValues(['personal_and_professional', 'relationships_family'], 'context')).toEqual(['relationships_family']);
  });

  it('maps legacy stored values back to canonical labels during reads', () => {
    expect(idsToLabels(['lifestyle_and_wellbeing/fashion_style'], 'context')).toEqual(['Moda/Estilo']);
    expect(idsToLabels(['geography.city'], 'reference')).toEqual(['Cidade']);
    expect(idsToLabels(['promotional (Promocional/Comercial)'], 'tone')).toEqual(['Promocional/Comercial']);
  });

  it('makes validation and subcategory expansion work with canonicalized values', () => {
    expect(isValidCategoryId('moda estilo', 'context')).toBe(true);
    expect(getCategoryByValue('lifestyle_and_wellbeing.fashion_style', 'context')?.id).toBe('fashion_style');
    expect(getCategoryWithSubcategoryIds('Moda/Estilo', 'context')).toEqual(['fashion_style']);
  });

  it('builds stored filter values that work for canonical ids and legacy labels', () => {
    expect(getStoredCategoryFilterValues('Moda/Estilo', 'context')).toEqual(['fashion_style', 'Moda/Estilo']);
    expect(getStoredCategoryFilterValues('Reel', 'format')).toEqual(['reel', 'Reel']);
  });

  it('finds category matches across dimensions for quarantined residue', () => {
    expect(findCategoryMatchesAcrossTypes('announcement')).toEqual([
      { type: 'proposal', id: 'announcement', label: 'Anúncio' },
    ]);
    expect(findCategoryMatchesAcrossTypes('neutral')).toEqual([
      { type: 'tone', id: 'neutral', label: 'Neutro/Descritivo' },
    ]);
    expect(findCategoryMatchesAcrossTypes('desconhecido')).toEqual([]);
  });
});
