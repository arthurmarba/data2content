import mongoose from 'mongoose';

import { connectToDatabase } from '@/app/lib/mongoose';
import {
  createBrandNarrativeReport,
  getPublicBrandNarrativeReportBySlug,
} from '@/app/lib/brands/brandNarrativeReportBuilder';
import { matchBrandsForNarrative } from '@/app/lib/brands/brandNarrativeMatcher';
import type { BrandNarrativeMatchInput } from '@/app/lib/brands/brandNarrativeMatchTypes';
import BrandNarrativeProfile from '@/app/models/BrandNarrativeProfile';
import BrandNarrativeReport from '@/app/models/BrandNarrativeReport';
import User from '@/app/models/User';

const SCRIPT_TAG = '[SMOKE_BRAND_NARRATIVE_FLOW]';

type SmokeOptions = {
  dryRun: boolean;
  skipReport: boolean;
  scenario: 'running' | 'wellness-digital' | 'wellness-chaos';
  verbose: boolean;
  userId?: string;
};

type SmokeSummary = {
  ok: boolean;
  validatedProfiles: number;
  matchesFound: number;
  matchLevels?: {
    alto: number;
    medio: number;
    baixo: number;
    panelVisible: number;
  };
  topMatches?: Array<{
    brandName: string;
    matchScore: number;
    matchLevel: string;
    matchedSignals: string[];
    rationale?: string;
    insertionAngle?: string;
  }>;
  firstMatch?: {
    brandName: string;
    matchScore: number;
    matchLevel: string;
  };
  report?: {
    created: boolean;
    publicSlug?: string;
    publicUrl?: string;
    status?: string;
    lookupValidated?: boolean;
  };
};

function parseArgs(argv: string[]): SmokeOptions {
  const options: SmokeOptions = {
    dryRun: false,
    skipReport: false,
    scenario: 'running',
    verbose: false,
    userId: process.env.BRAND_NARRATIVE_SMOKE_USER_ID?.trim() || undefined,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--skip-report') {
      options.skipReport = true;
      continue;
    }
    if (arg === '--verbose') {
      options.verbose = true;
      continue;
    }
    if (arg.startsWith('--userId=')) {
      options.userId = arg.slice('--userId='.length).trim() || undefined;
      continue;
    }
    if (arg.startsWith('--scenario=')) {
      const scenario = arg.slice('--scenario='.length).trim();
      if (scenario === 'running' || scenario === 'wellness-digital' || scenario === 'wellness-chaos') {
        options.scenario = scenario;
      }
      continue;
    }
    if (arg === '--scenario') {
      const nextValue = argv[index + 1]?.trim();
      if (
        (nextValue === 'running' || nextValue === 'wellness-digital' || nextValue === 'wellness-chaos') &&
        !nextValue.startsWith('--')
      ) {
        options.scenario = nextValue;
        index += 1;
      }
      continue;
    }
    if (arg === '--userId') {
      const nextValue = argv[index + 1]?.trim();
      if (nextValue && !nextValue.startsWith('--')) {
        options.userId = nextValue;
        index += 1;
      }
    }
  }

  return options;
}

function log(message: string, details?: Record<string, unknown>) {
  if (details) {
    console.log(`${SCRIPT_TAG} ${message}`, details);
    return;
  }
  console.log(`${SCRIPT_TAG} ${message}`);
}

const runningSmokeInput: BrandNarrativeMatchInput = {
  decision: {
    contextId: 'corrida de rua',
    proposalId: 'preparacao para prova',
    toneId: 'inspirador',
    narrativeId: 'jornada',
    intentId: 'inspirar',
    formatId: 'reels',
    themeId: 'meia maratona',
  },
  pauta: {
    title: 'Preparacao para minha primeira meia maratona com treino de corrida',
    description:
      'Rotina de longao, escolha de tenis de corrida, hidratacao, pace, comunidade de corrida e bastidores da evolucao ate a prova de rua.',
    reason: 'Mostrar uma jornada real de preparacao, superacao, treino pre-prova e aprendizado antes da corrida.',
    theme: 'corrida de rua e preparacao para prova',
    keywords: [
      'corrida',
      'corrida de rua',
      'tenis de corrida',
      'treino',
      'longao',
      'pace',
      'hidratacao',
      'meia maratona',
      'prova esportiva',
      'performance',
    ],
  },
  categories: {
    context: ['corrida de rua', 'treino', 'prova esportiva'],
    narrativeForm: ['jornada', 'bastidores', 'conquista'],
    contentIntent: ['inspirar', 'registrar jornada', 'demonstrar experiencia'],
    contentSignals: ['produto em uso real', 'rotina', 'preparacao'],
    proofStyle: ['uso cotidiano', 'experiencia real'],
    commercialMode: ['produto em uso', 'seeding', 'evento'],
  },
  limit: 6,
};

