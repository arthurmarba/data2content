export type AffiliateTipTemplate = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  buildCopy: (link: string, code?: string | null) => string;
};

export const AFFILIATE_TIP_TEMPLATES: AffiliateTipTemplate[] = [
  {
    id: 'bio',
    emoji: '🔗',
    title: 'Bio do Instagram',
    description: 'Deixe o link do seu mídia kit na bio e convide outros criadores a conhecer a Data2Content.',
    buildCopy: (link) =>
      `Atualizei minha bio com meu mídia kit da Data2Content: ${link}. Por ali você conhece a plataforma e já vê como uso o painel.`,
  },
  {
    id: 'stories',
    emoji: '🎥',
    title: 'Stories com contexto',
    description: 'Mostre seus resultados nos stories e em seguida compartilhe o link com o benefício.',
    buildCopy: (link) =>
      `Mostrando como planejo meus conteúdos na Data2Content. Se quiser conhecer a plataforma e ter um mídia kit pronto, use meu link: ${link}.`,
  },
  {
    id: 'groups',
    emoji: '💬',
    title: 'Grupos e comunidades',
    description: 'Envie o link pronto quando alguém pedir ferramenta para métricas/mídia kit.',
    buildCopy: (link) =>
      `Para quem procura mídia kit e análises de conteúdo em um só lugar: eu uso a Data2Content. Pelo meu link ${link} você conhece a plataforma e vê meu kit como referência.`,
  },
  {
    id: 'mentoria',
    emoji: '🤝',
    title: 'Mentorias e 1:1',
    description: 'Convide pessoalmente e ofereça ajuda para montar o painel e o kit.',
    buildCopy: (link) =>
      `Quer conhecer a Data2Content comigo? Entre por ${link} e eu te mostro como uso o mídia kit e as análises para conversar com marcas.`,
  },
];
