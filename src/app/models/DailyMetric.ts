import { Schema, model, models, Document, Types, Model } from "mongoose"; // Import Model

/**
 * IDailyMetric:
 * Interface que representa um documento de DailyMetric.
 */
export interface IDailyMetric extends Document {
  user: Types.ObjectId;
  postDate: Date;
  postId: Types.ObjectId; // <<< CORRIGIDO: Removido '?' - Agora é obrigatório >>>
  stats: {
    reproducoesTotais: number;
    reproducoesFacebook: number;
    reproducoes: number;
    reproducoesIniciais: number;
    repeticoes: number;

    interacoesTotais: number;
    interacoesReel: number;
    reacoesFacebook: number;
    curtidas: number;
    comentarios: number;
    compartilhamentos: number;
    salvamentos: number;

    impressoes: number;
    impressoesPaginaInicial: number;
    impressoesPerfil: number;
    impressoesOutraPessoa: number;
    impressoesExplorar: number;

    interacoes: number;
    interacoesSeguidores: number;
    interacoesNaoSeguidores: number;

    visualizacoes: number;
    visualizacoesSeguidores: number;
    visualizacoesNaoSeguidores: number;

    contasAlcancadas: number;
    contasAlcancadasSeguidores: number;
    contasAlcancadasNaoSeguidores: number;
    contasComEngajamento: number;
    contasComEngajamentoSeguidores: number;
    contasComEngajamentoNaoSeguidores: number;

    visitasPerfil: number;
    comecaramASeguir: number;

    tempoVisualizacao: number;
    duracao: number;
    tempoMedioVisualizacao: number;

    dataPublicacao: string | null; // Mantido como estava, embora pareça redundante com postDate
    daysSincePublication: number;

    totalInteracoes: number; // Mantido como estava

    taxaEngajamento: number;
    taxaReproducoesIniciais: number;
    taxaRepeticao: number;
    pctReproducoesFacebook: number;

    mediaDuracao: number;
    mediaTempoMedioVisualizacao: number;
    taxaRetencao: number;
    tempoVisualizacaoPorImpressao: number;
    tempoMedioVisualizacaoPorView: number;

    taxaConversaoSeguidores: number;
    pctSalvamentos: number;

    impressoesPorDia: number;
    interacoesTotaisPorDia: number;
    reproducoesTotaisPorDia: number;

    isReelCount: number;
    isPostCount: number;
    razaoReelsVsPosts: number;

    ratioLikeComment: number;
    ratioCommentShare: number;
    ratioSaveLike: number;

    ratioInteracaoSegNaoSeg: number;
    ratioVisSegNaoSeg: number;

    razaoExplorarPaginaInicial: number;

    engajamentoProfundoAlcance: number;
    engajamentoRapidoAlcance: number;
    ratioProfundoRapidoAlcance: number;

    indicePropagacao: number;
    viralidadePonderada: number;

    razaoSeguirAlcance: number;
    taxaEngajamentoNaoSeguidoresEmAlcance: number;
    taxaEngajamentoSeguidoresEmAlcance: number;
  };
}

/**
 * Schema de DailyMetric:
 * Representa um snapshot de métricas diárias (ou de um post específico)
 * usando a data real de publicação do conteúdo como referência.
 */
