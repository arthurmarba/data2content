// src/app/lib/parseMetrics.ts

import fetch from "node-fetch";
// path não é mais necessário para a chave
// import path from "path";
import { GoogleAuth, GoogleAuthOptions } from "google-auth-library"; // Importa GoogleAuthOptions
import { calcFormulas } from "./formulas";
import { IDailyMetric } from "@/app/models/DailyMetric";
import { logger } from '@/app/lib/logger'; // Importa o logger

// Configurações e variáveis de ambiente
const DOCUMENT_AI_ENDPOINT = process.env.DOCUMENT_AI_ENDPOINT || "";
const MAX_RETRIES = 3;
// <<< Variável para credenciais >>>
const GOOGLE_CREDENTIALS_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

// Cabeçalhos fixos
const FIXED_HEADERS = ["Post", "Data"];

// Cabeçalhos numéricos (conforme App Script)
const NUMERIC_HEADERS: string[] = [
  "Reproduções Totais", "Reproduções no Facebook", "Reproduções", "Reproduções Iniciais",
  "Repetições", "Interações Totais", "Interações do Reel", "Reações no Facebook",
  "Curtidas", "Comentários", "Compartilhamentos", "Salvamentos", "Impressões",
  "Impressões na Página Inicial", "Impressões no Perfil", "Impressões de Outra Pessoa",
  "Impressões de Explorar", "Impressões nas Hashtags", "Contas Alcançadas",
  "Contas Alcançadas de Seguidores", "Contas Alcançadas de Não Seguidores",
  "Contas com Engajamento", "Contas com Engajamento de Seguidores",
  "Contas com Engajamento de Não Seguidores", "Visitas ao Perfil", "Começaram a Seguir",
  "Visualizações", "Visualizações de Seguidores", "Visualizações de Não Seguidores",
  "Tempo de Visualização", "Duração", "Tempo Médio de Visualização"
];

// Cabeçalhos percentuais (conforme App Script)
const PERCENTAGE_HEADERS: string[] = [
  "Contas Alcançadas de Seguidores", "Contas Alcançadas de Não Seguidores",
  "Contas com Engajamento de Seguidores", "Contas com Engajamento de Não Seguidores",
  "Visualizações de Seguidores", "Visualizações de Não Seguidores",
  "Interações de Seguidores", "Interações de Não Seguidores"
];

// Cabeçalhos textuais (conforme App Script)
const TEXT_HEADERS: string[] = [
  "Data de Publicação", "Hora de Publicação", // Hora de Publicação pode ser extraída separadamente se necessário
  "Creator", "Caption", "Formato",
  "Proposta do Conteúdo", "Contexto do Conteúdo", "Tema do Conteúdo", "Collab",
  "Creator da Collab", "Link do Conteúdo", "Capa do Conteúdo"
];

// Função de normalização robusta (remove acentos e espaços extras)
const normalize = (str: string): string =>
  str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Mapeamento de alias (conforme App Script)
