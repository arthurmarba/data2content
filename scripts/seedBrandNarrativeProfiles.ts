import mongoose from 'mongoose';

import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import BrandNarrativeProfile, { type IBrandNarrativeProfile } from '@/app/models/BrandNarrativeProfile';
import { BRAND_NARRATIVE_SEED, type BrandNarrativeSeedItem } from '@/app/lib/brands/brandNarrativeSeed';

const SCRIPT_TAG = '[SCRIPT_SEED_BRAND_NARRATIVE_PROFILES]';

type SeedSummary = {
  dryRun: boolean;
  force: boolean;
  onlyNew: boolean;
  totalSeed: number;
  created: number;
  updated: number;
  ignored: number;
  ignoredExisting: number;
  errors: number;
};

type PreparedSeedItem = {
  seedItem: BrandNarrativeSeedItem;
  slug: string;
  normalizedName: string;
};

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function prepareSeedItem(seedItem: BrandNarrativeSeedItem): Promise<PreparedSeedItem> {
  const candidate = new BrandNarrativeProfile(seedItem);
  await candidate.validate();

  return {
    seedItem,
    slug: candidate.slug,
    normalizedName: candidate.normalizedName,
  };
}

function shouldUpdateExistingProfile(profile: IBrandNarrativeProfile, force: boolean): boolean {
  if (force) return true;
  if (profile.source === 'manual_seed') return true;
  return profile.validationStatus !== 'validated';
}

function buildSeedUpdate(seedItem: BrandNarrativeSeedItem) {
  return {
    brandName: seedItem.brandName,
    status: seedItem.status,
    source: seedItem.source,
    validationStatus: seedItem.validationStatus,
    confidenceScore: seedItem.confidenceScore,
    category: seedItem.category,
    subcategories: seedItem.subcategories,
    territories: seedItem.territories,
    contexts: seedItem.contexts,
    narrativeForms: seedItem.narrativeForms,
    contentIntents: seedItem.contentIntents,
    contentSignals: seedItem.contentSignals,
    tones: seedItem.tones,
    proofStyles: seedItem.proofStyles,
    commercialModes: seedItem.commercialModes,
    products: seedItem.products,
    campaignKeywords: seedItem.campaignKeywords,
    avoidContexts: seedItem.avoidContexts,
    insertionIdeas: seedItem.insertionIdeas,
    notes: seedItem.notes,
  };
}

async function assertNoDuplicateSeedSlugs(preparedItems: PreparedSeedItem[]) {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const item of preparedItems) {
    const existing = seen.get(item.slug);
    if (existing) {
      duplicates.push(`${existing} / ${item.seedItem.brandName} -> ${item.slug}`);
      continue;
    }
    seen.set(item.slug, item.seedItem.brandName);
  }

  if (duplicates.length > 0) {
    throw new Error(`Seed contém marcas com slug duplicado: ${duplicates.join('; ')}`);
  }
}

async function run() {
  const dryRun = hasFlag('dry-run');
  const force = hasFlag('force');
  const onlyNew = hasFlag('only-new');
  const summary: SeedSummary = {
    dryRun,
    force,
    onlyNew,
    totalSeed: BRAND_NARRATIVE_SEED.length,
    created: 0,
    updated: 0,
    ignored: 0,
    ignoredExisting: 0,
    errors: 0,
  };

  logger.info(`${SCRIPT_TAG} Iniciando seed de brand narrative profiles.`, {
    dryRun,
    force,
    onlyNew,
    totalSeed: BRAND_NARRATIVE_SEED.length,
  });

  try {
    if (onlyNew && force) {
      throw new Error('As flags --only-new e --force não podem ser usadas juntas.');
    }

    await connectToDatabase();

    const preparedItems = await Promise.all(BRAND_NARRATIVE_SEED.map(prepareSeedItem));
    await assertNoDuplicateSeedSlugs(preparedItems);

    if (dryRun) {
      logger.info(`${SCRIPT_TAG} Dry-run ativo: createIndexes e gravações serão ignorados.`);
    } else {
      await BrandNarrativeProfile.createIndexes();
      logger.info(`${SCRIPT_TAG} Índices de brand narrative profiles garantidos antes do upsert.`);
    }

    for (const prepared of preparedItems) {
      try {
        const existing = await BrandNarrativeProfile.findOne({
          $or: [{ slug: prepared.slug }, { normalizedName: prepared.normalizedName }],
        });

        if (!existing) {
          summary.created += 1;
          if (!dryRun) {
            await new BrandNarrativeProfile(prepared.seedItem).save();
          }
          continue;
        }

        if (onlyNew) {
          summary.ignoredExisting += 1;
          logger.info(`${SCRIPT_TAG} Marca existente ignorada por --only-new.`, {
            brandName: prepared.seedItem.brandName,
            slug: prepared.slug,
            existingSource: existing.source,
            existingValidationStatus: existing.validationStatus,
          });
          continue;
        }

        if (!shouldUpdateExistingProfile(existing, force)) {
          summary.ignored += 1;
          logger.info(`${SCRIPT_TAG} Marca ignorada para preservar curadoria existente.`, {
            brandName: prepared.seedItem.brandName,
            slug: prepared.slug,
            existingSource: existing.source,
            existingValidationStatus: existing.validationStatus,
          });
          continue;
        }

        summary.updated += 1;
        if (!dryRun) {
          existing.set(buildSeedUpdate(prepared.seedItem));
          await existing.save();
        }
      } catch (error) {
        summary.errors += 1;
        logger.error(`${SCRIPT_TAG} Falha ao processar marca da seed.`, {
          brandName: prepared.seedItem.brandName,
          slug: prepared.slug,
          error,
        });
      }
    }

    logger.info(`${SCRIPT_TAG} Seed concluída.`, summary);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    summary.errors += 1;
    logger.error(`${SCRIPT_TAG} Falha crítica no seed.`, error);
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    logger.info(`${SCRIPT_TAG} Conexão com o banco de dados encerrada.`);
  }
}

void run();
