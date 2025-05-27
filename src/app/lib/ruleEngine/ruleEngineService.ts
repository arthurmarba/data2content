// src/app/lib/ruleEngine/ruleEngineService.ts

import { logger } from '@/app/lib/logger';
import { IUser, IAlertHistoryEntry } from '@/app/models/User';
import { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { IAccountInsight } from '@/app/models/AccountInsight';
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types';
import { IDialogueState } from '@/app/lib/stateService';
import { PostObjectForAverage } from '@/app/lib/utils';
import * as dataService from '@/app/lib/dataService';
import { IRule, RuleContext, RuleConditionResult } from './types';
import { wasAlertTypeSentRecently } from '@/app/api/whatsapp/process-response/alertDetectionService';

interface IRuleEngineUserPreferences {
    isEnabled: boolean;
    disabledAlertTypes: string[];
}

function getTemporaryDefaultUserAlertPreferences(): IRuleEngineUserPreferences {
    return {
        isEnabled: true,
        disabledAlertTypes: [],
    };
}

class RuleEngineService {
    private rulesRegistry: IRule[] = [];
    private readonly serviceTag = '[RuleEngineService]';

    constructor() {
        logger.info(`${this.serviceTag} Instanciado.`);
    }

    public registerRule(rule: IRule): void {
        if (this.rulesRegistry.find(r => r.id === rule.id)) {
            logger.warn(`${this.serviceTag} Tentativa de registrar regra com ID duplicado: ${rule.id}. Ignorando.`);
            return;
        }
        this.rulesRegistry.push(rule);
        this.rulesRegistry.sort((a, b) => b.priority - a.priority);
        logger.info(`${this.serviceTag} Regra '${rule.id}' (Prioridade: ${rule.priority}) registrada. Total de regras: ${this.rulesRegistry.length}`);
    }

    public getRegisteredRulesMetadata(): { id: string, name: string, description: string, priority: number, resendCooldownDays: number }[] {
        return this.rulesRegistry.map(rule => ({
            id: rule.id,
            name: rule.name,
            description: rule.description,
            priority: rule.priority,
            resendCooldownDays: rule.resendCooldownDays,
        }));
    }

    public getRegisteredRuleIds(): string[] {
        return this.rulesRegistry.map(rule => rule.id);
    }

    public async runAllRules(userId: string, dialogueState: IDialogueState): Promise<DetectedEvent | null> {
        const handlerTAG = `${this.serviceTag}[runAllRules] User ${userId}:`;
        logger.info(`${handlerTAG} Iniciando execução do motor de regras.`);

        let user: IUser;
        try {
            user = await dataService.lookupUserById(userId);
        } catch (error) {
            logger.warn(`${handlerTAG} Usuário não encontrado ou erro ao buscar. Interrompendo. Erro: ${error}`);
            return null;
        }

        const userAlertHistory = user.alertHistory || [];
        const userPreferences: IRuleEngineUserPreferences = (user as any).userAlertPreferences || getTemporaryDefaultUserAlertPreferences();
        const today = new Date();

        const activeRules = this.rulesRegistry.filter(rule => {
            if (userPreferences.isEnabled === false) {
                logger.debug(`${handlerTAG} Radar desabilitado nas preferências (ou default). Nenhuma regra será executada.`);
                return false;
            }
            if (userPreferences.disabledAlertTypes?.includes(rule.id)) {
                logger.debug(`${handlerTAG} Regra '${rule.id}' desabilitada pelo usuário (ou default).`);
                return false;
            }

            // LÓGICA DE COOLDOWN DO HISTÓRICO ORIGINAL RESTAURADA
            if (wasAlertTypeSentRecently(userAlertHistory, rule.id, rule.resendCooldownDays, today)) {
                logger.debug(`${handlerTAG} Regra '${rule.id}' já enviada recentemente (cooldown: ${rule.resendCooldownDays} dias).`);
                return false;
            }

            // LÓGICA DE COOLDOWN DO DIÁLOGO ORIGINAL RESTAURADA
            if (dialogueState.lastRadarAlertType === rule.id) {
                 logger.debug(`${handlerTAG} Regra '${rule.id}' corresponde ao lastRadarAlertType. Pulando para evitar repetição na sessão.`);
                 return false;
            }
            return true;
        });

        if (activeRules.length === 0) {
            logger.info(`${handlerTAG} Nenhuma regra ativa elegível para execução após filtros iniciais.`);
            return null;
        }
        logger.debug(`${handlerTAG} ${activeRules.length} regras ativas para avaliação: ${activeRules.map(r=>r.id).join(', ')}`);

        const maxLookbackDays = activeRules.length > 0 ? Math.max(...activeRules.map(r => r.lookbackDays), 0) : 0;
        const allUserPosts = await dataService.getRecentPostObjectsWithAggregatedMetrics(userId, maxLookbackDays);

        let latestAccountInsights: IAccountInsight | null = null;
        if (activeRules.some(r => r.dataRequirements?.includes('accountInsights'))) {
            try {
                latestAccountInsights = await dataService.getLatestAccountInsights(userId);
            } catch (insightsError) {
                logger.warn(`${handlerTAG} Erro ao buscar latestAccountInsights:`, insightsError);
            }
        }

        const snapshotCache = new Map<string, IDailyMetricSnapshot[]>();
        const getSnapshotsForPostProvider = async (postId: string): Promise<IDailyMetricSnapshot[]> => {
            if (snapshotCache.has(postId)) {
                return snapshotCache.get(postId)!;
            }
            try {
                const snapshots = await dataService.getDailySnapshotsForMetric(postId, userId);
                snapshotCache.set(postId, snapshots);
                return snapshots;
            } catch (snapshotError) {
                logger.warn(`${handlerTAG} Erro ao buscar snapshots para post ${postId}:`, snapshotError);
                return [];
            }
        };

        const context: RuleContext = {
            user,
            allUserPosts: allUserPosts as PostObjectForAverage[],
            dialogueState,
            userAlertHistory,
            today,
            getSnapshotsForPost: getSnapshotsForPostProvider,
            latestAccountInsights: latestAccountInsights
        };

        logger.debug(`${handlerTAG} Avaliando condições para ${activeRules.length} regras (já ordenadas por prioridade)...`);

        for (const rule of activeRules) {
            try {
                logger.debug(`${handlerTAG} Avaliando condição da regra '${rule.id}' (Prioridade: ${rule.priority}).`);
                const conditionResult = await rule.condition(context);

                if (conditionResult.isMet) {
                    logger.info(`${handlerTAG} Condição da regra '${rule.id}' ATENDIDA.`);
                    const detectedEvent = await rule.action(context, conditionResult.data);

                    if (detectedEvent) {
                        logger.info(`${handlerTAG} Ação da regra '${rule.id}' gerou um evento. Retornando este evento (Prioridade: ${rule.priority}).`);
                        return detectedEvent;
                    } else {
                        logger.debug(`${handlerTAG} Ação da regra '${rule.id}' retornou null (sem evento gerado).`);
                    }
                } else {
                     logger.debug(`${handlerTAG} Condição da regra '${rule.id}' NÃO atendida.`);
                }
            } catch (ruleError) {
                logger.error(`${handlerTAG} Erro ao executar regra '${rule.id}':`, ruleError);
            }
        }

        logger.info(`${handlerTAG} Nenhuma regra gerou um evento de alerta após avaliação completa.`);
        return null;
    }
}

const ruleEngineInstance = new RuleEngineService();
export default ruleEngineInstance;
