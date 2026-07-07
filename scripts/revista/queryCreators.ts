// scripts/revista/queryCreators.ts
//
// Seleciona criadores elegíveis para a Revista D2C e monta o CONTEXTO que o
// Galeano (a skill) usa para escrever a matéria. Somente leitura.
//
// Elegível = MapaSeed com maturidade "instagram_enriched" ou "video_enriched"
// (mapa rico o suficiente para virar matéria). Evita criadores já usados nos
// últimos N dias via o arquivo de histórico scripts/revista/.history.json.
//
// Uso:
//   npx tsx --env-file=.env.local scripts/revista/queryCreators.ts
//   npx tsx --env-file=.env.local scripts/revista/queryCreators.ts --angulo=collab --limit=2
//   npx tsx --env-file=.env.local scripts/revista/queryCreators.ts --userId=<id>
//
// Saída: JSON (CriadorContexto[]) no stdout, para o Galeano consumir.

import { promises as fs } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "@/app/lib/mongoose";
import MapaSeed from "@/app/models/MapaSeed";
import User from "@/app/models/User";
import Metric from "@/app/models/Metric";
import AccountInsight from "@/app/models/AccountInsight";
import type { CriadorContexto, PostResumo } from "./lib/types";

const HISTORY_PATH = path.join(process.cwd(), "scripts", "revista", ".history.json");
const COOLDOWN_DAYS = 30;
const TOP_POSTS = 6;

function arg(name: string): string | null {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? null;
}

/** Resolve um criador por @handle (username) ou nome → userId. Evita o detour de
 *  escrever um script descartável só pra achar o id (gasto de round-trips). */
