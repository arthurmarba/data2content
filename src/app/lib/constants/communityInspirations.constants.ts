// @/app/lib/constants/communityInspirations.constants.ts
// v1.0.1 - Adiciona exportação dos valores padrão dos Enums.
// Baseado na v1.0.0

// --- FORMATOS DE CONTEÚDO ---
export const VALID_FORMATS = [
  "Reel",
  "Foto",
  "Carrossel",
  "Story",
  "Live",
  "Vídeo Longo",
  "Outro Formato",
  "Desconhecido"
] as const;
export type FormatType = typeof VALID_FORMATS[number];
export const DEFAULT_FORMAT_ENUM: FormatType = "Desconhecido"; // NOVO: Exportando default

// --- PROPÓSITOS / INTENÇÕES DO CONTEÚDO ---
export const VALID_PROPOSALS = [
  "Dicas",
  "Review",
  "Trend",
  "Humor/Cena",
  "Clipe",
  "Mensagem/Motivacional",
  "Posicionamento/Autoridade",
  "Chamada",
  "React",
  "Participação",
  "Publi/Divulgação",
  "LifeStyle",
  "Bastidores",
  "Notícia",
  "Outro Propósito"
] as const;
export type ProposalType = typeof VALID_PROPOSALS[number];
export const DEFAULT_PROPOSAL_ENUM: ProposalType = "Outro Propósito"; // NOVO: Exportando default

// --- CONTEXTOS / NICHOS / TÓPICOS DO CONTEÚDO ---
export const VALID_CONTEXTS = [
  "Beleza/Cuidados Pessoais",
  "Moda/Estilo",
  "LifeStyle/Rotina",
  "Relacionamentos/Família",
  "Fitness/Esporte",
  "Alimentação/Culinária",
  "Viagem/Turismo",
  "Parentalidade",
  "Casa/Decor/DIY",
  "Tecnologia/Digital",
  "Finanças",
  "Carreira/Trabalho",
  "Saúde/Bem-Estar",
  "Arte/Cultura",
  "Mídia/Entretenimento",
  "Automotivo",
  "Natureza/Animais",
  "Eventos/Celebrações",
  "Social/Causas/Religião",
  "Desenvolvimento Pessoal",
  "Geral",
  "Outro Contexto"
] as const;
export type ContextType = typeof VALID_CONTEXTS[number];
export const DEFAULT_CONTEXT_ENUM: ContextType = "Geral"; // NOVO: Exportando default

// --- OBJETIVOS QUALITATIVOS PRIMÁRIOS ALCANÇADOS ---
export const VALID_QUALITATIVE_OBJECTIVES = [
  'gerou_muitos_salvamentos',
  'alcance_expansivo_organico',
  'fomentou_discussao_rica',
  'alcancou_nova_audiencia',
  'manteve_atencao_da_audiencia',
  'desempenho_geral_interessante',
  'engajamento_inicial',
  'analise_qualitativa_do_conteudo',
  'outro_objetivo_qualitativo'
] as const;
export type QualitativeObjectiveType = typeof VALID_QUALITATIVE_OBJECTIVES[number];
export const DEFAULT_QUALITATIVE_OBJECTIVE_ENUM: QualitativeObjectiveType = "desempenho_geral_interessante"; // NOVO: Exportando default

// --- DESTAQUES QUALITATIVOS DE PERFORMANCE ---
export const VALID_PERFORMANCE_HIGHLIGHTS = [
  'excelente_para_gerar_salvamentos',
  'viralizou_nos_compartilhamentos',
  'alto_engajamento_nos_comentarios',
  'alcance_superior_a_media_de_seguidores',
  'excelente_retencao_em_reels',
  'boa_receptividade_curtidas',
  'sem_metricas_detalhadas_para_analise',
  'baixo_volume_de_dados',
  'desempenho_padrao',
  'outro_destaque_qualitativo'
] as const;
export type PerformanceHighlightType = typeof VALID_PERFORMANCE_HIGHLIGHTS[number];
export const DEFAULT_PERFORMANCE_HIGHLIGHT_ENUM: PerformanceHighlightType = "desempenho_padrao"; // NOVO: Exportando default
