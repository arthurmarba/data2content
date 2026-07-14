import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function POST() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

/**
 * PATCH /api/dashboard/mobile-strategic-profile/diagnosis/[id]/publish-intent
 *
 * Records the creator's publication intent for a specific video analysis.
 * Only "yes" readings feed the narrative map with full weight.
 * This is a fire-and-persist call — client proceeds optimistically.
 *
 * Body:
 *   {
 *     publishIntent: "yes" | "no",
 *     instagramMediaId?: string   // optional: when provided with publishIntent='yes',
 *                                 // promotes the diagnosis contentContext as lifeAssets
 *                                 // on the corresponding Metric document.
 *   }
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const sessionUser = (session as any)?.user;
  const userId: string | undefined = sessionUser?.id;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  const diagnosisId = params.id;
  if (!diagnosisId || typeof diagnosisId !== "string") {
    return NextResponse.json({ message: "ID inválido." }, { status: 400 });
  }

  // Parse body
  let publishIntent: "yes" | "no" | undefined;
  let instagramMediaId: string | undefined;
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.publishIntent === "yes" || body?.publishIntent === "no") {
      publishIntent = body.publishIntent;
    }
    if (typeof body?.instagramMediaId === "string" && body.instagramMediaId.trim()) {
      instagramMediaId = body.instagramMediaId.trim();
    }
  } catch {
    // ignore
  }

  if (!publishIntent) {
    return NextResponse.json(
      { message: "publishIntent deve ser 'yes' ou 'no'." },
      { status: 400 },
    );
  }

  try {
    await connectToDatabase();
    const { default: CreatorVideoNarrativeDiagnosis } = await import(
      "@/app/models/CreatorVideoNarrativeDiagnosis"
    );

    // Find by diagnosisId (string field) AND userId to prevent cross-user writes
    const diagnosis = await CreatorVideoNarrativeDiagnosis.findOneAndUpdate(
      {
        diagnosisId,
        userId: new Types.ObjectId(userId),
      },
      {
        $set: {
          publishIntent,
          publishDecisionAt: new Date(),
          ...(publishIntent === "yes" && instagramMediaId
            ? { linkedInstagramMediaId: instagramMediaId }
            : {}),
        },
      },
      { new: true },
    ).lean();

    if (!diagnosis) {
      return NextResponse.json({ message: "Diagnóstico não encontrado." }, { status: 404 });
    }

    // When the creator declares "yes" AND provides the Instagram media ID,
    // promote the life-asset context from the diagnosis to the Metric document.
    // This enables the "Asset×resultado" insight family in the Sua Audiência card.
    //
    // ⚠️ TIMING GAP (ver docs/audience-asset-resultado.md): o diagnóstico ocorre ANTES
    // de publicar, então o Metric com este instagramMediaId normalmente ainda não existe
    // → este updateOne casa 0 docs. A promoção definitiva deve acontecer no INGESTION do
    // Metric (metricActions.ts), reconciliando com o diagnóstico recente. Mantido aqui como
    // best-effort para o caso (raro) do post já estar sincronizado.
    if (publishIntent === "yes" && instagramMediaId) {
      try {
        const contentContext = (diagnosis as any).contentContext;
        if (contentContext) {
          const lifeAssets: string[] = [];
          if (contentContext.setting) lifeAssets.push(contentContext.setting);
          if (contentContext.socialPresence) lifeAssets.push(contentContext.socialPresence);
          if (Array.isArray(contentContext.lifeSignals)) {
            lifeAssets.push(...contentContext.lifeSignals.filter(Boolean));
          }

          if (lifeAssets.length > 0) {
            const { default: MetricModel } = await import("@/app/models/Metric");
            await MetricModel.updateOne(
              { instagramMediaId, user: new Types.ObjectId(userId) },
              { $set: { lifeAssets } },
            );
          }
        }
      } catch (promotionErr) {
        // Non-fatal: lifeAssets promotion failed — log and continue.
        // The publishIntent was already saved; the asset link can be retried later.
        console.error("[publish-intent] lifeAssets promotion failed:", promotionErr);
      }
    }

    // When the creator declares "yes" (will publish), enrich the MapaSeed
    // synchronously so the next router.refresh() on the client sees the updated
    // map immediately. QStash was the original mechanism but MAPA_VIDEO_ENRICH_WORKER_URL
    // was never propagated to production, silently no-oping every time.
    // Running it here (synchronous, ~2-5s LLM call) is non-fatal and guarantees
    // the card updates on the same page refresh.
    if (publishIntent === "yes") {
      try {
        const { enrichMapaSeedWithVideoForUser } = await import(
          "@/app/lib/mapaSeed/enrichMapaSeedWithVideoForUser"
        );
        await enrichMapaSeedWithVideoForUser(userId);
      } catch (enrichErr) {
        console.error("[publish-intent] enriquecimento de vídeo failed (non-fatal):", enrichErr);
      }
    }

    // When the creator declares "no", re-run the synthesis snapshot so the map
    // immediately reflects the exclusion. The Phase 2 readingFeedsNarrativeMap
    // filter already excludes "no" readings — this just persists the updated
    // snapshot synchronously so the next page load sees the correct map.
    // Non-fatal: a failure here means the map will self-correct on the next
    // video analysis or page load that triggers a snapshot write.
    if (publishIntent === "no") {
      try {
        const { runControlledVideoReadingSynthesisSnapshotWrite } = await import(
          "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeMockSynthesisSnapshotWriteOrchestrator"
        );
        await runControlledVideoReadingSynthesisSnapshotWrite({
          userId,
          savedDiagnosisId: diagnosisId,
          enableSnapshotWrite: true,
          source: "real_internal",
        });
      } catch (resynErr) {
        console.error("[publish-intent] re-síntese failed (non-fatal):", resynErr);
      }
    }

    return NextResponse.json({ ok: true, publishIntent });
  } catch (err) {
    console.error("[publish-intent] Erro:", err);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
