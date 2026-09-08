import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import UserModel from "@/app/models/User";
import { connectToDatabase } from "@/app/lib/mongoose";
import { Types } from "mongoose";
import { ZodError } from "zod";
import { RadarError } from "./adminService";

export async function radarAdminRequest(request: NextRequest, handler: (actor: string) => Promise<unknown>) {
  try {
    const session = await getServerSession(authOptions);
    const actor = session?.user?.id;
    if (session?.user?.role !== "admin" || !actor || !Types.ObjectId.isValid(actor)) throw new RadarError("Acesso administrativo necessário.", 403);
    await connectToDatabase();
    if (!await UserModel.exists({ _id: actor, role: "admin" })) throw new RadarError("Acesso administrativo necessário.", 403);
    if (request.method !== "GET" && request.headers.get("origin") !== new URL(request.url).origin) throw new RadarError("Origem da requisição inválida.", 403);
    return NextResponse.json(await handler(actor), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof RadarError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: error instanceof RadarError ? error.message : status === 400 ? "Confira os campos e o formato dos dados." : "Não foi possível concluir a operação." }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export async function readRadarJson(request: NextRequest) {
  const limit = 2_000_000;
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new RadarError("Arquivo muito grande (limite de 2 MB).", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new RadarError("Dados ausentes.");
  let size = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > limit) throw new RadarError("Arquivo muito grande (limite de 2 MB).", 413);
      text += decoder.decode(part.value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } finally { await reader.cancel().catch(() => undefined); }
}
