/** Prepara sem IA; --run executa somente o manifesto congelado, com orçamento próprio. */
import { promises as fs } from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectToDatabase } from "../src/app/lib/mongoose";
import Metric from "../src/app/models/Metric";
import User from "../src/app/models/User";
import Operation from "../src/app/models/GeminiOperation";
import { GeminiBudgetPolicy, GeminiBudgetBucket } from "../src/app/models/GeminiBudget";
import { loadMapProfiles, type MapProfile } from "../src/app/lib/relatorio/mapProfiles";
import { freshPublishedMedia } from "../src/app/lib/relatorio/publishedMedia";
import { evaluateSceneAgainstMap } from "../src/app/lib/relatorio/sceneEvaluation";
import { LEGACY_SCENE_FORMAT, COMPACT_SCENE_FORMAT, type SceneResponseFormat } from "../src/app/lib/relatorio/compactSceneFormat";
import { governanceHash } from "../src/app/lib/llm/geminiGovernance";

const option = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
type Manifest = { id: string; createdAt: string; model: string; usdBrl: number; capBrl: number; priceSource: string; items: Array<{ metricId: string; mediaId: string; creatorId: string; duration: number; profile: MapProfile }> };
async function main() {
  const directory = path.resolve(option("output") ?? "output/gemini-compact");
  const file = path.join(directory, "manifest.json");
  await fs.mkdir(directory, { recursive: true });
  await connectToDatabase();
  if (!process.argv.includes("--run")) {
    const usdBrl = Number(option("usd-brl"));
    if (!Number.isFinite(usdBrl) || usdBrl <= 0) throw new Error("Informe --usd-brl com cotação conservadora para estimar o limite de R$ 8.");
    const users = await User.find({ isInstagramConnected: true, planStatus: { $in: ["active", "non_renewing"] }, instagramAccessToken: { $nin: [null, ""] } }).select("_id").lean();
    const candidates = await Metric.find({ user: { $in: users.map(u => u._id) }, type: { $in: ["REEL", "VIDEO"] }, instagramMediaId: { $nin: [null, ""] }, postDate: { $gte: new Date(Date.now() - 90 * 86400000) }, "stats.video_duration_seconds": { $gt: 0, $lte: 180 } })
      .select("user instagramMediaId stats.video_duration_seconds postDate").sort({ postDate: -1 }).limit(500).lean();
    // Distribui faixas de duração e criadores. A revisão humana completa as categorias de áudio.
    const buckets = [candidates.filter(m => m.stats!.video_duration_seconds! <= 30), candidates.filter(m => m.stats!.video_duration_seconds! > 30 && m.stats!.video_duration_seconds! <= 90), candidates.filter(m => m.stats!.video_duration_seconds! > 90)];
    const selected: typeof candidates = [];
    const perCreator = new Map<string, number>();
    for (let round = 0; round < 10; round++) for (const bucket of buckets) {
      const index = bucket.findIndex(m => (perCreator.get(String(m.user)) ?? 0) < 3);
      if (index < 0) continue;
      const [item] = bucket.splice(index, 1);
      selected.push(item!); perCreator.set(String(item!.user), (perCreator.get(String(item!.user)) ?? 0) + 1);
    }
    const profiles = await loadMapProfiles([...perCreator.keys()]);
    const manifest: Manifest = { id: `compact-${new Date().toISOString().slice(0, 10)}`, createdAt: new Date().toISOString(), model: "gemini-2.5-flash", usdBrl, capBrl: 8,
      priceSource: "https://ai.google.dev/gemini-api/docs/pricing#gemini-2.5-flash (consultado em 14/09/2026)",
      items: selected.filter(m => profiles.has(String(m.user))).map(m => ({ metricId: String(m._id), mediaId: m.instagramMediaId!, creatorId: String(m.user), duration: m.stats!.video_duration_seconds!, profile: profiles.get(String(m.user))! })) };
    await fs.writeFile(file, JSON.stringify(manifest, null, 2), { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify({ prepared: manifest.items.length, productionReceipts: await Operation.countDocuments({ contentKey: /^published:/ }), file, capBrl: 8, usdBrl, paidCalls: 0 }));
    return;
  }
  const manifest = JSON.parse(await fs.readFile(file, "utf8")) as Manifest;
  if (manifest.model !== "gemini-2.5-flash" || manifest.capBrl !== 8 || !Number.isFinite(manifest.usdBrl) || manifest.usdBrl <= 0 || manifest.items.length > 30) throw new Error("Manifesto inválido");
  // Uma única identidade para todo o experimento, inclusive retomadas em outro dia.
  const policyId = `comparison:${manifest.id}`;
  const cap = Math.floor(manifest.capBrl / manifest.usdBrl * 1e6);
  const rates = { [manifest.model]: { inputUsdPerMillion: 1, outputUsdPerMillion: 2.5 } };
  await GeminiBudgetPolicy.updateOne({ _id: policyId }, { $setOnInsert: { enabled: true, globalDailyMicros: cap, rates } }, { upsert: true });
  const policy = await GeminiBudgetPolicy.findById(policyId).lean();
  if (policy?.globalDailyMicros !== cap || JSON.stringify(policy.rates) !== JSON.stringify(rates)) throw new Error("Orçamento existente difere do manifesto; não redefinir reservas.");
  const fingerprintFile = path.join(directory, "manifest.sha256");
  const hash = governanceHash(manifest);
  try { await fs.writeFile(fingerprintFile, hash, { flag: "wx", mode: 0o600 }); }
  catch (error: any) { if (error.code !== "EEXIST" || await fs.readFile(fingerprintFile, "utf8") !== hash) throw new Error("Manifesto mudou após início do experimento"); }
  const summary: any[] = [];
  for (const [index, item] of manifest.items.entries()) {
    const user = await User.findById(item.creatorId).select("instagramAccessToken").lean();
    if (!user?.instagramAccessToken) { summary.push({ index, skipped: "sem token" }); continue; }
    const media = await freshPublishedMedia(item.mediaId, user.instagramAccessToken).catch(() => null);
    if (!media?.mediaUrl || media.mediaType !== "VIDEO") { summary.push({ index, skipped: "mídia indisponível" }); continue; }
    const videoFile = path.join(directory, `video-${index}.mp4`);
    let buffer: Buffer;
    try { buffer = await fs.readFile(videoFile); }
    catch (error: any) {
      if (error.code !== "ENOENT") throw error;
      const response = await fetch(media.mediaUrl, { signal: AbortSignal.timeout(30000) });
      if (!response.ok) { summary.push({ index, skipped: `download ${response.status}` }); continue; }
      buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > 200 * 1024 * 1024) { summary.push({ index, skipped: "mídia acima do teto" }); continue; }
      await fs.writeFile(videoFile, buffer, { mode: 0o600, flag: "wx" });
    }
    const videoHash = governanceHash(buffer.toString("base64"));
    try { await fs.writeFile(`${videoFile}.sha256`, videoHash, { flag: "wx", mode: 0o600 }); }
    catch (error: any) { if (error.code !== "EEXIST" || await fs.readFile(`${videoFile}.sha256`, "utf8") !== videoHash) throw new Error("Vídeo do experimento mudou; comparação interrompida"); }
    const bytes = new Uint8Array(buffer).buffer;
    const variants: SceneResponseFormat[] = index % 2 ? [COMPACT_SCENE_FORMAT, LEGACY_SCENE_FORMAT] : [LEGACY_SCENE_FORMAT, COMPACT_SCENE_FORMAT];
    for (const format of variants) {
      const result = await evaluateSceneAgainstMap({ metricId: item.metricId, mediaUrl: media.mediaUrl, profile: item.profile, durationSeconds: item.duration,
        model: manifest.model, responseFormat: format, experiment: { id: manifest.id, budgetPolicyId: policyId },
        fetchImpl: (async () => new Response(bytes.slice(0), { headers: { "content-type": "video/mp4" } })) as typeof fetch });
      await fs.writeFile(path.join(directory, `${index}-${format}.json`), JSON.stringify(result, null, 2), { mode: 0o600 });
      summary.push({ index, format, ok: result.ok, partial: result.ok && result.result.readingCompleteness === "partial", reason: result.ok ? undefined : result.reason });
      console.log(JSON.stringify(summary[summary.length - 1]));
      if (!result.ok && /gemini_budget_deferred|gemini_provider_balance/.test(result.reason)) break;
    }
    await fs.writeFile(path.join(directory, "summary.json"), JSON.stringify(summary, null, 2), { mode: 0o600 });
    const bucket = await GeminiBudgetBucket.findById(`experiment:${policyId}`).lean();
    if (summary.some(s => /gemini_budget_deferred|gemini_provider_balance/.test(s.reason ?? "")) || (bucket?.allocatedMicros ?? 0) >= cap) break;
  }
  const receipts = await Operation.find({ contentKey: { $regex: `^experiment:${manifest.id}:` } }).select("contentKey model responseFormat state outcome response.usageMetadata chargedEstimateMicros reservedMicros").lean();
  await fs.writeFile(path.join(directory, "usage.json"), JSON.stringify(receipts, null, 2), { mode: 0o600 });
  console.log(JSON.stringify({ directory, completedVariants: receipts.length, audioReview: "pendente; piloto continua em 0%" }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Falha na comparação"); process.exitCode = 1; }).finally(() => mongoose.disconnect());