const METRICS_ALIAS_MAP: { [key: string]: string } = {
  comecaramaseguir: "Começaram a Seguir", comentarios: "Comentários",
  compartilhamentos: "Compartilhamentos", reproducoesiniciais: "Reproduções Iniciais",
  reproducoes: "Reproduções", contasalcancadas: "Contas Alcançadas",
  contasalcancadasdeseguidores: "Contas Alcançadas de Seguidores",
  contasalcancadasdenaoseguidores: "Contas Alcançadas de Não Seguidores",
  contascomengajamento: "Contas com Engajamento",
  contascomengajamentodeseguidores: "Contas com Engajamento de Seguidores",
  contascomengajamentodenaoseguidores: "Contas com Engajamento de Não Seguidores",
  interacoescomreels: "Interações do Reel", interacoesdoreel: "Interações do Reel",
  interacoes: "Interações Totais", interacoestotais: "Interações Totais",
  reacoesnofacebook: "Reações no Facebook", reproducoesinicias: "Reproduções Iniciais",
  reproducoesnofacebook: "Reproduções no Facebook", reproducoestotais: "Reproduções Totais",
  salvamentos: "Salvamentos", curtidas: "Curtidas", datadepublicacao: "Data de Publicação",
  duracao: "Duração", formato: "Formato", tempodevisualizacao: "Tempo de Visualização",
  tempomediodevisualizacao: "Tempo Médio de Visualização", visitasaoperfil: "Visitas ao Perfil",
  visualizacoes: "Visualizações", visualizacoesdeseguidores: "Visualizações de Seguidores",
  visualizacoesdenaoseguidores: "Visualizações de Não Seguidores", caption: "Caption",
  repeticoes: "Repetições", "repetições": "Repetições", linkdoconteudo: "Link do Conteúdo",
  capadoconteudo: "Capa do Conteúdo", "nao seguidores": "Visualizações de Não Seguidores"
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
  const TAG = '[callDocumentAI]'; // Tag para logs
  if (!DOCUMENT_AI_ENDPOINT) {
    logger.error(`${TAG} Erro: DOCUMENT_AI_ENDPOINT não definido.`);
    throw new Error("DOCUMENT_AI_ENDPOINT não definido.");
  }

  // --- MODIFICAÇÃO PARA USAR VARIÁVEL DE AMBIENTE ---
  if (!GOOGLE_CREDENTIALS_JSON) {
    logger.error(`${TAG} Erro: Variável de ambiente GOOGLE_SERVICE_ACCOUNT_JSON não definida.`);
    throw new Error("Credenciais do Google Cloud não configuradas no ambiente.");
  }

  let googleCredentials;
  try {
    // 1. Parse o JSON da variável de ambiente
    const parsedJson = JSON.parse(GOOGLE_CREDENTIALS_JSON);

    // 2. *** CORREÇÃO: Substitui '\\n' por '\n' na chave privada ***
    if (parsedJson.private_key && typeof parsedJson.private_key === 'string') {
        parsedJson.private_key = parsedJson.private_key.replace(/\\n/g, '\n');
    } else {
        logger.error(`${TAG} Campo 'private_key' ausente ou inválido nas credenciais parseadas.`);
        throw new Error('private_key ausente ou inválido nas credenciais do Google Cloud.');
    }
    // --- FIM DA CORREÇÃO ---

    googleCredentials = parsedJson; // Usa o objeto corrigido

  } catch (e) {
    logger.error(`${TAG} Erro ao fazer parse ou processar as credenciais JSON do Google Cloud:`, e);
    throw new Error("Formato inválido ou erro ao processar as credenciais do Google Cloud na variável de ambiente.");
  }

  // Configura autenticação usando as credenciais processadas
  const authOptions: GoogleAuthOptions = {
    credentials: googleCredentials, // Passa o objeto com private_key corrigida
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  };
  const auth = new GoogleAuth(authOptions);
  // --- FIM DA MODIFICAÇÃO ---

  const accessToken = await auth.getAccessToken();
  if (!accessToken || typeof accessToken !== "string") {
    logger.error(`${TAG} Erro: Token de acesso do Google vazio ou inválido.`);
    throw new Error("Token de acesso do Google vazio ou inválido.");
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
    logger.debug(`${TAG} Tentativa ${attempt}/${MAX_RETRIES} para chamar Document AI...`);
    try {
      response = await fetch(DOCUMENT_AI_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      logger.debug(`${TAG} Tentativa ${attempt} - Status: ${response.status}`);
      if (response.ok) break; // Sai do loop se a resposta for OK

      // Loga erro se não for OK
      const errorText = await response.text();
      logger.warn(`${TAG} Tentativa ${attempt} falhou com status ${response.status}: ${errorText.substring(0, 200)}...`);

    } catch (err) {
      logger.error(`${TAG} Tentativa ${attempt} falhou com erro de rede/fetch:`, err);
      if (attempt === MAX_RETRIES) throw err; // Lança o erro na última tentativa
    }
    // Espera exponencialmente (1s, 2s, 3s) antes de tentar novamente
    await new Promise((res) => setTimeout(res, 1000 * attempt));
  }

  if (!response || !response.ok) {
    // Se saiu do loop sem sucesso
    const text = response ? await response.text().catch(() => "Erro ao ler corpo da resposta") : "Sem resposta";
    logger.error(`${TAG} Falha final ao chamar Document AI após ${attempt} tentativas. Status: ${response?.status}`);
    throw new Error(`Erro Document AI após ${attempt} tentativas: ${response?.status} - ${text.substring(0, 200)}...`);
  }

  const json = (await response.json()) as DocumentAIResponse;
  logger.debug(`${TAG} Resposta do Document AI recebida com sucesso.`);
  // console.debug("Document AI response:", json); // Log muito verboso, comentar se não necessário
  return json;
}

// =============================================================================
// Extração das métricas a partir da resposta do Document AI
// =============================================================================
export function extractLabeledMetricsFromDocumentAIResponse(
  response: DocumentAIResponse
): Record<string, unknown> {
  const TAG = '[extractLabeledMetrics]';
  const document = response.document || {};
  const entities = document.entities || [];
  const validHeaders = new Map<string, string>([
    ...NUMERIC_MAP,
    ...PERCENTAGE_MAP,
    ...TEXT_MAP,
  ]);
  const extractedMetrics: Record<string, unknown> = {};

  logger.debug(`${TAG} Extraindo métricas de ${entities.length} entidades...`);
  for (const entity of entities) {
    let rawType = entity.type ? normalize(entity.type) : "";
    // Aplica alias de forma segura
    const alias = METRICS_ALIAS_MAP[rawType];
    if (alias !== undefined) {
      rawType = normalize(alias);
    }
    if (!validHeaders.has(rawType)) {
        // logger.debug(`${TAG} Ignorando tipo de entidade não mapeado: ${entity.type}`);
        continue;
    }
    const header = validHeaders.get(rawType)!;
    const metricValue = entity.mentionText ? entity.mentionText.trim() : "";

    // Preserva o primeiro valor encontrado para cada métrica
    if (extractedMetrics[header] && extractedMetrics[header] !== "") {
      // logger.debug(`Métrica "${header}" já definida com "${extractedMetrics[header]}". Ignorando novo valor "${metricValue}".`);
      continue;
    }

    // Aplica parsers específicos conforme o tipo da métrica
    try {
        if (header === "Duração") {
          const parsedDuration = parseDuration(metricValue);
          if (parsedDuration > 300) { // Ajuste o limite se necessário
            logger.warn(`${TAG} Alerta: Duração alta (${parsedDuration}s) para "${metricValue}" na métrica "${header}".`);
          }
          extractedMetrics[header] = parsedDuration; // Guarda 0 se não conseguir parsear
        } else if (header === "Tempo de Visualização") {
          extractedMetrics[header] = parseTempoVisualizacao(metricValue); // Guarda 0 se não conseguir parsear
        } else if (header === "Tempo Médio de Visualização") {
          extractedMetrics[header] = parseTempoVisualizacao(metricValue); // Guarda 0 se não conseguir parsear
        } else if (header === "Data de Publicação") {
          extractedMetrics[header] = parseDocAIDate(metricValue); // Guarda "" se não conseguir parsear
        } else if (TEXT_MAP.has(rawType)) { // Usa TEXT_MAP para verificar se é textual
          extractedMetrics[header] = metricValue; // Guarda como string
        } else { // Assume numérico ou percentual
          // Tenta parsear como número/percentual
          extractedMetrics[header] = parseNumericValuePercent(metricValue, header); // Guarda "" se não conseguir parsear
        }
    } catch (parseError) {
        logger.error(`${TAG} Erro ao fazer parse do valor "${metricValue}" para a métrica "${header}":`, parseError);
        extractedMetrics[header] = ""; // Define como vazio em caso de erro de parse
    }
  }
  logger.debug(`${TAG} Métricas extraídas:`, extractedMetrics);
  return extractedMetrics;
}

// =============================================================================
// Consolidação e validação dos dados extraídos
// =============================================================================
function initializeConsolidatedMetrics(): Record<string, unknown> {
  const consolidated: Record<string, unknown> = {};
  // Não inicializa com cabeçalhos fixos, eles não vêm da extração
  // FIXED_HEADERS.forEach((h) => { consolidated[h] = h; });
  NUMERIC_HEADERS.forEach((h) => { consolidated[h] = ""; });
  PERCENTAGE_HEADERS.forEach((h) => { consolidated[h] = ""; });
  TEXT_HEADERS.forEach((h) => { consolidated[h] = ""; });
  return consolidated;
}

function validateMetrics(metrics: Record<string, unknown>): Record<string, unknown> {
  // Possíveis validações adicionais podem ser implementadas aqui.
  // Ex: Verificar se valores numéricos estão dentro de limites esperados.
  return metrics;
}

/**
 * Consolida os valores validados, preservando o primeiro valor válido encontrado para cada métrica.
 * Se um valor já foi definido, novos valores são ignorados.
 */
function consolidateMetrics(
  consolidated: Record<string, unknown>,
  validated: Record<string, unknown>
): Record<string, unknown> {
  Object.keys(validated).forEach((key) => {
    // Verifica se a chave existe no objeto consolidado (para evitar adicionar chaves inesperadas)
    // e se o valor validado não está vazio
    if (consolidated.hasOwnProperty(key) && validated[key] !== "") {
        // Se o valor consolidado ainda está vazio, atualiza
        if (consolidated[key] === "" || consolidated[key] === undefined || consolidated[key] === null) {
            consolidated[key] = validated[key];
        }
        // Se já existe um valor consolidado, não sobrescreve (mantém o primeiro encontrado)
        // else {
        //   logger.debug(`Valor duplicado para "${key}" detectado. Mantendo o primeiro valor: ${consolidated[key]}`);
        // }
    }
  });
  return consolidated;
}

// =============================================================================
// Funções Auxiliares de Parse (Datas, Tempo e Valores Numéricos)
// =============================================================================
function parseNumericValuePercent(value: string | number | undefined | null, metricName: string): number | string {
    if (value === undefined || value === null || value === "") return ""; // Retorna vazio se entrada for inválida
    if (typeof value === 'number') return value; // Retorna se já for número

    let multiplier = 1;
    let str = value.toLowerCase().trim();

    // Trata 'K' para milhares e 'M' para milhões (comum em algumas métricas)
    if (str.endsWith("k")) {
        multiplier = 1000;
        str = str.slice(0, -1).trim();
    } else if (str.endsWith("m")) {
        multiplier = 1000000;
        str = str.slice(0, -1).trim();
    } else if (str.includes("mil")) { // Mantém tratamento para "mil"
        multiplier = 1000;
        str = str.replace("mil", "").trim();
    } else if (str.includes("mi")) { // Mantém tratamento para "mi"
        multiplier = 1000000;
        str = str.replace("mi", "").trim();
    }

    // Remove caracteres não-numéricos (exceto ponto e vírgula) e espaços
    str = str.replace(/[^\d.,]/g, "").trim();

    let isPercent = false;
    if (str.endsWith("%")) {
        isPercent = true;
        str = str.slice(0, -1).trim();
    }

    // Tratamento de separadores decimais/milhares (heurística)
    const hasDot = str.includes('.');
    const hasComma = str.includes(',');

    if (hasDot && hasComma) {
        // Assume ponto como milhar e vírgula como decimal (padrão BR) se vírgula vem depois do ponto
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
            str = str.replace(/\./g, "").replace(",", "."); // Remove pontos, troca vírgula por ponto
        } else {
            // Assume vírgula como milhar e ponto como decimal (padrão US)
            str = str.replace(/,/g, ""); // Remove vírgulas
        }
    } else if (hasComma) {
        // Se só tem vírgula, assume como decimal
        str = str.replace(",", ".");
    }
    // Se só tem ponto, ou nenhum, já está ok ou será tratado pelo parseFloat

    const num = parseFloat(str);
    if (isNaN(num)) {
        // logger.warn(`[parseNumericValuePercent] Não foi possível parsear "${value}" como número para "${metricName}".`);
        return ""; // Retorna vazio se não for número válido
    }

    let result = num * multiplier;

    // Verifica se a métrica DEVE ser percentual ou se o valor TINHA '%'
    if (PERCENTAGE_MAP.has(normalize(metricName)) || isPercent) {
        // Evita dividir por 100 se já for um valor decimal pequeno (provavelmente já é percentual)
        if (Math.abs(result) > 1.5 && isPercent) { // Heurística: se tinha % e é > 1.5, divide
             result /= 100;
        } else if (!isPercent && PERCENTAGE_MAP.has(normalize(metricName))) {
             // Se a métrica é percentual mas não tinha '%', assume que precisa dividir? Depende dos dados.
             // logger.debug(`[parseNumericValuePercent] Métrica ${metricName} é percentual mas valor não tinha '%'. Resultado: ${result}`);
             // Por segurança, não dividir automaticamente sem o '%'. Ajustar se necessário.
        }
    }
    return result;
}


