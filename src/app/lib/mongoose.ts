// src/app/lib/mongoose.ts

import mongoose, { Mongoose } from 'mongoose';

// Pega a URI e o nome do DB das variáveis de ambiente
// Certifique-se de definir DB_NAME no seu .env.local e na Vercel
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'data2content'; // <<< Defina um nome padrão ou pegue do .env

if (!MONGODB_URI) {
  throw new Error(
    'Por favor, defina a variável de ambiente MONGODB_URI dentro de .env.local'
  );
}

// Interface para o objeto de cache global
interface MongooseConnection {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

// Adiciona o cache ao objeto global do Node.js para persistir entre invocações serverless
// Usar 'declare global' para estender a interface global do NodeJS
declare global {
  // eslint-disable-next-line no-var
  var mongoose: MongooseConnection | undefined;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

/**
 * Função otimizada para conectar ao MongoDB em ambientes serverless.
 * Reutiliza conexões existentes e gerencia a promessa de conexão
 * para evitar múltiplas tentativas simultâneas.
 */
export const connectToDatabase = async (): Promise<Mongoose> => {
  // Se já temos uma conexão cacheada, retorna ela
  if (cached.conn) {
    // console.log('=> using existing database connection');
    return cached.conn;
  }

  // Se não há uma promessa de conexão em andamento, cria uma nova
  if (!cached.promise) {
    const opts = {
      // Desabilitar o buffer pode ajudar a identificar problemas mais rápido
      // Comandos falharão imediatamente se não houver conexão ativa.
      bufferCommands: false,
      // Especifica o nome do banco de dados explicitamente
      dbName: DB_NAME,
       // Aumenta um pouco o timeout padrão para seleção do servidor (padrão é 10000ms)
       // Ajuda em casos de cold start ou pequenas instabilidades de rede. Ajuste se necessário.
      serverSelectionTimeoutMS: 15000,
      // Timeout para operações de socket (padrão é 30000ms)
      socketTimeoutMS: 45000,
    };

    console.log('=> using new database connection');
    // Cria a promessa de conexão e a armazena no cache
    cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongooseInstance) => {
      console.log('MongoDB Connected');
      return mongooseInstance;
    }).catch(error => {
       // Em caso de erro na conexão inicial, limpa a promessa cacheada
       // para permitir uma nova tentativa na próxima chamada.
       console.error('MongoDB connection error:', error);
       cached!.promise = null; // Usa '!' pois 'cached' é garantido aqui
       throw new Error('Failed to connect to database');
    });
  }

  // Aguarda a promessa de conexão (seja a nova ou uma já existente) ser resolvida
  try {
    // Armazena a conexão resolvida no cache
    cached.conn = await cached.promise;
  } catch (e) {
     // Se a promessa falhar, limpa o cache da promessa e relança o erro
     cached.promise = null;
     throw e;
  }

  // Retorna a conexão estabelecida
  return cached.conn;
};
