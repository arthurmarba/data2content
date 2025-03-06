// pages/api/affiliates/index.js
const { getServerSession } = require("next-auth/next");
import { connectToDatabase } from "@lib/mongoose";
import User from "@models/user";
const { authOptions } = require("../auth/[...nextauth]"); // Import config do NextAuth

module.exports = async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  // Exemplo: ver role
  if (session.user.role !== "affiliate") {
    return res.status(403).json({ error: "Acesso negado" });
  }

  if (req.method === "GET") {
    // Pega dados do afiliado
    await connectToDatabase();
    const dbUser = await User.findOne({ _id: session.user.id });
    // Retorna affiliate_code, affiliate_balance, etc.
    return res.json({
      affiliate_code: dbUser.affiliate_code,
      affiliate_balance: dbUser.affiliate_balance,
    });
  }

  // Se quiser outro method POST/PUT etc.
  return res.status(405).json({ error: "Method not allowed" });
};
