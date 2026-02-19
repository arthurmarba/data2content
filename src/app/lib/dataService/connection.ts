/**
 * @fileoverview Lógica de conexão com o MongoDB para o dataService.
 * @version 2.14.4
 */
import mongoose, { ConnectionStates } from 'mongoose';
import { logger } from '@/app/lib/logger'; // Ajuste o caminho se o seu logger estiver em outro local

let connectionPromise: Promise<typeof mongoose> | null = null;
let connectionTimeout: NodeJS.Timeout | null = null;

const MONGODB_CONNECTION_TIMEOUT_MS = 10000;
const DEFAULT_MAX_POOL_SIZE = 10;
const DEFAULT_MAX_IDLE_TIME_MS = 30_000;
const DEFAULT_WAIT_QUEUE_TIMEOUT_MS = 10_000;
// Certifique-se de que a variável de ambiente MONGODB_DB_NAME está configurada
// ou defina um valor padrão apropriado para o seu projeto.
const EXPECTED_DB_NAME = process.env.MONGODB_DB_NAME || 'data2content';
const parsedMaxPoolSize = Number(process.env.MONGODB_MAX_POOL_SIZE);
const parsedMaxIdleTimeMs = Number(process.env.MONGODB_MAX_IDLE_TIME_MS);
const parsedWaitQueueTimeoutMs = Number(process.env.MONGODB_WAIT_QUEUE_TIMEOUT_MS);
const MAX_POOL_SIZE =
  Number.isFinite(parsedMaxPoolSize) && parsedMaxPoolSize > 0
    ? Math.floor(parsedMaxPoolSize)
    : DEFAULT_MAX_POOL_SIZE;
const MAX_IDLE_TIME_MS =
  Number.isFinite(parsedMaxIdleTimeMs) && parsedMaxIdleTimeMs >= 0
    ? Math.floor(parsedMaxIdleTimeMs)
    : DEFAULT_MAX_IDLE_TIME_MS;
const WAIT_QUEUE_TIMEOUT_MS =
  Number.isFinite(parsedWaitQueueTimeoutMs) && parsedWaitQueueTimeoutMs >= 0
    ? Math.floor(parsedWaitQueueTimeoutMs)
    : DEFAULT_WAIT_QUEUE_TIMEOUT_MS;

/**
 * Estabelece ou reutiliza uma conexão com o banco de dados MongoDB.
 * Garante que a conexão seja feita com o banco de dados esperado (EXPECTED_DB_NAME).
 * @returns {Promise<typeof mongoose>} Uma promessa que resolve para a instância do mongoose conectada.
 * @throws {Error} Se a MONGODB_URI não estiver definida ou se ocorrer um erro crítico na conexão.
 */