function parseTempoVisualizacao(tempoStr: string | number | undefined | null): number {
  if (tempoStr === undefined || tempoStr === null || tempoStr === "") return 0;
  if (typeof tempoStr === 'number') return tempoStr; // Retorna se já for número

  const str = tempoStr.toLowerCase().trim();
  const regex = /(\d+)\s*(a|d|h|min|m|s)/gi; // Adiciona 'm' como alias para 'min'
  let match: RegExpExecArray | null;
  let anos = 0, dias = 0, horas = 0, minutos = 0, segundos = 0;

  while ((match = regex.exec(str)) !== null) {
    const valor = parseInt(match[1]!, 10);
    if (isNaN(valor)) continue; // Pula se não for número válido

    const unidade = match[2]!.toLowerCase();
    switch (unidade) {
      case "a": anos += valor; break;
      case "d": dias += valor; break;
      case "h": horas += valor; break;
      case "min": // Trata 'min'
      case "m":   // Trata 'm'
          minutos += valor; break;
      case "s": segundos += valor; break;
    }
  }

  const totalSegundos = anos * 31536000 + dias * 86400 + horas * 3600 + minutos * 60 + segundos;
  // Remove limite máximo, pode haver vídeos legítimos muito longos (lives, etc.)
  // const MAX_SEGUNDOS = 5 * 31536000;
  // return totalSegundos > MAX_SEGUNDOS ? MAX_SEGUNDOS : totalSegundos;
  return totalSegundos;
}

