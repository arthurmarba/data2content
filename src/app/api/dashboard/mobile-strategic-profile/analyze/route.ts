import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { runVideoNarrativeMockProvider } from "@/app/dashboard/boards/videoUpload/videoNarrativeMockProvider";
import { upsertStrategicProfileSnapshot } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileSnapshotService";
import { mapAnalysisToSnapshotPayload } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileAnalyzeSnapshotMapper";

const SIGNED_URL_KEYWORDS = ["signature=", "expires=", "token=", "policy="];
const BASE64_INDICATOR = "base64";

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function POST(request: Request) {
  try {
    // 1. Feature Flag Check
    if (!isMobileStrategicProfileEnabled()) {
      return NextResponse.json(
        { message: "Acesso proibido: Perfil Estratégico mobile está desativado." },
        { status: 403 }
      );
    }

    // 2. Auth Session Check
    const session = await getServerSession(await resolveAuthOptions());
    if (!session?.user?.id) {
      return NextResponse.json(
        { message: "Acesso não autorizado: sessão não identificada." },
        { status: 401 }
      );
    }

    // 3. Provider Mode Check
    const providerMode = process.env.VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE || "mock";
    if (providerMode !== "mock") {
      return NextResponse.json(
        { message: "Apenas modo de simulação (mock) é suportado nesta rota." },
        { status: 400 }
      );
    }

    // 4. Content Type Check
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return NextResponse.json(
        { message: "Content-type inválido: deve ser application/json." },
        { status: 400 }
      );
    }

    // 5. Payload extraction & parsing
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { message: "Payload inválido: formato JSON corrompido." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { message: "Payload inválido: deve ser um objeto." },
        { status: 400 }
      );
    }

    // 6. Rígidas regras de segurança contra vazamento de vídeo, URLs e base64
    const forbiddenKeys = ["file", "videoUrl", "thumbnailUrl", "base64", "url", "video"];
    for (const key of forbiddenKeys) {
      if (key in body || body[key]) {
        return NextResponse.json(
          { message: `Regra de segurança: o campo '${key}' não é permitido nesta rota.` },
          { status: 400 }
        );
      }
    }

    const serializedBody = JSON.stringify(body);
    if (serializedBody.length > 5000) {
      return NextResponse.json(
        { message: "Regra de segurança: tamanho do payload excedeu o limite máximo seguro." },
        { status: 400 }
      );
    }

    if (serializedBody.includes(BASE64_INDICATOR) || /data:[a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+;base64,/i.test(serializedBody)) {
      return NextResponse.json(
        { message: "Regra de segurança: strings em Base64 não são permitidas." },
        { status: 400 }
      );
    }

    for (const keyword of SIGNED_URL_KEYWORDS) {
      if (serializedBody.toLowerCase().includes(keyword)) {
        return NextResponse.json(
          { message: "Regra de segurança: links assinados ou de mídias não são permitidos." },
          { status: 400 }
        );
      }
    }

    // 7. Validação do formulário leve do creator
    const creatorGoal = typeof body.creatorGoal === "string" ? body.creatorGoal : "";
    const selectedGoalOption = typeof body.selectedGoalOption === "string" ? body.selectedGoalOption : "";

    if (creatorGoal.length > 500 || selectedGoalOption.length > 100) {
      return NextResponse.json(
        { message: "Dados do formulário muito longos." },
        { status: 400 }
      );
    }

    // 8. Resolução do cenário mock baseado no objetivo do criador
    let mockScenario: any = "skincare_routine";
    if (selectedGoalOption === "sponsored_content") {
      mockScenario = "brand_potential";
    } else if (selectedGoalOption === "authority") {
      mockScenario = "backstage_process";
    } else if (selectedGoalOption === "retention") {
      mockScenario = "weak_hook";
    } else if (selectedGoalOption === "format_test") {
      mockScenario = "collab_potential";
    }

    // Se houver um mockScenario explícito enviado para QA (e for um cenário válido), podemos usar opcionalmente
    const allowedScenarios = [
      "skincare_routine",
      "backstage_process",
      "brand_potential",
      "weak_hook",
      "collab_potential",
      "unclear_content",
      "ad_adaptation"
    ];
    if (typeof body.mockScenario === "string" && allowedScenarios.includes(body.mockScenario)) {
      mockScenario = body.mockScenario;
    }

    // 9. Executar a simulação narrativa pura
    const analysis = runVideoNarrativeMockProvider({
      input: {
        id: `mock-flow-${Date.now()}`,
        creatorQuestion: creatorGoal || "Como posso melhorar meu posicionamento?",
        createdAt: new Date().toISOString(),
      },
      options: {
        scenario: mockScenario,
      },
    });

    // 10. Mapear para Snapshot
    const snapshotPayload = mapAnalysisToSnapshotPayload(analysis);

    // 11. Salvar no banco Mongoose com a fonte mock_analysis
    const upserted = await upsertStrategicProfileSnapshot({
      userId: session.user.id,
      status: "active",
      accessLevel: session.user.planStatus === "active" ? "premium" : "free",
      snapshot: snapshotPayload,
      source: "mock_analysis",
      lastAnalyzedAt: new Date(),
    });

    return NextResponse.json({
      ok: true,
      snapshotUpdated: true,
      snapshot: upserted.snapshot,
    });

  } catch (err: any) {
    console.error("Erro no processamento da análise mock:", err);
    return NextResponse.json(
      { message: "Ocorreu um erro ao processar a simulação do seu diagnóstico estratégico." },
      { status: 500 }
    );
  }
}
