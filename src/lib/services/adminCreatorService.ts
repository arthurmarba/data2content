import { Types } from 'mongoose';
import mongoose from 'mongoose';

// Modelos de dados importados de sua fonte única e correta
import UserModel, { IUser } from '@/app/models/User';
import RedemptionModel, { IRedemption } from '@/app/models/Redemption';

// Funções e tipos de suporte
import { connectToDatabase } from '@/app/lib/dataService/connection';
import { logger } from '@/app/lib/logger';
import {
  AdminCreatorListItem,
  AdminCreatorListParams,
  AdminCreatorStatus,
  AdminCreatorUpdateStatusPayload,
} from '@/types/admin/creators';
import {
  AdminAffiliateListItem,
  AdminAffiliateListParams,
  AdminAffiliateStatus,
  AdminAffiliateUpdateStatusPayload
} from '@/types/admin/affiliates';
import {
  AdminRedemptionListItem,
  AdminRedemptionListParams,
  AdminRedemptionUpdateStatusPayload as AdminRedemptionUpdatePayload
} from '@/types/admin/redemptions';


const SERVICE_TAG = '[adminCreatorService]';

/**
 * Fetches a paginated list of creators for admin management.
 */
export async function fetchCreators(
  params: AdminCreatorListParams
): Promise<{ creators: AdminCreatorListItem[]; totalCreators: number; totalPages: number }> {
  const TAG = `${SERVICE_TAG}[fetchCreators]`;
  await connectToDatabase();

  let {
    page = 1,
    limit = 10,
    search,
    status,
    planStatus,
    sortBy = 'registrationDate',
    sortOrder = 'desc',
  } = params;

  // Otimização de ordenação: Se houver busca, ordena por nome.
  if (search) {
    sortBy = 'name';
    sortOrder = 'asc';
  }

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  const query: any = {};

  // Otimização de performance: Usa o operador $text, que depende do índice de texto.
  if (search) {
    query.$text = { $search: search };
  }

  if (status) {
    query.adminStatus = status;
  }

  if (planStatus) {
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
      .lean()
      .exec();

    const totalCreators = await UserModel.countDocuments(query);
    const totalPages = Math.ceil(totalCreators / limit);

    const creators: AdminCreatorListItem[] = creatorsData.map((userDoc) => {
      const user = userDoc as IUser & {
        _id: Types.ObjectId;
        registrationDate?: Date;
        adminStatus?: AdminCreatorStatus;
        profile_picture_url?: string;
        planStatus?: string;
        inferredExpertiseLevel?: string;
        mediaKitSlug?: string;
        name?: string;
        email?: string;
      };
      return {
        _id: user._id.toString(),
        name: user.name || 'N/A',
        email: user.email || 'N/A',
        planStatus: user.planStatus,
        inferredExpertiseLevel: user.inferredExpertiseLevel,
        profilePictureUrl: user.profile_picture_url,
        mediaKitSlug: user.mediaKitSlug,
        adminStatus: user.adminStatus || 'pending',
        registrationDate: user.registrationDate || user._id.getTimestamp(),
      };
    });

    logger.info(`${TAG} Successfully fetched ${creators.length} creators. Total: ${totalCreators}.`);
    return { creators, totalCreators, totalPages };

  } catch (error: any) {
    logger.error(`${TAG} Error fetching creators:`, error);
    throw new Error(`Failed to fetch creators: ${error.message}`);
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

  const { status, feedback } = payload;
  const updateQuery: any = { $set: { adminStatus: status } };

  try {
    logger.info(`${TAG} Updating status for creator ${creatorId} to ${status}.`);
    
    const updatedCreator = await UserModel.findByIdAndUpdate(
      creatorId,
      updateQuery,
      { new: true, runValidators: true }
    ).exec();

    if (!updatedCreator) {
      logger.warn(`${TAG} Creator not found for ID: ${creatorId}`);
      throw new Error('Creator not found.');
    }

    logger.info(`${TAG} Successfully updated status for creator ${creatorId}.`);
    return updatedCreator as IUser;

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
 */
export async function fetchAffiliates(
  params: AdminAffiliateListParams
): Promise<{ affiliates: AdminAffiliateListItem[]; totalAffiliates: number; totalPages: number }> {
  const TAG = `${SERVICE_TAG}[fetchAffiliates]`;
  await connectToDatabase();

  const {
    page = 1,
    limit = 10,
    search,
    status,
    sortBy = 'registrationDate',
    sortOrder = 'desc',
  } = params;

  const skip = (page - 1) * limit;
  const sortDirection = sortOrder === 'asc' ? 1 : -1;

  const query: any = {
    affiliateStatus: { $exists: true },
  };

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { affiliateCode: { $regex: search, $options: 'i' } },
    ];
  }

  if (status) {
    query.affiliateStatus = status;
  }

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
        profile_picture_url?: string;
      };
      return {
        userId: user._id.toString(),
        name: user.name || 'N/A',
        email: user.email || 'N/A',
        profilePictureUrl: user.profile_picture_url,
        affiliateCode: user.affiliateCode,
        affiliateStatus: user.affiliateStatus || 'inactive',
        registrationDate: user.registrationDate || user._id.getTimestamp(),
        affiliateSince: user.affiliateSince,
        totalInvites: user.affiliateInvites,
        totalEarnings: user.affiliateTotalEarnings,
        currentBalance: user.affiliateBalance,
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
 */
export async function updateAffiliateStatus(
  userId: string,
  payload: AdminAffiliateUpdateStatusPayload
): Promise<IUser> {
  const TAG = `${SERVICE_TAG}[updateAffiliateStatus]`;
  await connectToDatabase();

  if (!Types.ObjectId.isValid(userId)) {
    logger.warn(`${TAG} Invalid userId format: ${userId}`);
    throw new Error('Invalid userId format.');
  }

  const { status, reason } = payload;

  try {
    logger.info(`${TAG} Updating affiliate status for user ${userId} to ${status}.`);
    const updatedUserAffiliate = await UserModel.findByIdAndUpdate(
      userId,
      { $set: { affiliateStatus: status } },
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
     logger.info(`${TAG} Search term "${search}" is not a valid ObjectId for redemption ID search. User search will be applied.`);
  }

  try {
    logger.info(`${TAG} Fetching redemptions with query: ${JSON.stringify(query)}`);

    const aggregationPipeline: mongoose.PipelineStage[] = [];

    if (Object.keys(query).length > 0) {
        aggregationPipeline.push({ $match: query });
    }

    aggregationPipeline.push({
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'userDetails'
      }
    });
    aggregationPipeline.push({ $unwind: { path: '$userDetails', preserveNullAndEmptyArrays: true } });

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
  const updateData: Partial<IRedemption> = { status };
  
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