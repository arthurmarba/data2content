/**
 * @fileoverview API Endpoint (Worker) for classifying content based on its description.
 * @version 5.0.1 - Fixed a code path that did not return a value.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric";
import { logger } from "@/app/lib/logger";
import { idsToLabels } from "@/app/lib/classification";
import mongoose from "mongoose";

// Importando as categorias definitivas para construir o prompt da IA
import {
  formatCategories,
  proposalCategories,
  contextCategories,
  toneCategories,
  referenceCategories,
  Category
} from "@/app/lib/classification";

export const runtime = "nodejs";

const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

/**
 * Interface para o resultado da classificação.
 */
interface ClassificationResult {
  format: string[];
  proposal: string[];
  context: string[];
  tone: string[];
  references: string[];
}

// --- Função de Classificação Otimizada com OpenAI ---

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const buildCategoryDescriptions = (categories: Category[]): string => {
  return categories.map(cat => {
    let desc = `- **${cat.id} (${cat.label}):** ${cat.description}`;
    if (cat.examples && cat.examples.length > 0) {
      desc += ` (Ex: "${cat.examples.join('", "')}")`;
    }
    if (cat.subcategories && cat.subcategories.length > 0) {
      desc += `\n  Subcategorias:\n` + cat.subcategories.map(sub => `    - **${sub.id} (${sub.label}):** ${sub.description}`).join('\n');
    }
    return desc;
  }).join('\n');
};

function normalizeClassification(rawResult: any): ClassificationResult {
    const normalized: ClassificationResult = {
        format: [], proposal: [], context: [], tone: [], references: [],
    };
    const keyMapping: { [K in keyof ClassificationResult]: string[] } = {
        format: ['format', 'formato do conteúdo', 'formato'],
        proposal: ['proposal', 'proposta'],
        context: ['context', 'contexto'],
        tone: ['tone', 'tom'],
        references: ['references', 'referências', 'referencias'],
    };

    const flattenValue = (value: any): string[] => {
        if (Array.isArray(value)) {
            return value.flatMap(flattenValue);
        }
        if (typeof value === 'object' && value !== null) {
            return flattenValue(Object.values(value));
        }
        if (typeof value === 'string') {
            return [value];
        }
        return [];
    };

    for (const rawKey in rawResult) {
        const cleanedKey = rawKey.toLowerCase().replace(/[\d.]/g, '').trim();
        const standardKey = Object.keys(keyMapping).find(k => 
            keyMapping[k as keyof ClassificationResult].includes(cleanedKey)
        ) as keyof ClassificationResult | undefined;

        if (standardKey) {
            const value = rawResult[rawKey];
            const flatValues = flattenValue(value);
            normalized[standardKey].push(...flatValues);
        }
    }
    
    for (const key in normalized) {
        const typedKey = key as keyof ClassificationResult;
        normalized[typedKey] = [...new Set(normalized[typedKey])].filter(v => typeof v === 'string' && v.length > 0);
    }
    return normalized;
}

