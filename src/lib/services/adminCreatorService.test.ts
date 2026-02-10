// src/lib/services/adminCreatorService.test.ts
import {
  fetchCreators,
  updateCreatorStatus,
  fetchAffiliates,
  updateAffiliateStatus,
  fetchRedemptions,
  updateRedemptionStatus,
} from './adminCreatorService';
import UserModel from '@/app/models/User';
import RedemptionModel from '@/app/models/Redemption';
import { connectToDatabase } from '@/app/lib/dataService/connection';
import { AdminCreatorListParams } from '@/types/admin/creators';
import { AdminAffiliateListParams, AdminAffiliateUpdateStatusPayload } from '@/types/admin/affiliates';
import {
  AdminRedemptionListParams,
  AdminRedemptionUpdateStatusPayload,
  RedemptionStatus,
} from '@/types/admin/redemptions';
import { Types } from 'mongoose';

// Mock UserModel
jest.mock('@/app/models/User', () => ({
  find: jest.fn().mockReturnThis(), // Permite encadear .sort, .skip, .limit, .lean, .exec
  sort: jest.fn().mockReturnThis(),
  skip: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(),
  exec: jest.fn(),
  countDocuments: jest.fn(),
  findByIdAndUpdate: jest.fn().mockReturnThis(), // Para findByIdAndUpdate(...).exec()
}));

// Mock RedemptionModel
jest.mock('@/app/models/Redemption', () => ({
  __esModule: true,
  default: {
    aggregate: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  },
}));

// Mock connectToDatabase
jest.mock('@/app/lib/dataService/connection');
const mockConnectToDatabase = connectToDatabase as jest.Mock;
const mockRedemption = RedemptionModel as unknown as {
  aggregate: jest.Mock;
  findById: jest.Mock;
  findByIdAndUpdate: jest.Mock;
  updateOne: jest.Mock;
};