function parseDuration(durationStr: string | number | undefined | null): number {
  if (durationStr === undefined || durationStr === null || durationStr === "") return 0;
  if (typeof durationStr === 'number') return durationStr; // Retorna se já for número

  const str = String(durationStr).trim(); // Converte para string e remove espaços

  // Tenta formato HH:MM:SS ou MM:SS
  if (str.includes(":")) {
    const parts = str.split(":").map((p) => parseInt(p.trim(), 10));
    let horas = 0, minutos = 0, segundos = 0;

    // Remove partes NaN que podem surgir de espaços extras ou caracteres inválidos
    const validParts = parts.filter(p => !isNaN(p));

    if (validParts.length === 3) {
      [horas, minutos, segundos] = validParts as [number, number, number];
    } else if (validParts.length === 2) {
      [minutos, segundos] = validParts as [number, number];
    } else if (validParts.length === 1) {
        // Assume que é apenas segundos se só um número for encontrado após split
        segundos = validParts[0] ?? 0; // Usa ?? 0 para garantir que é number
    } else {
      logger.warn(`[parseDuration] Formato de tempo inválido (com :): "${durationStr}"`);
      return 0; // Retorna 0 se o formato for inesperado
    }
    return horas * 3600 + minutos * 60 + segundos;
  } else {
    // Tenta formato "Xh Ym Zs" ou "Ym Zs" ou "Zs", etc.
    const regex = /(?:(\d+)\s*h)?\s*(?:(\d+)\s*(?:min|m))?\s*(?:(\d+)\s*s)?/i;
    const match = str.match(regex);
    if (match) {
        const horas = parseInt(match[1] || '0', 10);
        const minutos = parseInt(match[2] || '0', 10);
        const segundos = parseInt(match[3] || '0', 10);
        if (!isNaN(horas) && !isNaN(minutos) && !isNaN(segundos)) {
             return horas * 3600 + minutos * 60 + segundos;
        }
    }
    // Fallback: tenta interpretar como segundos puros se não for nenhum formato conhecido
    const segPuros = parseFloat(str.replace(/[^\d.]/g, "")); // Remove não dígitos/ponto
    if (!isNaN(segPuros)) {
        logger.debug(`[parseDuration] Usando fallback para segundos puros em: "${durationStr}" -> ${segPuros}`);
        return Math.round(segPuros); // Arredonda para inteiro
    }

    logger.warn(`[parseDuration] Não foi possível parsear duração: "${durationStr}"`);
    return 0; // Retorna 0 se não conseguir parsear
  }
}


