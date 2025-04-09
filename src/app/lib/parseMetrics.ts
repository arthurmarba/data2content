// src/app/lib/parseMetrics.ts

import fetch from "node-fetch";
import path from "path";
import { GoogleAuth } from "google-auth-library";
import { calcFormulas } from "./formulas";
import { IDailyMetric } from "@/app/models/DailyMetric";

// Configurações e variáveis de ambiente
const DOCUMENT_AI_ENDPOINT = process.env.DOCUMENT_AI_ENDPOINT || "";
const MAX_RETRIES = 3;

// Cabeçalhos fixos
const FIXED_HEADERS = ["Post", "Data"];

// Cabeçalhos numéricos (conforme App Script)
const NUMERIC_HEADERS: string[] = [
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
  "Tempo de Visualização",
  "Duração",
  "Tempo Médio de Visualização"
];

// Cabeçalhos percentuais (conforme App Script)
const PERCENTAGE_HEADERS: string[] = [
  "Contas Alcançadas de Seguidores",
  "Contas Alcançadas de Não Seguidores",
  "Contas com Engajamento de Seguidores",
  "Contas com Engajamento de Não Seguidores",
  "Visualizações de Seguidores",
  "Visualizações de Não Seguidores",
  "Interações de Seguidores",
  "Interações de Não Seguidores"
];

// Cabeçalhos textuais (conforme App Script)
const TEXT_HEADERS: string[] = [
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
  "Link do Conteúdo",
  "Capa do Conteúdo"
];

// Função de normalização robusta (remove acentos e espaços extras)
const normalize = (str: string): string =>
  str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Mapeamento de alias (conforme App Script)
const METRICS_ALIAS_MAP: { [key: string]: string } = {
  comecaramaseguir: "Começaram a Seguir",
  comentarios: "Comentários",
  compartilhamentos: "Compartilhamentos",
  reproducoesiniciais: "Reproduções Iniciais",
  reproducoes: "Reproduções",
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
  reproducoesinicias: "Reproduções Iniciais",
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
  // Adiciona alias para "não seguidores"
  "nao seguidores": "Visualizações de Não Seguidores"
};

// Cria mapas para identificar rapidamente os cabeçalhos válidos
const NUMERIC_MAP = new Map(NUMERIC_HEADERS.map(header => [normalize(header), header]));
const PERCENTAGE_MAP = new Map(PERCENTAGE_HEADERS.map(header => [normalize(header), header]));
const TEXT_MAP = new Map(TEXT_HEADERS.map(header => [normalize(header), header]));

// =============================================================================
// Interfaces para a resposta do Document AI
// =============================================================================
interface DocumentAIEntity {
  type?: string;
  mentionText?: string;
}

interface DocumentAIResponse {
  document?: {
    entities?: DocumentAIEntity[];
    text?: string;
  };
}

// =============================================================================
// Chamada à API do Document AI com retries
// =============================================================================
async function callDocumentAI(
  fileBuffer: Buffer,
  mimeType: string
): Promise<DocumentAIResponse> {
  if (!DOCUMENT_AI_ENDPOINT) {
    throw new Error("DOCUMENT_AI_ENDPOINT não definido.");
  }
  const auth = new GoogleAuth({
    keyFile: path.join(process.cwd(), "keys", "service-account.json"),
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const accessToken = await auth.getAccessToken();
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Token de acesso vazio.");
  }
  const payload = {
    rawDocument: {
      content: fileBuffer.toString("base64"),
      mimeType,
    },
  };

  let attempt = 0;
  let response;
  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      response = await fetch(DOCUMENT_AI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) break;
    } catch (err) {
      console.error(`Tentativa ${attempt} falhou: ${String(err)}`);
      if (attempt === MAX_RETRIES) throw err;
    }
    await new Promise((res) => setTimeout(res, 1000 * attempt));
  }
  if (!response || !response.ok) {
    const text = response ? await response.text() : "Sem resposta";
    throw new Error(`Erro Document AI: ${response?.status} - ${text}`);
  }
  const json = (await response.json()) as DocumentAIResponse;
  console.debug("Document AI response:", json);
  return json;
}