describe('AdminCreatorService', () => {
  beforeEach(() => {
    // Limpar mocks antes de cada teste
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(undefined); // Simula conexão bem-sucedida
  });

  describe('fetchCreators', () => {
    it('should call UserModel.find with correct query for default params', async () => {
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce([]); // Para o find().exec()
      ((UserModel as any).countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminCreatorListParams = {};
      await fetchCreators(params);

      expect(mockConnectToDatabase).toHaveBeenCalled();
      expect(UserModel.find).toHaveBeenCalledWith({});
      expect((UserModel as any).sort).toHaveBeenCalledWith({ registrationDate: -1 }); // Default sort
      expect((UserModel as any).skip).toHaveBeenCalledWith(0); // Default page 1
      expect((UserModel as any).limit).toHaveBeenCalledWith(10); // Default limit 10
      expect((UserModel as any).countDocuments).toHaveBeenCalledWith({});
    });

    it('should build query with search term', async () => {
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce([]);
      ((UserModel as any).countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminCreatorListParams = { search: 'testuser' };
      await fetchCreators(params);

      const expectedQuery = { $text: { $search: 'testuser' } };
      expect(UserModel.find).toHaveBeenCalledWith(expectedQuery);
      expect((UserModel as any).countDocuments).toHaveBeenCalledWith(expectedQuery);
    });

    it('should build query with status filter', async () => {
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce([]);
      ((UserModel as any).countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminCreatorListParams = { status: 'approved' };
      await fetchCreators(params);

      const expectedQuery = { adminStatus: 'approved' };
      expect(UserModel.find).toHaveBeenCalledWith(expectedQuery);
      expect((UserModel as any).countDocuments).toHaveBeenCalledWith(expectedQuery);
    });

    it('should build query with planStatus filter as string', async () => {
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce([]);
      ((UserModel as any).countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminCreatorListParams = { planStatus: 'active' };
      await fetchCreators(params);

      const expectedQuery = { planStatus: 'active' };
      expect(UserModel.find).toHaveBeenCalledWith(expectedQuery);
      expect((UserModel as any).countDocuments).toHaveBeenCalledWith(expectedQuery);
    });

    it('should build query with planStatus filter as array', async () => {
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce([]);
      ((UserModel as any).countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminCreatorListParams = { planStatus: ['active', 'trialing'] };
      await fetchCreators(params);

      const expectedQuery = { planStatus: { $in: ['active', 'trialing'] } };
      expect(UserModel.find).toHaveBeenCalledWith(expectedQuery);
      expect((UserModel as any).countDocuments).toHaveBeenCalledWith(expectedQuery);
    });


    it('should map user data correctly', async () => {
      const date1 = new Date('2023-01-01T00:00:00.000Z');
      const date2 = new Date('2023-02-15T00:00:00.000Z');
      const mockUserData = [
        {
          _id: new Types.ObjectId(date1.getTime() / 1000), // Simulate ObjectId from timestamp
          name: 'User One',
          email: 'one@example.com',
          planStatus: 'active',
          adminStatus: 'approved',
          profile_picture_url: 'url1',
          mediaKitSlug: 'token1',
          // registrationDate é omitido para testar fallback para _id.getTimestamp()
        },
        {
          _id: new Types.ObjectId(),
          name: 'User Two',
          email: 'two@example.com',
          adminStatus: 'pending',
          registrationDate: date2,
          profile_picture_url: 'url2',
          mediaKitSlug: undefined,
        },
      ];
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce(mockUserData); // manter ObjectId para usar getTimestamp
      ((UserModel as any).countDocuments as jest.Mock).mockResolvedValueOnce(mockUserData.length);

      const { creators } = await fetchCreators({});

      expect(creators.length).toBe(2);
      expect(creators[0]!).toEqual(expect.objectContaining({
        _id: mockUserData[0]!._id.toString(),
        name: 'User One',
        email: 'one@example.com',
        planStatus: 'active',
        adminStatus: 'approved',
        profilePictureUrl: 'url1',
        mediaKitSlug: 'token1',
        registrationDate: date1, // from _id.getTimestamp()
      }));
      expect(creators[1]!).toEqual(expect.objectContaining({
        _id: mockUserData[1]!._id.toString(),
        name: 'User Two',
        email: 'two@example.com',
        adminStatus: 'pending',
        profilePictureUrl: 'url2',
        mediaKitSlug: undefined,
        registrationDate: date2,
      }));
    });
  });

  describe('updateCreatorStatus', () => {
    it('should call findByIdAndUpdate with correct parameters', async () => {
      const creatorId = new Types.ObjectId().toString();
      const mockUpdatedUser = { _id: creatorId, adminStatus: 'approved' };
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce(mockUpdatedUser);

      const payload = { status: 'approved' as const };
      const result = await updateCreatorStatus(creatorId, payload);

      expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        creatorId,
        { $set: { adminStatus: 'approved' } },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(mockUpdatedUser);
    });

    it('should throw error if creator not found', async () => {
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce(null);

      await expect(updateCreatorStatus(new Types.ObjectId().toString(), { status: 'approved' })).rejects.toThrow('Creator not found.');
    });

    it('should throw error for invalid creatorId format', async () => {
      await expect(updateCreatorStatus('invalidId', { status: 'approved' })).rejects.toThrow('Invalid creatorId format.');
    });
  });

  describe('fetchAffiliates', () => {
    it('should call UserModel.find with correct query for default affiliate params (placeholder)', async () => {
      // Mockear UserModel.exec e UserModel.countDocuments
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce([]);
      ((UserModel as any).countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminAffiliateListParams = {}; // Usar AdminAffiliateListParams importado
      await fetchAffiliates(params); // Usar fetchAffiliates importado

      // Verificar se connectToDatabase foi chamado
      expect(connectToDatabase).toHaveBeenCalled();
      // Verificar a query base para afiliados (ex: { affiliateStatus: { $exists: true } })
      // e os defaults de paginação/ordenação
      expect(UserModel.find).toHaveBeenCalledWith(expect.objectContaining({
        affiliateStatus: { $exists: true }
      }));
      expect((UserModel as any).sort).toHaveBeenCalledWith({ registrationDate: -1 }); // Ou 'affiliateSince'
      // ... mais asserções
    });
    // Adicionar mais testes para filtros, busca, paginação, ordenação e mapeamento de dados
  });

  describe('updateAffiliateStatus', () => {
    it('should call findByIdAndUpdate for affiliate status (placeholder)', async () => {
      const userId = new Types.ObjectId().toString();
      const mockUpdatedUser = { _id: userId, affiliateStatus: 'active' };
      ((UserModel as any).exec as jest.Mock).mockResolvedValueOnce(mockUpdatedUser);


      const payload: AdminAffiliateUpdateStatusPayload = { status: 'active' as const };
      await updateAffiliateStatus(userId, payload);

      expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { $set: { affiliateStatus: 'active' } },
        { new: true, runValidators: true }
      );
    });
    // Adicionar mais testes para ID não encontrado, ID inválido
  });

  // --- Testes para Funções de Resgate ---

  describe('fetchRedemptions', () => {
    let mockExecForFetchRedemptions: jest.Mock;

    beforeEach(() => {
      mockExecForFetchRedemptions = jest.fn();
      (mockRedemption.aggregate as jest.Mock).mockReturnValue({ exec: mockExecForFetchRedemptions });
    });

    it('should call RedemptionModel.aggregate with correct pipeline for default params', async () => {
      mockExecForFetchRedemptions.mockResolvedValueOnce([]); // Data
      mockExecForFetchRedemptions.mockResolvedValueOnce([{ totalCount: 0 }]); // Count

      await fetchRedemptions({});

      expect(connectToDatabase).toHaveBeenCalled();
      const aggregateCalls = (mockRedemption.aggregate as jest.Mock).mock.calls;
      expect(aggregateCalls.length).toBeGreaterThanOrEqual(2);

      const pipeline = aggregateCalls[0][0];
      const initialMatchStage = pipeline.find((stage: any) => stage.$match);
      expect(initialMatchStage?.$match || {}).toEqual({});
    });

    it('should include $match for status if status filter is provided', async () => {
      mockExecForFetchRedemptions.mockResolvedValueOnce([]);
      mockExecForFetchRedemptions.mockResolvedValueOnce([{ totalCount: 0 }]);

      await fetchRedemptions({ status: 'requested' });

      const pipeline = (mockRedemption.aggregate as jest.Mock).mock.calls[0][0];
      const initialMatchStage = pipeline.find((stage: any) => stage.$match && stage.$match.status);
      expect(initialMatchStage?.$match).toEqual({ status: 'requested' });
    });

    it('should include $match for date range if dateFrom and dateTo are provided', async () => {
      mockExecForFetchRedemptions.mockResolvedValueOnce([]);
      mockExecForFetchRedemptions.mockResolvedValueOnce([{ totalCount: 0 }]);

      const dateFromStr = new Date('2023-01-01T00:00:00.000Z').toISOString();
      const dateToStr = new Date('2023-01-31T23:59:59.999Z').toISOString();

      await fetchRedemptions({ dateFrom: dateFromStr, dateTo: dateToStr });

      const pipeline = (mockRedemption.aggregate as jest.Mock).mock.calls[0][0];
      const initialMatchStage = pipeline.find((stage: any) => stage.$match && stage.$match.createdAt);

      expect(initialMatchStage?.$match.createdAt.$gte).toEqual(new Date(dateFromStr));
      const expectedEndDate = new Date(dateToStr);
      expectedEndDate.setHours(23, 59, 59, 999);
      expect(initialMatchStage?.$match.createdAt.$lte).toEqual(expectedEndDate);
    });
  });

  describe('updateRedemptionStatus', () => {
    it('should call RedemptionModel.findByIdAndUpdate with correct parameters', async () => {
      const redemptionId = new Types.ObjectId().toString();
      const payload: AdminRedemptionUpdateStatusPayload = { status: 'paid', notes: 'Approved by admin' };
      const baseDoc = {
        _id: redemptionId,
        status: 'requested' as RedemptionStatus,
        amountCents: 1000,
        currency: 'usd',
        userId: new Types.ObjectId(),
      };

      (mockRedemption.findById as jest.Mock).mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(baseDoc) });
      (mockRedemption.findByIdAndUpdate as jest.Mock).mockReturnValueOnce({ exec: jest.fn().mockResolvedValue({ ...baseDoc, ...payload }) });
      (mockRedemption.updateOne as jest.Mock).mockResolvedValueOnce({ modifiedCount: 1 });
      (UserModel.updateOne as any) = jest.fn().mockResolvedValueOnce({ modifiedCount: 1 });

      const result = await updateRedemptionStatus(redemptionId, payload);

      expect(mockRedemption.findByIdAndUpdate).toHaveBeenCalledWith(
        redemptionId,
        { $set: expect.objectContaining({ status: 'paid', notes: 'Approved by admin' }) },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(expect.objectContaining({ status: 'paid' }));
    });

    it('should throw error if redemption not found', async () => {
      (mockRedemption.findById as jest.Mock).mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(null) });

      await expect(updateRedemptionStatus(new Types.ObjectId().toString(), { status: 'paid' })).rejects.toThrow('Redemption not found.');
    });

    it('should throw error for invalid redemptionId format', async () => {
      await expect(updateRedemptionStatus('invalid-id', { status: 'paid' })).rejects.toThrow('Invalid redemptionId format.');
    });
  });
});
