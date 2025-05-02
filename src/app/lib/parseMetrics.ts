// src/app/lib/parseMetrics.ts - v3.2 (Função processImageFile Definida)

// Importa dependências externas e internas necessárias
import fetch from "node-fetch"; // Para fazer chamadas HTTP (ex: Document AI)
import { GoogleAuth, GoogleAuthOptions } from "google-auth-library"; // Para autenticação Google Cloud
import { calcFormulas } from "./formulas"; // Função para calcular métricas derivadas (v1.1 Padronizado)
import { logger } from '@/app/lib/logger'; // Logger da aplicação

// --- Configurações e Constantes ---

// Endpoint da API do Google Document AI (ler da variável de ambiente)
const DOCUMENT_AI_ENDPOINT = process.env.DOCUMENT_AI_ENDPOINT || "";
// Número máximo de tentativas para chamar a API do Document AI
const MAX_RETRIES = 3;
// Credenciais da conta de serviço do Google Cloud (ler da variável de ambiente)
const GOOGLE_CREDENTIALS_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

// Mapeamento dos nomes extraídos do Document AI (Português) para as chaves canônicas/descritivas (Inglês)
// Usado para padronizar a estrutura de dados antes de salvar no MetricModel
const MANUAL_TO_CANONICAL_MAP: { [key: string]: string } = {
    // Métricas Primárias -> Chaves correspondentes à interface IMetricStats
    "curtidas": "likes",
    "comentários": "comments",
    "compartilhamentos": "shares",
    "salvamentos": "saved",
    "contas alcançadas": "reach",
    "impressões": "impressions",
    "reproduções": "views", // Mapeia 'Reproduções' e 'Visualizações' para 'views'
    "visualizações": "views", // Alias
    "visitas ao perfil": "profile_visits", // Chave da API v19+
    "começaram a seguir": "follows", // Chave da API v19+
    // Métricas Manuais/Calculadas -> Chaves descritivas (armazenadas em Metric.stats via Mixed type)
    "reproduções iniciais": "initial_plays",
    "repetições": "repeats",
    "interações do reel": "reel_interactions",
    "contas com engajamento": "engaged_accounts",
    "duração": "video_duration_seconds", // Em segundos
    "tempo médio de visualização": "average_video_watch_time_seconds", // Em segundos
    "tempo de visualização": "total_watch_time_seconds", // Em segundos
    "contas alcançadas de seguidores": "reach_followers_ratio", // Como ratio (0-1)
    "contas alcançadas de não seguidores": "reach_non_followers_ratio", // Como ratio (0-1)
    // Métricas auxiliares (podem não ir para o stats final se não forem necessárias)
    "reproduções totais": "total_plays_manual",
    "interações totais": "total_interactions_manual",
    // Campos Textuais -> Mapeados para campos de nível superior do MetricModel
    "data de publicação": "postDate", // Chave temporária para parse -> Metric.postDate (Date)
    "caption": "description", // -> Metric.description (String)
    "formato": "format", // -> Metric.format (String)
    "proposta do conteúdo": "proposal", // -> Metric.proposal (String)
    "contexto do conteúdo": "context", // -> Metric.context (String)
    "link do conteúdo": "postLink", // -> Metric.postLink (String)
    "tema do conteúdo": "theme", // -> Metric.theme (String, adicionar ao Schema)
    "collab": "collab", // -> Metric.collab (Boolean, adicionar ao Schema)
    "creator da collab": "collabCreator", // -> Metric.collabCreator (String, adicionar ao Schema)
    "capa do conteúdo": "coverUrl" // -> Metric.coverUrl (String, adicionar ao Schema)
};

// Conjunto de chaves canônicas que correspondem a campos de NÍVEL SUPERIOR no MetricModel
const TOP_LEVEL_FIELDS = new Set([
    "postDate", // Tratamento especial para converter em Date
    "description",
    "format",
    "proposal",
    "context",
    "postLink",
    "theme",
    "collab",
    "collabCreator",
    "coverUrl"
]);

