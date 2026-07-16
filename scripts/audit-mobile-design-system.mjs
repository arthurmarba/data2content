import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "src/app/dashboard/boards/components/videoUpload/appPreview");
const literalPattern = /#[0-9a-f]{3,8}\b|rgba?\(/gi;
const fontPattern = /SF Pro|Poppins/g;
const legacyPalettePattern = /#(?:1c1c1e|18181b|09090b|27272a|3a3a3c|52525b|71717a|8e8e93|a1a1aa|c7c7cc|d4d4d8|007aff|5856d6|5e5ce6|ff6b35|ededec|f2f2f7|f4f4f5|f7f7f4|e5e5ea|f1f1f1|e4e4e7)\b/gi;
const allowed = new Set(["diagnosticoTokens.ts"]);

const files = fs.readdirSync(root)
  .filter((file) => file.endsWith(".tsx") && !file.includes(".test.") && !allowed.has(file));

const findings = files.flatMap((file) => {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const colors = source.match(literalPattern)?.length ?? 0;
  const legacyFonts = source.match(fontPattern)?.length ?? 0;
  const legacyPalette = source.match(legacyPalettePattern)?.length ?? 0;
  return colors || legacyFonts || legacyPalette ? [{ file, colors, legacyFonts, legacyPalette }] : [];
}).sort((a, b) => (b.colors + b.legacyFonts) - (a.colors + a.legacyFonts));

const totalColors = findings.reduce((sum, finding) => sum + finding.colors, 0);
const totalFonts = findings.reduce((sum, finding) => sum + finding.legacyFonts, 0);
const totalLegacyPalette = findings.reduce((sum, finding) => sum + finding.legacyPalette, 0);

process.stdout.write(`Design-system audit: ${totalColors} color literals, ${totalFonts} legacy font references and ${totalLegacyPalette} legacy palette references.\n`);
for (const finding of findings.slice(0, 20)) {
  process.stdout.write(`${finding.file}: colors=${finding.colors}, legacyFonts=${finding.legacyFonts}, legacyPalette=${finding.legacyPalette}\n`);
}

if (process.argv.includes("--strict") && (totalFonts > 0 || totalLegacyPalette > 0)) process.exitCode = 1;
