/**
 * backfillActiveMapaSeed.ts — desperta o MapaSeed dos assinantes ativos
 *
 * Assinantes que já existiam ANTES da nova experiência mobile não passaram pelo
 * onboarding novo nem dispararam o enriquecimento on-connect do Instagram. O
 * MapaSeed deles está vazio/ausente, então o card "Seu Mapa" cai no path
 * read-only da síntese de vídeo (sem chips editáveis) ou aparece vazio.
 *
 * Este script percorre os usuários com PLANO ATIVO (premium) e, para cada um,
 * roda os mesmos enriquecedores que a produção usa:
 *
 *   1. Instagram → enrichMapaSeedWithInstagram (auto-cria o seed e preenche
 *      narrativa/territórios/temas/assets/tom a partir dos posts via Gemini).
 *      Só roda se o usuário tem Instagram conectado.
 *   2. Vídeo → enrichMapaSeedWithVideoForUser (cruza as leituras publicadas).
 *      Só roda se já existe um MapaSeed (criado pelo passo 1, pelo onboarding,
 *      ou pelo backfill de propósito) — é a mesma pré-condição da produção.
 *
 * Os dois enriquecedores são non-fatal e auto-throttle (não reprocessam um mapa
 * enriquecido há < 12h), então o script é seguro de re-rodar.
 *
 * COMPLEMENTAR ao `backfillMapaSeed.ts` (que cria o seed a partir do
 * creatorPurpose declarado). Rode aquele primeiro se quiser semear quem só tem
 * propósito e não tem Instagram. Aqui, usuários sem Instagram e sem MapaSeed
 * são apenas reportados (nada a enriquecer) — eles recebem o propósito inline.
 *
 * Uso:
 *   npx tsx scripts/backfillActiveMapaSeed.ts                 # dry-run (não escreve)
 *   npx tsx scripts/backfillActiveMapaSeed.ts --apply         # aplica (chama IA + grava)
 *   npx tsx scripts/backfillActiveMapaSeed.ts --email=x@y.com # um usuário (ignora filtro de plano)
 *   npx tsx scripts/backfillActiveMapaSeed.ts --apply --limit=50
 *   npx tsx scripts/backfillActiveMapaSeed.ts --apply --force      # fura o throttle (re-enriquece com prompts novos)
 *
 * ATENÇÃO: usa connectToDatabase() (a conexão padrão do app, MONGODB_URI). Rode
 * com a URI de PRODUÇÃO para backfillar produção. Em --apply, faz chamadas de IA
 * reais (Gemini/OpenAI) e grava — é uma operação de ops deliberada.
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const APPLY = process.argv.includes("--apply");
const EMAIL = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1] ?? null;
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? "0") || 0;
// --force: zera os timestamps de enriquecimento (instagram/video) antes de rodar,
// furando o throttle de 12h. Necessário para re-enriquecer com prompts atualizados.
const FORCE = process.argv.includes("--force");

async function main() {
  const { connectToDatabase } = await import("../src/app/lib/mongoose");
  const mongoose = (await import("mongoose")).default;
  await connectToDatabase();

  const { default: User } = await import("../src/app/models/User");
  const { default: MapaSeedModel } = await import("../src/app/models/MapaSeed");
  const { hasPlanPremiumAccess } = await import("../src/utils/planStatus");
  const { enrichMapaSeedWithInstagram } = await import(
    "../src/app/lib/mapaSeed/enrichMapaSeedForUser"
  );
  const { enrichMapaSeedWithVideoForUser } = await import(
    "../src/app/lib/mapaSeed/enrichMapaSeedWithVideoForUser"
  );

  console.log(
    `Banco: ${mongoose.connection.db?.databaseName} | modo: ${APPLY ? "APPLY" : "DRY-RUN"}` +
      `${EMAIL ? ` | email: ${EMAIL}` : ""}${LIMIT ? ` | limit: ${LIMIT}` : ""}\n`,
  );

  const baseQuery: Record<string, unknown> = EMAIL ? { email: EMAIL } : {};
  const users = await User.find(baseQuery)
    .select("email planStatus cancelAtPeriodEnd instagramAccountId isInstagramConnected")
    .lean();

  // Filtro de plano ativo (premium). Com --email, processa o usuário direto
  // para facilitar teste pontual, sem exigir plano ativo.
  const active = EMAIL
    ? users
    : users.filter((u) => hasPlanPremiumAccess((u as any).planStatus, (u as any).cancelAtPeriodEnd));

  console.log(`Usuários ativos: ${active.length}\n`);

  let igEnriched = 0;
  let videoEnriched = 0;
  let noSource = 0;
  let processed = 0;

  for (const u of active) {
    if (LIMIT && processed >= LIMIT) break;
    processed++;

    const userId = String((u as any)._id);
    const hasIG = Boolean((u as any).instagramAccountId || (u as any).isInstagramConnected);
    const hadSeedBefore = Boolean(await MapaSeedModel.exists({ userId: (u as any)._id }));

    const willIG = hasIG;
    const willVideo = hasIG || hadSeedBefore; // seed existirá após o passo IG, ou já existe

    if (!willIG && !willVideo) {
      noSource++;
      console.log(`  ○ ${(u as any).email}: sem Instagram e sem MapaSeed — nada a enriquecer (propósito inline)`);
      continue;
    }

    if (!APPLY) {
      const actions = [willIG ? "Instagram" : null, willVideo ? "vídeo" : null]
        .filter(Boolean)
        .join(" + ");
      console.log(`  • ${(u as any).email}: enriqueceria via ${actions}`);
      if (willIG) igEnriched++;
      if (willVideo) videoEnriched++;
      continue;
    }

    // ── APPLY ────────────────────────────────────────────────────────────────
    // --force: limpa o throttle por fonte para reprocessar com os prompts novos.
    if (FORCE) {
      await MapaSeedModel.updateOne(
        { userId: (u as any)._id },
        { $set: { instagramEnrichedAt: null, videoEnrichedAt: null } },
      );
    }

    if (willIG) {
      try {
        await enrichMapaSeedWithInstagram(userId);
        igEnriched++;
        console.log(`  ✅ ${(u as any).email}: Instagram enriquecido`);
      } catch (e) {
        console.log(`  ⚠️  ${(u as any).email}: falha no Instagram — ${(e as Error).message}`);
      }
    }

    // Vídeo só se há seed (criado pelo passo IG acima, ou pré-existente).
    const seedNow = Boolean(await MapaSeedModel.exists({ userId: (u as any)._id }));
    if (seedNow) {
      try {
        await enrichMapaSeedWithVideoForUser(userId);
        videoEnriched++;
        console.log(`  ✅ ${(u as any).email}: vídeo enriquecido`);
      } catch (e) {
        console.log(`  ⚠️  ${(u as any).email}: falha no vídeo — ${(e as Error).message}`);
      }
    }
  }

  console.log(
    `\nResumo: ${processed} processados | ${igEnriched} ${APPLY ? "Instagram OK" : "Instagram a rodar"} | ` +
      `${videoEnriched} ${APPLY ? "vídeo OK" : "vídeo a rodar"} | ${noSource} sem fonte`,
  );
  if (!APPLY) console.log("DRY-RUN — nada escrito. Rode com --apply para aplicar.");

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