// Conjuntos de nomes ORIGINAIS para ajudar no parsing (não usados como chaves finais)
const NUMERIC_HEADERS_REF = new Set([
  "Reproduções Totais", "Reproduções no Facebook", "Reproduções", "Reproduções Iniciais",
  "Repetições", "Interações Totais", "Interações do Reel", "Reações no Facebook",
  "Curtidas", "Comentários", "Compartilhamentos", "Salvamentos", "Impressões",
  "Impressões na Página Inicial", "Impressões no Perfil", "Impressões de Outra Pessoa",
  "Impressões de Explorar", "Contas Alcançadas",
  "Contas Alcançadas de Seguidores", "Contas Alcançadas de Não Seguidores",
  "Contas com Engajamento", "Contas com Engajamento de Seguidores",
  "Contas com Engajamento de Não Seguidores", "Visitas ao Perfil", "Começaram a Seguir",
  "Visualizações", "Visualizações de Seguidores", "Visualizações de Não Seguidores",
]);
const PERCENTAGE_HEADERS_REF = new Set([
  "Contas Alcançadas de Seguidores", "Contas Alcançadas de Não Seguidores",
  "Contas com Engajamento de Seguidores", "Contas com Engajamento de Não Seguidores",
  "Visualizações de Seguidores", "Visualizações de Não Seguidores",
  "Interações de Seguidores", "Interações de Não Seguidores"
]);
const TEXT_HEADERS_REF = new Set([
  "Data de Publicação", "Hora de Publicação", "Creator", "Caption", "Formato",
  "Proposta do Conteúdo", "Contexto do Conteúdo", "Tema do Conteúdo", "Collab",
  "Creator da Collab", "Link do Conteúdo", "Capa do Conteúdo"
]);
const TIME_HEADERS_REF = new Set(["Tempo de Visualização", "Duração", "Tempo Médio de Visualização"]);

// --- Funções Auxiliares ---

/**
 * Normaliza uma string: converte para minúsculas, remove espaços extras e acentos.
 * @param str A string a ser normalizada.
 * @returns A string normalizada.
 */
const normalize = (str: string): string =>
  str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// --- Interfaces para Document AI ---
interface DocumentAIEntity { type?: string; mentionText?: string; }
interface DocumentAIResponse { document?: { entities?: DocumentAIEntity[]; text?: string; }; }

// --- Chamada à API do Document AI ---

/**
 * Chama a API do Google Document AI com retentativas.
 * @param fileBuffer Buffer do arquivo de imagem.
 * @param mimeType Mime type do arquivo (ex: 'image/png').
 * @returns A resposta JSON da API do Document AI.
 * @throws Erro se a chamada falhar após as retentativas ou se a configuração estiver incorreta.
 */