async function resolveUserId(handle: string | null, name: string | null): Promise<string | null> {
  if (handle) {
    const u: any = await User.findOne({
      username: new RegExp(`^@?${handle.replace(/^@/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"),
    })
      .select("_id")
      .lean();
    if (u) return String(u._id);
  }
  if (name) {
    const rx = new RegExp(name.trim().replace(/\s+/g, ".*").replace(/[.*+?^${}()|[\]\\]/g, (m) => (m === ".*" ? m : "\\" + m)), "i");
    const u: any = await User.findOne({ name: rx }).select("_id").lean();
    if (u) return String(u._id);
  }
  return null;
}

/** Digest compacto p/ stdout: o Galeano lê isto (pequeno) e escreve o brief, sem
 *  precisar carregar as URLs assinadas gigantes (que vivem só no context.json). */
function digest(angulo: string, criadores: CriadorContexto[]): string {
  const lines: string[] = [`▸ ${angulo} · ${criadores.length} criador(es)`];
  for (const c of criadores) {
    lines.push("");
    lines.push(`### ${c.nome} (${c.handle ?? "?"}) · userId ${c.userId} · ${c.maturidade}`);
    lines.push(`narrativa: ${c.narrativaCentral}`);
    if (c.territorios?.length) lines.push(`territórios: ${c.territorios.join(" · ")}`);
    if (c.temas?.length) lines.push(`temas: ${c.temas.join(" · ")}`);
    if (c.assets?.length) lines.push(`assets: ${c.assets.join(" · ")}`);
    if (c.tom) lines.push(`tom: ${c.tom}`);
    lines.push(`profilePic: ${c.profilePictureUrl ? "sim" : "NÃO"}`);
    lines.push(`topPosts (use postId p/ referenciar no brief):`);
    for (const p of c.topPosts) {
      const desc = (p.description ?? "").replace(/\s+/g, " ").slice(0, 90);
      lines.push(
        `  • ${p.totalInteractions.toLocaleString("pt-BR")} int | ${p.type}${p.format?.length ? "/" + p.format.join(",") : ""} | postId=${p.instagramMediaId ?? "—"} | thumb=${p.thumbnailUrl ? "sim" : "não"} | ${desc}`,
      );
    }
  }
  return lines.join("\n");
}

interface HistoryEntry {
  userId: string;
  data: string;
}

async function readHistory(): Promise<HistoryEntry[]> {
  try {
    return JSON.parse(await fs.readFile(HISTORY_PATH, "utf-8"));
  } catch {
    return [];
  }
}

function recentlyUsed(history: HistoryEntry[]): Set<string> {
  const cutoff = Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
  return new Set(
    history.filter((h) => new Date(h.data).getTime() >= cutoff).map((h) => h.userId),
  );
}

async function topPostsFor(userId: unknown): Promise<PostResumo[]> {
  const posts = await Metric.find({ user: userId })
    .sort({ "stats.total_interactions": -1 })
    .limit(TOP_POSTS)
    .select("postLink postDate type format description thumbnailUrl instagramMediaId stats")
    .lean();

  return posts.map((p: any) => ({
    postLink: p.postLink ?? "",
    postDate: p.postDate ? new Date(p.postDate).toISOString().slice(0, 10) : "",
    type: p.type ?? "",
    format: Array.isArray(p.format) ? p.format : [],
    description: (p.description ?? "").slice(0, 280),
    thumbnailUrl: p.thumbnailUrl ?? null,
    totalInteractions: p.stats?.total_interactions ?? 0,
    instagramMediaId: p.instagramMediaId ?? null,
  }));
}

async function profilePicFor(userId: unknown): Promise<string | null> {
  const insight: any = await AccountInsight.findOne({ user: userId })
    .sort({ recordedAt: -1 })
    .select("accountDetails.profile_picture_url")
    .lean();
  return insight?.accountDetails?.profile_picture_url ?? null;
}

async function buildContexto(mapaDoc: any): Promise<CriadorContexto | null> {
  const user: any = await User.findById(mapaDoc.userId)
    .select("name username")
    .lean();
  if (!user) return null;

  const mapa = mapaDoc.mapa ?? {};
  const [topPosts, profilePictureUrl] = await Promise.all([
    topPostsFor(mapaDoc.userId),
    profilePicFor(mapaDoc.userId),
  ]);

  return {
    userId: String(mapaDoc.userId),
    nome: user.name ?? "Criador",
    handle: user.username ? `@${user.username.replace(/^@/, "")}` : null,
    profilePictureUrl,
    maturidade: mapa.maturidade ?? "seed",
    narrativaCentral: mapa.narrativa_central ?? "",
    territorios: mapa.territorios ?? [],
    temas: mapa.temas ?? [],
    narrativasAdjacentes: mapa.narrativas_adjacentes ?? [],
    assets: mapa.assets ?? [],
    tom: mapa.tom ?? "",
    topPosts,
  };
}

async function main() {
  const angulo = arg("angulo") ?? "perfil";
  const limit = Number(arg("limit")) || (angulo === "collab" || angulo === "territorio" ? 4 : 1);

  await connectToDatabase();

  // Resolve criador por --userId, --handle=@... ou --name="..." (nesta ordem).
  let explicitUserId = arg("userId");
  const handle = arg("handle");
  const name = arg("name");
  if (!explicitUserId && (handle || name)) {
    explicitUserId = await resolveUserId(handle, name);
    if (!explicitUserId) {
      console.error(`✗ nenhum criador encontrado para ${handle ? `@${handle.replace(/^@/, "")}` : ""}${name ? ` "${name}"` : ""}`);
      await (await connectToDatabase()).connection.close();
      process.exit(2);
    }
  }

  let mapaDocs: any[];
  if (explicitUserId) {
    mapaDocs = await MapaSeed.find({ userId: explicitUserId }).lean();
  } else {
    const history = await readHistory();
    const used = recentlyUsed(history);
    const candidates = await MapaSeed.find({
      "mapa.maturidade": { $in: ["instagram_enriched", "video_enriched"] },
      "mapa.narrativa_central": { $nin: ["", null] },
    })
      .sort({ updatedAt: -1 })
      .limit(80)
      .lean();

    mapaDocs = candidates.filter((d: any) => !used.has(String(d.userId))).slice(0, limit);
    if (mapaDocs.length === 0 && candidates.length > 0) {
      // Todos em cooldown — libera o mais antigo para não travar a produção.
      mapaDocs = candidates.slice(0, limit);
    }
  }

  const contextos = (
    await Promise.all(mapaDocs.map((d) => buildContexto(d)))
  ).filter((c): c is CriadorContexto => c !== null);

  const payload = JSON.stringify({ angulo, criadores: contextos }, null, 2);
  const outArg = arg("out");
  if (outArg) {
    // --out aceita um DIRETÓRIO (pasta do dia) ou um arquivo. Diretório → grava
    // context.json lá dentro (o resolveAssets/produce leem dele) e imprime o
    // DIGEST compacto no stdout (o Galeano lê isto, não as URLs gigantes).
    const resolved = path.resolve(outArg);
    const isFile = /\.json$/i.test(outArg);
    const ctxPath = isFile ? resolved : path.join(resolved, "context.json");
    await fs.mkdir(path.dirname(ctxPath), { recursive: true });
    await fs.writeFile(ctxPath, payload);
    console.error(`✓ context salvo em ${ctxPath}`);
    process.stdout.write(digest(angulo, contextos) + "\n");
  } else {
    // Sem --out: imprime o JSON completo (compatível com chamadas antigas).
    process.stdout.write(payload);
  }
  await (await connectToDatabase()).connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
