import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import {
  canAccessInternalPreview,
  type InternalPreviewUser,
} from "@/app/dashboard/boards/internalPreviewAccess";
import { performVideoNarrativeRealRuntimeEnvAudit } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealRuntimeEnvAudit";
import { runGeminiVideoNarrativeProviderFromEnv } from "@/app/dashboard/boards/videoUpload/geminiVideoNarrativeProviderComposer";
import { parseVideoNarrativeGeminiResponse } from "@/app/dashboard/boards/videoUpload/videoNarrativeGeminiResponseParser";
import { getServerSession } from "next-auth/next";
import { NextResponse } from "next/server";

export async function POST(): Promise<NextResponse> {
  // 1. Feature Flag for Smoke Harness
  if (process.env.VIDEO_NARRATIVE_GEMINI_SMOKE_ENABLED !== "true" && process.env.VIDEO_NARRATIVE_GEMINI_SMOKE_ENABLED !== "1") {
    return NextResponse.json(
      { ok: false, error: "Smoke harness is disabled (VIDEO_NARRATIVE_GEMINI_SMOKE_ENABLED)." },
      { status: 403 }
    );
  }

  // 2. Authentication and Authorization
  const session = (await getServerSession(await resolveAuthOptions())) as {
    user?: InternalPreviewUser | null;
  } | null;
  const user = session?.user ?? null;

  if (!user || !canAccessInternalPreview(user)) {
    return NextResponse.json(
      { ok: false, error: "Acesso interno não permitido." },
      { status: 403 }
    );
  }

  // 3. Env Audit
  const audit = performVideoNarrativeRealRuntimeEnvAudit();
  if (!audit.ok) {
    return NextResponse.json(
      { 
        ok: false, 
        error: "Ambiente não está pronto para smoke test.", 
        audit 
      },
      { status: 400 }
    );
  }

  // 4. Safe Payload for test
  const startMs = Date.now();
  let providerReady = false;
  let parserReady = false;
  let issueCodes: string[] = [];
  const model = process.env.VIDEO_NARRATIVE_GEMINI_MODEL || "gemini-2.5-flash";

  try {
    // Only test the real provider via composer with a minimal prompt
    const providerResult = await runGeminiVideoNarrativeProviderFromEnv({
      input: {
        id: "smoke-test-id",
        creatorQuestion: "Teste de conectividade do smoke harness.",
        createdAt: new Date().toISOString(),
        videoUri: undefined,
        inlineVideoBase64: undefined,
        mimeType: undefined,
      },
      env: process.env,
    });

    if (providerResult.ok) {
      providerReady = true;

      // Ensure we don't expose raw response text
      const rawText = providerResult.rawText || "";
      
      const parsed = parseVideoNarrativeGeminiResponse(rawText);
      parserReady = parsed.ok;
      
      if (!parsed.ok && parsed.issues) {
         issueCodes = parsed.issues.map(i => i.code);
      }
    } else {
       issueCodes = providerResult.issues.map(i => i.code);
    }
  } catch (err: unknown) {
    providerReady = false;
    issueCodes.push("provider_unhandled_error");
  }

  const timingMs = Date.now() - startMs;

  return NextResponse.json(
    { 
      ok: providerReady && parserReady, 
      providerReady, 
      parserReady, 
      model, 
      timingMs, 
      issueCodes 
    },
    { status: 200 }
  );
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, error: "Method Not Allowed" }, { status: 405 });
}
