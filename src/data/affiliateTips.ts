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
    description: 'Deixe o link do mídia kit na bio explicando que o indicado ganha 10% de desconto na primeira fatura.',
    buildCopy: (link) =>
      `Atualizei minha bio com meu mídia kit do Mobi: ${link}. Quem ativa por ali entra com 10% de desconto na primeira fatura e já vê como uso o painel.`,
  },
  {
    id: 'stories',
    emoji: '🎥',
    title: 'Stories com contexto',
    description: 'Mostre seus resultados nos stories e em seguida compartilhe o link com o benefício.',
    buildCopy: (link) =>
      `Mostrando como planejo meus conteúdos no Mobi. Se quiser testar com 10% off na primeira fatura e ter mídia kit pronto, usa meu link: ${link}. Te ajudo no onboarding!`,
  },
  {
    id: 'groups',
    emoji: '💬',
    title: 'Grupos e comunidades',
    description: 'Envie o link pronto quando alguém pedir ferramenta para métricas/mídia kit.',
    buildCopy: (link) =>
      `Pra quem queria uma ferramenta completa de mídia kit + análises: eu uso o Mobi. Pelo meu link ${link} você ativa com 10% de desconto na primeira fatura e já recebe meu kit de referência.`,
  },
  {
    id: 'mentoria',
    emoji: '🤝',
    title: 'Mentorias e 1:1',
    description: 'Convide pessoalmente e ofereça ajuda para montar o painel e o kit.',
    buildCopy: (link) =>
      `Quer testar o Mobi comigo? Entra por ${link}, garante 10% de desconto na primeira fatura e eu te mostro como uso os alertas no WhatsApp e o mídia kit para falar com marcas (dúvidas com IA ficam no Chat AI do app).`,
  },
];
