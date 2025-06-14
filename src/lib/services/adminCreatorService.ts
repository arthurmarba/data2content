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
import {
  AdminAffiliateListItem,
  AdminAffiliateListParams,
  AdminAffiliateStatus,
  AdminAffiliateUpdateStatusPayload
} from '@/types/admin/affiliates'; // Ajuste o caminho se necessário
import {
  AdminRedemptionListItem,
  AdminRedemptionListParams,
  RedemptionStatus,
  AdminRedemptionUpdateStatusPayload as AdminRedemptionUpdatePayload // Alias to avoid name clash if imported directly
} from '@/types/admin/redemptions';
import mongoose, { Document } from 'mongoose'; // Necessário para o placeholder do modelo
import { logger } from '@/app/lib/logger';

const SERVICE_TAG = '[adminCreatorService]'; // Ou '[adminService]' se renomeado


// Placeholder para RedemptionModel - SUBSTITUA PELO SEU MODELO REAL
// Interface básica para o documento de Resgate no DB
interface IRedemption extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId; // Referência ao UserModel
  amount: number;
  currency: string;
  status: RedemptionStatus;
  requestedAt: Date;
  updatedAt?: Date;
  paymentMethod?: string;
  paymentDetails?: Record<string, any>;
  adminNotes?: string;
  transactionId?: string;
}
// Mock do Modelo Mongoose - SUBSTITUA PELO SEU MODELO REAL
const RedemptionModel = (global as any).RedemptionModel ||
  mongoose.model<IRedemption>('Redemption', new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, default: 'BRL' },
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'processing', 'paid', 'failed', 'cancelled'], required: true, default: 'pending' },
    // requestedAt: { type: Date, default: Date.now }, // Provided by timestamps: true
    // updatedAt: { type: Date }, // Provided by timestamps: true
    paymentMethod: String,
    paymentDetails: mongoose.Schema.Types.Mixed,
    adminNotes: String,
    transactionId: String,
  }, { timestamps: { createdAt: 'requestedAt', updatedAt: 'updatedAt' } }));
(global as any).RedemptionModel = RedemptionModel;
// FIM DO PLACEHOLDER

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

/**
 * Fetches the total count of all creators.
 */
export async function getTotalCreatorsCount(): Promise<number> {
  const TAG = `${SERVICE_TAG}[getTotalCreatorsCount]`;
  await connectToDatabase();
  try {
    logger.info(`${TAG} Fetching total creators count.`);
    const count = await UserModel.countDocuments({});
    logger.info(`${TAG} Total creators count: ${count}.`);
    return count;
  } catch (error: any) {
    logger.error(`${TAG} Error fetching total creators count:`, error);
    throw new Error(`Failed to fetch total creators count: ${error.message}`);
  }
}

/**
 * Fetches the count of creators with a 'pending' adminStatus.
 */
export async function getPendingCreatorsCount(): Promise<number> {
  const TAG = `${SERVICE_TAG}[getPendingCreatorsCount]`;
  await connectToDatabase();
  try {
    logger.info(`${TAG} Fetching pending creators count.`);
    // Assumes UserModel has an 'adminStatus' field of type AdminCreatorStatus
    const count = await UserModel.countDocuments({ adminStatus: 'pending' as AdminCreatorStatus });
    logger.info(`${TAG} Pending creators count: ${count}.`);
    return count;
  } catch (error: any) {
    logger.error(`${TAG} Error fetching pending creators count:`, error);
    throw new Error(`Failed to fetch pending creators count: ${error.message}`);
  }
}

/**
 * Fetches a paginated list of affiliates for admin management.
 * Assumes affiliate data is part of UserModel.
 */