async function callDocumentAI(
  fileBuffer: Buffer,
  mimeType: string
): Promise<DocumentAIResponse> {
  const TAG = '[callDocumentAI v3.2]'; // Atualiza tag
  // Valida configuração das variáveis de ambiente
  if (!DOCUMENT_AI_ENDPOINT) {
    logger.error(`${TAG} Erro: DOCUMENT_AI_ENDPOINT não definido.`);
    throw new Error("DOCUMENT_AI_ENDPOINT não definido.");
  }
  if (!GOOGLE_CREDENTIALS_JSON) {
    logger.error(`${TAG} Erro: Variável GOOGLE_SERVICE_ACCOUNT_JSON não definida.`);
    throw new Error("Credenciais do Google Cloud não configuradas.");
  }

  // Processa as credenciais JSON (incluindo correção da chave privada)
  let googleCredentials;
  try {
    const parsedJson = JSON.parse(GOOGLE_CREDENTIALS_JSON);
    if (parsedJson.private_key && typeof parsedJson.private_key === 'string') {
        // Substitui literais '\n' por newlines reais na chave privada
        parsedJson.private_key = parsedJson.private_key.replace(/\\n/g, '\n');
    } else {
        throw new Error('private_key ausente ou inválido.');
    }
    googleCredentials = parsedJson;
  } catch (e) {
    logger.error(`${TAG} Erro ao processar credenciais JSON:`, e);
    throw new Error("Erro ao processar credenciais Google Cloud.");
  }

  // Configura autenticação Google
  const authOptions: GoogleAuthOptions = { credentials: googleCredentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] };
  const auth = new GoogleAuth(authOptions);

  // Obtém token de acesso
  const accessToken = await auth.getAccessToken();
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Token de acesso Google vazio ou inválido.");
  }

  // Monta o payload para a API do Document AI
  const payload = { rawDocument: { content: fileBuffer.toString("base64"), mimeType } };

  // Lógica de retentativas para a chamada da API
  let attempt = 0;
  let response;
  while (attempt < MAX_RETRIES) {
    attempt++;
    logger.debug(`${TAG} Tentativa ${attempt}/${MAX_RETRIES}...`);
    try {
      // Faz a chamada fetch para o endpoint do Document AI
      response = await fetch(DOCUMENT_AI_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Se a resposta for OK (status 2xx), sai do loop de retentativas
      if (response.ok) break;
      // Loga o erro se a resposta não for OK
      const errorText = await response.text();
      logger.warn(`${TAG} Tentativa ${attempt} falhou (${response.status}): ${errorText.substring(0, 200)}...`);
    } catch (err) {
      // Loga erro de rede ou fetch
      logger.error(`${TAG} Tentativa ${attempt} falhou (fetch):`, err);
      // Se for a última tentativa, relança o erro
      if (attempt === MAX_RETRIES) throw err;
    }
    // Espera exponencial antes da próxima tentativa (1s, 2s, 3s)
    await new Promise((res) => setTimeout(res, 1000 * attempt));
  }

  // Verifica se a chamada foi bem-sucedida após todas as tentativas
  if (!response || !response.ok) {
    const text = response ? await response.text().catch(() => "N/A") : "N/A";
    throw new Error(`Erro Document AI (${response?.status}): ${text.substring(0, 200)}...`);
  }

  // Parseia a resposta JSON e retorna
  const json = (await response.json()) as DocumentAIResponse;
  logger.debug(`${TAG} Resposta DocAI recebida.`);
  return json;
}

// --- Extração e Mapeamento de Métricas ---

/**
 * Extrai métricas da resposta do Document AI, mapeia para chaves canônicas
 * e separa entre campos de nível superior e campos para 'stats'.
 * @param response A resposta da API do Document AI.
 * @returns Um objeto contendo `{ topLevel: {...}, stats: {...} }`.
 */
