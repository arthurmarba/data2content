import AccountInsightModel, { IAccountInsight } from "@/app/models/AccountInsight"; // Ajuste o caminho conforme necessário
import { Types } from "mongoose";

interface FollowerGrowthData {
  currentFollowers: number | null;
  previousFollowers: number | null;
  absoluteGrowth: number | null;
  percentageGrowth: number | null; // Em formato decimal, ex: 0.20 para 20%
  startDate?: Date | null;
  endDate?: Date | null;
}

async function calculateFollowerGrowthRate(
  userId: string | Types.ObjectId,
  periodInDays: number
): Promise<FollowerGrowthData> {
  const resolvedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
  const today = new Date();
  const endDate = new Date(today); // Data final é hoje
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - periodInDays); // Data inicial é periodInDays atrás

  const initialResult: FollowerGrowthData = {
    currentFollowers: null,
    previousFollowers: null,
    absoluteGrowth: null,
    percentageGrowth: null,
    startDate: startDate,
    endDate: endDate,
  };

  try {
    // 1. Buscar o snapshot mais recente até endDate
    const latestSnapshot: IAccountInsight | null = await AccountInsightModel.findOne({
      user: resolvedUserId,
      recordedAt: { $lte: endDate },
    })
    .sort({ recordedAt: -1 })
    .lean();

    if (!latestSnapshot || typeof latestSnapshot.followersCount !== 'number') {
      // Se não houver snapshot recente ou followersCount não for um número, retorna dados iniciais/nulos
      console.warn(`No recent AccountInsight or valid followersCount for userId: ${resolvedUserId} up to ${endDate.toISOString()}`);
      return initialResult;
    }
    initialResult.currentFollowers = latestSnapshot.followersCount;

    // 2. Buscar o snapshot mais recente anterior ou igual à startDate
    const previousSnapshot: IAccountInsight | null = await AccountInsightModel.findOne({
      user: resolvedUserId,
      recordedAt: { $lte: startDate },
    })
    .sort({ recordedAt: -1 })
    .lean();

    // 3. Cálculos
    if (!previousSnapshot || typeof previousSnapshot.followersCount !== 'number') {
      // Snapshot recente existe, mas não anterior ou followersCount anterior não é um número
      initialResult.previousFollowers = 0;
      initialResult.absoluteGrowth = initialResult.currentFollowers;
      initialResult.percentageGrowth = initialResult.currentFollowers > 0 ? 1.0 : 0.0;
    } else {
      // Ambos os snapshots existem e têm followersCount válidos
      initialResult.previousFollowers = previousSnapshot.followersCount;
      initialResult.absoluteGrowth = initialResult.currentFollowers - initialResult.previousFollowers;

      if (initialResult.previousFollowers > 0) {
        initialResult.percentageGrowth = initialResult.absoluteGrowth / initialResult.previousFollowers;
      } else {
        initialResult.percentageGrowth = initialResult.currentFollowers > 0 ? 1.0 : 0.0;
      }
    }

    return initialResult;

  } catch (error) {
    console.error(`Error calculating follower growth rate for userId ${resolvedUserId}:`, error);
    // Retorna o objeto com valores nulos/zeros em caso de erro, mas com as datas preenchidas
    return {
        currentFollowers: null,
        previousFollowers: null,
        absoluteGrowth: null,
        percentageGrowth: null,
        startDate: startDate,
        endDate: endDate,
    };
  }
}