// =============================================================================
// Extração das métricas a partir da resposta do Document AI
// =============================================================================
export function extractLabeledMetricsFromDocumentAIResponse(
  response: DocumentAIResponse
): Record<string, unknown> {
  const document = response.document || {};
  const entities = document.entities || [];
  const validHeaders = new Map<string, string>([
    ...NUMERIC_MAP,
    ...PERCENTAGE_MAP,
    ...TEXT_MAP,
  ]);
  const extractedMetrics: Record<string, unknown> = {};

  for (const entity of entities) {
    let rawType = entity.type ? normalize(entity.type) : "";
    // Aplica alias de forma segura
    const alias = METRICS_ALIAS_MAP[rawType];
    if (alias !== undefined) {
      rawType = normalize(alias);
    }
    if (!validHeaders.has(rawType)) continue;
    const header = validHeaders.get(rawType)!;
    const metricValue = entity.mentionText ? entity.mentionText.trim() : "";

    // Preserva o primeiro valor encontrado para cada métrica
    if (extractedMetrics[header] && extractedMetrics[header] !== "") {
      console.debug(`Métrica "${header}" já definida com "${extractedMetrics[header]}". Ignorando novo valor "${metricValue}".`);
      continue;
    }

    // Aplica parsers específicos conforme o tipo da métrica
    if (header === "Duração") {
      const parsedDuration = parseDuration(metricValue);
      if (parsedDuration > 300) {
        console.warn(`Alerta: Duração muito alta (${parsedDuration} segundos) para "${metricValue}".`);
      }
      extractedMetrics[header] = parsedDuration || "";
    } else if (header === "Tempo de Visualização") {
      extractedMetrics[header] = parseTempoVisualizacao(metricValue) || "";
    } else if (header === "Tempo Médio de Visualização") {
      const seg = parseTempoVisualizacao(metricValue);
      extractedMetrics[header] = seg > 0 ? seg : "";
    } else if (header === "Data de Publicação") {
      extractedMetrics[header] = parseDocAIDate(metricValue) || "";
    } else if (TEXT_HEADERS.includes(header)) {
      extractedMetrics[header] = metricValue;
    } else {
      const numericMatch = metricValue.match(/[\d.,]+\s*(mil|mi)?/i);
      extractedMetrics[header] = numericMatch
        ? parseNumericValuePercent(numericMatch[0], header)
        : "";
    }
  }
  console.debug("Extracted Metrics:", extractedMetrics);
  return extractedMetrics;
}

// =============================================================================
// Consolidação e validação dos dados extraídos
// =============================================================================
function initializeConsolidatedMetrics(): Record<string, unknown> {
  const consolidated: Record<string, unknown> = {};
  FIXED_HEADERS.forEach((h) => { consolidated[h] = h; });
  NUMERIC_HEADERS.forEach((h) => { consolidated[h] = ""; });
  PERCENTAGE_HEADERS.forEach((h) => { consolidated[h] = ""; });
  TEXT_HEADERS.forEach((h) => { consolidated[h] = ""; });
  return consolidated;
}

function validateMetrics(metrics: Record<string, unknown>): Record<string, unknown> {
  // Possíveis validações adicionais podem ser implementadas aqui.
  return metrics;
}

/**
 * Consolida os valores validados, preservando o primeiro valor encontrado para cada métrica.
 * Se um valor já foi definido, novos valores são ignorados.
 */
function consolidateMetrics(
  consolidated: Record<string, unknown>,
  validated: Record<string, unknown>
): Record<string, unknown> {
  Object.keys(validated).forEach((key) => {
    if (validated[key] !== "" && (consolidated[key] === "" || consolidated[key] === undefined)) {
      consolidated[key] = validated[key];
    } else if (validated[key] !== "" && consolidated[key] !== "" && consolidated[key] !== undefined) {
      console.debug(`Valor duplicado para "${key}" detectado. Mantendo o primeiro valor: ${consolidated[key]}`);
    }
  });
  return consolidated;
}

// =============================================================================
// Funções Auxiliares de Parse (Datas, Tempo e Valores Numéricos)
// =============================================================================
function parseNumericValuePercent(value: string, metricName: string): number | string {
  let multiplier = 1;
  let str = value.toLowerCase();
  if (str.includes("mil")) {
    multiplier = 1000;
    str = str.replace("mil", "").trim();
  } else if (str.includes("mi")) {
    multiplier = 1000000;
    str = str.replace("mi", "").trim();
  }
  // Remove caracteres não-numéricos (exceto pontos e vírgulas)
  str = str.replace(/[^\d.,]/g, "").trim();
  let isPercent = false;
  if (str.endsWith("%")) {
    isPercent = true;
    str = str.slice(0, -1).trim();
  }
  const commaCount = (str.match(/,/g) || []).length;
  if (commaCount === 1) {
    str = str.replace(",", ".");
  } else if (commaCount > 1) {
    str = str.replace(/,/g, "");
  }
  const num = parseFloat(str);
  if (isNaN(num)) return "";
  let result = num * multiplier;
  if (PERCENTAGE_HEADERS.includes(metricName) || isPercent) {
    result /= 100;
  }
  return result;
}

