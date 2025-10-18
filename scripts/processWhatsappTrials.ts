// scripts/processWhatsappTrials.ts

import "dotenv/config";
import { logger } from "../src/app/lib/logger";
import processWhatsappTrials from "../src/app/lib/cron/processWhatsappTrials";

const TAG = "[processWhatsappTrials]";

processWhatsappTrials()
  .then((result) => {
    logger.info(`${TAG} Execução concluída.`, result);
    process.exit(0);
  })
  .catch((error) => {
    logger.error(`${TAG} Erro fatal:`, error);
    process.exit(1);
  });
