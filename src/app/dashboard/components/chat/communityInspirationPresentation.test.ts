import {
  buildCommunityHeaderMeta,
  buildCommunityInspirationMetaTags,
  buildCommunityQuickActions,
} from './communityInspirationPresentation';

describe('communityInspirationPresentation', () => {
  it('prioritizes strategic labels over legacy taxonomy labels', () => {
    expect(
      buildCommunityInspirationMetaTags({
        id: '1',
        proposal: 'Review comparativo',
        context: 'Moda/Estilo',
        format: 'Reel',
        contentIntent: 'convert',
        narrativeForm: 'review',
        proofStyle: 'demonstration',
        stance: 'endorsing',
        commercialMode: 'paid_partnership',
        contentSignals: ['comment_cta'],
        tone: 'neutral',
        reference: 'pop_culture_movies_series',
        primaryObjective: 'gerou_muitos_salvamentos',
        source: 'community',
        narrativeRole: 'gancho',
      })
    ).toEqual([
      'Resultado: Gerou Muitos Salvamentos',
      'Objetivo: Converter',
      'Narrativa: Review',
      'Tema: Moda/Estilo',
      'Prova: Demonstracao',
      'Papel: Gancho',
      'Formato: Reel',
      'Postura: Endossando',
      'Comercial: Parceria Paga',
      'Sinais: CTA de Comentario',
      'Tom: Neutro',
      'Referência: Filmes e Séries',
    ]);
  });

  it('builds header chips and quick actions with neutral wording', () => {
    const fallback = {
      id: '2',
      proposal: 'Bastidores',
      context: 'Casa/Decor/DIY',
      format: 'Carousel',
      contentIntent: 'connect',
      narrativeForm: 'behind_the_scenes',
      source: 'community' as const,
    };

    expect(
      buildCommunityHeaderMeta({
        filters: { primaryObjective: 'analise_qualitativa_do_conteudo', contentIntent: 'connect' },
        fallback,
        personalizedByUserPerformance: true,
      })
    ).toEqual([
      'Resultado: Analise Qualitativa Do Conteudo',
      'Objetivo: Conectar/Relacionar',
      'Narrativa: Bastidores',
      'Tema: Casa/Decor/DIY',
      'Formato: Carrossel',
      'Ranking: personalizado pelo seu histórico',
    ]);

    expect(buildCommunityQuickActions({ fallback })).toEqual([
      { label: 'Mais Conectar/Relacionar', prompt: 'Me traga mais inspirações com essa intenção: Conectar/Relacionar.' },
      { label: 'Mais Bastidores', prompt: 'Me traga mais inspirações com essa narrativa: Bastidores.' },
      { label: 'Mais Casa/Decor/DIY', prompt: 'Me traga mais inspirações nesse tema: Casa/Decor/DIY.' },
      { label: 'Mais Carrossel', prompt: 'Me traga mais inspirações em formato Carrossel.' },
      { label: 'Mais dessa proposta', prompt: 'Me traga mais inspirações nessa proposta: Bastidores.' },
    ]);
  });
});