// --- FUNÇÃO parseDocAIDate ATUALIZADA ---
function parseDocAIDate(dateStr: string | undefined | null): string {
  if (!dateStr) return "";
  const str = dateStr.trim();
  const TAG = '[parseDocAIDate]';

  // 1. Tenta parsear diretamente (formatos ISO, etc.)
  const directDate = new Date(str);
  if (!isNaN(directDate.getTime())) {
    const year = directDate.getFullYear();
    if (year > 1990 && year < 2100) {
        const dd = String(directDate.getDate()).padStart(2, "0");
        const mm = String(directDate.getMonth() + 1).padStart(2, "0");
        const yyyy = directDate.getFullYear();
        logger.debug(`${TAG} Parse direto bem-sucedido: ${dd}/${mm}/${yyyy}`);
        return `${dd}/${mm}/${yyyy}`;
    }
  }

  // 2. Tenta formato "DD de MMMM de YYYY às HH:MM" ou "DD de MMMM de YYYY"
  const MESES_MAP: Record<string, string> = {
    janeiro: "01", fev: "02", fevereiro: "02", mar: "03", março: "03", marco: "03",
    abr: "04", abril: "04", mai: "05", maio: "05", jun: "06", junho: "06",
    jul: "07", julho: "07", ago: "08", agosto: "08", set: "09", setembro: "09",
    out: "10", outubro: "10", nov: "11", novembro: "11", dez: "12", dezembro: "12",
  };

  // Remove pontuação irrelevante, normaliza e separa por espaços ou 'de' ou 'às'
  const parts = str.toLowerCase()
                   .normalize("NFD")
                   .replace(/[\u0300-\u036f]/g, "") // Remove acentos
                   .replace(/,/g, '') // Remove vírgulas
                   .split(/[\s]+(?:de|às|as)?[\s]+/); // Separa por espaços e opcionalmente 'de'/'às'/'as'

  let dia = "", mes = "", ano = "", hora = "00", minuto = "00"; // Inicializa hora/minuto

  for (const part of parts) {
    if (!part) continue;
    if (!isNaN(Number(part))) { // É um número
        if (part.length === 4 && !ano && Number(part) > 1900) { // Ano (4 dígitos)
            ano = part;
        } else if (part.length <= 2 && !dia && Number(part) > 0 && Number(part) <= 31) { // Dia (1 ou 2 dígitos)
            dia = part.padStart(2, "0");
        } else if (part.includes(':') && hora === "00") { // Hora (contém ':') - Verifica se hora ainda não foi setada
             const timeParts = part.split(':');
             if (timeParts.length === 2) {
                 // --- CORREÇÃO AQUI ---
                 const h = parseInt(timeParts[0] ?? '', 10); // Usa ?? '' para garantir string
                 const m = parseInt(timeParts[1] ?? '', 10); // Usa ?? '' para garantir string
                 // --- FIM DA CORREÇÃO ---
                 if (!isNaN(h) && h >= 0 && h < 24 && !isNaN(m) && m >= 0 && m < 60) {
                     hora = String(h).padStart(2, '0');
                     minuto = String(m).padStart(2, '0');
                 }
             }
        }
    } else if (MESES_MAP[part] && !mes) { // Mês
        mes = MESES_MAP[part];
    }
  }

  // Fallback para o ano se não encontrado explicitamente
  if (!ano) {
      const yearMatch = str.match(/\b(\d{4})\b/); // Procura 4 dígitos em qualquer lugar
      if (yearMatch && yearMatch[1]) {
          ano = yearMatch[1];
      } else {
          ano = new Date().getFullYear().toString(); // Usa ano atual
          logger.debug(`${TAG} Usando ano atual como fallback para: "${dateStr}"`);
      }
  }

  if (dia && mes && ano) {
    // Validação final da data construída
    // Usa T12:00:00Z se a hora não foi encontrada, senão usa a hora encontrada
    const timeString = (hora !== "00" && minuto !== "00") ? `T${hora}:${minuto}:00Z` : "T12:00:00Z"; // Verifica se hora foi setada
    const finalDate = new Date(`${ano}-${mes}-${dia}${timeString}`);
    if (!isNaN(finalDate.getTime())) {
        const dd = String(finalDate.getUTCDate()).padStart(2, "0");
        const mm = String(finalDate.getUTCMonth() + 1).padStart(2, "0");
        const yyyy = finalDate.getUTCFullYear();
        logger.debug(`${TAG} Parse formato 'DD de MMMM...' bem-sucedido: ${dd}/${mm}/${yyyy}`);
        return `${dd}/${mm}/${yyyy}`; // Retorna apenas DD/MM/YYYY
    } else {
        logger.warn(`${TAG} Data construída inválida: ${dia}/${mes}/${ano} ${hora}:${minuto} a partir de "${dateStr}"`);
    }
  }

  logger.warn(`${TAG} Não foi possível parsear data de forma robusta: "${dateStr}"`);
  return ""; // Retorna vazio se não conseguir parsear
}


