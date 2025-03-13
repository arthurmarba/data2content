/**
 * Definimos o tipo do array de entrada como `Record<string, unknown>[]`
 * para evitar o uso de `any[]`. Cada item é um objeto com chaves string e valores desconhecidos.
 */
export function calcFormulas(
  rawDataArray: Record<string, unknown>[]
): Record<string, unknown> {
  // 1) Variáveis de soma
  let reproducoesTotais = 0;
  let reproducoesFacebook = 0;
  let reproducoes = 0;
  let reproducoesIniciais = 0;
  let repeticoes = 0;

  let interacoesTotais = 0;
  let interacoesReel = 0;
  let reacoesFacebook = 0;
  let curtidas = 0;
  let comentarios = 0;
  let compartilhamentos = 0;
  let salvamentos = 0;

  let impressoes = 0;
  let impressoesPaginaInicial = 0;
  let impressoesPerfil = 0;
  let impressoesOutraPessoa = 0;
  let impressoesExplorar = 0;

  let interacoes = 0;

  let visualizacoes = 0;
  let visualizacoesSeguidores = 0;
  let visualizacoesNaoSeguidores = 0;

  let contasAlcancadas = 0;
  let contasAlcancadasSeguidores = 0;
  let contasAlcancadasNaoSeguidores = 0;
  let contasComEngajamento = 0;
  let contasComEngajamentoSeguidores = 0;
  let contasComEngajamentoNaoSeguidores = 0;

  let visitasPerfil = 0;
  let comecaramASeguir = 0;

  let tempoVisualizacao = 0;
  let duracao = 0;
  let tempoMedioVisualizacao = 0;

  // Contagem de Reels vs. Posts
  let isReelCount = 0;
  let isPostCount = 0;

  // 2) Capturar Data de Publicação (pegando a mais antiga)
  let dataPublicacao: Date | null = null;

  // Função auxiliar para converter qualquer valor em número
  function asNumber(value: unknown): number {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value === "string") {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        return parsed;
      }
    }
    return 0;
  }

  // 3) Somar cada campo do rawDataArray
  rawDataArray.forEach((item) => {
    // Identifica se é reel ou post
    const itemType = item["type"] as string | undefined;
    if (itemType === "reel") {
      isReelCount++;
    } else if (itemType === "post") {
      isPostCount++;
    }

    reproducoesTotais += asNumber(item["Reproduções Totais"]);
    reproducoesFacebook += asNumber(item["Reproduções no Facebook"]);
    reproducoes += asNumber(item["Reproduções"]);
    reproducoesIniciais += asNumber(item["Reproduções Iniciais"]);
    repeticoes += asNumber(item["Repetições"]);

    interacoesTotais += asNumber(item["Interações Totais"]);
    interacoesReel += asNumber(item["Interações do Reel"]);
    reacoesFacebook += asNumber(item["Reações no Facebook"]);
    curtidas += asNumber(item["Curtidas"]);
    comentarios += asNumber(item["Comentários"]);
    compartilhamentos += asNumber(item["Compartilhamentos"]);
    salvamentos += asNumber(item["Salvamentos"]);

    impressoes += asNumber(item["Impressões"]);
    impressoesPaginaInicial += asNumber(item["Impressões na Página Inicial"]);
    impressoesPerfil += asNumber(item["Impressões no Perfil"]);
    impressoesOutraPessoa += asNumber(item["Impressões de Outra Pessoa"]);
    impressoesExplorar += asNumber(item["Impressões de Explorar"]);

    interacoes += asNumber(item["Interações"]);

    visualizacoes += asNumber(item["Visualizações"]);
    visualizacoesSeguidores += asNumber(item["Visualizações de Seguidores"]);
    visualizacoesNaoSeguidores += asNumber(item["Visualizações de Não Seguidores"]);

    contasAlcancadas += asNumber(item["Contas Alcançadas"]);
    contasAlcancadasSeguidores += asNumber(item["Contas Alcançadas de Seguidores"]);
    contasAlcancadasNaoSeguidores += asNumber(item["Contas Alcançadas de Não Seguidores"]);
    contasComEngajamento += asNumber(item["Contas com Engajamento"]);
    contasComEngajamentoSeguidores += asNumber(
      item["Contas com Engajamento de Seguidores"]
    );
    contasComEngajamentoNaoSeguidores += asNumber(
      item["Contas com Engajamento de Não Seguidores"]
    );

    visitasPerfil += asNumber(item["Visitas ao Perfil"]);
    comecaramASeguir += asNumber(item["Começaram a Seguir"]);

    tempoVisualizacao += asNumber(item["Tempo de Visualização"]);
    duracao += asNumber(item["Duração"]);
    tempoMedioVisualizacao += asNumber(item["Tempo Médio de Visualização"]);

    // Data de Publicação (mais antiga)
    const dateStr = item["Data de Publicação"];
    if (typeof dateStr === "string") {
      const parsedDate = parseDateString(dateStr);
      if (parsedDate && (!dataPublicacao || parsedDate < dataPublicacao)) {
        dataPublicacao = parsedDate;
      }
    }
  });

  // 4) Cálculos / taxas

  // Soma de curtidas+comentários+salvamentos+compartilhamentos
  const totalInteracoes = curtidas + comentarios + salvamentos + compartilhamentos;

  // Função auxiliar para transformar fração em %
  function toPercent(value: number) {
    return parseFloat((value * 100).toFixed(2));
  }

  // (I) Taxas de reproduções (em %)
  const taxaReproducoesIniciais =
    reproducoesTotais > 0 ? toPercent(reproducoesIniciais / reproducoesTotais) : 0;

  const taxaRepeticao =
    reproducoesTotais > 0 ? toPercent(repeticoes / reproducoesTotais) : 0;

  const pctReproducoesFacebook =
    reproducoesTotais > 0 ? toPercent(reproducoesFacebook / reproducoesTotais) : 0;

  // (II) Engajamento geral (impressões)
  const taxaEngajamento =
    impressoes > 0 ? toPercent(totalInteracoes / impressoes) : 0;

  // (III) Tempo de Visualização / Retenção
  const mediaDuracao =
    rawDataArray.length > 0 ? duracao / rawDataArray.length : 0;
  const mediaTempoMedioVisualizacao =
    rawDataArray.length > 0 ? tempoMedioVisualizacao / rawDataArray.length : 0;

  const taxaRetencao =
    mediaDuracao > 0
      ? toPercent(mediaTempoMedioVisualizacao / mediaDuracao)
      : 0;

  const tempoVisualizacaoPorImpressao =
    impressoes > 0 ? tempoVisualizacao / impressoes : 0;

  const tempoMedioVisualizacaoPorView =
    reproducoesTotais > 0 ? tempoVisualizacao / reproducoesTotais : 0;

  // (IV) Conversão / Crescimento
  const taxaConversaoSeguidores =
    visitasPerfil > 0 ? toPercent(comecaramASeguir / visitasPerfil) : 0;

  const pctSalvamentos =
    interacoesTotais > 0 ? toPercent(salvamentos / interacoesTotais) : 0;

  // (V) Cálculos diários (aprox.)
  let daysSincePublication = 0;
  let impressoesPorDia = 0;
  let interacoesTotaisPorDia = 0;
  let reproducoesTotaisPorDia = 0;

  if (dataPublicacao !== null) {
    const now = new Date();
    const diffMs = now.getTime() - (dataPublicacao as Date).getTime();
    daysSincePublication = diffMs / (1000 * 60 * 60 * 24);

    if (daysSincePublication > 0) {
      impressoesPorDia = impressoes / daysSincePublication;
      interacoesTotaisPorDia = totalInteracoes / daysSincePublication;
      reproducoesTotaisPorDia = reproducoesTotais / daysSincePublication;
    }
  }

  // (VI) Métricas específicas para Reels vs. Posts
  let razaoReelsVsPosts = 0;
  if (isPostCount > 0) {
    razaoReelsVsPosts = parseFloat(((isReelCount / isPostCount) * 100).toFixed(2));
  }

  // (XI) Relações internas -> em %
  const ratioLikeComment =
    comentarios > 0
      ? parseFloat(((curtidas / comentarios) * 100).toFixed(2))
      : 0;

  const ratioCommentShare =
    compartilhamentos > 0
      ? parseFloat(((comentarios / compartilhamentos) * 100).toFixed(2))
      : 0;

  const ratioSaveLike =
    curtidas > 0
      ? parseFloat(((salvamentos / curtidas) * 100).toFixed(2))
      : 0;

  // Relação Interação Seguidores vs. Não Seguidores (em %)
  const ratioInteracaoSegNaoSeg =
    visualizacoesNaoSeguidores > 0
      ? parseFloat(
          ((visualizacoesSeguidores / visualizacoesNaoSeguidores) * 100).toFixed(2)
        )
      : 0;

  // Relação Visualização Seguidores vs. Não Seguidores (em %)
  const ratioVisSegNaoSeg = ratioInteracaoSegNaoSeg;

  // (XII) Relação de origem (Explorar vs. Página Inicial) -> em %
  const razaoExplorarPaginaInicial =
    impressoesPaginaInicial > 0
      ? parseFloat(((impressoesExplorar / impressoesPaginaInicial) * 100).toFixed(2))
      : 0;

  // (XIII) Engajamento Profundo vs. Rápido
  let engajamentoProfundoAlcance = 0;
  let engajamentoRapidoAlcance = 0;
  let ratioProfundoRapidoAlcance = 0;

  if (contasAlcancadas > 0) {
    const prof = (comentarios + salvamentos + compartilhamentos) / contasAlcancadas;
    const rap = (curtidas + reacoesFacebook) / contasAlcancadas;
    engajamentoProfundoAlcance = parseFloat((prof * 100).toFixed(2));
    engajamentoRapidoAlcance = parseFloat((rap * 100).toFixed(2));

    if (rap > 0) {
      ratioProfundoRapidoAlcance = parseFloat(((prof / rap) * 100).toFixed(2));
    }
  }

  // (XIV) Índice de Propagação (em %)
  const indicePropagacao =
    contasAlcancadas > 0
      ? parseFloat(((compartilhamentos / contasAlcancadas) * 100).toFixed(2))
      : 0;

  // (XIV-b) Viralidade Ponderada => (compartilhamentos + salvamentos * alpha + repeticoes * beta) / alcance
  const alpha = 0.5;
  const beta = 0.3;
  let viralidadePonderada = 0;
  if (contasAlcancadas > 0) {
    const val =
      (compartilhamentos + salvamentos * alpha + repeticoes * beta) / contasAlcancadas;
    viralidadePonderada = parseFloat((val * 100).toFixed(2));
  }

  // (XV) “Razão Seguir / Alcance Total” -> em %
  const razaoSeguirAlcance =
    contasAlcancadas > 0
      ? parseFloat(((comecaramASeguir / contasAlcancadas) * 100).toFixed(2))
      : 0;

  // (XVI) “Engajamento de Não Seguidores” vs. “Seguidores” em % do Alcance
  const taxaEngajamentoNaoSeguidoresEmAlcance =
    contasAlcancadas > 0
      ? parseFloat(((visualizacoesNaoSeguidores / contasAlcancadas) * 100).toFixed(2))
      : 0;

  const taxaEngajamentoSeguidoresEmAlcance =
    contasAlcancadas > 0
      ? parseFloat(((visualizacoesSeguidores / contasAlcancadas) * 100).toFixed(2))
      : 0;

  // 7) Retorna os resultados
  return {
    reproducoesTotais,
    reproducoesFacebook,
    reproducoes,
    reproducoesIniciais,
    repeticoes,
    interacoesTotais,
    interacoesReel,
    reacoesFacebook,
    curtidas,
    comentarios,
    compartilhamentos,
    salvamentos,
    impressoes,
    impressoesPaginaInicial,
    impressoesPerfil,
    impressoesOutraPessoa,
    impressoesExplorar,
    interacoes,
    visualizacoes,
    visualizacoesSeguidores,
    visualizacoesNaoSeguidores,
    contasAlcancadas,
    contasAlcancadasSeguidores,
    contasAlcancadasNaoSeguidores,
    contasComEngajamento,
    contasComEngajamentoSeguidores,
    contasComEngajamentoNaoSeguidores,
    visitasPerfil,
    comecaramASeguir,
    tempoVisualizacao,
    duracao,
    tempoMedioVisualizacao,
    dataPublicacao: dataPublicacao !== null
      ? (dataPublicacao as Date).toISOString().slice(0, 10)
      : null,
    daysSincePublication,
    totalInteracoes,
    taxaEngajamento,
    taxaReproducoesIniciais,
    taxaRepeticao,
    pctReproducoesFacebook,
    mediaDuracao,
    mediaTempoMedioVisualizacao,
    taxaRetencao,
    tempoVisualizacaoPorImpressao,
    tempoMedioVisualizacaoPorView,
    taxaConversaoSeguidores,
    pctSalvamentos,
    impressoesPorDia,
    interacoesTotaisPorDia,
    reproducoesTotaisPorDia,
    isReelCount,
    isPostCount,
    razaoReelsVsPosts,
    ratioLikeComment,
    ratioCommentShare,
    ratioSaveLike,
    ratioInteracaoSegNaoSeg,
    ratioVisSegNaoSeg,
    razaoExplorarPaginaInicial,
    engajamentoProfundoAlcance,
    engajamentoRapidoAlcance,
    ratioProfundoRapidoAlcance,
    indicePropagacao,
    viralidadePonderada,
    razaoSeguirAlcance,
    taxaEngajamentoNaoSeguidoresEmAlcance,
    taxaEngajamentoSeguidoresEmAlcance,
  };
}

/**
 * parseDateString: converte datas dos formatos "dd/mm/yyyy" ou "yyyy-mm-dd" em Date.
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Tenta parsear formato "yyyy-mm-dd"
  const isoParsed = new Date(dateStr);
  if (!isNaN(isoParsed.getTime())) {
    return isoParsed;
  }

  // Se for "dd/mm/yyyy"
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const dd = parseInt(parts[0]!, 10);
    const mm = parseInt(parts[1]!, 10) - 1;
    const yyyy = parseInt(parts[2]!, 10);
    const d = new Date(yyyy, mm, dd);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }

  return null;
}
