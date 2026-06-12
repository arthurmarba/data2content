/**
 * PATCH /api/dashboard/mobile-strategic-profile/map-seed
 *
 * Mutates a MapaSeed section — add/remove an item in an array section, or set
 * a scalar section. The caller applies an optimistic update and calls
 * router.refresh() after to get the merged synthesis.
 *
 * Body: { section, op, value }
 *   section: "narrativa_central" | "tom" | "territorios" | "temas" | "assets"
 *            | "narrativas_adjacentes" | "formatos"
 *   op:      "set" (scalars) | "add" | "remove" (arrays)
 *   value:   string — new value (set/add) or item to delete (remove)
 */

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { connectToDatabase } from "@/app/lib/mongoose";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";

// ─── Section catalogue ────────────────────────────────────────────────────────

const ARRAY_SECTIONS = [
  "territorios",
  "temas",
  "assets",
  "narrativas_adjacentes",
  "formatos",
] as const;

const SCALAR_SECTIONS = ["narrativa_central", "tom"] as const;

const ALL_SECTIONS = [...ARRAY_SECTIONS, ...SCALAR_SECTIONS] as const;

type ArraySection  = (typeof ARRAY_SECTIONS)[number];
type ScalarSection = (typeof SCALAR_SECTIONS)[number];
type Section       = (typeof ALL_SECTIONS)[number];

const MAX_ITEMS: Record<ArraySection, number> = {
  territorios:           6,
  temas:                 6,
  assets:                6,
  narrativas_adjacentes: 4,
  formatos:              6,
};

// ─── Route handlers ───────────────────────────────────────────────────────────

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

export async function PATCH(request: Request) {
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
    const { default: MapaSeedModel } = await import("@/app/models/MapaSeed");

    const doc = await MapaSeedModel.findOne({ userId });
    if (!doc) {
      return NextResponse.json({ message: "Mapa não encontrado." }, { status: 404 });
    }

    const { section, op, value } = parsed;
    const mapa = doc.mapa as unknown as Record<string, unknown>;

    if (SCALAR_SECTIONS.includes(section as ScalarSection)) {
      mapa[section] = value.slice(0, 200);
    } else {
      const arr: string[] = Array.isArray(mapa[section]) ? (mapa[section] as string[]) : [];
      const cap = MAX_ITEMS[section as ArraySection];

      if (op === "add") {
        const trimmed = value.trim().slice(0, 100);
        const alreadyExists = arr.some(
          (v) => v.toLowerCase().trim() === trimmed.toLowerCase(),
        );
        if (trimmed && !alreadyExists && arr.length < cap) {
          arr.push(trimmed);
        }
        mapa[section] = arr;
      } else {
        // remove
        mapa[section] = arr.filter(
          (v) => v.toLowerCase().trim() !== value.toLowerCase().trim(),
        );
      }
    }

    doc.markModified("mapa");
    await doc.save();

    return NextResponse.json({ ok: true, section, mapa: doc.mapa });
  } catch (err) {
    console.error("[map-seed] Erro ao mutar mapa:", err);
    return NextResponse.json(
      { message: "Não foi possível atualizar o mapa." },
      { status: 500 },
    );
  }
}

// ─── Input validation ─────────────────────────────────────────────────────────

type ParseOk  = { ok: true; section: Section; op: "set" | "add" | "remove"; value: string };
type ParseErr = { ok: false; error: string };

function parseBody(body: unknown): ParseOk | ParseErr {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body deve ser um objeto JSON." };
  }

  const b = body as Record<string, unknown>;

  if (!ALL_SECTIONS.includes(b.section as Section)) {
    return { ok: false, error: `section deve ser um de: ${ALL_SECTIONS.join(", ")}.` };
  }

  const section = b.section as Section;
  const isArray = ARRAY_SECTIONS.includes(section as ArraySection);

  if (!["set", "add", "remove"].includes(b.op as string)) {
    return { ok: false, error: `op deve ser "set", "add" ou "remove".` };
  }

  const op = b.op as "set" | "add" | "remove";

  if (!isArray && op !== "set") {
    return {
      ok: false,
      error: `op "${op}" não é suportado para "${section}" (use "set").`,
    };
  }
  if (isArray && op === "set") {
    return {
      ok: false,
      error: `op "set" não é suportado para "${section}" (use "add" ou "remove").`,
    };
  }

  if (typeof b.value !== "string" || !b.value.trim()) {
    return { ok: false, error: "value é obrigatório e não pode ser vazio." };
  }

  return { ok: true, section, op, value: b.value.trim() };
}
