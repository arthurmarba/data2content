// @/app/lib/errors.ts - v1.1.0 (Adiciona OperationNotPermittedError)
// - ADICIONADO: Nova classe de erro 'OperationNotPermittedError'.

/**
 * Classe base para erros customizados da aplicação.
 * Permite encapsular uma causa raiz (underlying error) e garante
 * que o nome e o stack trace sejam tratados corretamente.
 */
export class BaseError extends Error {
    public readonly cause?: Error | unknown; // Causa raiz do erro, se houver

    constructor(message: string, cause?: Error | unknown) {
        super(message); // Passa a mensagem para a classe Error nativa

        // Define o nome da classe de erro corretamente (será sobrescrito pelas classes filhas)
        this.name = 'BaseError';
        this.cause = cause;

        // Garante que o stack trace seja capturado corretamente na classe filha
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        // Melhora o stack trace adicionando a causa, se disponível
        if (cause instanceof Error && cause.stack) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }

        // Necessário para instâncias de Error customizadas em TypeScript
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

// --- Erros de Acesso e Dados ---

/**
 * Erro lançado quando um usuário específico não é encontrado no banco de dados.
 */
export class UserNotFoundError extends BaseError {
    constructor(message: string = "Usuário não encontrado.", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'UserNotFoundError';
    }
}

/**
 * Erro lançado quando não são encontradas métricas suficientes para realizar uma análise.
 */
export class MetricsNotFoundError extends BaseError {
    constructor(message: string = "Métricas não encontradas ou insuficientes.", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'MetricsNotFoundError';
    }
}

// --- Erros de Serviços Externos ---

/**
 * Erro lançado quando ocorrem problemas na comunicação com a API da OpenAI.
 */
export class AIError extends BaseError {
    constructor(message: string = "Erro na comunicação com o serviço de IA.", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'AIError';
    }
}

// --- Erros de Infraestrutura Interna ---

/**
 * Erro lançado quando ocorrem problemas ao interagir com o cache (Redis).
 */
export class CacheError extends BaseError {
    constructor(message: string = "Erro ao interagir com o Cache (Redis).", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'CacheError';
    }
}

/**
 * Erro lançado para problemas genéricos ou específicos de banco de dados (MongoDB).
 */
export class DatabaseError extends BaseError {
    constructor(message: string = "Erro no Banco de Dados.", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'DatabaseError';
    }
}

// --- Erros Específicos da Lógica de Negócio (Relatórios) ---

/**
 * Erro lançado quando a agregação principal do relatório falha.
 * (Originado em reportHelpers)
 */
export class ReportAggregationError extends BaseError {
    constructor(message: string = "Falha na agregação geral do relatório.", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'ReportAggregationError';
    }
}

/**
 * Erro lançado especificamente quando a busca de estatísticas detalhadas falha.
 * (Originado em reportHelpers)
 */
export class DetailedStatsError extends BaseError {
    constructor(message: string = "Falha ao buscar estatísticas detalhadas.", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'DetailedStatsError';
    }
}

// --- Outros Erros Potenciais ---

/**
 * Erro para problemas de configuração ou dependências ausentes.
 */
export class ConfigurationError extends BaseError {
    constructor(message: string = "Erro de configuração.", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'ConfigurationError';
    }
}

/**
 * Erro para dados de entrada inválidos fornecidos a uma função ou serviço.
 */
export class ValidationError extends BaseError {
    constructor(message: string = "Dados de entrada inválidos.", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'ValidationError';
    }
}

// <<< NOVO: Erro para Operação Não Permitida >>>
/**
 * Erro lançado quando uma operação não é permitida devido a alguma condição de negócio
 * (ex: usuário não fez opt-in para uma funcionalidade).
 */
export class OperationNotPermittedError extends BaseError {
    constructor(message: string = "Operação não permitida.", cause?: Error | unknown) {
        super(message, cause);
        this.name = 'OperationNotPermittedError';
    }
}
// <<< FIM NOVO: Erro para Operação Não Permitida >>>


// Você pode adicionar mais classes de erro conforme necessário para sua aplicação.
