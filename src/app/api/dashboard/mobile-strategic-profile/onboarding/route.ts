import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";

export async function GET() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function PATCH() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ message: "Método não permitido." }, { status: 405 });
}

/**
 * POST /api/dashboard/mobile-strategic-profile/onboarding
 *
 * Saves creator's onboarding answers and marks onboarding as complete.
 * Answers are stored in User.onboardingAnswers and also converted to
 * pastCreatorAnswers format so the Gemini prompt is calibrated from the
 * first analysis.
 *
 * Body:
 *   { whyYouCreate: string; desiredFeeling: string; contentLimit?: string; creatorPurpose?: string }
 */
export async function POST(request: Request) {
  if (!isMobileStrategicProfileEnabled()) {
    return NextResponse.json({ message: "Recurso não habilitado." }, { status: 404 });
  }

  const authOptions = await resolveAuthOptions();
  const session = await getServerSession(authOptions);
  const userId = (session as any)?.user?.id as string | undefined;

  if (!userId) {
    return NextResponse.json({ message: "Não autenticado." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Body inválido." }, { status: 400 });
  }

  const parsed = parseBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const { default: UserModel } = await import("@/app/models/User");

    await UserModel.findByIdAndUpdate(userId, {
      $set: {
        onboardingAnswers: {
          whyYouCreate: parsed.whyYouCreate,
          desiredFeeling: parsed.desiredFeeling,
          contentLimit: parsed.contentLimit ?? null,
          creatorPurpose: parsed.creatorPurpose ?? null,
        },
        onboardingCompletedAt: new Date(),
        isNewUserForOnboarding: false,
      },
    });

    // Fase 3 — preview enriquecido do mapa.
    // Quando o criador declara um propósito (Q3), a IA interpreta os 3 sinais
    // e extrai narrativa, territórios, temas e assets (primeiro mapa completo).
    // Best-effort: a persistência acima já sucedeu — uma falha aqui NÃO deve
    // bloquear o onboarding. O client cai no fallback determinístico (buildSeedSignal).
    let seedSignal: import("@/app/lib/mapaSeed/generateOnboardingSeedSignal").OnboardingSeedSignal | null = null;
    if (parsed.creatorPurpose) {
      try {
        const { generateOnboardingSeedSignal } = await import(
          "@/app/lib/mapaSeed/generateOnboardingSeedSignal"
        );
        seedSignal = await generateOnboardingSeedSignal({
          whyYouCreate: parsed.whyYouCreate,
          desiredFeeling: parsed.desiredFeeling,
          creatorPurpose: parsed.creatorPurpose,
        });
      } catch (genErr) {
        console.warn("[onboarding] Falha ao gerar seed signal (não-fatal):", genErr);
      }
    }

    // Fase 2A — semeia o MapaSeed a partir da hipótese de narrativa do onboarding,
    // para que ele EXISTA e possa ser enriquecido depois (Instagram/vídeo). Sem
    // isso, o enriquecimento de Instagram desiste na primeira linha (sem MapaSeed)
    // e a coleção fica vazia. Best-effort: nunca bloqueia o onboarding. Só cria se
    // ainda não houver mapa — não sobrescreve um mapa já enriquecido.
    if (seedSignal?.label) {
      try {
        const { default: MapaSeedModel } = await import("@/app/models/MapaSeed");
        const exists = await MapaSeedModel.exists({ userId });
        if (!exists) {
          await MapaSeedModel.create({
            userId,
            mapa: {
              narrativa_central: seedSignal.label,
              territorios:       seedSignal.territorios ?? [],
              temas:             seedSignal.temas        ?? [],
              assets:            seedSignal.assets       ?? [],
              maturidade: "seed",
              fonte: ["onboarding_declarativo"],
            },
          });
        }
      } catch (seedErr) {
        console.warn("[onboarding] Falha ao semear MapaSeed (não-fatal):", seedErr);
      }
    }

    return NextResponse.json({ ok: true, seedSignal });
  } catch (err) {
    console.error("[onboarding] Erro ao salvar respostas:", err);
    return NextResponse.json({ message: "Não foi possível salvar as respostas." }, { status: 500 });
  }
}

// ─── Input validation ─────────────────────────────────────────────────────────

const WHY_OPTIONS = [
  // Valores atuais — identidade narrativa
  "ensino_conhecimento",
  "conto_historias",
  "entretenimento",
  "inspiro_acao",
  // Legacy — mantidos para compatibilidade com sessões antigas
  "compartilho_aprendizado",
  "ensino_habilidade",
  "expressao_pessoal",
  "construir_audiencia",
  "gerar_renda",
  "construir_autoridade",
  "explorar_criatividade",
] as const;

const FEELING_OPTIONS = [
  "inspirado",
  "informado",
  "entendido",
  "entretido",
  "motivado",
] as const;

type ParseResult =
  | { ok: true; whyYouCreate: string; desiredFeeling: string; contentLimit?: string; creatorPurpose?: string }
  | { ok: false; error: string };

function parseBody(body: unknown): ParseResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const b = body as Record<string, unknown>;

  if (typeof b.whyYouCreate !== "string" || !b.whyYouCreate.trim()) {
    return { ok: false, error: "whyYouCreate é obrigatório." };
  }
  if (!WHY_OPTIONS.includes(b.whyYouCreate as any)) {
    return { ok: false, error: `whyYouCreate inválido. Opções: ${WHY_OPTIONS.join(", ")}.` };
  }

  if (typeof b.desiredFeeling !== "string" || !b.desiredFeeling.trim()) {
    return { ok: false, error: "desiredFeeling é obrigatório." };
  }
  if (!FEELING_OPTIONS.includes(b.desiredFeeling as any)) {
    return { ok: false, error: `desiredFeeling inválido. Opções: ${FEELING_OPTIONS.join(", ")}.` };
  }

  const contentLimit =
    typeof b.contentLimit === "string" && b.contentLimit.trim()
      ? b.contentLimit.trim().slice(0, 300)
      : undefined;

  // Declaração de propósito — opcional, máx 150 chars (campo livre do criador).
  const creatorPurpose =
    typeof b.creatorPurpose === "string" && b.creatorPurpose.trim()
      ? b.creatorPurpose.trim().slice(0, 150)
      : undefined;

  return {
    ok: true,
    whyYouCreate: b.whyYouCreate,
    desiredFeeling: b.desiredFeeling,
    contentLimit,
    creatorPurpose,
  };
}
