// src/app/lib/parseMetrics.ts
import fetch from "node-fetch";

const DOCUMENT_AI_ENDPOINT = process.env.DOCUMENT_AI_ENDPOINT || "";
const DOCUMENT_AI_BEARER_TOKEN = process.env.DOCUMENT_AI_BEARER_TOKEN || "";
const MAX_RETRIES = 3;

// Exemplos de cabeçalhos, ajustados do seu script
const FIXED_HEADERS = ["Post", "Data"];
const NUMERIC_HEADERS: string[] = [/* ... */];
const PERCENTAGE_HEADERS: string[] = [/* ... */];
const TEXT_HEADERS: string[] = [/* ... */];

/**
 * Estrutura mínima para representar a resposta do Document AI
 * (caso queira tipar melhor, crie interfaces mais específicas).
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
 * processImageFile: recebe um Buffer + mimeType, chama Document AI e retorna um objeto
 * com todas as métricas consolidadas (ex.: { "Curtidas": 100, "Data de Publicação": "03/10/2024", ... }).
 */
export async function processImageFile(
  fileBuffer: Buffer,
  mimeType: string
): Promise<Record<string, unknown>> {
  let responseData: DocumentAIResponse | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      responseData = await callDocumentAI(fileBuffer, mimeType);
      if (responseData?.document) break;
    } catch (err) {
      console.log(`Tentativa ${attempt} falhou: ${String(err)}`);
      if (attempt === MAX_RETRIES) {
        throw err;
      }
    }
    // backoff
    await new Promise((res) => setTimeout(res, 1000 * attempt));
  }

  if (!responseData?.document) {
    throw new Error("Resposta inválida do Document AI.");
  }

  // Extrai métricas
  const labeledMetrics = extractLabeledMetricsFromDocumentAIResponse(responseData);

  // Consolida e retorna
  const consolidated = initializeConsolidatedMetrics();
  const validated = validateMetrics(labeledMetrics);
  const finalMetrics = consolidateMetrics(consolidated, validated);

  return finalMetrics;
}

/**
 * Chama Document AI, enviando base64 do arquivo.
 */
