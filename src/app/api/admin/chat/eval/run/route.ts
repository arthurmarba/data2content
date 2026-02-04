import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ChatEvalRunModel from "@/app/models/ChatEvalRun";
import ChatEvalCaseModel from "@/app/models/ChatEvalCase";
import { askLLMWithEnrichedContext } from "@/app/lib/aiOrchestrator";
import { buildChatContext, stringifyChatContext } from "@/app/lib/contextBuilder";
import type { EnrichedAIContext } from "@/app/api/whatsapp/process-response/types";
import UserModel from "@/app/models/User";
import { getDefaultDialogueState } from "@/app/lib/stateService";
import type { DeterminedIntent } from "@/app/lib/intentService";

// Nota: runner simplificado (não usa streaming nem heurísticas avançadas). Produção deveria ter worker/queue.

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if ((session?.user as any)?.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const { caseIds, variantA, variantB, ragEnabled, modelVersion, name } = body || {};
  if (!Array.isArray(caseIds) || !caseIds.length || !variantA) {
    return NextResponse.json({ error: "caseIds (array) e variantA são obrigatórios" }, { status: 400 });
  }
  await connectToDatabase();
  const cases = await ChatEvalCaseModel.find({ _id: { $in: caseIds } }).lean();
  if (!cases.length) return NextResponse.json({ error: "Nenhum case encontrado" }, { status: 404 });

  const run = await ChatEvalRunModel.create({
    name: name || null,
    variantA,
    variantB: variantB || null,
    ragEnabled: typeof ragEnabled === "boolean" ? ragEnabled : null,
    modelVersion: modelVersion || null,
    caseIds,
    status: "running",
    results: [],
  });

  try {
    const results: any[] = [];
    // Runner síncrono simplificado
    for (const c of cases) {
      const user = await UserModel.findOne().lean(); // stub: usa qualquer user para o contexto
      const enriched: EnrichedAIContext = {
        user: user as any,
        historyMessages: [],
        userName: user?.name || "criador",
        dialogueState: getDefaultDialogueState(),
        channel: "web",
        intentConfidence: 0.5,
        intentLabel: (c.intentHint as DeterminedIntent) || "general",
        promptVariant: variantA,
        chatContextJson: stringifyChatContext(buildChatContext(user)),
      };
      const payloadText = c.userPrompt;
      const intent = (c.intentHint as DeterminedIntent | undefined) ?? "general";
      const { stream } = await askLLMWithEnrichedContext(enriched, payloadText, intent);
      const reader = stream.getReader();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (typeof value === "string") full += value;
      }
      results.push({
        caseId: c._id,
        variant: variantA,
        response: full,
        intent: c.intentHint || null,
        fallbackReason: null,
        llmLatencyMs: null,
        totalLatencyMs: null,
      });
      if (variantB) {
        const { stream: streamB } = await askLLMWithEnrichedContext({ ...enriched, promptVariant: variantB }, payloadText, intent);
        const readerB = streamB.getReader();
        let fullB = "";
        while (true) {
          const { done, value } = await readerB.read();
          if (done) break;
          if (typeof value === "string") fullB += value;
        }
        results.push({
          caseId: c._id,
          variant: variantB,
          response: fullB,
          intent: c.intentHint || null,
          fallbackReason: null,
          llmLatencyMs: null,
          totalLatencyMs: null,
        });
      }
    }
    run.status = "completed";
    run.completedAt = new Date();
    run.results = results;
    await run.save();
    return NextResponse.json({ runId: run._id, resultsCount: results.length });
  } catch (error: any) {
    run.status = "failed";
    run.error = error?.message || "Erro desconhecido";
    run.completedAt = new Date();
    await run.save();
    return NextResponse.json({ error: run.error }, { status: 500 });
  }
}