async function classifyContent(description: string): Promise<ClassificationResult> {
    const TAG = '[classifyContent_Final_Optimized]';
    if (!description || description.trim() === '') {
        return { format: [], proposal: [], context: [], tone: [], references: [] };
    }

    const systemPrompt = `
      Você é um especialista em análise de conteúdo de mídias sociais. Sua tarefa é analisar a descrição de um post, incluindo as hashtags, e classificá-lo em CINCO dimensões.

      **REGRAS CRÍTICAS PARA SEGUIR:**
      1.  **USE APENAS IDs:** Sua resposta DEVE conter apenas os IDs das categorias fornecidas. NUNCA use os rótulos em texto (ex: use 'humor_scene', não 'Humor/Cena').
      2.  **NÃO INVENTE CATEGORIAS:** Use EXCLUSIVAMENTE os IDs da lista. Se uma categoria não se encaixar perfeitamente, escolha a mais próxima ou retorne um array vazio.
      3.  **HASHTAGS SÃO A CHAVE:** Analise as hashtags (#) com muita atenção. Elas são a pista principal para definir o 'Contexto' e também podem indicar a 'Proposta' (ex: #humor indica a proposta 'humor_scene').
      4.  **PREFIRA A ESPECIFICIDADE:** Ao classificar 'Contexto' e 'Referências', se uma subcategoria se aplicar, prefira sempre o ID da subcategoria em vez do ID da categoria principal.
      5.  **DETECTE O TOM:** Preste atenção em palavras e emojis. Risadas (haha, kkk) indicam o tom 'humorous'. Emojis de coração (💖) ou palavras de encorajamento indicam 'inspirational'.
      6.  **SAÍDA JSON:** Sua resposta final deve ser APENAS o objeto JSON, sem nenhum texto adicional antes ou depois.
    `;

    const userPrompt = `**Descrição:**\n"${description}"\n\n**Categorias:**\nFormato: ${buildCategoryDescriptions(formatCategories)}\nProposta: ${buildCategoryDescriptions(proposalCategories)}\nContexto: ${buildCategoryDescriptions(contextCategories)}\nTom: ${buildCategoryDescriptions(toneCategories)}\nReferências: ${buildCategoryDescriptions(referenceCategories)}`;

    const payload = {
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      response_format: { type: "json_object" }
    };
    
    const apiKey = process.env.OPENAI_API_KEY; 
    if (!apiKey) throw new Error("A variável de ambiente OPENAI_API_KEY não está definida.");
    
    const apiUrl = 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        if (response.status === 429) {
            const errorBody = await response.json();
            const customError = new Error(errorBody.error.message);
            customError.name = 'RateLimitError';
            throw customError;
        }
        const errorBody = await response.text();
        throw new Error(`A API da OpenAI retornou um erro: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const result = await response.json();
    
    if (result.choices?.[0]?.message?.content) {
        const content = result.choices[0].message.content;
        const parsedJson = JSON.parse(content);
        const normalizedResult = normalizeClassification(parsedJson);
        logger.info(`${TAG} Classificação recebida e normalizada: ${JSON.stringify(normalizedResult)}`);
        return normalizedResult;
    } else {
        throw new Error("A resposta da OpenAI não continha os dados de classificação esperados.");
    }
}


async function handlerLogic(request: NextRequest): Promise<NextResponse> { // Adicionado tipo de retorno explícito
    const TAG = '[Worker Classify Content v5.0.1]';

    let metricId: string | undefined;

    try {
        const body = await request.json();
        metricId = body.metricId;
        logger.info(`${TAG} Assinatura verificada. Recebida tarefa para Metric ID: ${metricId}`);

        if (!metricId || !mongoose.isValidObjectId(metricId)) {
            logger.error(`${TAG} Erro: metricId inválido ou ausente no payload: ${metricId}`);
            return NextResponse.json({ error: "Metric ID inválido ou ausente" }, { status: 400 });
        }

        await connectToDatabase();
        logger.debug(`${TAG} Conectado ao BD.`);

        const metricDoc = await Metric.findById(metricId);

        if (!metricDoc) {
            logger.warn(`${TAG} Métrica com ID ${metricId} não encontrada no DB. Tarefa ignorada.`);
            return NextResponse.json({ message: "Métrica não encontrada." }, { status: 200 });
        }

        if (metricDoc.classificationStatus === 'completed') {
            logger.info(`${TAG} Métrica ${metricId} já classificada. Tarefa ignorada.`);
            return NextResponse.json({ message: "Métrica já classificada." }, { status: 200 });
        }
        if (!metricDoc.description || metricDoc.description.trim() === "") {
            logger.warn(`${TAG} Métrica ${metricId} não possui descrição. Impossível classificar.`);
            await Metric.updateOne(
                { _id: metricDoc._id },
                { $set: { classificationStatus: 'failed', classificationError: 'Descrição ausente ou vazia.' } }
            );
            return NextResponse.json({ message: "Métrica sem descrição para classificar." }, { status: 200 });
        }

        logger.debug(`${TAG} Chamando classifyContent para Metric ${metricId}...`);
        
        let retries = 3;
        while (retries > 0) {
            try {
                const classification = await classifyContent(metricDoc.description);
                logger.info(`${TAG} Classificação completa recebida para Metric ${metricId}: ${JSON.stringify(classification)}`);

                const updateData: Partial<IMetric> = {
                    format: idsToLabels(classification.format, 'format'),
                    proposal: idsToLabels(classification.proposal, 'proposal'),
                    context: idsToLabels(classification.context, 'context'),
                    tone: idsToLabels(classification.tone, 'tone'),
                    references: idsToLabels(classification.references, 'reference'),
                    classificationStatus: 'completed',
                    classificationError: null,
                };

                await Metric.updateOne({ _id: metricDoc._id }, { $set: updateData });
                logger.info(`${TAG} Metric ${metricId} atualizado com sucesso no DB com 5 dimensões (status: completed).`);
                
                return NextResponse.json({ message: "Classificação concluída e métrica atualizada." }, { status: 200 });

            } catch (classError: any) {
                if (classError.name === 'RateLimitError') {
                    const waitMatch = classError.message.match(/Please try again in ([\d.]+)s/);
                    const waitTime = waitMatch ? (parseFloat(waitMatch[1]) + 0.5) * 1000 : 60000;
                    logger.warn(`${TAG} Rate limit atingido para Metric ${metricId}. Aguardando ${waitTime / 1000} segundos para tentar novamente...`);
                    await sleep(waitTime);
                    retries--;
                } else {
                    throw classError; // Lança outros erros para o catch principal
                }
            }
        }
        
        // CORREÇÃO: Se o loop terminar após todas as retentativas falharem, lança um erro.
        // Isso garante que este caminho também seja tratado pelo bloco catch principal,
        // cobrindo todos os caminhos de código e resolvendo o erro do TypeScript.
        throw new Error(`Não foi possível classificar o post ${metricId} após múltiplas tentativas de rate limit.`);

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        const finalMetricId = metricId || 'ID_DESCONHECIDO';
        logger.error(`${TAG} Falha final ao processar Metric ${finalMetricId}: ${errorMessage}`, error);
        
        if (mongoose.isValidObjectId(finalMetricId)) {
            await Metric.updateOne(
                { _id: finalMetricId },
                { $set: { classificationStatus: 'failed', classificationError: `Erro na IA: ${errorMessage}` } }
            );
        }
        
        return NextResponse.json({ error: `Falha ao classificar conteúdo: ${errorMessage}` }, { status: 500 });
    }
}

export const POST = async (request: NextRequest) => {
    const TAG_POST = '[Worker Classify POST v5.0.1]';
    try {
        const signature = request.headers.get("upstash-signature");
        if (!signature) {
            logger.error(`${TAG_POST} Erro: Header 'upstash-signature' ausente.`);
            return new NextResponse("Signature header missing", { status: 401 });
        }
        const bodyAsText = await request.text();
        const isValid = await receiver.verify({
            signature: signature,
            body: bodyAsText,
        });

        if (!isValid) {
            logger.error(`${TAG_POST} Assinatura QStash inválida.`);
            return new NextResponse("Invalid signature", { status: 401 });
        }
        const newRequest = new NextRequest(request.url, {
            method: request.method,
            headers: request.headers,
            body: bodyAsText,
        });
        return await handlerLogic(newRequest);

    } catch (error) {
        logger.error(`${TAG_POST} Erro durante verificação/recriação do request:`, error);
        return NextResponse.json({ error: "Erro ao processar requisição do webhook." }, { status: 500 });
    }
};

export async function GET() {
    return NextResponse.json({ message: "Worker de classificação v5.0.1 ativo." });
}
