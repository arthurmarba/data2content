import {
  buildMediaKitMetaDescription,
  buildMediaKitMetaTitle,
  formatCompactCount,
  formatIntegerCount,
  normalizePreviewUsername,
  toNonNegativeInt,
} from './socialPreview';

describe('socialPreview helpers', () => {
  it('normaliza username removendo arrobas extras', () => {
    expect(normalizePreviewUsername('@@clara_lemkova')).toBe('clara_lemkova');
    expect(normalizePreviewUsername('   ')).toBeNull();
  });

  it('normaliza números não negativos para inteiro', () => {
    expect(toNonNegativeInt(1987.8)).toBe(1988);
    expect(toNonNegativeInt(-3)).toBeNull();
    expect(toNonNegativeInt(undefined)).toBeNull();
  });

  it('formata contagens para compacta e inteira', () => {
    expect(formatCompactCount(564000)).toMatch(/564[\s\u00A0]?mil/i);
    expect(formatIntegerCount(197)).toBe('197');
  });

  it('gera título e descrição com identidade social', () => {
    const title = buildMediaKitMetaTitle('Clara Lemkova', 'claralemkova_');
    const description = buildMediaKitMetaDescription({
      displayName: 'Clara Lemkova',
      username: 'claralemkova_',
      followersCount: 564000,
      mediaCount: 197,
      biography: 'Veja as fotos e vídeos da Clara.',
    });

    expect(title).toBe('Mídia Kit de Clara Lemkova (@claralemkova_)');
    expect(description).toContain('@claralemkova_');
    expect(description).toMatch(/564[\s\u00A0]?mil seguidores/i);
    expect(description).toContain('197 publicações');
    expect(description.length).toBeLessThanOrEqual(160);
  });

  it('usa fallback quando não há dados sociais', () => {
    const description = buildMediaKitMetaDescription({
      displayName: 'Criador Teste',
      biography: '',
    });
    expect(description).toBe('Dados de desempenho e publicações de destaque de Criador Teste.');
  });
});