// =============================================================================
// Funções Exportadas para Processamento de Imagens
// =============================================================================
export async function processImageFile(
  base64File: string,
  mimeType: string
): Promise<Record<string, unknown>> {
  const TAG = '[processImageFile]';
  try {
    logger.debug(`${TAG} Processando imagem (mime: ${mimeType})...`);
    const buffer = Buffer.from(base64File, "base64");
    const docAIResponse = await callDocumentAI(buffer, mimeType);
    const labeledMetrics = extractLabeledMetricsFromDocumentAIResponse(docAIResponse);
    // Não inicializa mais aqui, a consolidação acontece em processMultipleImages
    // const consolidated = initializeConsolidatedMetrics();
    const validated = validateMetrics(labeledMetrics); // Valida as métricas extraídas
    // const finalMetrics = consolidateMetrics(consolidated, validated);
    // logger.debug(`${TAG} Métricas finais validadas:`, validated);
    return validated; // Retorna apenas as métricas validadas desta imagem
  } catch (error) {
      logger.error(`${TAG} Erro ao processar imagem individual:`, error);
      throw error; // Relança o erro para ser tratado por processMultipleImages
  }
}

export async function processMultipleImages(
  images: { base64File: string; mimeType: string }[]
): Promise<{
  rawDataArray: Record<string, unknown>[]; // Mantém rawDataArray para possível uso futuro, mas conterá apenas o consolidado
  stats: Record<string, unknown>;
}> {
  const TAG = '[processMultipleImages]';
  logger.info(`${TAG} Iniciando processamento de ${images.length} imagens...`);
  // Consolidação global: preserva para cada métrica o primeiro valor válido dentre todas as imagens
  let globalConsolidated = initializeConsolidatedMetrics();
  const allExtractedMetrics: Record<string, unknown>[] = []; // Guarda métricas de cada imagem para debug

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (!img || !img.base64File || !img.mimeType) {
        logger.warn(`${TAG} Imagem ${i+1} inválida ou faltando dados, pulando.`);
        continue;
    }
    try {
        logger.debug(`${TAG} Processando imagem ${i + 1}/${images.length}...`);
        // Processa a imagem e obtém as métricas validadas dela
        const extracted = await processImageFile(img.base64File, img.mimeType);
        allExtractedMetrics.push(extracted); // Guarda para debug
        // Consolida as métricas desta imagem no objeto global
        globalConsolidated = consolidateMetrics(globalConsolidated, extracted);
        logger.debug(`${TAG} Imagem ${i + 1} processada e consolidada.`);
    } catch (error) {
        logger.error(`${TAG} Erro ao processar imagem ${i + 1}. Continuando com as próximas...`, error);
        // Continua processando as outras imagens mesmo que uma falhe
    }
  }

  // Log do resultado consolidado final antes de calcular stats
  logger.debug(`${TAG} Consolidação global finalizada:`, globalConsolidated);

  // Calcula as estatísticas com base no objeto consolidado único
  logger.debug(`${TAG} Calculando estatísticas finais...`);
  const stats = calcFormulas([globalConsolidated]); // calcFormulas espera um array
  logger.info(`${TAG} Processamento de imagens concluído. Estatísticas calculadas.`);
  // Retorna o objeto consolidado como o único item em rawDataArray (para manter estrutura)
  // e as estatísticas calculadas
  return { rawDataArray: [globalConsolidated], stats };
}
