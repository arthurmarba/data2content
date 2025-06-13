// src/lib/services/adminCreatorService.ts
import { Types } from 'mongoose';
import UserModel, { IUser } from '@/app/models/User'; // Ajuste o caminho se IUser não estiver em UserModel diretamente
import { connectToDatabase } from '@/app/lib/dataService/connection'; // Reutilize a conexão existente
import {
  AdminCreatorListItem,
  AdminCreatorListParams,
  AdminCreatorStatus,
  AdminCreatorUpdateStatusPayload,
} from '@/types/admin/creators'; // Ajuste o caminho se necessário
import { logger } from '@/app/lib/logger';

const SERVICE_TAG = '[adminCreatorService]';

/**
 * Fetches a paginated list of creators for admin management.
 */
export async function fetchCreators(
  params: AdminCreatorListParams
): Promise<{ creators: AdminCreatorListItem[]; totalCreators: number; totalPages: number }> {
  const TAG = `${SERVICE_TAG}[fetchCreators]`;
  await connectToDatabase();

  const {
    page = 1,
    limit = 10,
    search,
    status,
    planStatus,
    sortBy = 'registrationDate', // Default sort
    sortOrder = 'desc',
  } = params;

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  const query: any = {};

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  if (status) {
    query.adminStatus = status;
  }

  if (planStatus) {
    // Assuming planStatus in UserModel is an array. If it's a string, adjust query.
    // If planStatus filter can be multiple values (e.g., "Free,Pro"), split it.
    // For now, assuming it's a single string value filter or an array from params.
    if (Array.isArray(planStatus)) {
        query.planStatus = { $in: planStatus };
    } else {
        query.planStatus = planStatus;
    }
  }

  try {
    logger.info(`${TAG} Fetching creators with query: ${JSON.stringify(query)} and sort: ${sortBy}:${sortOrder}`);
    const creatorsData = await UserModel.find(query)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .lean() // Use .lean() for faster, plain JS objects
      .exec();

    const totalCreators = await UserModel.countDocuments(query);
    const totalPages = Math.ceil(totalCreators / limit);

    // Mapear para o tipo AdminCreatorListItem
    // Assumindo que IUser tem campos como adminStatus e registrationDate (ou _id para inferir registrationDate)
    // e que profile_picture_url é o nome do campo no UserModel
    const creators: AdminCreatorListItem[] = creatorsData.map((userDoc) => {
      const user = userDoc as IUser & { _id: Types.ObjectId; registrationDate?: Date; adminStatus?: AdminCreatorStatus; profile_picture_url?: string; planStatus?: string; inferredExpertiseLevel?: string; name?: string; email?: string };
      return {
        _id: user._id.toString(),
        name: user.name || 'N/A',
        email: user.email || 'N/A',
        planStatus: user.planStatus,
        inferredExpertiseLevel: user.inferredExpertiseLevel,
        profilePictureUrl: user.profile_picture_url,
        adminStatus: user.adminStatus || 'pending', // Default se não existir
        registrationDate: user.registrationDate || user._id.getTimestamp(), // Usa _id se registrationDate não existir
        // totalPostsInPeriod e lastActivityDate seriam calculados separadamente se necessário via $lookup ou outra query
      };
    });

    logger.info(`${TAG} Successfully fetched ${creators.length} creators. Total: ${totalCreators}.`);
    return { creators, totalCreators, totalPages };

  } catch (error: any) {
    logger.error(`${TAG} Error fetching creators:`, error);
    throw new Error(`Failed to fetch creators: ${error.message}`); // Pode ser uma DatabaseError customizada
  }
}

/**
 * Updates the administrative status of a creator.
 */
export async function updateCreatorStatus(
  creatorId: string,
  payload: AdminCreatorUpdateStatusPayload
): Promise<IUser> {
  const TAG = `${SERVICE_TAG}[updateCreatorStatus]`;
  await connectToDatabase();

  if (!Types.ObjectId.isValid(creatorId)) {
    logger.warn(`${TAG} Invalid creatorId format: ${creatorId}`);
    throw new Error('Invalid creatorId format.');
  }

  const { status, feedback } = payload; // Feedback não está sendo usado ainda no UserModel (suposição)

  try {
    logger.info(`${TAG} Updating status for creator ${creatorId} to ${status}.`);
    // Assumindo que UserModel tem um campo 'adminStatus'.
    // Se houver um campo para feedback (ex: 'adminFeedback'), adicionar ao $set.
    // Também é uma boa prática registrar quem fez a alteração e quando, se o modelo suportar.
    const updateQuery: any = { $set: { adminStatus: status } };
    // if (feedback) { // Exemplo se fosse salvar o feedback
    //   updateQuery.$set.adminFeedback = feedback;
    //   updateQuery.$push = { adminStatusHistory: { status, feedback, changedAt: new Date(), changedBy: "admin_user_id" } }; // Exemplo de histórico
    // }


    const updatedCreator = await UserModel.findByIdAndUpdate(
      creatorId,
      updateQuery,
      { new: true, runValidators: true } // Retorna o documento atualizado e roda validadores
    ).exec();

    if (!updatedCreator) {
      logger.warn(`${TAG} Creator not found for ID: ${creatorId}`);
      throw new Error('Creator not found.');
    }

    logger.info(`${TAG} Successfully updated status for creator ${creatorId}.`);
    return updatedCreator as IUser; // Retorna o documento completo do usuário atualizado

  } catch (error: any) {
    logger.error(`${TAG} Error updating creator status for ID ${creatorId}:`, error);
    throw new Error(`Failed to update creator status: ${error.message}`);
  }
}
