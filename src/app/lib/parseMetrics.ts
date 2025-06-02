// src/app/lib/parseMetrics.ts - v3.3.1 (Revisado para alinhamento com MetricModel v1.5.2)
// - Objetivo: Padronizar a saída para facilitar a integração com MetricModel,
//   garantindo que as chaves canônicas e a estrutura (topLevel, stats)
//   estejam alinhadas com IMetric e IMetricStats (conforme MetricModel v1.5.2).
// - O código que chama 'processMultipleImages' será responsável pela construção final
//   do objeto MetricModel, incluindo a mesclagem de 'consolidatedStats' e 'calculatedStats'.

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

// Mapeamento dos nomes extraídos do Document AI (Português) para as chaves canônicas/descritivas
// Usado para padronizar a estrutura de dados antes de salvar no MetricModel
// As chaves resultantes devem corresponder aos campos em IMetric (para top-level) ou IMetricStats (para stats).
const MANUAL_TO_CANONICAL_MAP: { [key: string]: string } = {
    // Métricas Primárias -> Chaves correspondentes à interface IMetricStats
    "curtidas": "likes",
    "comentários": "comments",
    "compartilhamentos": "shares",
    "salvamentos": "saved",
    "contas alcançadas": "reach",
    "impressões": "impressions",
    "reproduções": "views", 
    "visualizações": "views", 
    "visitas ao perfil": "profile_visits", 
    "começaram a seguir": "follows", 
    
    "reproduções iniciais": "initial_plays",
    "repetições": "repeats",
    "interações do reel": "reel_interactions",
    "contas com engajamento": "engaged_accounts",
    "duração": "video_duration_seconds", // Em segundos (para IMetricStats)
    // Nota: Se "tempo médio de visualização" do DocAI for o mesmo que ig_reels_avg_watch_time da API,
    // mapear para ig_reels_avg_watch_time para consistência. Caso contrário, manter separado.
    "tempo médio de visualização": "average_video_watch_time_seconds", 
    // Nota: Se "tempo de visualização" do DocAI for o mesmo que ig_reels_video_view_total_time da API,
    // mapear para ig_reels_video_view_total_time. Caso contrário, manter separado.
    "tempo de visualização": "total_watch_time_seconds", 
    "contas alcançadas de seguidores": "reach_followers_ratio", 
    "contas alcançadas de não seguidores": "reach_non_followers_ratio", 
    
    "reproduções totais": "total_plays_manual",
    "interações totais": "total_interactions_manual",
    
    // Campos Textuais -> Mapeados para campos de nível superior do MetricModel (IMetric)
    "data de publicação": "postDate", 
    "caption": "description", 
    "formato": "format", 
    "proposta do conteúdo": "proposal", 
    "contexto do conteúdo": "context", 
    "link do conteúdo": "postLink", 
    "tema do conteúdo": "theme", 
    "collab": "collab", 
    "creator da collab": "collabCreator", 
    "capa do conteúdo": "coverUrl" 
};