export function extractAndMapMetricsFromDocAI(
  response: DocumentAIResponse
): { topLevel: Record<string, unknown>, stats: Record<string, unknown> } {
  const TAG = '[extractAndMapMetrics v3.2]'; // Atualiza tag
  const document = response.document || {};
  const entities = document.entities || []; // Array de entidades (label: value) extraídas
  const extractedTopLevel: Record<string, unknown> = {}; // Para campos como description, format, etc.
  const extractedStats: Record<string, unknown> = {}; // Para métricas numéricas (likes, reach, etc.)

  logger.debug(`${TAG} Mapeando ${entities.length} entidades...`);
  // Itera sobre cada entidade encontrada pelo Document AI
  for (const entity of entities) {
    const originalType = entity.type ?? ""; // Nome original da métrica (ex: "Curtidas")
    const normalizedType = normalize(originalType); // Normaliza o nome (minúsculo, sem acentos)
    const canonicalKey = MANUAL_TO_CANONICAL_MAP[normalizedType]; // Busca a chave canônica no mapa

    // Se não encontrou mapeamento, ignora esta entidade
    if (!canonicalKey) continue;

    // Valor textual extraído pelo Document AI
    const metricValue = entity.mentionText ? entity.mentionText.trim() : "";
    let parsedValue: unknown = ""; // Variável para guardar o valor após parsing

    // Aplica a função de parsing correta baseada no NOME ORIGINAL da métrica
    try {
        if (originalType === "Duração") parsedValue = parseDuration(metricValue);
        else if (TIME_HEADERS_REF.has(originalType)) parsedValue = parseTempoVisualizacao(metricValue); // Tempo de Vis e Tempo Médio
        else if (originalType === "Data de Publicação") parsedValue = parseDocAIDate(metricValue); // Retorna Date ou null
        else if (TEXT_HEADERS_REF.has(originalType)) {
            parsedValue = metricValue; // Usa o valor como string
            if (canonicalKey === 'collab' && typeof parsedValue === 'string') { // Converte 'collab' para boolean
                parsedValue = ['sim', 'yes', 'true', '1'].includes(parsedValue.toLowerCase());
            }
        } else parsedValue = parseNumericValuePercent(metricValue, originalType); // Assume numérico/percentual
    } catch (parseError) {
        logger.error(`${TAG} Erro parse metric "${originalType}":`, parseError);
        parsedValue = ""; // Define como vazio em caso de erro
    }

    // Armazena o valor parseado no objeto correto (topLevel ou stats),
    // apenas se o valor for válido e a chave ainda não existir (preserva o primeiro)
    if (parsedValue !== "" && parsedValue !== undefined && parsedValue !== null) {
        if (TOP_LEVEL_FIELDS.has(canonicalKey)) {
            if (canonicalKey === 'postDate') {
                if (parsedValue instanceof Date && !extractedTopLevel['postDate']) extractedTopLevel['postDate'] = parsedValue;
            } else if (!extractedTopLevel[canonicalKey]) extractedTopLevel[canonicalKey] = parsedValue;
        } else {
            if (!extractedStats[canonicalKey]) extractedStats[canonicalKey] = parsedValue;
        }
    } else if (canonicalKey === 'postDate' && parsedValue === null && !extractedTopLevel['postDate']) {
        extractedTopLevel['postDate'] = null; // Permite postDate ser null
    }
  }
  logger.debug(`${TAG} Mapeamento concluído.`);
  // Retorna os dois objetos separados
  return { topLevel: extractedTopLevel, stats: extractedStats };
}

// --- Consolidação de Métricas ---

/**
 * Inicializa um objeto vazio para guardar os dados consolidados.
 */
function initializeConsolidatedMetrics(): { topLevel: Record<string, unknown>, stats: Record<string, unknown> } {
  return { topLevel: {}, stats: {} };
}

/**
 * Consolida os dados extraídos de uma imagem no objeto global.
 * Preserva o primeiro valor válido encontrado para cada chave.
 */
function consolidateMetrics(
  globalConsolidated: { topLevel: Record<string, unknown>, stats: Record<string, unknown> },
  extracted: { topLevel: Record<string, unknown>, stats: Record<string, unknown> }
): { topLevel: Record<string, unknown>, stats: Record<string, unknown> } {
    // Consolida campos de nível superior
    Object.keys(extracted.topLevel).forEach((key) => {
        const value = extracted.topLevel[key];
        // Adiciona se for válido e chave não existir ou for null
        if (value !== undefined && value !== "" && (globalConsolidated.topLevel[key] === undefined || globalConsolidated.topLevel[key] === null)) {
             globalConsolidated.topLevel[key] = value;
        }
    });
    // Consolida campos de stats
    Object.keys(extracted.stats).forEach((key) => {
        const value = extracted.stats[key];
         // Adiciona se for válido e chave não existir
         if (value !== undefined && value !== "" && globalConsolidated.stats[key] === undefined) {
            globalConsolidated.stats[key] = value;
        }
    });
  return globalConsolidated; // Retorna o objeto acumulador modificado
}

// --- Funções Auxiliares de Parsing ---

/**
 * Converte um valor textual (com K, M, %, vírgula/ponto) em número.
 */
