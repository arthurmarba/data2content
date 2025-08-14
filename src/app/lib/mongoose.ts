// src/app/lib/mongoose.ts
import mongoose, { Mongoose } from 'mongoose';

// Tipagem do cache de conexão
interface MongooseConnection {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// Evita recriar conexão em dev / serverless
declare global {
  // eslint-disable-next-line no-var
  var __mongooseConn: MongooseConnection | undefined;
}

const getCache = (): MongooseConnection => {
  if (!global.__mongooseConn) {
    global.__mongooseConn = { conn: null, promise: null };
  }
  return global.__mongooseConn;
};

export const connectToDatabase = async (): Promise<Mongoose> => {
  const cache = getCache();
  if (cache.conn) return cache.conn;

  // ❗️Pegue as envs AQUI (não no topo do arquivo)
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.DB_NAME || 'data2content';

  if (!uri) {
    // Só falha quando a função é chamada de fato
    throw new Error(
      'MONGODB_URI não definida. Crie .env.local com MONGODB_URI="mongodb+srv://<user>:<pass>@<host>/<db>?retryWrites=true&w=majority"'
    );
  }

  const opts: Parameters<typeof mongoose.connect>[1] = {
    bufferCommands: false,
    dbName,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  };

  if (!cache.promise) {
    // opcional: logs úteis
    if (process.env.NODE_ENV !== 'test') {
      console.log('=> opening new MongoDB connection');
    }
    cache.promise = mongoose
      .connect(uri, opts)
      .then((m) => {
        if (process.env.NODE_ENV !== 'test') console.log('MongoDB connected');
        return m;
      })
      .catch((err) => {
        // Libera o slot da promise para permitir nova tentativa depois
        global.__mongooseConn = { conn: null, promise: null };
        throw err;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
};
