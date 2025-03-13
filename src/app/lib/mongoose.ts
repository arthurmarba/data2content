// src/app/lib/mongoose.ts

import mongoose from "mongoose";

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI não definido nas variáveis de ambiente");
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Conectado ao MongoDB!");
  } catch (err) {
    console.error("Erro ao conectar ao MongoDB:", err);
    throw err;
  }
}