function parseNumericValuePercent(value: string | number | undefined | null, metricNameOriginal: string): number | string {
    if (value === undefined || value === null || value === "") return "";
    if (typeof value === 'number') return value;
    let multiplier = 1; let str = value.toLowerCase().trim();
    if (str.endsWith("k")) { multiplier = 1000; str = str.slice(0, -1).trim(); }
    else if (str.endsWith("m")) { multiplier = 1000000; str = str.slice(0, -1).trim(); }
    else if (str.includes("mil")) { multiplier = 1000; str = str.replace("mil", "").trim(); }
    else if (str.includes("mi")) { multiplier = 1000000; str = str.replace("mi", "").trim(); }
    str = str.replace(/[^\d.,]/g, "").trim();
    let isPercent = false; if (str.endsWith("%")) { isPercent = true; str = str.slice(0, -1).trim(); }
    const hasDot = str.includes('.'); const hasComma = str.includes(',');
    if (hasDot && hasComma) { if (str.lastIndexOf(',') > str.lastIndexOf('.')) { str = str.replace(/\./g, "").replace(",", "."); } else { str = str.replace(/,/g, ""); } }
    else if (hasComma) { str = str.replace(",", "."); }
    const num = parseFloat(str); if (isNaN(num)) return "";
    let result = num * multiplier; return result; // Retorna número (ex: 15 para 15%)
}

/**
 * Converte uma string de tempo (ex: "1 d 2 h 30 min 15 s") em segundos.
 */
function parseTempoVisualizacao(tempoStr: string | number | undefined | null): number {
  if (tempoStr === undefined || tempoStr === null || tempoStr === "") return 0;
  if (typeof tempoStr === 'number') return tempoStr;
  const str = tempoStr.toLowerCase().trim(); const regex = /(\d+)\s*(a|d|h|min|m|s)/gi;
  let match: RegExpExecArray | null; let anos = 0, dias = 0, horas = 0, minutos = 0, segundos = 0;
  while ((match = regex.exec(str)) !== null) {
    const valor = parseInt(match[1]!, 10); if (isNaN(valor)) continue;
    const unidade = match[2]!.toLowerCase();
    switch (unidade) {
      case "a": anos += valor; break; case "d": dias += valor; break; case "h": horas += valor; break;
      case "min": case "m": minutos += valor; break; case "s": segundos += valor; break;
    }
  } return anos * 31536000 + dias * 86400 + horas * 3600 + minutos * 60 + segundos;
}

/**
 * Converte uma string de duração (ex: "01:30:15", "2m 10s") em segundos.
 */
function parseDuration(durationStr: string | number | undefined | null): number {
  if (durationStr === undefined || durationStr === null || durationStr === "") return 0;
  if (typeof durationStr === 'number') return durationStr;
  const str = String(durationStr).trim();
  if (str.includes(":")) {
    const parts = str.split(":").map((p) => parseInt(p.trim(), 10)); const validParts = parts.filter(p => !isNaN(p));
    let h = 0, m = 0, s = 0;
    if (validParts.length === 3) { [h, m, s] = validParts as [number, number, number]; }
    else if (validParts.length === 2) { [m, s] = validParts as [number, number]; }
    else if (validParts.length === 1) { s = validParts[0] ?? 0; }
    else { logger.warn(`[parseDuration v3.2] Formato inválido (com :): "${durationStr}"`); return 0; }
    return h * 3600 + m * 60 + s;
  } else {
    const regex = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*(?:min|m))?\s*(?:(\d+)\s*s)?/i; const match = str.match(regex);
    if (match) {
        const h = parseInt(match[1] || '0', 10); const m = parseInt(match[2] || '0', 10); const s = parseInt(match[3] || '0', 10);
        if (!isNaN(h) && !isNaN(m) && !isNaN(s)) { return h * 3600 + m * 60 + s; }
    }
    const segPuros = parseFloat(str.replace(/[^\d.]/g, ""));
    if (!isNaN(segPuros)) { logger.debug(`[parseDuration v3.2] Fallback segundos puros: "${durationStr}" -> ${segPuros}`); return Math.round(segPuros); }
    logger.warn(`[parseDuration v3.2] Parse falhou: "${durationStr}"`); return 0;
  }
}