// Conjunto de chaves canônicas que correspondem a campos de NÍVEL SUPERIOR no MetricModel (IMetric)
const TOP_LEVEL_FIELDS = new Set([
    "postDate", 
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
  const TAG = '[callDocumentAI v3.2]'; 
  if (!DOCUMENT_AI_ENDPOINT) {
    logger.error(`${TAG} Erro: DOCUMENT_AI_ENDPOINT não definido.`);
    throw new Error("DOCUMENT_AI_ENDPOINT não definido.");
  }
  if (!GOOGLE_CREDENTIALS_JSON) {
    logger.error(`${TAG} Erro: Variável GOOGLE_SERVICE_ACCOUNT_JSON não definida.`);
    throw new Error("Credenciais do Google Cloud não configuradas.");
  }

  let googleCredentials;
  try {
    const parsedJson = JSON.parse(GOOGLE_CREDENTIALS_JSON);
    if (parsedJson.private_key && typeof parsedJson.private_key === 'string') {
        parsedJson.private_key = parsedJson.private_key.replace(/\\n/g, '\n');
    } else {
        throw new Error('private_key ausente ou inválido nas credenciais JSON.');
    }
    googleCredentials = parsedJson;
  } catch (e: any) {
    logger.error(`${TAG} Erro ao processar credenciais JSON: ${e.message}`);
    throw new Error("Erro ao processar credenciais Google Cloud.");
  }

  const authOptions: GoogleAuthOptions = { credentials: googleCredentials, scopes: ["https://www.googleapis.com/auth/cloud-platform"] };
  const auth = new GoogleAuth(authOptions);

  const accessToken = await auth.getAccessToken();
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Token de acesso Google vazio ou inválido.");
  }

  const payload = { rawDocument: { content: fileBuffer.toString("base64"), mimeType } };

  let attempt = 0;
  let response;
  while (attempt < MAX_RETRIES) {
    attempt++;
    logger.debug(`${TAG} Tentativa ${attempt}/${MAX_RETRIES} para chamar Document AI...`);
    try {
      response = await fetch(DOCUMENT_AI_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.ok) break;
      const errorText = await response.text();
      logger.warn(`${TAG} Tentativa ${attempt} falhou (${response.status}): ${errorText.substring(0, 200)}...`);
    } catch (err: any) {
      logger.error(`${TAG} Tentativa ${attempt} falhou (fetch): ${err.message}`);
      if (attempt === MAX_RETRIES) throw err;
    }
    await new Promise((res) => setTimeout(res, 1000 * attempt));
  }

  if (!response || !response.ok) {
    const text = response ? await response.text().catch(() => "N/A") : "N/A";
    throw new Error(`Erro Document AI (${response?.status}): ${text.substring(0, 200)}...`);
  }

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
  const TAG = '[extractAndMapMetrics v3.2]'; 
  const document = response.document || {};
  const entities = document.entities || []; 
  const extractedTopLevel: Record<string, unknown> = {}; 
  const extractedStats: Record<string, unknown> = {}; 

  logger.debug(`${TAG} Mapeando ${entities.length} entidades...`);
  for (const entity of entities) {
    const originalType = entity.type ?? ""; 
    const normalizedType = normalize(originalType); 
    const canonicalKey = MANUAL_TO_CANONICAL_MAP[normalizedType]; 

    if (!canonicalKey) continue;

    const metricValue = entity.mentionText ? entity.mentionText.trim() : "";
    let parsedValue: unknown = ""; 

    try {
        if (originalType === "Duração") parsedValue = parseDuration(metricValue);
        else if (TIME_HEADERS_REF.has(originalType)) parsedValue = parseTempoVisualizacao(metricValue); 
        else if (originalType === "Data de Publicação") parsedValue = parseDocAIDate(metricValue); 
        else if (TEXT_HEADERS_REF.has(originalType)) {
            parsedValue = metricValue; 
            if (canonicalKey === 'collab' && typeof parsedValue === 'string') { 
                parsedValue = ['sim', 'yes', 'true', '1'].includes(parsedValue.toLowerCase());
            }
        } else parsedValue = parseNumericValuePercent(metricValue, originalType); 
    } catch (parseError: any) {
        logger.error(`${TAG} Erro ao parsear métrica "${originalType}" com valor "${metricValue}": ${parseError.message}`);
        parsedValue = ""; 
    }

    if (parsedValue !== "" && parsedValue !== undefined && parsedValue !== null) {
        if (TOP_LEVEL_FIELDS.has(canonicalKey)) {
            if (canonicalKey === 'postDate') {
                // Garante que postDate seja Date ou null
                if (parsedValue instanceof Date && !extractedTopLevel['postDate']) extractedTopLevel['postDate'] = parsedValue;
                else if (parsedValue === null && !extractedTopLevel['postDate']) extractedTopLevel['postDate'] = null;
            } else if (!extractedTopLevel[canonicalKey]) extractedTopLevel[canonicalKey] = parsedValue;
        } else {
            if (!extractedStats[canonicalKey]) extractedStats[canonicalKey] = parsedValue;
        }
    } else if (canonicalKey === 'postDate' && parsedValue === null && !extractedTopLevel['postDate']) {
        extractedTopLevel['postDate'] = null; 
    }
  }
  logger.debug(`${TAG} Mapeamento concluído. TopLevel:`, extractedTopLevel, "Stats:", extractedStats);
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
    Object.keys(extracted.topLevel).forEach((key) => {
        const value = extracted.topLevel[key];
        if (value !== undefined && value !== "" && (globalConsolidated.topLevel[key] === undefined || globalConsolidated.topLevel[key] === null)) {
             globalConsolidated.topLevel[key] = value;
        }
    });
    Object.keys(extracted.stats).forEach((key) => {
        const value = extracted.stats[key];
         if (value !== undefined && value !== "" && globalConsolidated.stats[key] === undefined) {
            globalConsolidated.stats[key] = value;
        }
    });
  return globalConsolidated; 
}

// --- Funções Auxiliares de Parsing ---

/**
 * Converte um valor textual (com K, M, %, vírgula/ponto) em número.
 * Retorna o número ou string vazia se não puder parsear.
 */
