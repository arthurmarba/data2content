import { access, readFile, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const traceFile = path.join(
  projectRoot,
  ".next/server/app/api/dashboard/mobile-strategic-profile/analyze-real/route.js.nft.json",
);
const ffmpegBinary = path.join(projectRoot, "node_modules/ffmpeg-static/ffmpeg");

await access(ffmpegBinary, fsConstants.R_OK | fsConstants.X_OK);

const trace = JSON.parse(await readFile(traceFile, "utf8"));
if (!Array.isArray(trace.files)) {
  throw new Error(`Manifesto de trace inválido: ${traceFile}`);
}

const relativeBinaryPath = path.relative(path.dirname(traceFile), ffmpegBinary);
if (!trace.files.includes(relativeBinaryPath)) {
  trace.files.push(relativeBinaryPath);
  trace.files.sort();
  await writeFile(traceFile, JSON.stringify(trace));
}

console.log(`[video-analysis] ffmpeg incluído no trace: ${relativeBinaryPath}`);
