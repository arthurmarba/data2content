// src/app/lib/ruleEngine/types.ts

// ATUALIZADO: Caminhos de importação corrigidos
import { IUser, IAlertHistoryEntry } from '@/app/models/User'; 
import { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot'; 
import { IAccountInsight } from '@/app/models/AccountInsight'; // <--- CAMINHO CORRIGIDO
import { IDialogueState } from '@/app/lib/stateService';
import { PostObjectForAverage } from '@/app/lib/utils'; 
import { DetectedEvent } from '@/app/api/whatsapp/process-response/types'; 

/**
 * Define o objeto de contexto que será passado para cada regra durante sua avaliação.
 * Ele contém todos os dados e dependências que uma regra pode precisar para tomar uma decisão.
 */
export interface RuleContext {
    /** O objeto completo do usuário, incluindo userPreferences e alertHistory. */
    user: IUser;

    /**
     * Array de posts do usuário, buscando um período que cubra o `maxLookbackDays` de todas as regras ativas.
     * Estes objetos devem ser do tipo `PostObjectForAverage` e incluir os campos `format`, `proposal`, `context`,
     * além de todas as métricas de `stats` que as regras possam necessitar.
     */
    allUserPosts: PostObjectForAverage[];

    /** O estado atual do diálogo do usuário. */
    dialogueState: IDialogueState;

    /** Histórico de alertas já enviados ao usuário. Usado para evitar reenvio. */
    userAlertHistory: IAlertHistoryEntry[];

    /** A data e hora atuais no momento da execução do motor de regras. */
    today: Date;

    /**
     * Uma função provedora para buscar snapshots diários de um post sob demanda.
     * O motor de regras injetará esta função no contexto, pré-configurada com o `userId`.
     * As regras que precisam de snapshots chamarão esta função.
     * Exemplo de uso dentro de uma regra: `const snapshots = await context.getSnapshotsForPost(postId);`
     */
    getSnapshotsForPost: (postId: string) => Promise<IDailyMetricSnapshot[]>;

    /**
     * Opcional: Os insights mais recentes da conta do usuário.
     * Se múltiplas regras precisarem destes dados, o motor pode pré-buscá-los e injetá-los aqui.
     * Se não for pré-buscado, as regras que precisarem podem chamar uma função similar ao `getSnapshotsForPost`.
     */
    latestAccountInsights?: IAccountInsight | null;
}

/**
 * Define a estrutura do objeto retornado pela função condition de uma regra.
 */
export interface RuleConditionResult {
    /** Indica se a condição principal da regra foi atendida e se a regra é candidata a gerar um alerta. */
    isMet: boolean;

    /**
     * Dados opcionais que a função `condition` identificou e que a função `action` precisará para construir o `DetectedEvent`.
     * Isso evita que a função `action` precise recalcular ou rebuscar esses dados.
     * Ex: Para um alerta de pico de shares, `data` poderia conter `{ postId: 'xyz', peakValue: 100, averageValue: 10 }`.
     */
    data?: any;
}

/**
 * A interface central que define a estrutura de cada regra de alerta.
 */
export interface IRule {
    /**
     * Identificador único global da regra. Usado como `alertType` no histórico e para preferências.
     * Ex: "peak_performance_shares_v1", "untapped_topic_high_engagement_v1".
     * A versão (e.g., _v1) permite criar novas versões de uma regra sem conflitar com a antiga.
     */
    id: string;

    /** Nome legível da regra, para logs e possivelmente para UI de configuração de preferências. */
    name: string;

    /** Descrição curta do que a regra faz e qual insight ela busca gerar. */
    description: string;

    /**
     * Prioridade numérica da regra. Usada para desempate se múltiplas regras tiverem suas condições atendidas.
     * Um valor maior indica maior prioridade.
     */
    priority: number;

    /**
     * Número de dias de histórico de posts (`allUserPosts`) que esta regra precisa para sua análise.
     * O motor de regras usará o valor máximo entre todas as regras ativas para buscar os posts uma vez.
     */
    lookbackDays: number;

    /**
     * Declara explicitamente se a regra requer dados adicionais além de `allUserPosts`.
     * O motor de regras pode usar isso para otimizar o carregamento de dados (e.g., pré-buscar `latestAccountInsights`
     * se alguma regra ativa o declarar).
     * Ex: `['snapshots']` ou `['accountInsights', 'snapshots']`.
     */
    dataRequirements?: ('snapshots' | 'accountInsights')[];

    /**
     * Função assíncrona que avalia se as condições para esta regra são atendidas,
     * com base no `RuleContext` fornecido.
     * Retorna um objeto `RuleConditionResult`.
     */
    condition: (context: RuleContext) => Promise<RuleConditionResult>;

    /**
     * Função assíncrona que, se a `condition` for atendida, gera o objeto `DetectedEvent` para o alerta.
     * Recebe o `RuleContext` e os dados (`conditionData`) retornados pela função `condition`.
     * Pode retornar `null` se, mesmo com a condição atendida, uma verificação final na `action` determinar
     * que o alerta não deve ser gerado (e.g., o insight não é forte o suficiente após um cálculo final).
     */
    action: (context: RuleContext, conditionData?: any) => Promise<DetectedEvent | null>;
    
    /**
     * Número de dias que devem se passar antes que este tipo específico de alerta (`rule.id`)
     * possa ser enviado novamente para o mesmo usuário.
     */
    resendCooldownDays: number;
}