/**
 * Converte uma string de data em diversos formatos para um objeto Date (ou null).
 */
function parseDocAIDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null; const str = dateStr.trim(); const TAG = '[parseDocAIDate v3.2]';
  try { const d = new Date(str); if (!isNaN(d.getTime())) { const y = d.getFullYear(); if (y > 1970 && y < 2100) return d; } } catch (e) { /* Ignora */ }
  const MESES_MAP: Record<string, string> = {
    janeiro: "01", fev: "02", fevereiro: "02", mar: "03", março: "03", marco: "03",
    abr: "04", abril: "04", mai: "05", maio: "05", jun: "06", junho: "06",
    jul: "07", julho: "07", ago: "08", agosto: "08", set: "09", setembro: "09",
    out: "10", outubro: "10", nov: "11", novembro: "11", dez: "12", dezembro: "12",
   };
  const parts = str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/,/g, '').split(/[\s]+(?:de|às|as)?[\s]+/);
  let dia = "", mes = "", ano = "", hora = "12", min = "00";
  for (const p of parts) {
    if (!p) continue; if (!isNaN(Number(p))) { if (p.length === 4 && !ano && Number(p) > 1900) ano = p; else if (p.length <= 2 && !dia && Number(p) > 0 && Number(p) <= 31) dia = p.padStart(2, "0"); else if (p.includes(':') && hora === "12") { const tp = p.split(':'); if (tp.length >= 2) { const h = parseInt(tp[0] ?? '', 10); const m = parseInt(tp[1] ?? '', 10); if (!isNaN(h) && h >= 0 && h < 24 && !isNaN(m) && m >= 0 && m < 60) { hora = String(h).padStart(2, '0'); min = String(m).padStart(2, '0'); } } } } else if (MESES_MAP[p] && !mes) mes = MESES_MAP[p];
   }
  if (!ano) { const ym = str.match(/\b(\d{4})\b/); if (ym && ym[1]) ano = ym[1]; }
  if (dia && mes && ano) {
    const dsUTC = `${ano}-${mes}-${dia}T${hora}:${min}:00Z`; const fd = new Date(dsUTC);
    if (!isNaN(fd.getTime())) { if (fd.getUTCFullYear() === parseInt(ano) && fd.getUTCMonth() === parseInt(mes) - 1 && fd.getUTCDate() === parseInt(dia)) return fd; }
   }
  const dp = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (dp) {
       let d, m, y; const p1 = parseInt(dp[1]!, 10); const p2 = parseInt(dp[2]!, 10); const p3 = parseInt(dp[3]!, 10);
       if (p1 > 12 && p2 <= 12) [d, m, y] = [p1, p2, p3]; else if (p2 > 12 && p1 <= 12) [m, d, y] = [p1, p2, p3]; else [d, m, y] = [p1, p2, p3];
       if (y < 100) y += 2000;
       if (d && m && y && d > 0 && d <= 31 && m > 0 && m <= 12 && y > 1970 && y < 2100) {
           const dsUTC = `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00Z`; const fd = new Date(dsUTC);
            if (!isNaN(fd.getTime()) && fd.getUTCFullYear() === y && fd.getUTCMonth() === m - 1 && fd.getUTCDate() === d) return fd;
       }
   }
  logger.warn(`${TAG} Parse de data falhou: "${dateStr}"`); return null;
}

// --- Função de Processamento de Imagem Única (Definida Agora) ---

/**
 * Processa um único arquivo de imagem, chamando Document AI e mapeando métricas.
 * @param base64File Conteúdo da imagem em base64.
 * @param mimeType Mime type da imagem.
 * @returns Objeto com campos topLevel e stats (chaves canônicas).
 * @throws Erro se o processamento falhar.
 */
