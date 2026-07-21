// scripts/relatorio/lib/creatorWeek.ts
//
// Helpers de leitura (somente leitura) da semana de UM criador, compartilhados
// entre a Galileia (queryWeek.ts — relatório individual) e o Galisteu
// (queryMeeting.ts — apresentação de reunião em grupo).
//
// Extraídos de queryWeek.ts para evitar duplicação: a mesma fonte que o Galeano
// usa (MapaSeed, User, Metric, AccountInsight) + rebusca de thumbnails frescas
// via Graph API (a URL salva no Metric é assinada e expira → 403 no download).

import { promises as fs } from "node:fs";
import User from "@/app/models/User";
import Metric from "@/app/models/Metric";
import AccountInsight from "@/app/models/AccountInsight";
import { BASE_URL, API_VERSION } from "@/app/lib/instagram/config/instagramApiConfig";
import type { PostSemana, Snapshot } from "./types";

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function resolveUserId(
  handle: string | null,
  name: string | null,
): Promise<string | null> {
  if (handle) {
    const u: any = await User.findOne({
      username: new RegExp(
        `^@?${handle.replace(/^@/, "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
        "i",
      ),
    })
      .select("_id")
      .lean();
    if (u) return String(u._id);
  }
  if (name) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(name.trim())) {
      const byEmail: any = await User.findOne({ email: name.trim().toLowerCase() })
        .select("_id")
        .lean();
      if (byEmail) return String(byEmail._id);
    }
    const clean = name.trim().replace(/^(dra?\.?|assessoria)\s+/i, "");
    const accentPattern = (value: string): string => value
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/[aáàâãä]/gi, "[aáàâãä]")
      .replace(/[eéèêë]/gi, "[eéèêë]")
      .replace(/[iíìîï]/gi, "[iíìîï]")
      .replace(/[oóòôõö]/gi, "[oóòôõö]")
      .replace(/[uúùûü]/gi, "[uúùûü]")
      .replace(/[cç]/gi, "[cç]")
      .replace(/\s+/g, ".*");
    const rx = new RegExp(accentPattern(clean), "i");
    const candidates: any[] = await User.find({ name: rx })
      .select(
        "_id name username accountState mergedIntoUserId planStatus isInstagramConnected instagramAccountId instagramAccessToken lastInstagramSyncSuccess updatedAt",
      )
      .lean();
    if (candidates.length) {
      const normName = (value: string): string => value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/^(dra?\.?|assessoria)\s+/, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
      const wanted = normName(clean);
      const score = (u: any): number => {
        const candidate = normName(u.name ?? "");
        let total = 0;
        if (candidate === wanted) total += 50;
        else if (candidate.startsWith(wanted) || wanted.startsWith(candidate)) total += 30;
        if (u.isInstagramConnected) total += 35;
        if (u.instagramAccessToken) total += 15;
        if (u.instagramAccountId) total += 10;
        if (u.username) total += 10;
        if (u.lastInstagramSyncSuccess) total += 8;
        if (["active", "trial", "trialing"].includes(u.planStatus)) total += 12;
        if (u.accountState === "registered") total += 3;
        if (u.mergedIntoUserId) total -= 100;
        return total;
      };
      candidates.sort((a, b) => score(b) - score(a));
      return String(candidates[0]._id);
    }
  }
  return null;
}

export async function postsInWeek(userId: unknown, de: Date, ate: Date): Promise<PostSemana[]> {
  const posts = await Metric.find({
    user: userId,
    postDate: { $gte: de, $lte: ate },
  })
    .sort({ postDate: 1 })
    .select(
      "postLink postDate type format proposal context tone references description thumbnailUrl coverUrl instagramMediaId stats",
    )
    .lean();

  return posts.map((p: any) => ({
    postId: p.instagramMediaId ?? null,
    postLink: p.postLink ?? "",
    postDate: p.postDate ? ymd(new Date(p.postDate)) : "",
    type: p.type ?? "",
    format: Array.isArray(p.format) ? p.format : [],
    proposal: Array.isArray(p.proposal) ? p.proposal : [],
    context: Array.isArray(p.context) ? p.context : [],
    tone: Array.isArray(p.tone) ? p.tone : [],
    references: Array.isArray(p.references) ? p.references : [],
    description: (p.description ?? "").slice(0, 400),
    thumbnailUrl: p.thumbnailUrl ?? p.coverUrl ?? null,
    stats: {
      views: p.stats?.views,
      reach: p.stats?.reach,
      likes: p.stats?.likes,
      comments: p.stats?.comments,
      saved: p.stats?.saved,
      shares: p.stats?.shares,
      total_interactions: p.stats?.total_interactions,
    },
  }));
}

/** Token Instagram do criador (necessário p/ rebuscar mídia fresca na Graph API). */
export async function instagramTokenFor(userId: unknown): Promise<string | null> {
  const u: any = await User.findById(userId).select("instagramAccessToken").lean();
  return u?.instagramAccessToken ?? null;
}

/** Rebusca a thumbnail FRESCA de um post via Graph API. A URL salva no Metric é
 *  assinada e expira (dá 403 ao baixar server-side); a fresca baixa normalmente.
 *  Reel/vídeo → thumbnail_url; imagem → media_url. */
export async function freshThumb(mediaId: string, token: string): Promise<string | null> {
  const fields = encodeURIComponent("id,media_type,media_url,thumbnail_url");
  const url = `${BASE_URL}/${API_VERSION}/${mediaId}?fields=${fields}&access_token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
    if (j?.error) return null;
    return (
      (typeof j.thumbnail_url === "string" && j.thumbnail_url) ||
      (typeof j.media_url === "string" && j.media_url) ||
      null
    );
  } catch {
    return null;
  }
}

/** Rebusca a mídia FRESCA de um post (tipo + mp4 + poster). Para embutir o reel
 *  no deck (Galisteu): a media_url salva expira em horas — esta baixa normalmente.
 *  Só vale a pena embutir quando media_type === "VIDEO". */
export async function freshMedia(
  mediaId: string,
  token: string,
): Promise<{ mediaType: string | null; mediaUrl: string | null; thumbnailUrl: string | null }> {
  const fields = encodeURIComponent("id,media_type,media_url,thumbnail_url");
  const url = `${BASE_URL}/${API_VERSION}/${mediaId}?fields=${fields}&access_token=${token}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { mediaType: null, mediaUrl: null, thumbnailUrl: null };
    const j: any = await res.json();
    if (j?.error) return { mediaType: null, mediaUrl: null, thumbnailUrl: null };
    return {
      mediaType: typeof j.media_type === "string" ? j.media_type : null,
      mediaUrl: typeof j.media_url === "string" ? j.media_url : null,
      thumbnailUrl: typeof j.thumbnail_url === "string" ? j.thumbnail_url : null,
    };
  } catch {
    return { mediaType: null, mediaUrl: null, thumbnailUrl: null };
  }
}

/** Substitui as thumbnails dos posts por versões frescas da Graph API. */
export async function enrichThumbs(userId: unknown, posts: PostSemana[]): Promise<void> {
  const token = await instagramTokenFor(userId);
  if (!token) {
    console.error("⚠ sem token Instagram do criador — thumbnails podem dar 403 no render");
    return;
  }
  let ok = 0;
  for (const p of posts) {
    if (!p.postId) continue;
    const fresh = await freshThumb(p.postId, token);
    if (fresh) {
      p.thumbnailUrl = fresh;
      ok++;
    }
  }
  console.error(`✓ thumbnails frescas via Graph API: ${ok}/${posts.length}`);
}

export async function profilePicFor(userId: unknown): Promise<string | null> {
  const insight: any = await AccountInsight.findOne({ user: userId })
    .sort({ recordedAt: -1 })
    .select("accountDetails.profile_picture_url")
    .lean();
  return insight?.accountDetails?.profile_picture_url ?? null;
}

/** Lê o snapshot mais recente anterior a `ate` (liga o comparativo entre semanas).
 *  Os snapshots são gravados pela Galileia em output/relatorios/<slug>/snapshots.json. */
export async function previousSnapshot(snapshotsPath: string, ate: string): Promise<Snapshot | null> {
  try {
    const all: Snapshot[] = JSON.parse(await fs.readFile(snapshotsPath, "utf-8"));
    const previas = all.filter((s) => s.data < ate).sort((a, b) => (a.data < b.data ? 1 : -1));
    return previas[0] ?? null;
  } catch {
    return null;
  }
}
