// src/app/models/DailyMetric.ts

import { Schema, model, models } from "mongoose";

/**
 * DailyMetric:
 * Representa um snapshot de métricas diárias (ou de um post específico) 
 * usando a data real de publicação do conteúdo como referência.
 *
 * - user: referência ao User dono das métricas.
 * - postDate: data efetiva do post (não a data de inserção no banco).
 * - stats: objeto contendo todos os campos gerados pelo `calcFormulas` 
 *          (somas, taxas, porcentagens, etc.).
 */
const dailyMetricSchema = new Schema(
  {
    // Referência ao usuário (autor/criador do conteúdo)
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /**
     * postDate:
     * Em vez de "date: { default: Date.now }", armazenamos a data real de publicação do post.
     * Por exemplo, se o post foi publicado em "2023-04-15", você converte a string para Date 
     * e salva aqui. Isso facilita análises por data real do conteúdo.
     */
    postDate: {
      type: Date,
      required: true,
    },

    /**
     * stats: Campos calculados pelo Document AI + `calcFormulas`.
     * Armazena valores absolutos (ex.: curtidas, comentários) e também porcentagens (ex.: taxaEngajamento).
     * Cada campo tem um default de 0 (ou null) para evitar problemas em agregações.
     */
    stats: {
      // ----- Somas (valores absolutos) -----
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

      // dataPublicacao original do Document AI (opcional)
      dataPublicacao: { type: String, default: null },
      daysSincePublication: { type: Number, default: 0 },

      totalInteracoes: { type: Number, default: 0 },

      // ----- Taxas e Porcentagens -----
      taxaEngajamento: { type: Number, default: 0 }, // 0–100
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
    // Se quiser armazenar createdAt/updatedAt automaticamente, use:
    // timestamps: true,
    // Caso não precise, mantenha false ou remova a opção.
    timestamps: false,
  }
);

// Índice para consultas rápidas por usuário e data (por exemplo, últimos 7 ou 30 dias)
dailyMetricSchema.index({ user: 1, postDate: -1 });

/**
 * Evita recriar o modelo em dev/hot reload (ambiente de desenvolvimento).
 * Se já existir "DailyMetric" no models, utiliza-o; caso contrário, cria.
 */
export const DailyMetric = models.DailyMetric || model("DailyMetric", dailyMetricSchema);
