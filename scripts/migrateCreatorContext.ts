// Habilita paths do tsconfig para o ts-node (CJS export exige extensão explícita em ESM)
import 'tsconfig-paths/register.js';

import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import { batchInferCreatorContexts } from '@/app/lib/creatorContextHelper';
import { logger } from '@/app/lib/logger';

async function migrateCreatorContexts() {
    logger.info('Starting creatorContext migration...');
    await connectToDatabase();

    try {
        const users = await UserModel.find({ creatorContext: { $exists: false } }).select('_id');
        const userIds = users.map(u => u._id.toString());

        logger.info(`Found ${userIds.length} users to migrate.`);

        if (userIds.length === 0) {
            logger.info('No users to migrate.');
            return;
        }

        const batchSize = 50;
        for (let i = 0; i < userIds.length; i += batchSize) {
            const batch = userIds.slice(i, i + batchSize);
            logger.info(`Processing batch ${i / batchSize + 1} of ${Math.ceil(userIds.length / batchSize)}...`);
            await batchInferCreatorContexts(batch);
        }

        logger.info('Migration completed successfully.');
    } catch (error) {
        logger.error('Migration failed:', error);
    }
}

migrateCreatorContexts()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
