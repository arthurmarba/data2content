// scripts/compliance-whatsapp.mjs
import { execSync } from "node:child_process";

function run(cmd) {
  try {
    return execSync(cmd, { stdio: "pipe" }).toString().trim();
  } catch (err) {
    const stderr = err?.stderr?.toString?.() || "";
    const stdout = err?.stdout?.toString?.() || "";
    // rg returns code 1 when no matches; that's fine.
    if (stderr.includes("command not found") || stderr.includes("No such file or directory")) {
      throw new Error(`Erro ao rodar comando:\n${cmd}\n\n${stderr || stdout}`);
    }
    return (stdout || "").trim();
  }
}

function fail(title, details) {
  console.error(`\n❌ ${title}\n${details}\n`);
  process.exit(1);
}

// ✅ Allowlist mínima: só permitimos sendWhatsAppMessage dentro do whatsappService.
const ALLOWLIST_SEND_FREE_TEXT = ["src/app/lib/whatsappService.ts"];

// 1) Bloquear texto livre fora da allowlist
{
  const allowGlobs = ALLOWLIST_SEND_FREE_TEXT.map((p) => `--glob '!${p}'`).join(" ");
  const cmd = `rg -n "sendWhatsAppMessage\\(" src ${allowGlobs}`;
  const out = run(cmd);

  if (out) {
    fail(
      "Uso de texto livre no WhatsApp fora da allowlist",
      `Encontrado sendWhatsAppMessage() fora de ${ALLOWLIST_SEND_FREE_TEXT.join(", ")}:\n\n${out}\n\n` +
        `➡️ Use templates via whatsappService, ou mova o envio para o arquivo allowlistado.`
    );
  }
}

// 2) Garantir que WhatsApp inbound não chama LLM / intent infra
{
  const cmd = `rg -n "(askLLM|openai|enrichedContext)" src/app/api/whatsapp`;
  const out = run(cmd);

  if (out) {
    fail(
      "Indícios de LLM no escopo do WhatsApp API",
      `Matches em src/app/api/whatsapp:\n\n${out}\n\n` +
        `➡️ Inbound precisa continuar redirect-only (sem LLM).`
    );
  }
}

console.log("✅ compliance:whatsapp OK");
process.exit(0);