export default calculateFollowerGrowthRate;
// Exemplo de uso (comentar ou remover em produção):
/*
async function testGrowthRate() {
  // Simular conexão com o MongoDB ou usar um mock
  // mongoose.connect("mongodb://localhost:27017/yourdb");

  // Mock do modelo para teste local sem DB (substituir por conexão real)
  global.AccountInsightModel = {
    findOne: async (conditions: any) => {
      const userIdToTest = "60c72b9f9b1d8e001f8e4f5b"; // Exemplo de ID
      if (conditions.user.toString() !== userIdToTest) return null;

      if (conditions.recordedAt.$lte.toISOString().startsWith(new Date().toISOString().substring(0,10))) { // latest snapshot query
         // Simula snapshot recente
        if (conditions.recordedAt.$lte.getDate() >= (new Date().getDate() - 1) ) { // Ajuste para garantir que seja o mais recente
             return { followersCount: 120, recordedAt: new Date(), user: new Types.ObjectId(userIdToTest) };
        }
      }
      // Simula snapshot anterior
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      if (conditions.recordedAt.$lte.toISOString().startsWith(thirtyDaysAgo.toISOString().substring(0,10)) ) {
         return { followersCount: 100, recordedAt: thirtyDaysAgo, user: new Types.ObjectId(userIdToTest) };
      }
      return null;
    }
  } as any;


  const userId = "60c72b9f9b1d8e001f8e4f5b"; // Substituir por um ID de usuário de teste
  const period = 30; // 30 dias

  console.log(`\nTesting with existing AccountInsightModel: ${AccountInsightModel !== undefined}`);

  console.log("\n--- Test Case 1: Growth ---");
  // Mock para crescimento
  (AccountInsightModel.findOne as any) = jest.fn()
    .mockResolvedValueOnce({ followersCount: 120, recordedAt: new Date() }) // latest
    .mockResolvedValueOnce({ followersCount: 100, recordedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }); // previous
  let growthData = await calculateFollowerGrowthRate(userId, period);
  console.log(growthData);
  // Expected: currentFollowers: 120, previousFollowers: 100, absoluteGrowth: 20, percentageGrowth: 0.2

  console.log("\n--- Test Case 2: No Previous Snapshot ---");
  (AccountInsightModel.findOne as any) = jest.fn()
    .mockResolvedValueOnce({ followersCount: 50, recordedAt: new Date() }) // latest
    .mockResolvedValueOnce(null); // no previous
  growthData = await calculateFollowerGrowthRate(userId, period);
  console.log(growthData);
  // Expected: currentFollowers: 50, previousFollowers: 0, absoluteGrowth: 50, percentageGrowth: 1.0

  console.log("\n--- Test Case 3: No Recent Snapshot ---");
   (AccountInsightModel.findOne as any) = jest.fn()
    .mockResolvedValueOnce(null); // no recent
  growthData = await calculateFollowerGrowthRate(userId, period);
  console.log(growthData);
  // Expected: all nulls/0 for follower data, dates should be set

  console.log("\n--- Test Case 4: Previous is 0, Current > 0 ---");
  (AccountInsightModel.findOne as any) = jest.fn()
    .mockResolvedValueOnce({ followersCount: 10, recordedAt: new Date() }) // latest
    .mockResolvedValueOnce({ followersCount: 0, recordedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }); // previous
  growthData = await calculateFollowerGrowthRate(userId, period);
  console.log(growthData);
  // Expected: currentFollowers: 10, previousFollowers: 0, absoluteGrowth: 10, percentageGrowth: 1.0

  console.log("\n--- Test Case 5: Both 0 ---");
  (AccountInsightModel.findOne as any) = jest.fn()
    .mockResolvedValueOnce({ followersCount: 0, recordedAt: new Date() }) // latest
    .mockResolvedValueOnce({ followersCount: 0, recordedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }); // previous
  growthData = await calculateFollowerGrowthRate(userId, period);
  console.log(growthData);
  // Expected: currentFollowers: 0, previousFollowers: 0, absoluteGrowth: 0, percentageGrowth: 0.0

  console.log("\n--- Test Case 6: Decline ---");
  (AccountInsightModel.findOne as any) = jest.fn()
    .mockResolvedValueOnce({ followersCount: 90, recordedAt: new Date() }) // latest
    .mockResolvedValueOnce({ followersCount: 100, recordedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }); // previous
  growthData = await calculateFollowerGrowthRate(userId, period);
  console.log(growthData);
  // Expected: currentFollowers: 90, previousFollowers: 100, absoluteGrowth: -10, percentageGrowth: -0.1

  console.log("\n--- Test Case 7: DB Error Simulation ---");
  (AccountInsightModel.findOne as any) = jest.fn().mockRejectedValueOnce(new Error("DB connection failed"));
  growthData = await calculateFollowerGrowthRate(userId, period);
  console.log(growthData);
  // Expected: all nulls/0 for follower data, dates should be set, error logged to console
}

// Para executar o teste, você precisaria de um ambiente Node com ts-node e jest (ou similar)
// e descomentar a chamada para testGrowthRate() e a simulação do Mongoose.
// Ex: No seu package.json, scripts: "test:growth": "ts-node src/utils/calculateFollowerGrowthRate.ts"
// E então rodar `npm run test:growth` (após instalar ts-node e configurar jest globalmente ou no projeto)
// Ou, integrar em um arquivo de teste Jest.
// testGrowthRate(); // Descomente para rodar localmente com ts-node (requer setup de jest.fn ou similar)
*/
