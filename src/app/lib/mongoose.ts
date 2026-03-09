// src/app/lib/mongoose.ts
import mongoose, { Mongoose } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from '@/app/lib/mongoTransient';

// Tipagem do cache de conexão
interface MongooseConnection {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

interface MongooseRuntimeState {
  listenersRegistered: boolean;
  lastConnectedAt: number;
  lastInvalidatedAt: number;
}

// Evita recriar conexão em dev / serverless
declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: MongooseConnection | undefined;
  // eslint-disable-next-line no-var
  var __mongooseRuntimeState: MongooseRuntimeState | undefined;
}

const getCache = (): MongooseConnection => {
  if (!global.__mongooseConn) {
    global.__mongooseConn = { conn: null, promise: null };
  }
  return global.__mongooseConn;
};

const getRuntimeState = (): MongooseRuntimeState => {
  if (!global.__mongooseRuntimeState) {
    global.__mongooseRuntimeState = {
      listenersRegistered: false,
      lastConnectedAt: 0,
      lastInvalidatedAt: 0,
    };
  }
  return global.__mongooseRuntimeState;
};

const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 30000;
const DEFAULT_SOCKET_TIMEOUT_MS = 60000;
const DEFAULT_MAX_POOL_SIZE = 10;
const CONNECT_RETRY_ATTEMPTS = 2;

function invalidateConnectionCache(reason: string, error?: unknown) {
  const cache = getCache();
  const runtimeState = getRuntimeState();
  cache.conn = null;
  if (mongoose.connection.readyState !== 2) {
    cache.promise = null;
  }
  runtimeState.lastInvalidatedAt = Date.now();

  logger.warn('[mongoose] Invalidating cached Mongo connection.', {
    reason,
    readyState: mongoose.connection.readyState,
    error: error ? getErrorMessage(error) : undefined,
  });
}

async function disconnectStaleConnection(reason: string, error?: unknown) {
  invalidateConnectionCache(reason, error);

  if (mongoose.connection.readyState !== 1) {
    return;
  }

  try {
    await mongoose.disconnect();
    logger.warn('[mongoose] Disconnected stale Mongo connection.', {
      reason,
    });
  } catch (disconnectError) {
    logger.warn('[mongoose] Failed to disconnect stale Mongo connection cleanly.', {
      reason,
      error: getErrorMessage(disconnectError),
    });
  }
}

function registerConnectionListeners() {
  const runtimeState = getRuntimeState();
  if (runtimeState.listenersRegistered) {
    return;
  }

  mongoose.connection.on('connected', () => {
    getRuntimeState().lastConnectedAt = Date.now();
    logger.info('[mongoose] MongoDB connection event: connected.', {
      dbName: mongoose.connection.name,
      host: mongoose.connection.host,
    });
  });

  mongoose.connection.on('disconnected', () => {
    invalidateConnectionCache('connection_disconnected');
  });

  mongoose.connection.on('error', (error) => {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      invalidateConnectionCache('connection_error', error);
      return;
    }

    logger.error('[mongoose] MongoDB connection emitted a non-transient error.', {
      error: getErrorMessage(error),
    });
  });

  runtimeState.listenersRegistered = true;
}

export const connectToDatabase = async (): Promise<Mongoose> => {
  const cache = getCache();
  const runtimeState = getRuntimeState();
  registerConnectionListeners();

  if (cache.promise) {
    return cache.promise;
  }

  const hasStaleConnectedState = runtimeState.lastInvalidatedAt > runtimeState.lastConnectedAt;

  if (cache.conn && cache.conn.connection.readyState === 1 && !hasStaleConnectedState) {
    return cache.conn;
  }

  if (hasStaleConnectedState) {
    await disconnectStaleConnection('stale_connected_state_detected');
  }

  if (cache.conn && cache.conn.connection.readyState !== 1) {
    await disconnectStaleConnection('cache_ready_state_not_connected');
  }

  // ❗️Pegue as envs AQUI (não no topo do arquivo)
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || process.env.DB_NAME || 'data2content';

  if (!uri) {
    // Só falha quando a função é chamada de fato
    throw new Error(
      'MONGODB_URI não definida. Crie .env.local com MONGODB_URI="mongodb+srv://<user>:<pass>@<host>/<db>?retryWrites=true&w=majority"'
    );
  }

  const parsedMaxPoolSize = Number(process.env.MONGODB_MAX_POOL_SIZE);
  const parsedServerSelectionTimeoutMs = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS);
  const parsedSocketTimeoutMs = Number(process.env.MONGODB_SOCKET_TIMEOUT_MS);
  const opts: Parameters<typeof mongoose.connect>[1] = {
    bufferCommands: true,
    dbName,
    maxPoolSize:
      Number.isFinite(parsedMaxPoolSize) && parsedMaxPoolSize > 0
        ? Math.floor(parsedMaxPoolSize)
        : DEFAULT_MAX_POOL_SIZE,
    serverSelectionTimeoutMS:
      Number.isFinite(parsedServerSelectionTimeoutMs) && parsedServerSelectionTimeoutMs > 0
        ? Math.floor(parsedServerSelectionTimeoutMs)
        : DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
    socketTimeoutMS:
      Number.isFinite(parsedSocketTimeoutMs) && parsedSocketTimeoutMs > 0
        ? Math.floor(parsedSocketTimeoutMs)
        : DEFAULT_SOCKET_TIMEOUT_MS,
  };

  logger.info('[mongoose] Opening MongoDB connection.', {
    dbName,
    readyState: cache.conn?.connection.readyState ?? mongoose.connection.readyState,
    maxPoolSize: opts.maxPoolSize,
    serverSelectionTimeoutMS: opts.serverSelectionTimeoutMS,
    socketTimeoutMS: opts.socketTimeoutMS,
  });

  cache.promise = withMongoTransientRetry(
    async () => {
      try {
        const connection = await mongoose.connect(uri, opts);
        runtimeState.lastConnectedAt = Date.now();
        logger.info('[mongoose] MongoDB connected.', {
          dbName: connection.connection.name,
          host: connection.connection.host,
        });
        return connection;
      } catch (error) {
        if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
          await disconnectStaleConnection('connect_attempt_failed', error);
        }
        throw error;
      }
    },
    {
      retries: CONNECT_RETRY_ATTEMPTS,
      onRetry: (error, retryCount) => {
        logger.warn('[mongoose] Retrying transient Mongo connection error.', {
          retryCount,
          error: getErrorMessage(error),
        });
      },
    }
  ).catch((err) => {
    global.__mongooseConn = { conn: null, promise: null };
    const payload = {
      dbName,
      error: getErrorMessage(err),
    };
    if (isTransientMongoError(err) || isTransientMongoError((err as any)?.cause)) {
      logger.warn('[mongoose] Transient failure while connecting to MongoDB.', payload);
    } else {
      logger.error('[mongoose] Failed to connect to MongoDB.', payload);
    }
    throw err;
  });

  cache.conn = await cache.promise;
  return cache.conn;
};
