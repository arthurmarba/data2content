import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { connectToDatabase } from "@/app/lib/mongoose";
import { freshMedia, instagramTokenFor } from "../scripts/relatorio/lib/creatorWeek";

const execFileP = promisify(execFile);
const deckPath = path.resolve("output/reunioes/2026-07-16-completo/deck.json");
const assetsDir = path.dirname(deckPath) + "/.assets";
const deck = JSON.parse(await fs.readFile(deckPath, "utf8"));
const debora = deck.criadores.find((c: any) => c.handle === "@deborabroch");
if (!debora?.userId || !debora?.reel?.postId) throw new Error("Débora sem userId/reel no deck hidratado");

await connectToDatabase();
const token = await instagramTokenFor(debora.userId);
if (!token) throw new Error("Débora sem token do Instagram");
const media = await freshMedia(debora.reel.postId, token);
if (media.mediaType !== "VIDEO" || !media.mediaUrl) throw new Error("Post da Débora não retornou vídeo");

const raw = path.join(assetsDir, "reel-08-raw.mp4");
const out = path.join(assetsDir, "reel-08.mp4");
const videoRes = await fetch(media.mediaUrl);
if (!videoRes.ok) throw new Error(`Falha ao baixar vídeo: HTTP ${videoRes.status}`);
await fs.writeFile(raw, Buffer.from(await videoRes.arrayBuffer()));
await execFileP("ffmpeg", [
  "-y", "-i", raw,
  "-t", "45",
  "-vf", "scale='min(720,iw)':-2",
  "-c:v", "libx264", "-crf", "30", "-preset", "veryfast",
  "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart",
  out,
]);
await fs.rm(raw, { force: true });

const posterUrl = media.thumbnailUrl ?? debora.reel.posterUrl ?? debora.pontoForte?.thumbnailUrl;
if (posterUrl) {
  const posterRes = await fetch(posterUrl);
  if (posterRes.ok) await fs.writeFile(path.join(assetsDir, "reel-poster-08.jpg"), Buffer.from(await posterRes.arrayBuffer()));
}
console.log("Débora: reel-08.mp4 atualizado");
process.exit(0);