const wellnessDigitalSmokeInput: BrandNarrativeMatchInput = {
  decision: {
    contextId: 'Estilo de Vida e Bem-Estar',
    proposalId: 'rotina real',
    toneId: 'leve',
    narrativeId: 'rotina',
    intentId: 'conectar',
    formatId: 'reels',
    themeId: 'Estilo de Vida e Bem-Estar',
  },
  pauta: {
    title: 'Quando você tenta relaxar e o celular não para de tocar',
    description:
      'Pauta sobre rotina, descanso, excesso de notificações, autocuidado e relação com o celular no dia a dia.',
    reason: 'Mostrar uma tensão real entre pausa, cuidado pessoal e estímulos digitais constantes.',
    theme: 'Estilo de Vida e Bem-Estar',
    keywords: ['relaxar', 'celular', 'notificações', 'descanso', 'autocuidado', 'bem-estar digital'],
  },
  categories: {
    context: ['Estilo de Vida e Bem-Estar'],
    narrativeForm: ['rotina', 'história real'],
    contentIntent: ['conectar', 'gerar identificação'],
    contentSignals: ['uso cotidiano', 'rotina real', 'autocuidado'],
    proofStyle: ['experiência real', 'uso cotidiano'],
    commercialMode: ['produto em uso'],
  },
  limit: 6,
};

const wellnessChaosSmokeInput: BrandNarrativeMatchInput = {
  decision: {
    contextId: 'Estilo de Vida e Bem-Estar',
    proposalId: 'rotina real',
    toneId: 'humor cotidiano',
    narrativeId: 'pov',
    intentId: 'conectar',
    formatId: 'reels',
    themeId: 'Estilo de Vida e Bem-Estar',
  },
  pauta: {
    title: 'POV: tentando relaxar enquanto a obra começa',
    description:
      'Pauta sobre tentativa de descanso, barulho de obra, caos doméstico, humor cotidiano, autocuidado e rotina real.',
    reason: 'Mostrar uma frustração leve de tentar pausar enquanto a casa, o barulho e a rotina real não colaboram.',
    theme: 'Estilo de Vida e Bem-Estar',
    keywords: ['relaxar', 'obra', 'barulho', 'descanso', 'autocuidado', 'rotina real', 'caos doméstico'],
  },
  categories: {
    context: ['Estilo de Vida e Bem-Estar'],
    narrativeForm: ['pov', 'humor cotidiano', 'rotina real'],
    contentIntent: ['conectar', 'gerar identificação'],
    contentSignals: ['rotina real', 'humor cotidiano', 'autocuidado', 'pausa'],
    proofStyle: ['experiência real', 'uso cotidiano'],
    commercialMode: ['produto em uso real', 'ritual', 'experiência'],
  },
  limit: 6,
};

const smokeInputs: Record<SmokeOptions['scenario'], BrandNarrativeMatchInput> = {
  running: runningSmokeInput,
  'wellness-digital': wellnessDigitalSmokeInput,
  'wellness-chaos': wellnessChaosSmokeInput,
};

