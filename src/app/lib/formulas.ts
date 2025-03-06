// src/app/lib/formulas.ts

/**
 * Função que soma campos de rawData e calcula métricas avançadas para UM conteúdo (snapshot único).
 * - Agora, as "taxas" e "razões" são convertidas para porcentagem (0–100).
 * - Se quiser comparar Reels vs. Posts no total, é preciso um agregador que some todos.
 */
export function calcFormulas(rawDataArray: any[]) {
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
  let interacoesSeguidores = 0;
  let interacoesNaoSeguidores = 0;

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

  // Se o item tiver "type" ("reel" ou "post"), podemos contar quantos frames são Reels vs. Posts.
  let isReelCount = 0; 
  let isPostCount = 0;

  // 2) Capturar Data de Publicação (pegando a mais antiga)
  let dataPublicacao: Date | null = null;

  // 3) Somar cada campo do rawDataArray
  rawDataArray.forEach((item: any) => {
    if (item.type === "reel") {
      isReelCount++;
    } else if (item.type === "post") {
      isPostCount++;
    }

    reproducoesTotais        += item["Reproduções Totais"]         || 0;
    reproducoesFacebook      += item["Reproduções no Facebook"]    || 0;
    reproducoes             += item["Reproduções"]                 || 0;
    reproducoesIniciais     += item["Reproduções Iniciais"]        || 0;
    repeticoes              += item["Repetições"]                  || 0;

    interacoesTotais        += item["Interações Totais"]           || 0;
    interacoesReel          += item["Interações do Reel"]          || 0;
    reacoesFacebook         += item["Reações no Facebook"]         || 0;
    curtidas                += item["Curtidas"]                    || 0;
    comentarios             += item["Comentários"]                 || 0;
    compartilhamentos       += item["Compartilhamentos"]           || 0;
    salvamentos             += item["Salvamentos"]                 || 0;

    impressoes              += item["Impressões"]                  || 0;
    impressoesPaginaInicial += item["Impressões na Página Inicial"]|| 0;
    impressoesPerfil        += item["Impressões no Perfil"]        || 0;
    impressoesOutraPessoa   += item["Impressões de Outra Pessoa"]  || 0;
    impressoesExplorar      += item["Impressões de Explorar"]      || 0;

    interacoes              += item["Interações"]                  || 0;
    interacoesSeguidores    += item["Interações de Seguidores"]    || 0;
    interacoesNaoSeguidores += item["Interações de Não Seguidores"]|| 0;

    visualizacoes           += item["Visualizações"]               || 0;
    visualizacoesSeguidores += item["Visualizações de Seguidores"] || 0;
    visualizacoesNaoSeguidores += item["Visualizações de Não Seguidores"] || 0;

    contasAlcancadas        += item["Contas Alcançadas"]           || 0;
    contasAlcancadasSeguidores    += item["Contas Alcançadas de Seguidores"]    || 0;
    contasAlcancadasNaoSeguidores += item["Contas Alcançadas de Não Seguidores"] || 0;
    contasComEngajamento    += item["Contas com Engajamento"]      || 0;
    contasComEngajamentoSeguidores += item["Contas com Engajamento de Seguidores"]    || 0;
    contasComEngajamentoNaoSeguidores += item["Contas com Engajamento de Não Seguidores"] || 0;

    visitasPerfil           += item["Visitas ao Perfil"]           || 0;
    comecaramASeguir        += item["Começaram a Seguir"]          || 0;

    tempoVisualizacao       += item["Tempo de Visualização"]       || 0;
    duracao                 += item["Duração"]                     || 0;
    tempoMedioVisualizacao  += item["Tempo Médio de Visualização"] || 0;

    // Data de Publicação (mais antiga)
    if (item["Data de Publicação"]) {
      const dateStr = item["Data de Publicação"];
      const parsedDate = parseDateString(dateStr);
      if (parsedDate) {
        if (!dataPublicacao || parsedDate < dataPublicacao) {
          dataPublicacao = parsedDate;
        }
      }
    }
  });

  // 4) Cálculos / taxas

  // Soma de curtidas+comentários+salvamentos+compartilhamentos
  const totalInteracoes = curtidas + comentarios + salvamentos + compartilhamentos;

  // Função auxiliar para transformar fração em %
  // e arredondar a 2 casas decimais
  function toPercent(value: number) {
    return parseFloat((value * 100).toFixed(2));
  }

  // (I) Taxas de reproduções (em %)
  const taxaReproducoesIniciais = reproducoesTotais > 0
    ? toPercent(reproducoesIniciais / reproducoesTotais)
    : 0;

  const taxaRepeticao = reproducoesTotais > 0
    ? toPercent(repeticoes / reproducoesTotais)
    : 0;

  const pctReproducoesFacebook = reproducoesTotais > 0
    ? toPercent(reproducoesFacebook / reproducoesTotais)
    : 0;

  // (II) Engajamento geral (impressões)
  const taxaEngajamento = impressoes > 0
    ? toPercent(totalInteracoes / impressoes)
    : 0;

  // (III) Tempo de Visualização / Retenção
  // Mantemos estes como fração? Se quiser em %, multiplique por 100
  const mediaDuracao = (rawDataArray.length > 0) ? (duracao / rawDataArray.length) : 0;
  const mediaTempoMedioVisualizacao = (rawDataArray.length > 0)
    ? (tempoMedioVisualizacao / rawDataArray.length)
    : 0;

  // Se quiser taxaRetencao em %:
  const taxaRetencao = (mediaDuracao > 0)
    ? toPercent(mediaTempoMedioVisualizacao / mediaDuracao)
    : 0;

  // Estes são valores absolutos (segundos por impressao), deixamos como está ou convertemos
  const tempoVisualizacaoPorImpressao = (impressoes > 0)
    ? (tempoVisualizacao / impressoes)
    : 0;

  const tempoMedioVisualizacaoPorView = (reproducoesTotais > 0)
    ? (tempoVisualizacao / reproducoesTotais)
    : 0;

  // (IV) Conversão / Crescimento
  const taxaConversaoSeguidores = (visitasPerfil > 0)
    ? toPercent(comecaramASeguir / visitasPerfil)
    : 0;

  // Exemplo: salvamentos / interacoesTotais => em %
  const pctSalvamentos = (interacoesTotais > 0)
    ? toPercent(salvamentos / interacoesTotais)
    : 0;

  // (V) Cálculos diários (aprox., sem converter em %)
  let daysSincePublication = 0;
  let impressoesPorDia = 0;
  let interacoesTotaisPorDia = 0;
  let reproducoesTotaisPorDia = 0;

  if (dataPublicacao) {
    const now = new Date();
    const diffMs = now.getTime() - dataPublicacao.getTime();
    daysSincePublication = diffMs / (1000 * 60 * 60 * 24);

    if (daysSincePublication > 0) {
      impressoesPorDia        = impressoes         / daysSincePublication;
      interacoesTotaisPorDia  = interacoesTotais   / daysSincePublication;
      reproducoesTotaisPorDia = reproducoesTotais  / daysSincePublication;
    }
  }

  // (VI) Métricas específicas para Reels vs. Posts
  let razaoReelsVsPosts = 0;
  if (isPostCount > 0) {
    razaoReelsVsPosts = parseFloat(((isReelCount / isPostCount) * 100).toFixed(2)); 
    // se quiser em % ou manter em ratio
  }

  // (VII) Taxas de Interação (Seguidores vs. Não Seguidores) -> em %
  const taxaInteracaoSeguidores = (interacoes > 0)
    ? toPercent(interacoesSeguidores / interacoes)
    : 0;

  const taxaInteracaoNaoSeguidores = (interacoes > 0)
    ? toPercent(interacoesNaoSeguidores / interacoes)
    : 0;

  // (VIII) Taxas de Visualizações (Seguidores vs. Não Seguidores) -> em %
  const taxaVisualizacoesSeguidores = (visualizacoes > 0)
    ? toPercent(visualizacoesSeguidores / visualizacoes)
    : 0;

  const taxaVisualizacoesNaoSeguidores = (visualizacoes > 0)
    ? toPercent(visualizacoesNaoSeguidores / visualizacoes)
    : 0;

  // (IX) Engajamento sobre contas alcançadas -> em %
  const taxaEngajamentoSobreAlcancadas = (contasAlcancadas > 0)
    ? toPercent(contasComEngajamento / contasAlcancadas)
    : 0;

  const taxaEngajamentoSeguidores = (contasAlcancadasSeguidores > 0)
    ? toPercent(contasComEngajamentoSeguidores / contasAlcancadasSeguidores)
    : 0;

  const taxaEngajamentoNaoSeguidores = (contasAlcancadasNaoSeguidores > 0)
    ? toPercent(contasComEngajamentoNaoSeguidores / contasAlcancadasNaoSeguidores)
    : 0;

  // (X) Relações internas -> em %
  const ratioLikeComment = (comentarios > 0)
    ? parseFloat(((curtidas / comentarios) * 100).toFixed(2))
    : 0;

  const ratioCommentShare = (compartilhamentos > 0)
    ? parseFloat(((comentarios / compartilhamentos) * 100).toFixed(2))
    : 0;

  const ratioSaveLike = (curtidas > 0)
    ? parseFloat(((salvamentos / curtidas) * 100).toFixed(2))
    : 0;

  // (XI) Relações Seguidores vs. Não Seguidores -> em %
  const ratioInteracaoSegNaoSeg = (interacoesNaoSeguidores > 0)
    ? parseFloat(((interacoesSeguidores / interacoesNaoSeguidores) * 100).toFixed(2))
    : 0;

  const ratioVisSegNaoSeg = (visualizacoesNaoSeguidores > 0)
    ? parseFloat(((visualizacoesSeguidores / visualizacoesNaoSeguidores) * 100).toFixed(2))
    : 0;

  // (XII) Relação de origem (Explorar vs. Página Inicial) -> em %
  const razaoExplorarPaginaInicial = (impressoesPaginaInicial > 0)
    ? parseFloat(((impressoesExplorar / impressoesPaginaInicial) * 100).toFixed(2))
    : 0;

  // (XIII) Engajamento Profundo vs. Rápido (com base em "contasAlcancadas") -> em %
  let engajamentoProfundoAlcance = 0;
  let engajamentoRapidoAlcance   = 0;
  let ratioProfundoRapidoAlcance = 0;

  if (contasAlcancadas > 0) {
    const prof = (comentarios + salvamentos + compartilhamentos) / contasAlcancadas;
    const rap  = (curtidas + reacoesFacebook) / contasAlcancadas;
    engajamentoProfundoAlcance = parseFloat((prof * 100).toFixed(2));
    engajamentoRapidoAlcance   = parseFloat((rap * 100).toFixed(2));

    if (rap > 0) {
      ratioProfundoRapidoAlcance = parseFloat(((prof / rap) * 100).toFixed(2));
    }
  }

  // (XIV) Índice de “Viralidade” / Propagação (compartilhamentos / alcance total) -> em %
  const indicePropagacao = (contasAlcancadas > 0)
    ? parseFloat(((compartilhamentos / contasAlcancadas) * 100).toFixed(2))
    : 0;

  // (XIV-b) Viralidade Ponderada => (compart + salv * alpha + rep * beta) / alcance -> em %
  const alpha = 0.5;
  const beta = 0.3;
  let viralidadePonderada = 0;
  if (contasAlcancadas > 0) {
    const val = (compartilhamentos + salvamentos * alpha + repeticoes * beta) / contasAlcancadas;
    viralidadePonderada = parseFloat((val * 100).toFixed(2));
  }

  // (XV) “Razão Seguir / Alcance Total” -> em %
  const razaoSeguirAlcance = (contasAlcancadas > 0)
    ? parseFloat(((comecaramASeguir / contasAlcancadas) * 100).toFixed(2))
    : 0;

  // (XVI) “Engajamento de Não Seguidores” vs. “Seguidores” em % do Alcance
  const taxaEngajamentoNaoSeguidoresEmAlcance = (contasAlcancadas > 0)
    ? parseFloat(((interacoesNaoSeguidores / contasAlcancadas) * 100).toFixed(2))
    : 0;

  const taxaEngajamentoSeguidoresEmAlcance = (contasAlcancadas > 0)
    ? parseFloat(((interacoesSeguidores / contasAlcancadas) * 100).toFixed(2))
    : 0;

  // 7) Retornamos tudo
  return {
    // Somas (valores absolutos, não em %)
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
    interacoesSeguidores,
    interacoesNaoSeguidores,

    visualizacoes,
    visualizacoesSeguidores,
    visualizacoesNaoSeguidores,

    // Alcance total
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

    // Data de Publicação (mais antiga)
    dataPublicacao: dataPublicacao ? dataPublicacao.toISOString().slice(0, 10) : null,
    daysSincePublication,

    // Cálculos de apoio
    totalInteracoes,

    // Taxa de Engajamento (em %)
    taxaEngajamento,

    // Reproduções (em %)
    taxaReproducoesIniciais,
    taxaRepeticao,
    pctReproducoesFacebook,

    // Tempo / Retenção
    mediaDuracao,  // (segundos ou sem conversão)
    mediaTempoMedioVisualizacao,
    taxaRetencao,  // (%)
    tempoVisualizacaoPorImpressao, // (segundos)
    tempoMedioVisualizacaoPorView, // (segundos)

    // Conversão (em %)
    taxaConversaoSeguidores,
    pctSalvamentos,

    // Métricas diárias (aprox.)
    impressoesPorDia,
    interacoesTotaisPorDia,
    reproducoesTotaisPorDia,

    // Reels vs. Posts (em %)
    isReelCount,
    isPostCount,
    razaoReelsVsPosts,

    // Relações internas (em %)
    ratioLikeComment,
    ratioCommentShare,
    ratioSaveLike,

    // Relações Seguidores vs. Não Seguidores (em %)
    ratioInteracaoSegNaoSeg,
    ratioVisSegNaoSeg,

    // Relação de origem (Explorar vs. Página Inicial) (em %)
    razaoExplorarPaginaInicial,

    // Engajamento Profundo vs. Rápido (com base em ALCANCE) -> em %
    engajamentoProfundoAlcance,
    engajamentoRapidoAlcance,
    ratioProfundoRapidoAlcance,

    // Índice de Propagação (em %)
    indicePropagacao,
    // Viralidade Ponderada (em %)
    viralidadePonderada,

    // Razão Seguir / Alcance (em %)
    razaoSeguirAlcance,

    // Engajamento de Não Seguidores e Seguidores em % do Alcance
    taxaEngajamentoNaoSeguidoresEmAlcance,
    taxaEngajamentoSeguidoresEmAlcance,
  };
}

/**
 * Função auxiliar para parsear data no formato dd/mm/yyyy (ou tentar yyyy-mm-dd).
 * Ajuste conforme seu Document AI retorne (yyyy-mm-dd, etc.).
 */
function parseDateString(dateStr: string): Date | null {
  if (!dateStr) return null;

  // Tenta parsear se estiver no formato "yyyy-mm-dd"
  const isoParsed = new Date(dateStr);
  if (!isNaN(isoParsed.getTime())) {
    return isoParsed;
  }

  // Se for dd/mm/yyyy
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    const dd = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10) - 1; // mês em JS é 0-based
    const yyyy = parseInt(parts[2], 10);
    const d = new Date(yyyy, mm, dd);
    if (!isNaN(d.getTime())) {
      return d;
    }
  }

  return null;
}
