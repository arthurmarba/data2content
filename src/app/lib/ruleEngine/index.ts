// src/app/lib/ruleEngine/index.ts

import ruleEngineInstance from './ruleEngineService';
import { logger } from '@/app/lib/logger';

// Importação das regras individuais
import { peakPerformanceSharesRule } from './rules/peakPerformanceSharesRule';
import { dropWatchTimeRule } from './rules/dropWatchTimeRule';
import { forgottenFormatRule } from './rules/forgottenFormatRule';
import { untappedPotentialTopicRule } from './rules/untappedPotentialTopicRule';
import { engagementPeakNotCapitalizedRule } from './rules/engagementPeakNotCapitalizedRule';
import { bestDayFormatEngagementRule } from './rules/bestDayFormatEngagementRule'; 
import { followerGrowthStagnationRule } from './rules/followerGrowthStagnationRule'; 
import { postingConsistencyRule } from './rules/postingConsistencyRule'; 
import { evergreenRepurposeRule } from './rules/evergreenRepurposeRule'; 
import { newFormatPerformanceRule } from './rules/newFormatPerformanceRule'; // <-- ADICIONADO
import { mediaTypeComparisonRule } from './rules/mediaTypeComparisonRule'; // <-- ADICIONADO


const TAG = '[RuleEngineIndex]';

logger.info(`${TAG} Iniciando registro de regras no motor...`);

// --- Registra cada regra no motor ---

ruleEngineInstance.registerRule(peakPerformanceSharesRule);
logger.info(`${TAG} Regra '${peakPerformanceSharesRule.id}' registrada.`);

ruleEngineInstance.registerRule(dropWatchTimeRule);
logger.info(`${TAG} Regra '${dropWatchTimeRule.id}' registrada.`);

ruleEngineInstance.registerRule(forgottenFormatRule);
logger.info(`${TAG} Regra '${forgottenFormatRule.id}' registrada.`);

ruleEngineInstance.registerRule(untappedPotentialTopicRule);
logger.info(`${TAG} Regra '${untappedPotentialTopicRule.id}' registrada.`);

ruleEngineInstance.registerRule(engagementPeakNotCapitalizedRule);
logger.info(`${TAG} Regra '${engagementPeakNotCapitalizedRule.id}' registrada.`);

ruleEngineInstance.registerRule(bestDayFormatEngagementRule);
logger.info(`${TAG} Regra '${bestDayFormatEngagementRule.id}' registrada.`);

ruleEngineInstance.registerRule(followerGrowthStagnationRule);
logger.info(`${TAG} Regra '${followerGrowthStagnationRule.id}' registrada.`);

ruleEngineInstance.registerRule(postingConsistencyRule);
logger.info(`${TAG} Regra '${postingConsistencyRule.id}' registrada.`);

ruleEngineInstance.registerRule(evergreenRepurposeRule);
logger.info(`${TAG} Regra '${evergreenRepurposeRule.id}' registrada.`);

// Registrando as duas novas regras
ruleEngineInstance.registerRule(newFormatPerformanceRule);
logger.info(`${TAG} Regra '${newFormatPerformanceRule.id}' registrada.`);

ruleEngineInstance.registerRule(mediaTypeComparisonRule);
logger.info(`${TAG} Regra '${mediaTypeComparisonRule.id}' registrada.`);


logger.info(`${TAG} Todas as regras disponíveis foram processadas para registro. Total de regras registradas: ${ruleEngineInstance.getRegisteredRuleIds().length}`);

// Exporta a instância configurada do motor de regras para ser usada em outras partes da aplicação
// (por exemplo, no dailyTipHandler.ts).
export default ruleEngineInstance;