function parseTempoVisualizacao(tempoStr: string): number {
  if (!tempoStr) return 0;
  const regex = /(\d+)\s*(a|d|h|min|s)/gi;
  let match: RegExpExecArray | null;
  let anos = 0, dias = 0, horas = 0, minutos = 0, segundos = 0;
  while ((match = regex.exec(tempoStr)) !== null) {
    const valor = parseInt(match[1]!, 10);
    const unidade = match[2]!.toLowerCase();
    switch (unidade) {
      case "a": anos += valor; break;
      case "d": dias += valor; break;
      case "h": horas += valor; break;
      case "min": minutos += valor; break;
      case "s": segundos += valor; break;
    }
  }
  const totalSegundos = anos * 31536000 + dias * 86400 + horas * 3600 + minutos * 60 + segundos;
  const MAX_SEGUNDOS = 5 * 31536000;
  return totalSegundos > MAX_SEGUNDOS ? MAX_SEGUNDOS : totalSegundos;
}

function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;
  if (durationStr.includes(":")) {
    const parts = durationStr.split(":").map((p) => parseInt(p, 10));
    let horas = 0, minutos = 0, segundos = 0;
    if (parts.length === 3) {
      [horas, minutos, segundos] = parts as [number, number, number];
    } else if (parts.length === 2) {
      [minutos, segundos] = parts as [number, number];
    } else {
      return 0;
    }
    return horas * 3600 + minutos * 60 + segundos;
  } else {
    // Ex.: "2h 30m 10s"
    const regex = /(\d+)\s*h|\b(\d+)\s*m\b|\b(\d+)\s*s\b/g;
    let match: RegExpExecArray | null;
    let horas = 0, minutos = 0, segundos = 0;
    while ((match = regex.exec(durationStr)) !== null) {
      if (match[1]) horas += parseInt(match[1], 10);
      if (match[2]) minutos += parseInt(match[2], 10);
      if (match[3]) segundos += parseInt(match[3], 10);
    }
    return horas * 3600 + minutos * 60 + segundos;
  }
}

function parseDocAIDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } else {
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
    let dia = "", mes = "", ano = "";
    for (const part of parts) {
      if (!isNaN(Number(part)) && part.length === 4) {
        ano = part;
      } else if (!isNaN(Number(part))) {
        dia = part.padStart(2, "0");
      } else if (MESES_MAP[part]) {
        mes = MESES_MAP[part];
      }
    }
    if (!ano) {
      ano = new Date().getFullYear().toString();
    }
    return dia && mes && ano ? `${dia}/${mes}/${ano}` : "";
  }
}

// =============================================================================
// Funções Exportadas para Processamento de Imagens
// =============================================================================
export async function processImageFile(
  base64File: string,
  mimeType: string
): Promise<Record<string, unknown>> {
  const buffer = Buffer.from(base64File, "base64");
  const docAIResponse = await callDocumentAI(buffer, mimeType);
  const labeledMetrics = extractLabeledMetricsFromDocumentAIResponse(docAIResponse);
  const consolidated = initializeConsolidatedMetrics();
  const validated = validateMetrics(labeledMetrics);
  const finalMetrics = consolidateMetrics(consolidated, validated);
  console.debug("Final consolidated metrics:", finalMetrics);
  return finalMetrics;
}

export async function processMultipleImages(
  images: { base64File: string; mimeType: string }[]
): Promise<{
  rawDataArray: Record<string, unknown>[];
  stats: Record<string, unknown>;
}> {
  // Consolidação global: preserva para cada métrica o primeiro valor válido dentre todas as imagens
  let globalConsolidated = initializeConsolidatedMetrics();
  for (const img of images) {
    const extracted = await processImageFile(img.base64File, img.mimeType);
    globalConsolidated = consolidateMetrics(globalConsolidated, validateMetrics(extracted));
  }
  // Calcula as estatísticas com base no objeto consolidado único
  const stats = calcFormulas([globalConsolidated]);
  console.debug("Calculated stats:", stats);
  return { rawDataArray: [globalConsolidated], stats };
}