export async function fetchAffiliates(
  params: AdminAffiliateListParams
): Promise<{ affiliates: AdminAffiliateListItem[]; totalAffiliates: number; totalPages: number }> {
  const TAG = `${SERVICE_TAG}[fetchAffiliates]`; // Usar o SERVICE_TAG do arquivo
  await connectToDatabase();

  const {
    page = 1,
    limit = 10,
    search,
    status,
    sortBy = 'registrationDate', // Default sort, pode ser 'affiliateSince' se existir
    sortOrder = 'desc',
  } = params;

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  const query: any = {
    // Filtrar apenas usuários que são afiliados (ex: têm um affiliateCode ou um affiliateStatus definido)
    // Esta condição depende de como você identifica um afiliado no UserModel.
    // Exemplo: affiliateCode: { $exists: true, $ne: null } OU affiliateStatus: { $exists: true }
    // Por agora, vamos assumir que qualquer usuário pode ser listado aqui, e o filtro de status fará o trabalho.
  };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { affiliateCode: { $regex: search, $options: 'i' } }, // Busca por código de afiliado
    ];
  }

  if (status) {
    query.affiliateStatus = status; // Assumindo que UserModel tem 'affiliateStatus'
  }

  // Adicionar um filtro base para garantir que estamos lidando com usuários que são afiliados
  // Se não houver um campo `isAffiliate: true` ou similar, podemos filtrar por existência de `affiliateCode`
  // ou `affiliateStatus`. Vamos assumir que `affiliateStatus` existe para todos os afiliados.
  query.affiliateStatus = { $exists: true };


  try {
    logger.info(`${TAG} Fetching affiliates with query: ${JSON.stringify(query)}`);
    const affiliatesData = await UserModel.find(query)
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();

    const totalAffiliates = await UserModel.countDocuments(query);
    const totalPages = Math.ceil(totalAffiliates / limit);

    const affiliates: AdminAffiliateListItem[] = affiliatesData.map((userDoc) => {
      const user = userDoc as IUser & {
        _id: Types.ObjectId;
        affiliateCode?: string;
        affiliateStatus?: AdminAffiliateStatus;
        registrationDate?: Date;
        affiliateSince?: Date | string;
        affiliateInvites?: number;
        affiliateTotalEarnings?: number;
        affiliateBalance?: number;
        profile_picture_url?: string; // Garante que este campo é esperado do IUser
      };
      return {
        userId: user._id.toString(),
        name: user.name || 'N/A',
        email: user.email || 'N/A',
        profilePictureUrl: user.profile_picture_url,
        affiliateCode: user.affiliateCode,
        affiliateStatus: user.affiliateStatus || 'inactive', // Default
        registrationDate: user.registrationDate || user._id.getTimestamp(),
        affiliateSince: user.affiliateSince, // Assumindo que UserModel tem affiliateSince
        totalInvites: user.affiliateInvites, // Assumindo UserModel.affiliateInvites
        totalEarnings: user.affiliateTotalEarnings, // Assumindo UserModel.affiliateTotalEarnings
        currentBalance: user.affiliateBalance, // Assumindo UserModel.affiliateBalance
      };
    });

    logger.info(`${TAG} Successfully fetched ${affiliates.length} affiliates. Total: ${totalAffiliates}.`);
    return { affiliates, totalAffiliates, totalPages };

  } catch (error: any) {
    logger.error(`${TAG} Error fetching affiliates:`, error);
    throw new Error(`Failed to fetch affiliates: ${error.message}`);
  }
}

/**
 * Updates the status of an affiliate.
 * Assumes affiliateStatus is part of UserModel.
 */
export async function updateAffiliateStatus(
  userId: string, // userId, pois o afiliado é um usuário
  payload: AdminAffiliateUpdateStatusPayload
): Promise<IUser> { // Retorna o IUser atualizado
  const TAG = `${SERVICE_TAG}[updateAffiliateStatus]`;
  await connectToDatabase();

  if (!Types.ObjectId.isValid(userId)) {
    logger.warn(`${TAG} Invalid userId format: ${userId}`);
    throw new Error('Invalid userId format.');
  }

  const { status, reason } = payload; // Reason não está sendo usado ainda no UserModel (suposição)

  try {
    logger.info(`${TAG} Updating affiliate status for user ${userId} to ${status}.`);
    // Assumindo que UserModel tem um campo 'affiliateStatus'.
    // Se houver um campo para reason (ex: 'affiliateStatusReason'), adicionar ao $set.
    const updatedUserAffiliate = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { affiliateStatus: status } }, // Adicionar affiliateStatusReason: reason se existir
      { new: true, runValidators: true }
    ).exec();

    if (!updatedUserAffiliate) {
      logger.warn(`${TAG} User (affiliate) not found for ID: ${userId}`);
      throw new Error('User (affiliate) not found.');
    }

    logger.info(`${TAG} Successfully updated affiliate status for user ${userId}.`);
    return updatedUserAffiliate as IUser;

  } catch (error: any) {
    logger.error(`${TAG} Error updating affiliate status for user ID ${userId}:`, error);
    throw new Error(`Failed to update affiliate status: ${error.message}`);
  }
}

/**
 * Fetches a paginated list of redemptions for admin management.
 */