async function processImageFile( // <<< FUNÇÃO DEFINIDA AQUI >>>
  base64File: string,
  mimeType: string
): Promise<{ topLevel: Record<string, unknown>, stats: Record<string, unknown> }> {
  const TAG = '[processImageFile v3.2]'; // Atualiza tag
  try {
    logger.debug(`${TAG} Processando imagem (mime: ${mimeType})...`);
    // Converte base64 para Buffer
    const buffer = Buffer.from(base64File, "base64");
    // Chama a API do Document AI
    const docAIResponse = await callDocumentAI(buffer, mimeType);
    // Extrai e mapeia as métricas da resposta
    const extractedMetrics = extractAndMapMetricsFromDocAI(docAIResponse);
    logger.debug(`${TAG} Métricas extraídas e mapeadas da imagem.`);
    // Retorna o resultado separado em topLevel e stats
    return extractedMetrics;
  } catch (error) {
      logger.error(`${TAG} Erro ao processar imagem individual:`, error);
      // Relança o erro para ser tratado pela função chamadora (processMultipleImages)
      throw error;
  }
}


// --- Função Principal Exportada ---
/**
 * Processa múltiplas imagens de métricas manuais.
 * 1. Chama processImageFile para cada imagem.
 * 2. Consolida os resultados, preservando o primeiro valor válido para cada chave.
 * 3. Calcula métricas derivadas usando a função `calcFormulas`.
 * @param images Array de objetos contendo base64 e mimeType de cada imagem.
 * @returns Objeto com dados consolidados e calculados.
 * @throws Erro se houver falha crítica no processamento.
 */
export async function processMultipleImages(
  images: { base64File: string; mimeType: string }[]
): Promise<{
  consolidatedTopLevel: Record<string, unknown>;
  consolidatedStats: Record<string, unknown>;
  calculatedStats: Record<string, unknown>;
}> {
  const TAG = '[processMultipleImages v3.2]'; // Atualiza tag
  logger.info(`${TAG} Iniciando processamento de ${images.length} imagens...`);
  // Inicializa o objeto que acumulará os dados consolidados
  let globalConsolidated = initializeConsolidatedMetrics();

  // Itera sobre cada imagem fornecida
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    // Valida se os dados da imagem são válidos
    if (!img?.base64File || !img.mimeType) {
        logger.warn(`${TAG} Imagem ${i+1} inválida ou faltando dados, pulando.`);
        continue; // Pula para a próxima imagem
    }
    try {
        logger.debug(`${TAG} Processando imagem ${i + 1}/${images.length}...`);
        // <<< CHAMA A FUNÇÃO processImageFile AGORA DEFINIDA >>>
        const extracted = await processImageFile(img.base64File, img.mimeType);
        // Consolida os resultados extraídos no objeto global
        globalConsolidated = consolidateMetrics(globalConsolidated, extracted);
        logger.debug(`${TAG} Imagem ${i + 1} processada e consolidada.`);
    } catch (error) {
        // Loga erro no processamento da imagem, mas continua com as outras
        logger.error(`${TAG} Erro ao processar imagem ${i + 1}. Continuando...`, error);
        // Poderia adicionar uma estratégia aqui, como parar se muitas imagens falharem
    }
  }

  // Loga os resultados consolidados finais
  logger.debug(`${TAG} Consolidação global finalizada. TopLevel:`, globalConsolidated.topLevel);
  logger.debug(`${TAG} Consolidação global finalizada. Stats Brutos:`, globalConsolidated.stats);

  // Calcula as métricas derivadas usando APENAS os stats consolidados
  logger.debug(`${TAG} Calculando estatísticas finais...`);
  // Passa um array contendo apenas o objeto de stats consolidados para calcFormulas
  // calcFormulas deve retornar um objeto com chaves canônicas/descritivas
  const calculatedStats = calcFormulas([globalConsolidated.stats]);
  logger.info(`${TAG} Processamento de imagens concluído.`);

  // Retorna os três objetos separados: topLevel, stats brutos, stats calculados
  return {
      consolidatedTopLevel: globalConsolidated.topLevel,
      consolidatedStats: globalConsolidated.stats,
      calculatedStats: calculatedStats
  };
}
