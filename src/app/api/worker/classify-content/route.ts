/**
 * @fileoverview API Endpoint (Worker) for classifying content based on its description.
 * @version 3.0.0 - Implemented full 5-dimension classification using an LLM.
 */

import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric, { IMetric } from "@/app/models/Metric";
import { logger } from "@/app/lib/logger";
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
 * Interface para o resultado da classificação, esperando 5 arrays de strings.
 */
interface ClassificationResultFromService {
  format: string[];
  proposal: string[];
  context: string[];
  tone: string[];
  references: string[];
}

// --- Nova Função de Classificação com IA ---

/**
 * Constrói uma string de descrição para uma lista de categorias para ser usada no prompt da IA.
 * @param categories - Array de categorias a serem formatadas.
 * @returns Uma string formatada descrevendo as categorias.
 */
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

/**
 * Classifica o conteúdo de uma descrição usando um modelo de linguagem generativo.
 * @param description - A descrição do post a ser classificada.
 * @returns Uma promessa que resolve para o resultado da classificação.
 */
async function classifyContent(description: string): Promise<ClassificationResultFromService> {
    const TAG = '[classifyContent v3.0.0]';
    logger.info(`${TAG} Iniciando classificação para descrição: "${description.substring(0, 50)}..."`);

    const prompt = `
      Analise a seguinte descrição de um post de mídia social e classifique-a em CINCO dimensões: Formato, Proposta, Contexto, Tom e Referências.
      Para cada dimensão, retorne um array com os IDs das categorias mais relevantes. Você PODE retornar múltiplos IDs para cada dimensão se aplicável.

      **Descrição do Post para Análise:**
      "${description}"

      ---

      **Dimensões e Categorias Disponíveis (use os IDs):**

      **1. Formato do Conteúdo:**
      ${buildCategoryDescriptions(formatCategories)}

      **2. Proposta (O objetivo principal do post):**
      ${buildCategoryDescriptions(proposalCategories)}

      **3. Contexto (O tópico ou área de interesse principal):**
      ${buildCategoryDescriptions(contextCategories)}

      **4. Tom (A abordagem emocional ou sentimento):**
      ${buildCategoryDescriptions(toneCategories)}

      **5. Referências (Elementos culturais, geográficos ou sociais específicos mencionados):**
      ${buildCategoryDescriptions(referenceCategories)}

      ---

      **Instruções de Saída:**
      - Forneça sua resposta em formato JSON.
      - Para cada dimensão (format, proposal, context, tone, references), retorne um array de strings contendo os IDs das categorias que você identificou.
      - Se nenhuma categoria de uma dimensão se aplicar, retorne um array vazio para essa dimensão.
    `;

    const payload = {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "format": { "type": "ARRAY", "items": { "type": "STRING" } },
            "proposal": { "type": "ARRAY", "items": { "type": "STRING" } },
            "context": { "type": "ARRAY", "items": { "type": "STRING" } },
            "tone": { "type": "ARRAY", "items": { "type": "STRING" } },
            "references": { "type": "ARRAY", "items": { "type": "STRING" } }
          }
        }
      }
    };
    
    const apiKey = process.env.GEMINI_API_KEY || ""; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            logger.error(`${TAG} Erro na API da IA: ${response.status} ${response.statusText}`, errorBody);
            throw new Error(`A API de classificação retornou um erro: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts && result.candidates[0].content.parts[0].text) {
            const text = result.candidates[0].content.parts[0].text;
            const parsedJson = JSON.parse(text);
            logger.info(`${TAG} Classificação recebida da IA: ${text}`);
            return parsedJson;
        } else {
            logger.error(`${TAG} Resposta da IA em formato inesperado.`, result);
            throw new Error("A resposta da IA não continha os dados de classificação esperados.");
        }
    } catch (error) {
        logger.error(`${TAG} Falha ao executar a chamada de classificação.`, error);
        throw error;
    }
}


async function handlerLogic(request: NextRequest) {
    const TAG = '[Worker Classify Content v3.0.0]';

    try {
        const body = await request.json();
        const { metricId } = body;
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
        
        let classification: ClassificationResultFromService;
        try {
            classification = await classifyContent(metricDoc.description);
            logger.info(`${TAG} Classificação completa recebida para Metric ${metricId}: ${JSON.stringify(classification)}`);

            const updateData: Partial<IMetric> = {
                format: classification.format,
                proposal: classification.proposal,
                context: classification.context,
                tone: classification.tone,
                references: classification.references,
                classificationStatus: 'completed',
                classificationError: null,
            };

            const updateResult = await Metric.updateOne({ _id: metricDoc._id }, { $set: updateData });

            if (updateResult.modifiedCount > 0) {
                logger.info(`${TAG} Metric ${metricId} atualizado com sucesso no DB com 5 dimensões (status: completed).`);
            } else {
                logger.warn(`${TAG} Nenhum documento foi modificado para Metric ${metricId} na atualização.`);
            }
            return NextResponse.json({ message: "Classificação concluída e métrica atualizada." }, { status: 200 });

        } catch (classError: unknown) {
            const errorMessage = classError instanceof Error ? classError.message : "Erro desconhecido na classificação";
            logger.error(`${TAG} Erro ao chamar classifyContent para Metric ${metricId}: ${errorMessage}`, classError);
            
            await Metric.updateOne(
                { _id: metricDoc._id },
                { $set: { classificationStatus: 'failed', classificationError: `Erro na IA: ${errorMessage}` } }
            );
            
            return NextResponse.json({ error: `Falha ao classificar conteúdo: ${errorMessage}` }, { status: 500 });
        }

    } catch (error: unknown) {
        logger.error(`${TAG} Erro GERAL inesperado no worker:`, error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        return NextResponse.json({ error: `Erro interno do worker: ${errorMessage}` }, { status: 500 });
    }
}

export const POST = async (request: NextRequest) => {
    const TAG_POST = '[Worker Classify POST v3.0.0]';
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
    return NextResponse.json({ message: "Worker de classificação v3.0.0 ativo." });
}
