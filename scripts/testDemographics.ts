// scripts/testDemographics.ts

import 'dotenv/config'; // Garante que as variáveis de .env sejam carregadas
import { connectToDatabase } from '../src/app/lib/mongoose';
import User from '../src/app/models/User';
import { fetchFollowerDemographics } from '../src/services/instagramInsightsService';
import { logger } from '../src/app/lib/logger';

async function testDemographicsCollection() {
  const TAG = '[testDemographicsScript]';

  // ID do usuário no seu banco de dados que você quer usar para o teste
  const TEST_USER_ID = '6838def9ecf99d0ab45a9eba';

  if (!TEST_USER_ID) {
    logger.error(`${TAG} ID de usuário para teste não foi fornecido.`);
    process.exit(1);
  }

  try {
    logger.info(`${TAG} Conectando ao banco de dados...`);
    await connectToDatabase();
    logger.info(`${TAG} Conectado com sucesso.`);

    logger.info(`${TAG} Buscando usuário com ID: ${TEST_USER_ID}`);
    const user = await User.findById(TEST_USER_ID)
      .select('instagramAccountId instagramAccessToken')
      .lean();

    if (!user) {
      logger.error(`${TAG} Usuário com ID ${TEST_USER_ID} não encontrado.`);
      return;
    }

    if (!user.instagramAccountId || !user.instagramAccessToken) {
      logger.error(`${TAG} Usuário encontrado, mas não possui conta do Instagram ou token de acesso.`);
      return;
    }

    logger.info(`${TAG} Usuário encontrado com Instagram Account ID: ${user.instagramAccountId}`);
    logger.info(`${TAG} Iniciando a coleta de métricas demográficas...`);

    const demographicsData = await fetchFollowerDemographics(
      user.instagramAccountId,
      user.instagramAccessToken
    );

    logger.info(`${TAG} Coleta concluída com sucesso!`);

    // Imprime o resultado de forma legível
    console.log('--- RESULTADO DA COLETA ---');
    console.log(JSON.stringify(demographicsData, null, 2));
    console.log('---------------------------');

  } catch (error) {
    logger.error(`${TAG} Ocorreu um erro durante o teste:`, error);
  } finally {
    // É importante fechar a conexão ou o script pode não terminar
    logger.info(`${TAG} Encerrando o script.`);
    process.exit(0);
  }
}

testDemographicsCollection();