export async function fetchRedemptions(
  params: AdminRedemptionListParams
): Promise<{ redemptions: AdminRedemptionListItem[]; totalRedemptions: number; totalPages: number }> {
  const TAG = `${SERVICE_TAG}[fetchRedemptions]`;
  await connectToDatabase();

  const {
    page = 1,
    limit = 10,
    search,
    status,
    userId,
    minAmount,
    maxAmount,
    dateFrom,
    dateTo,
    sortBy = 'requestedAt',
    sortOrder = 'desc',
  } = params;

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  const query: any = {};

  if (status) {
    query.status = status;
  }
  if (userId) {
    if (Types.ObjectId.isValid(userId)) {
      query.userId = new Types.ObjectId(userId);
    } else {
      logger.warn(`${TAG} Invalid userId format for filtering: ${userId}`);
      query.userId = null;
    }
  }
  if (typeof minAmount === 'number') {
    query.amount = { ...query.amount, $gte: minAmount };
  }
  if (typeof maxAmount === 'number') {
    query.amount = { ...query.amount, $lte: maxAmount };
  }
  if (dateFrom) {
    query.requestedAt = { ...query.requestedAt, $gte: new Date(dateFrom) };
  }
  if (dateTo) {
    const endDate = new Date(dateTo);
    endDate.setHours(23, 59, 59, 999);
    query.requestedAt = { ...query.requestedAt, $lte: endDate };
  }

  if (search && Types.ObjectId.isValid(search)) {
     query._id = new Types.ObjectId(search);
  } else if (search) {
     logger.info(`${TAG} Search term "${search}" is not a valid ObjectId for redemption ID search. User search not yet implemented in this version.`);
     // For user name/email search, we need to use it in the aggregation pipeline after $lookup
  }


  try {
    logger.info(`${TAG} Fetching redemptions with query: ${JSON.stringify(query)}`);

    const aggregationPipeline: mongoose.PipelineStage[] = [];

    // Add $match stage for main query filters on RedemptionModel fields
    if (Object.keys(query).length > 0) {
        aggregationPipeline.push({ $match: query });
    }

    // $lookup to join with users collection
    aggregationPipeline.push({
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'userDetails'
      }
    });
    aggregationPipeline.push({ $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } });

    // Add $match stage for search term if it's not an ObjectId (i.e., search by user name/email)
    if (search && !Types.ObjectId.isValid(search)) {
        aggregationPipeline.push({
            $match: {
                $or: [
                    { 'userDetails.name': { $regex: search, $options: 'i' } },
                    { 'userDetails.email': { $regex: search, $options: 'i' } },
                ]
            }
        });
    }

    const countPipeline = [...aggregationPipeline, { $count: 'totalCount' }];

    aggregationPipeline.push(
      { $sort: { [sortBy]: sortDirection } },
      { $skip: skip },
      { $limit: limit }
    );

    const [redemptionsData, totalCountResult] = await Promise.all([
        RedemptionModel.aggregate(aggregationPipeline).exec(),
        RedemptionModel.aggregate(countPipeline).exec()
    ]);

    const totalRedemptions = totalCountResult[0]?.totalCount || 0;
    const totalPages = Math.ceil(totalRedemptions / limit);

    const redemptions: AdminRedemptionListItem[] = redemptionsData.map((doc: any) => ({
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
      userName: doc.userDetails?.name || 'Usuário Desconhecido',
      userEmail: doc.userDetails?.email || 'N/A',
      amount: doc.amount,
      currency: doc.currency,
      status: doc.status,
      requestedAt: doc.requestedAt,
      updatedAt: doc.updatedAt,
      paymentMethod: doc.paymentMethod,
      paymentDetails: doc.paymentDetails,
      adminNotes: doc.adminNotes,
    }));

    logger.info(`${TAG} Successfully fetched ${redemptions.length} redemptions. Total: ${totalRedemptions}.`);
    return { redemptions, totalRedemptions, totalPages };

  } catch (error: any) {
    logger.error(`${TAG} Error fetching redemptions:`, error);
    throw new Error(`Failed to fetch redemptions: ${error.message}`);
  }
}

/**
 * Updates the status of a redemption request.
 */
export async function updateRedemptionStatus(
  redemptionId: string,
  payload: AdminRedemptionUpdatePayload
): Promise<IRedemption> {
  const TAG = `${SERVICE_TAG}[updateRedemptionStatus]`;
  await connectToDatabase();

  if (!Types.ObjectId.isValid(redemptionId)) {
    logger.warn(`${TAG} Invalid redemptionId format: ${redemptionId}`);
    throw new Error('Invalid redemptionId format.');
  }

  const { status, adminNotes, transactionId } = payload;

  const updateData: Partial<IRedemption> = {
    status,
    // updatedAt will be handled by timestamps:true in schema
  };
  if (adminNotes !== undefined) {
    updateData.adminNotes = adminNotes;
  }
  if (transactionId !== undefined) {
    updateData.transactionId = transactionId;
  }


  try {
    logger.info(`${TAG} Updating status for redemption ${redemptionId} to ${status}.`);

    const updatedRedemption = await RedemptionModel.findByIdAndUpdate(
      redemptionId,
      { $set: updateData },
      { new: true, runValidators: true }
    ).exec();

    if (!updatedRedemption) {
      logger.warn(`${TAG} Redemption not found for ID: ${redemptionId}`);
      throw new Error('Redemption not found.');
    }

    logger.info(`${TAG} Successfully updated status for redemption ${redemptionId}.`);
    return updatedRedemption as IRedemption;

  } catch (error: any) {
    logger.error(`${TAG} Error updating redemption status for ID ${redemptionId}:`, error);
    throw new Error(`Failed to update redemption status: ${error.message}`);
  }
}