const dailyMetricSchema = new Schema<IDailyMetric>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    postDate: {
      type: Date,
      required: true,
    },
    postId: { // <<< CORRIGIDO: required agora é true >>>
      type: Schema.Types.ObjectId,
      ref: "Metric", // Certifique-se que 'Metric' é o nome correto do seu modelo de conteúdo
      required: true, // <<< ALTERADO PARA true >>>
      index: true,
    },
    stats: {
      // Definições dos campos de stats com defaults (mantidos como no original)
      reproducoesTotais: { type: Number, default: 0 },
      reproducoesFacebook: { type: Number, default: 0 },
      reproducoes: { type: Number, default: 0 },
      reproducoesIniciais: { type: Number, default: 0 },
      repeticoes: { type: Number, default: 0 },
      interacoesTotais: { type: Number, default: 0 },
      interacoesReel: { type: Number, default: 0 },
      reacoesFacebook: { type: Number, default: 0 },
      curtidas: { type: Number, default: 0 },
      comentarios: { type: Number, default: 0 },
      compartilhamentos: { type: Number, default: 0 },
      salvamentos: { type: Number, default: 0 },
      impressoes: { type: Number, default: 0 },
      impressoesPaginaInicial: { type: Number, default: 0 },
      impressoesPerfil: { type: Number, default: 0 },
      impressoesOutraPessoa: { type: Number, default: 0 },
      impressoesExplorar: { type: Number, default: 0 },
      interacoes: { type: Number, default: 0 },
      interacoesSeguidores: { type: Number, default: 0 },
      interacoesNaoSeguidores: { type: Number, default: 0 },
      visualizacoes: { type: Number, default: 0 },
      visualizacoesSeguidores: { type: Number, default: 0 },
      visualizacoesNaoSeguidores: { type: Number, default: 0 },
      contasAlcancadas: { type: Number, default: 0 },
      contasAlcancadasSeguidores: { type: Number, default: 0 },
      contasAlcancadasNaoSeguidores: { type: Number, default: 0 },
      contasComEngajamento: { type: Number, default: 0 },
      contasComEngajamentoSeguidores: { type: Number, default: 0 },
      contasComEngajamentoNaoSeguidores: { type: Number, default: 0 },
      visitasPerfil: { type: Number, default: 0 },
      comecaramASeguir: { type: Number, default: 0 },
      tempoVisualizacao: { type: Number, default: 0 },
      duracao: { type: Number, default: 0 },
      tempoMedioVisualizacao: { type: Number, default: 0 },
      dataPublicacao: { type: String, default: null },
      daysSincePublication: { type: Number, default: 0 },
      totalInteracoes: { type: Number, default: 0 },
      taxaEngajamento: { type: Number, default: 0 },
      taxaReproducoesIniciais: { type: Number, default: 0 },
      taxaRepeticao: { type: Number, default: 0 },
      pctReproducoesFacebook: { type: Number, default: 0 },
      mediaDuracao: { type: Number, default: 0 },
      mediaTempoMedioVisualizacao: { type: Number, default: 0 },
      taxaRetencao: { type: Number, default: 0 },
      tempoVisualizacaoPorImpressao: { type: Number, default: 0 },
      tempoMedioVisualizacaoPorView: { type: Number, default: 0 },
      taxaConversaoSeguidores: { type: Number, default: 0 },
      pctSalvamentos: { type: Number, default: 0 },
      impressoesPorDia: { type: Number, default: 0 },
      interacoesTotaisPorDia: { type: Number, default: 0 },
      reproducoesTotaisPorDia: { type: Number, default: 0 },
      isReelCount: { type: Number, default: 0 },
      isPostCount: { type: Number, default: 0 },
      razaoReelsVsPosts: { type: Number, default: 0 },
      ratioLikeComment: { type: Number, default: 0 },
      ratioCommentShare: { type: Number, default: 0 },
      ratioSaveLike: { type: Number, default: 0 },
      ratioInteracaoSegNaoSeg: { type: Number, default: 0 },
      ratioVisSegNaoSeg: { type: Number, default: 0 },
      razaoExplorarPaginaInicial: { type: Number, default: 0 },
      engajamentoProfundoAlcance: { type: Number, default: 0 },
      engajamentoRapidoAlcance: { type: Number, default: 0 },
      ratioProfundoRapidoAlcance: { type: Number, default: 0 },
      indicePropagacao: { type: Number, default: 0 },
      viralidadePonderada: { type: Number, default: 0 },
      razaoSeguirAlcance: { type: Number, default: 0 },
      taxaEngajamentoNaoSeguidoresEmAlcance: { type: Number, default: 0 },
      taxaEngajamentoSeguidoresEmAlcance: { type: Number, default: 0 },
    },
  },
  {
    timestamps: false,
  }
);

// Índice para consultas rápidas por usuário e data
dailyMetricSchema.index({ user: 1, postDate: -1 });
// Adicionado índice para postId (agora obrigatório)
dailyMetricSchema.index({ postId: 1 });


// Evita recriar o modelo em dev/hot reload
// CORRIGIDO: Usa Model<IDailyMetric> para tipagem correta
const DailyMetricModel: Model<IDailyMetric> =
  models.DailyMetric || model<IDailyMetric>("DailyMetric", dailyMetricSchema);

export { DailyMetricModel as DailyMetric };