import fetch from "node-fetch"; // ou use fetch nativo do Node 18+ se preferir
import path from "path";
import { GoogleAuth } from "google-auth-library";
import { calcFormulas } from "./formulas";

/**
 * Interface mínima para a resposta do Document AI.
 * Ajuste conforme o modelo real retornado pelo seu endpoint.
 */
interface DocumentAIEntity {
  type?: string;
  mentionText?: string;
}

interface DocumentAIResponse {
  document?: {
    entities?: DocumentAIEntity[];
  };
}

/**
 * 1) Configuração da conta de serviço para autenticar no Google Cloud.
 *    Substitua o caminho do arquivo JSON se estiver em outro lugar.
 */
const auth = new GoogleAuth({
  keyFile: path.join(process.cwd(), "keys", "service-account.json"),
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

/**
 * 2) Chamada principal ao Document AI (REST), obtendo token dinamicamente.
 */
export async function callDocumentAI(
  base64File: string,
  mimeType: string
): Promise<DocumentAIResponse> {
  const endpoint = process.env.DOC_AI_ENDPOINT;
  if (!endpoint) {
    throw new Error("DOC_AI_ENDPOINT não definido");
  }

  // 1) Obtém o client e token via conta de serviço
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;
  if (!token) {
    throw new Error("Não foi possível obter token de acesso para Document AI");
  }

  // 2) Monta payload
  const payload = {
    rawDocument: {
      content: base64File, // base64 do arquivo
      mimeType,
    },
  };

  // 3) Faz fetch ao endpoint
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Erro Document AI: ${response.status} - ${text}`);
  }

  // 4) Retorna JSON
  const json = (await response.json()) as DocumentAIResponse;
  return json;
}

/**
 * 3) Listas de cabeçalhos e alias (como no seu Apps Script).
 *    Ajuste conforme suas necessidades.
 */
const NUMERIC_HEADERS = [
  "Reproduções Totais",
  "Reproduções no Facebook",
  "Reproduções",
  "Reproduções Iniciais",
  "Repetições",
  "Interações Totais",
  "Interações do Reel",
  "Reações no Facebook",
  "Curtidas",
  "Comentários",
  "Compartilhamentos",
  "Salvamentos",
  "Impressões",
  "Impressões na Página Inicial",
  "Impressões no Perfil",
  "Impressões de Outra Pessoa",
  "Impressões de Explorar",
  "Impressões nas Hashtags",
  "Contas Alcançadas",
  "Contas Alcançadas de Seguidores",
  "Contas Alcançadas de Não Seguidores",
  "Contas com Engajamento",
  "Contas com Engajamento de Seguidores",
  "Contas com Engajamento de Não Seguidores",
  "Visitas ao Perfil",
  "Começaram a Seguir",
  "Visualizações",
  "Visualizações de Seguidores",
  "Visualizações de Não Seguidores",
  "Tempo Médio de Visualização",
];

const PERCENTAGE_HEADERS = [
  "Contas Alcançadas de Seguidores",
  "Contas Alcançadas de Não Seguidores",
  "Contas com Engajamento de Seguidores",
  "Contas com Engajamento de Não Seguidores",
  "Visualizações de Seguidores",
  "Visualizações de Não Seguidores",
  "Interações de Seguidores",
  "Interações de Não Seguidores",
];

const TEXT_HEADERS = [
  "Data de Publicação",
  "Hora de Publicação",
  "Creator",
  "Caption",
  "Formato",
  "Proposta do Conteúdo",
  "Contexto do Conteúdo",
  "Tema do Conteúdo",
  "Collab",
  "Creator da Collab",
  "Tempo de Visualização",
  "Duração",
  "Link do Conteúdo",
  "Capa do Conteúdo",
];

// Alias de nomes
const METRICS_ALIAS_MAP: Record<string, string> = {
  comecaramaseguir: "Começaram a Seguir",
  comentarios: "Comentários",
  compartilhamentos: "Compartilhamentos",
  contasalcancadas: "Contas Alcançadas",
  contasalcancadasdeseguidores: "Contas Alcançadas de Seguidores",
  contasalcancadasdenaoseguidores: "Contas Alcançadas de Não Seguidores",
  contascomengajamento: "Contas com Engajamento",
  contascomengajamentodeseguidores: "Contas com Engajamento de Seguidores",
  contascomengajamentodenaoseguidores: "Contas com Engajamento de Não Seguidores",
  interacoescomreels: "Interações do Reel",
  interacoesdoreel: "Interações do Reel",
  interacoes: "Interações Totais",
  interacoestotais: "Interações Totais",
  reacoesnofacebook: "Reações no Facebook",
  reproducoesiniciais: "Reproduções Iniciais",
  reproducoesinicias: "Reproduções Iniciais",
  reproducoes: "Reproduções",
  reproducoesnofacebook: "Reproduções no Facebook",
  reproducoestotais: "Reproduções Totais",
  salvamentos: "Salvamentos",
  curtidas: "Curtidas",
  datadepublicacao: "Data de Publicação",
  duracao: "Duração",
  formato: "Formato",
  tempodevisualizacao: "Tempo de Visualização",
  tempomediodevisualizacao: "Tempo Médio de Visualização",
  visitasaoperfil: "Visitas ao Perfil",
  visualizacoes: "Visualizações",
  visualizacoesdeseguidores: "Visualizações de Seguidores",
  visualizacoesdenaoseguidores: "Visualizações de Não Seguidores",
  caption: "Caption",
  repeticoes: "Repetições",
  "repetições": "Repetições",
  linkdoconteudo: "Link do Conteúdo",
  capadoconteudo: "Capa do Conteúdo",
};

/**
 * 4) Extrai as métricas do response do Document AI, usando a lógica avançada (alias, parse de datas, etc.).
 */
export function extractLabeledMetricsFromDocumentAIResponse(
  docAIResponse: DocumentAIResponse
): Record<string, unknown> {
  const document = docAIResponse.document || {};
  const entities = document.entities || [];

  const extractedMetrics: Record<string, unknown> = {};

  for (const entity of entities) {
    let metricName = normalizeHeader(entity.type ?? "");
    const metricValue = entity.mentionText ? entity.mentionText.trim() : "";

    // Aplica alias
    if (METRICS_ALIAS_MAP[metricName]) {
      metricName = METRICS_ALIAS_MAP[metricName];
    }

    // Verifica se é numérico, percentual ou textual
    const isNumeric = NUMERIC_HEADERS.includes(metricName);
    const isPercent = PERCENTAGE_HEADERS.includes(metricName);
    const isText = TEXT_HEADERS.includes(metricName);

    // Se não estiver em nenhum, descarta
    if (!isNumeric && !isPercent && !isText) {
      continue;
    }

    // TEXT
    if (isText) {
      if (metricName === "Data de Publicação") {
        extractedMetrics[metricName] = parseDocAIDate(metricValue);
      } else if (metricName === "Duração") {
        extractedMetrics[metricName] = parseDuration(metricValue);
      } else if (metricName === "Tempo de Visualização") {
        extractedMetrics[metricName] = parseTempoVisualizacao(metricValue);
      } else {
        extractedMetrics[metricName] = metricValue;
      }
      // NUMERIC / PERCENT
    } else {
      if (metricName === "Tempo Médio de Visualização") {
        extractedMetrics[metricName] = parseTempoVisualizacao(metricValue);
      } else {
        extractedMetrics[metricName] = parseNumericValuePercent(metricValue, metricName);
      }
    }
  }

  return extractedMetrics;
}

/**
 * 5) Funções auxiliares de parse (datas, tempo, numéricos).
 */
function parseDocAIDate(dateStr: string) {
  if (!dateStr) return "";

  // Tenta parsear diretamente
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    // formata dd/MM/yyyy
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // Caso "3 de outubro de 2024"
  const MESES_MAP: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    março: "03",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };

  const parts = dateStr
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(" ");

  let dia = "",
    mes = "",
    ano = "";
  for (const part of parts) {
    if (!isNaN(Number(part)) && part.length === 4) {
      ano = part;
    } else if (!isNaN(Number(part))) {
      dia = part.padStart(2, "0");
    } else if (MESES_MAP[part]) {
      mes = MESES_MAP[part];
    }
  }

  if (!dia || !mes || !ano) {
    return "";
  }
  return `${dia}/${mes}/${ano}`;
}

function parseTempoVisualizacao(tempoStr: string) {
  if (!tempoStr) return 0;

  const regex = /(\d+)\s*(a|d|h|min|s)/gi;
  let match;
  let anos = 0,
    dias = 0,
    horas = 0,
    minutos = 0,
    segundos = 0;

  while ((match = regex.exec(tempoStr)) !== null) {
    const valor = parseInt(match[1], 10);
    const unidade = match[2].toLowerCase();

    switch (unidade) {
      case "a":
        anos += valor;
        break;
      case "d":
        dias += valor;
        break;
      case "h":
        horas += valor;
        break;
      case "min":
        minutos += valor;
        break;
      case "s":
        segundos += valor;
        break;
    }
  }

  let totalSegundos =
    anos * 31536000 + dias * 86400 + horas * 3600 + minutos * 60 + segundos;
  const MAX_SEGUNDOS = 5 * 31536000;
  if (totalSegundos > MAX_SEGUNDOS) {
    totalSegundos = MAX_SEGUNDOS;
  }
  return totalSegundos;
}

function parseDuration(durationStr: string) {
  if (!durationStr) return 0;

  if (durationStr.includes(":")) {
    // "HH:MM:SS" ou "MM:SS"
    const parts = durationStr.split(":").map((p) => parseInt(p, 10));
    if (parts.length === 3) {
      const [hh, mm, ss] = parts;
      return hh * 3600 + mm * 60 + ss;
    } else if (parts.length === 2) {
      const [mm, ss] = parts;
      return mm * 60 + ss;
    }
    return 0;
  } else {
    // Ex.: "2h 30m 10s"
    const regex = /(\d+)\s*h|\b(\d+)\s*m\b|\b(\d+)\s*s\b/g;
    let match;
    let horas = 0,
      minutos = 0,
      segundos = 0;

    while ((match = regex.exec(durationStr)) !== null) {
      if (match[1]) horas += parseInt(match[1], 10);
      if (match[2]) minutos += parseInt(match[2], 10);
      if (match[3]) segundos += parseInt(match[3], 10);
    }
    return horas * 3600 + minutos * 60 + segundos;
  }
}

function parseNumericValuePercent(valueStr: string, metricName: string) {
  if (!valueStr) return 0;

  let str = valueStr.toLowerCase();
  let multiplier = 1;

  if (str.includes("mil")) {
    multiplier = 1000;
    str = str.replace("mil", "").trim();
  } else if (str.includes("mi")) {
    multiplier = 1000000;
    str = str.replace("mi", "").trim();
  }

  let endsWithPercent = false;
  if (str.endsWith("%")) {
    endsWithPercent = true;
    str = str.slice(0, -1).trim();
  }

  // Substitui vírgula decimal
  const commaCount = (str.match(/,/g) || []).length;
  if (commaCount === 1) {
    str = str.replace(",", ".");
  } else if (commaCount > 1) {
    str = str.replace(/,/g, "");
  }

  // remove resto não-numérico
  str = str.replace(/[^\d.]+/g, "");

  let num = parseFloat(str) || 0;
  num *= multiplier;

  // Se for cabeçalho de PERCENTAGE_HEADERS ou terminar com '%'
  if (PERCENTAGE_HEADERS.includes(metricName) || endsWithPercent) {
    num = num / 100;
  }

  return num;
}

function normalizeHeader(header: string) {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * 6) Funções para processar imagens (1 ou várias).
 *    - Chama Document AI
 *    - Extrai métricas
 *    - Retorna rawData e stats
 */
export async function processImageFile(base64File: string, mimeType: string) {
  const docAIResponse = await callDocumentAI(base64File, mimeType);
  const labeledMetrics = extractLabeledMetricsFromDocumentAIResponse(docAIResponse);
  return labeledMetrics;
}

export async function processMultipleImages(
  images: { base64File: string; mimeType: string }[]
): Promise<{
  rawDataArray: Record<string, unknown>[];
  stats: Record<string, unknown>;
}> {
  const rawDataArray: Record<string, unknown>[] = [];

  for (const img of images) {
    const extracted = await processImageFile(img.base64File, img.mimeType);
    rawDataArray.push(extracted);
  }

  // Calcula stats (por ex., soma de curtidas, comentários, etc.)
  const stats = calcFormulas(rawDataArray);

  return { rawDataArray, stats };
}