function parseNumericValuePercent(value: string | number | undefined | null, metricNameOriginal: string): number | "" {
    if (value === undefined || value === null || String(value).trim() === "") return "";
    if (typeof value === 'number') return value;
    let multiplier = 1; let str = String(value).toLowerCase().trim();
    
    if (str.endsWith("k")) { multiplier = 1000; str = str.slice(0, -1).trim(); }
    else if (str.endsWith("m")) { multiplier = 1000000; str = str.slice(0, -1).trim(); }
    else if (str.includes("mil")) { multiplier = 1000; str = str.replace("mil", "").trim(); }
    else if (str.includes("mi")) { multiplier = 1000000; str = str.replace("mi", "").trim(); }
    
    str = str.replace(/[^\d.,]/g, "").trim(); 
    
    if (str.endsWith("%")) { str = str.slice(0, -1).trim(); } 

    const hasDot = str.includes('.'); const hasComma = str.includes(',');
    if (hasDot && hasComma) { 
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) { str = str.replace(/\./g, "").replace(",", "."); } 
        else { str = str.replace(/,/g, ""); } 
    } else if (hasComma) { str = str.replace(",", "."); }
    
    const num = parseFloat(str); 
    if (isNaN(num)) return "";
    
    return num * multiplier; 
}

/**
 * Converte uma string de tempo (ex: "1 d 2 h 30 min 15 s") em segundos.
 */
function parseTempoVisualizacao(tempoStr: string | number | undefined | null): number {
  if (tempoStr === undefined || tempoStr === null || String(tempoStr).trim() === "") return 0;
  if (typeof tempoStr === 'number') return tempoStr;
  const str = String(tempoStr).toLowerCase().trim(); const regex = /(\d+)\s*(a|d|h|min|m|s)/gi;
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
  if (durationStr === undefined || durationStr === null || String(durationStr).trim() === "") return 0;
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
async function processImageFile( 
  base64File: string,
  mimeType: string
): Promise<{ topLevel: Record<string, unknown>, stats: Record<string, unknown> }> {
  const TAG = '[processImageFile v3.2]'; 
  try {
    logger.debug(`${TAG} Processando imagem (mime: ${mimeType})...`);
    const buffer = Buffer.from(base64File, "base64");
    const docAIResponse = await callDocumentAI(buffer, mimeType);
    const extractedMetrics = extractAndMapMetricsFromDocAI(docAIResponse);
    logger.debug(`${TAG} Métricas extraídas e mapeadas da imagem.`);
    return extractedMetrics;
  } catch (error) {
      logger.error(`${TAG} Erro ao processar imagem individual:`, error);
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
  consolidatedStats: Record<string, unknown>; // Métricas diretas do DocAI, mapeadas para chaves canônicas
  calculatedStats: Record<string, unknown>;    // Métricas calculadas por formulas.ts
}> {
  const TAG = '[processMultipleImages v3.3.1]'; // Versão atualizada
  logger.info(`${TAG} Iniciando processamento de ${images.length} imagens...`);
  let globalConsolidated = initializeConsolidatedMetrics();

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img?.base64File || !img.mimeType) {
        logger.warn(`${TAG} Imagem ${i+1} inválida ou faltando dados, pulando.`);
        continue; 
    }
    try {
        logger.debug(`${TAG} Processando imagem ${i + 1}/${images.length}...`);
        const extracted = await processImageFile(img.base64File, img.mimeType);
        globalConsolidated = consolidateMetrics(globalConsolidated, extracted);
        logger.debug(`${TAG} Imagem ${i + 1} processada e consolidada.`);
    } catch (error) {
        logger.error(`${TAG} Erro ao processar imagem ${i + 1}. Continuando...`, error);
    }
  }

  logger.debug(`${TAG} Consolidação global finalizada. TopLevel:`, globalConsolidated.topLevel);
  logger.debug(`${TAG} Consolidação global finalizada. Stats Brutos (consolidatedStats):`, globalConsolidated.stats);

  // Calcula as métricas derivadas usando APENAS os stats consolidados (que já têm chaves canônicas)
  logger.debug(`${TAG} Calculando estatísticas derivadas (calculatedStats)...`);
  const calculatedStats = calcFormulas([globalConsolidated.stats]); // calcFormulas espera um array
  logger.info(`${TAG} Processamento de imagens concluído.`);

  // A função que chama processMultipleImages será responsável por:
  // 1. Criar uma instância do MetricModel.
  // 2. Popular os campos de nível superior do MetricModel com os dados de 'consolidatedTopLevel'.
  // 3. Definir 'source' como 'document_ai'.
  // 4. Determinar e definir o 'type' (IMAGE, REEL, etc.) com base em 'consolidatedTopLevel.format' ou similar.
  // 5. Criar o objeto final 'stats' para o MetricModel, mesclando 'consolidatedStats' e 'calculatedStats'.
  //    Ex: const finalStatsForDB = { ...globalConsolidated.stats, ...calculatedStats };
  // 6. Salvar a instância do MetricModel.

  return {
      consolidatedTopLevel: globalConsolidated.topLevel,
      consolidatedStats: globalConsolidated.stats,
      calculatedStats: calculatedStats
  };
}