async function assertUserExists(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error(`userId invalido: ${userId}`);
  }

  const user = await User.findById(userId).select('_id email name username').lean().exec();
  if (!user) {
    throw new Error(`Nenhum usuario encontrado para BRAND_NARRATIVE_SMOKE_USER_ID=${userId}`);
  }

  return user;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const shouldCreateReport = Boolean(options.userId && !options.dryRun && !options.skipReport);
  const summary: SmokeSummary = {
    ok: false,
    validatedProfiles: 0,
    matchesFound: 0,
    report: {
      created: false,
    },
  };

  log('Iniciando smoke operacional de marcas sugeridas.', {
    dryRun: options.dryRun,
    skipReport: options.skipReport,
    scenario: options.scenario,
    verbose: options.verbose,
    hasUserId: Boolean(options.userId),
    willCreateReport: shouldCreateReport,
  });

  try {
    await connectToDatabase();

    const validatedProfiles = await BrandNarrativeProfile.countDocuments({
      archivedAt: { $exists: false },
      validationStatus: 'validated',
      status: { $in: ['observed_external', 'human_validated', 'ai_generated', 'brand_registered'] },
    }).exec();

    summary.validatedProfiles = validatedProfiles;
    if (validatedProfiles < 1) {
      throw new Error('Nenhum BrandNarrativeProfile validado encontrado. Rode o seed antes do smoke.');
    }

    log('BrandNarrativeProfile validados encontrados.', { count: validatedProfiles });

    const smokeInput = smokeInputs[options.scenario];
    const matches = await matchBrandsForNarrative(smokeInput);
    summary.matchesFound = matches.length;
    if (matches.length < 1) {
      throw new Error(`O motor de match nao retornou nenhuma marca para o cenario ${options.scenario}.`);
    }

    const firstMatch = matches[0];
    if (!firstMatch) {
      throw new Error(`O motor de match nao retornou nenhuma marca para o cenario ${options.scenario}.`);
    }
    summary.matchLevels = matches.reduce(
      (accumulator, match) => {
        if (match.matchLevel === 'alto') accumulator.alto += 1;
        if (match.matchLevel === 'medio') accumulator.medio += 1;
        if (match.matchLevel === 'baixo') accumulator.baixo += 1;
        if (match.matchLevel === 'alto' || match.matchLevel === 'medio') accumulator.panelVisible += 1;
        return accumulator;
      },
      { alto: 0, medio: 0, baixo: 0, panelVisible: 0 }
    );
    summary.topMatches = matches.slice(0, 6).map((match) => ({
      brandName: match.brandName,
      matchScore: match.matchScore,
      matchLevel: match.matchLevel,
      matchedSignals: match.matchedSignals,
      ...(options.verbose
        ? {
            rationale: match.rationale,
            insertionAngle: match.insertionAngle,
          }
        : {}),
    }));
    summary.firstMatch = {
      brandName: firstMatch.brandName,
      matchScore: firstMatch.matchScore,
      matchLevel: firstMatch.matchLevel,
    };

    if (summary.matchLevels.panelVisible < 1) {
      throw new Error(`O cenario ${options.scenario} nao retornou matches medios/altos para exibicao no painel.`);
    }

    log('Match narrativo validado.', {
      matchesFound: matches.length,
      firstBrand: firstMatch.brandName,
      matchScore: firstMatch.matchScore,
      matchLevel: firstMatch.matchLevel,
      matchLevels: summary.matchLevels,
      topMatches: summary.topMatches,
    });

    if (!options.userId) {
      log('Sem userId informado: criacao de relatorio pulada por seguranca.');
    } else if (options.dryRun || options.skipReport) {
      log('Criacao de relatorio pulada por flag operacional.', {
        dryRun: options.dryRun,
        skipReport: options.skipReport,
        userId: options.userId,
      });
    } else {
      const user = await assertUserExists(options.userId);
      log('UserId validado. O smoke vai criar um relatorio real.', {
        userId: String(user._id),
      });

      const report = await createBrandNarrativeReport({
        userId: options.userId,
        decision: smokeInput.decision,
        pauta: smokeInput.pauta,
        brandMatch: firstMatch,
      });

      if (!report.publicSlug || !report.publicUrl) {
        throw new Error('Relatorio criado sem publicSlug/publicUrl.');
      }

      const persistedReport = await BrandNarrativeReport.findOne({
        publicSlug: report.publicSlug,
      })
        .select('_id publicSlug status')
        .lean()
        .exec();
      if (!persistedReport) {
        throw new Error(`Relatorio criado nao foi encontrado no banco por publicSlug=${report.publicSlug}.`);
      }
      if ((persistedReport as any).status !== 'active') {
        throw new Error(`Relatorio criado com status inesperado: ${(persistedReport as any).status || 'sem status'}.`);
      }

      const publicReport = await getPublicBrandNarrativeReportBySlug(report.publicSlug);
      if (!publicReport) {
        throw new Error(`Helper publico nao encontrou relatorio active por publicSlug=${report.publicSlug}.`);
      }

      summary.report = {
        created: true,
        publicSlug: report.publicSlug,
        publicUrl: report.publicUrl,
        status: report.status,
        lookupValidated: true,
      };

      log('Relatorio real criado pelo smoke.', {
        reportId: report.reportId,
        publicSlug: report.publicSlug,
        publicUrl: report.publicUrl,
        status: report.status,
        lookupValidated: true,
      });
    }

    summary.ok = true;
    log('Smoke concluido com sucesso.');
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log('Smoke falhou.', { error: message });
    console.log(JSON.stringify(summary, null, 2));
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    log('Conexao com o banco encerrada.');
  }
}

void run();