async function callDocumentAI(
  fileBuffer: Buffer,
  mimeType: string
): Promise<DocumentAIResponse> {
  if (!DOCUMENT_AI_ENDPOINT) {
    throw new Error("DOCUMENT_AI_ENDPOINT não definido.");
  }

  const payload = {
    rawDocument: {
      content: fileBuffer.toString("base64"),
      mimeType,
    },
  };

  const res = await fetch(DOCUMENT_AI_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${DOCUMENT_AI_BEARER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro Document AI: ${res.status} - ${text}`);
  }

  const json = (await res.json()) as DocumentAIResponse;
  return json;
}

/**
 * Lógica de extração e parse, adaptada do seu Apps Script.
 */
function extractLabeledMetricsFromDocumentAIResponse(
  response: DocumentAIResponse
): Record<string, unknown> {
  const document = response.document || {};
  const entities = document.entities || [];

  const validMetrics = [...NUMERIC_HEADERS, ...PERCENTAGE_HEADERS, ...TEXT_HEADERS];

  // Mapeamento de alias (se houver)
  const METRICS_ALIAS_MAP: Record<string, string> = {
    // "comentarios": "Comentários",
    // ...
  };

  const extractedMetrics: Record<string, unknown> = {};

  for (const entity of entities) {
    const rawType = entity.type || "";
    let metricName = normalizeHeader(rawType);
    const metricValue = entity.mentionText?.trim() || "";

    // Se houver alias, aplica
    if (METRICS_ALIAS_MAP[metricName]) {
      metricName = METRICS_ALIAS_MAP[metricName];
    }

    // Se não estiver nos headers válidos, ignora
    if (!validMetrics.includes(metricName)) {
      continue;
    }

    // Se for textual
    if (TEXT_HEADERS.includes(metricName)) {
      if (metricName === "Duração") {
        extractedMetrics[metricName] = parseDuration(metricValue) || "";
      } else if (metricName === "Tempo de Visualização") {
        extractedMetrics[metricName] = parseTempoVisualizacao(metricValue) || "";
      } else if (metricName === "Data de Publicação") {
        extractedMetrics[metricName] = parseDocAIDate(metricValue) || "";
      } else {
        extractedMetrics[metricName] = metricValue;
      }
    } else {
      // Numérico ou percentual
      if (metricName === "Tempo Médio de Visualização") {
        const seg = parseTempoVisualizacao(metricValue);
        extractedMetrics[metricName] = seg > 0 ? seg : "";
      } else {
        const numericMatch = metricValue.match(/[\d.,]+\s*(mil|mi)?/i);
        if (numericMatch) {
          extractedMetrics[metricName] = parseNumericValuePercent(numericMatch[0], metricName);
        } else {
          extractedMetrics[metricName] = "";
        }
      }
    }
  }

  return extractedMetrics;
}

/**
 * Inicializa o objeto "consolidated" com valores vazios
 * para cada header que deseja controlar.
 */
function initializeConsolidatedMetrics(): Record<string, unknown> {
  const consolidated: Record<string, unknown> = {};
  FIXED_HEADERS.forEach((h) => (consolidated[h] = ""));
  [...NUMERIC_HEADERS, ...PERCENTAGE_HEADERS, ...TEXT_HEADERS].forEach((h) => {
    consolidated[h] = "";
  });
  return consolidated;
}

/**
 * Caso queira normalizar ou validar as métricas extraídas, faça aqui.
 */
function validateMetrics(metrics: Record<string, unknown>): Record<string, unknown> {
  // Se quiser normalizar, faça aqui
  return metrics;
}

/**
 * Junta as métricas validadas no objeto consolidated, preenchendo
 * apenas se estiver vazio.
 */
function consolidateMetrics(
  consolidated: Record<string, unknown>,
  validated: Record<string, unknown>
): Record<string, unknown> {
  // Numéricos
  NUMERIC_HEADERS.forEach((header) => {
    const value = validated[header];
    if (value !== "" && consolidated[header] === "") {
      consolidated[header] = value;
    }
  });

  // Percentuais
  PERCENTAGE_HEADERS.forEach((header) => {
    const value = validated[header];
    if (value !== "" && consolidated[header] === "") {
      consolidated[header] = value;
    }
  });

  // Textuais
  TEXT_HEADERS.forEach((header) => {
    const value = validated[header];
    if (value !== "" && consolidated[header] === "") {
      consolidated[header] = value;
    }
  });

  return consolidated;
}

/**
 * Normaliza o cabeçalho removendo acentos e convertendo para lowercase.
 */
function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * parseNumericValuePercent: "12 mil", "3,5mi", "50%", etc.
 */
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

  // Remove caracteres não numéricos, exceto vírgula e ponto
  str = str.replace(/[^\d.,]/g, "").trim();

  let isPercent = false;
  if (str.endsWith("%")) {
    isPercent = true;
    str = str.slice(0, -1).trim();
  }

  // Ajusta vírgula decimal
  const commaCount = (str.match(/,/g) || []).length;
  if (commaCount === 1) {
    // "3,5" => "3.5"
    str = str.replace(",", ".");
  } else if (commaCount > 1) {
    // "3,000,000" => "3000000"
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

/**
 * parseTempoVisualizacao: converte "2h 15min" ou "90s" etc. em segundos.
 */
function parseTempoVisualizacao(tempoStr: string): number {
  if (!tempoStr) return 0;

  const regex = /(\d+)\s*(a|d|h|min|s)/gi;
  let match: RegExpExecArray | null;
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

  let totalSegundos = anos * 31536000 + dias * 86400 + horas * 3600 + minutos * 60 + segundos;
  const MAX_SEGUNDOS = 5 * 31536000;
  if (totalSegundos > MAX_SEGUNDOS) {
    totalSegundos = MAX_SEGUNDOS;
  }
  return totalSegundos;
}

/**
 * parseDuration: "HH:MM:SS" ou "1h 20m 30s" em segundos.
 */
function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;

  if (durationStr.includes(":")) {
    // "HH:MM:SS" ou "MM:SS"
    const parts = durationStr.split(":").map((p) => parseInt(p, 10));
    let horas = 0,
      minutos = 0,
      segundos = 0;

    if (parts.length === 3) {
      [horas, minutos, segundos] = parts;
    } else if (parts.length === 2) {
      [minutos, segundos] = parts;
    } else {
      return 0;
    }
    return horas * 3600 + minutos * 60 + segundos;
  } else {
    // Ex.: "2h 30m 10s"
    const regex = /(\d+)\s*h|\b(\d+)\s*m\b|\b(\d+)\s*s\b/g;
    let match: RegExpExecArray | null;
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

/**
 * parseDocAIDate: "3 de outubro de 2024" => "03/10/2024", etc.
 */
function parseDocAIDate(dateStr: string): string {
  if (!dateStr) return "";

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

  // Tenta converter diretamente (ex.: "2024-10-03")
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } else {
    // Tenta parse manual: "3 de outubro de 2024"
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
}