export const connectToDatabase = async (): Promise<typeof mongoose> => {
    const TAG = '[dataService][connection][connectToDatabase v2.14.4]';
    const currentReadyState = mongoose.connection.readyState;

    // Log detalhado do estado atual da conexão
    logger.info(`${TAG} Solicitada conexão. Estado Mongoose: ${ConnectionStates[currentReadyState]} (${currentReadyState}). Conexão existente: ${mongoose.connection.name || 'N/A'}. DB esperado: ${EXPECTED_DB_NAME}`);

    // Se já estiver conectado ao banco de dados correto, reutiliza a conexão.
    if (currentReadyState === ConnectionStates.connected && mongoose.connection.name === EXPECTED_DB_NAME) {
        logger.info(`${TAG} Mongoose já conectado ao DB CORRETO ('${mongoose.connection.name}'). Reutilizando instância mongoose.`);
        return Promise.resolve(mongoose);
    }

    // Se estiver no processo de conexão, reutiliza a promessa existente.
    if (connectionPromise && currentReadyState === ConnectionStates.connecting) {
        logger.info(`${TAG} Mongoose está no estado 'connecting'. Reutilizando promessa de conexão existente.`);
        return connectionPromise;
    }

    logger.info(`${TAG} Necessário estabelecer nova conexão ou promessa de conexão.`);
    // Se estiver conectado a um DB diferente, reseta a promessa para forçar uma nova conexão direcionada.
    if (currentReadyState === ConnectionStates.connected && mongoose.connection.name !== EXPECTED_DB_NAME) {
        logger.warn(`${TAG} Mongoose conectado ao DB '${mongoose.connection.name}', mas esperado '${EXPECTED_DB_NAME}'. Será criada uma nova conexão direcionada.`);
        // Não é necessário desconectar explicitamente aqui, pois mongoose.connect() com dbName
        // deve lidar com a criação de uma nova conexão ou reutilizar a existente de forma inteligente.
        // No entanto, resetar connectionPromise garante que não reutilizemos uma promessa antiga para o DB errado.
        connectionPromise = null;
    }

    // Limpa timeout anterior, se existir.
    if (connectionTimeout) {
        clearTimeout(connectionTimeout);
        connectionTimeout = null;
    }

    // Valida se a MONGODB_URI está presente.
    if (!process.env.MONGODB_URI) {
        logger.error(`${TAG} MONGODB_URI não está definida no ambiente.`);
        throw new Error('MONGODB_URI não está definida.');
    }

    // Log da URI de forma segura (sem credenciais)
    const uriParts = process.env.MONGODB_URI.split('@');
    const uriDisplay = uriParts.length > 1 ? `mongodb+srv://****@${uriParts[1]}` : process.env.MONGODB_URI.substring(0,30) + "...";
    logger.info(`${TAG} MONGODB_URI (segura): ${uriDisplay}`);
    logger.info(
      `${TAG} Criando NOVA promessa de conexão com MongoDB para o DB: ${EXPECTED_DB_NAME}. maxPoolSize=${MAX_POOL_SIZE}, maxIdleTimeMS=${MAX_IDLE_TIME_MS}, waitQueueTimeoutMS=${WAIT_QUEUE_TIMEOUT_MS}.`
    );

    // Remove todos os listeners antigos para evitar duplicações ou comportamento inesperado
    // de listeners de conexões anteriores.
    mongoose.connection.removeAllListeners('connected');
    mongoose.connection.removeAllListeners('error');
    mongoose.connection.removeAllListeners('disconnected');
    mongoose.connection.removeAllListeners('reconnected');
    mongoose.connection.removeAllListeners('close');
    mongoose.connection.removeAllListeners('fullsetup');

    // Configura listeners para a nova tentativa de conexão.
    mongoose.connection.on('connected', () => {
        logger.info(`${TAG} Evento 'connected': Conectado ao MongoDB. DB: ${mongoose.connection.name}, Host: ${mongoose.connection.host}`);
        // Validação crítica: verifica se conectou ao banco de dados correto.
        if (mongoose.connection.name !== EXPECTED_DB_NAME) {
            logger.error(`${TAG} ALERTA CRÍTICO: Conectado ao banco de dados '${mongoose.connection.name}' em vez do esperado '${EXPECTED_DB_NAME}'. Verifique a string de conexão e a variável de ambiente MONGODB_DB_NAME.`);
            // Considere lançar um erro aqui ou tomar uma ação mais drástica se isso ocorrer.
        }
        if (connectionTimeout) clearTimeout(connectionTimeout);
    });
    mongoose.connection.on('error', (err) => {
        logger.error(`${TAG} Evento 'error': Erro na conexão MongoDB:`, err);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionPromise = null; // Reseta a promessa em caso de erro.
    });
    mongoose.connection.on('disconnected', () => {
        logger.warn(`${TAG} Evento 'disconnected': Desconectado do MongoDB.`);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionPromise = null; // Reseta a promessa.
    });
    mongoose.connection.on('reconnected', () => {
        logger.info(`${TAG} Evento 'reconnected': Reconectado ao MongoDB.`);
        if (mongoose.connection.name !== EXPECTED_DB_NAME) {
             logger.warn(`${TAG} Reconectado, mas ao DB '${mongoose.connection.name}'. Esperado: '${EXPECTED_DB_NAME}'.`);
        }
        if (connectionTimeout) clearTimeout(connectionTimeout);
    });
     mongoose.connection.on('close', () => {
        logger.info(`${TAG} Evento 'close': Conexão MongoDB fechada.`);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionPromise = null; // Reseta a promessa.
    });
    mongoose.connection.on('fullsetup', () => { // Para replica sets
        logger.info(`${TAG} Evento 'fullsetup': ReplSet fullsetup concluído.`);
    });

    // Cria a nova promessa de conexão.
    // A opção `dbName` na URI ou nas opções do connect é crucial para garantir
    // que o Mongoose se conecte ao banco de dados correto.
    connectionPromise = mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: MONGODB_CONNECTION_TIMEOUT_MS, // Tempo para selecionar um servidor
        socketTimeoutMS: 45000, // Tempo de inatividade do socket
        dbName: EXPECTED_DB_NAME, // Especifica o banco de dados aqui!
        maxPoolSize: MAX_POOL_SIZE,
        minPoolSize: 0,
        maxIdleTimeMS: MAX_IDLE_TIME_MS,
        waitQueueTimeoutMS: WAIT_QUEUE_TIMEOUT_MS,
        // useNewUrlParser: true, // Não é mais necessário no Mongoose 6+
        // useUnifiedTopology: true, // Não é mais necessário no Mongoose 6+
    }).then(mongooseInstance => {
        logger.info(`${TAG} Conexão MongoDB estabelecida com sucesso (dentro do .then). DB: ${mongooseInstance.connection.name}`);
        // Verificação final pós-conexão.
        if (mongooseInstance.connection.name !== EXPECTED_DB_NAME) {
            logger.error(`${TAG} ALERTA CRÍTICO PÓS-CONEXÃO: Conectado ao banco de dados '${mongooseInstance.connection.name}' em vez do esperado '${EXPECTED_DB_NAME}'. Isso não deveria acontecer se dbName foi especificado corretamente.`);
            // Considere desconectar e lançar um erro.
            // mongooseInstance.disconnect();
            // throw new Error(`Conexão estabelecida com o DB errado: ${mongooseInstance.connection.name}`);
        }
        if (connectionTimeout) clearTimeout(connectionTimeout);
        return mongooseInstance;
    }).catch(error => {
        logger.error(`${TAG} Falha CRÍTICA ao conectar ao MongoDB (dentro do .catch da promessa) para o DB ${EXPECTED_DB_NAME}:`, error);
        if (connectionTimeout) clearTimeout(connectionTimeout);
        connectionPromise = null; // Reseta a promessa em caso de falha.
        throw error; // Relança o erro para ser tratado pelo chamador.
    });

    // Configura um timeout para a operação de conexão.
    connectionTimeout = setTimeout(() => {
        logger.error(`${TAG} Timeout de ${MONGODB_CONNECTION_TIMEOUT_MS}ms atingido para conexão com MongoDB (DB: ${EXPECTED_DB_NAME}). O estado da conexão pode ser 'connecting' ou indefinido.`);
        // Não reseta connectionPromise aqui diretamente, pois a promessa ainda pode resolver ou rejeitar.
        // Apenas loga o timeout. O catch da promessa principal deve lidar com a falha.
        // Se a promessa ficar pendurada indefinidamente, isso é um problema mais profundo.
    }, MONGODB_CONNECTION_TIMEOUT_MS);

    return connectionPromise;
};
