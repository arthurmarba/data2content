import { hasPubliCaptionIndicator } from '@/app/lib/publisCaptionDetector';

describe('hasPubliCaptionIndicator', () => {
  it('detecta variações válidas de publi na legenda', () => {
    const positives = [
      'Essa e uma publi com marca parceira.',
      '#publi',
      '#publis da semana',
      'publipost de hoje',
      'publi post com cupom',
      'publi-post especial',
      'conteudo publipubli para campanha',
      'Parceria #Publi com @marca',
      '*publi* com cupom',
      '**publi** de hoje',
      '*publi post* para campanha',
      'p*u*b*l*i com marca',
    ];

    for (const caption of positives) {
      expect(hasPubliCaptionIndicator(caption)).toBe(true);
    }
  });

  it('nao marca termos fora do indicador publi', () => {
    const negatives = [
      'publicidade institucional da empresa',
      'conteudo patrocinado',
      '#ad com desconto',
      'parceria remunerada',
      'sou publicitario e criador',
      '',
      'post normal sem indicador',
    ];

    for (const caption of negatives) {
      expect(hasPubliCaptionIndicator(caption)).toBe(false);
    }
  });

  it('retorna false para nulo ou indefinido', () => {
    expect(hasPubliCaptionIndicator(null)).toBe(false);
    expect(hasPubliCaptionIndicator(undefined)).toBe(false);
  });
});
