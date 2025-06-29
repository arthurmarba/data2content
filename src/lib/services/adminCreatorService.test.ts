// src/lib/services/adminCreatorService.test.ts
import {
  fetchCreators,
  updateCreatorStatus,
  fetchAffiliates,
  updateAffiliateStatus,
  fetchRedemptions, // Added
  updateRedemptionStatus // Added
} from './adminCreatorService';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/dataService/connection';
import { AdminCreatorListParams } from '@/types/admin/creators';
import { AdminAffiliateListParams, AdminAffiliateUpdateStatusPayload } from '@/types/admin/affiliates';
import {
  AdminRedemptionListParams,
  AdminRedemptionUpdateStatusPayload,
  RedemptionStatus
} from '@/types/admin/redemptions'; // Added
import mongoose, { Types } from 'mongoose'; // Added mongoose for spying

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

// Mock connectToDatabase
jest.mock('@/app/lib/dataService/connection');
const mockConnectToDatabase = connectToDatabase as jest.Mock;


describe('AdminCreatorService', () => {
  beforeEach(() => {
    // Limpar mocks antes de cada teste
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(undefined); // Simula conexão bem-sucedida
  });

  describe('fetchCreators', () => {
    it('should call UserModel.find with correct query for default params', async () => {
      (UserModel.exec as jest.Mock).mockResolvedValueOnce([]); // Para o find().exec()
      (UserModel.countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminCreatorListParams = {};
      await fetchCreators(params);

      expect(mockConnectToDatabase).toHaveBeenCalled();
      expect(UserModel.find).toHaveBeenCalledWith({});
      expect(UserModel.sort).toHaveBeenCalledWith({ registrationDate: -1 }); // Default sort
      expect(UserModel.skip).toHaveBeenCalledWith(0); // Default page 1
      expect(UserModel.limit).toHaveBeenCalledWith(10); // Default limit 10
      expect(UserModel.countDocuments).toHaveBeenCalledWith({});
    });

    it('should build query with search term', async () => {
      (UserModel.exec as jest.Mock).mockResolvedValueOnce([]);
      (UserModel.countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminCreatorListParams = { search: 'testuser' };
      await fetchCreators(params);

      const expectedQuery = {
        $or: [
          { name: { $regex: 'testuser', $options: 'i' } },
          { email: { $regex: 'testuser', $options: 'i' } },
        ],
      };
      expect(UserModel.find).toHaveBeenCalledWith(expectedQuery);
      expect(UserModel.countDocuments).toHaveBeenCalledWith(expectedQuery);
    });

    it('should build query with status filter', async () => {
      (UserModel.exec as jest.Mock).mockResolvedValueOnce([]);
      (UserModel.countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminCreatorListParams = { status: 'approved' };
      await fetchCreators(params);

      const expectedQuery = { adminStatus: 'approved' };
      expect(UserModel.find).toHaveBeenCalledWith(expectedQuery);
      expect(UserModel.countDocuments).toHaveBeenCalledWith(expectedQuery);
    });

    it('should build query with planStatus filter as string', async () => {
        (UserModel.exec as jest.Mock).mockResolvedValueOnce([]);
        (UserModel.countDocuments as jest.Mock).mockResolvedValueOnce(0);

        const params: AdminCreatorListParams = { planStatus: 'Free' };
        await fetchCreators(params);

        const expectedQuery = { planStatus: 'Free' };
        expect(UserModel.find).toHaveBeenCalledWith(expectedQuery);
        expect(UserModel.countDocuments).toHaveBeenCalledWith(expectedQuery);
      });

    it('should build query with planStatus filter as array', async () => {
        (UserModel.exec as jest.Mock).mockResolvedValueOnce([]);
        (UserModel.countDocuments as jest.Mock).mockResolvedValueOnce(0);

        const params: AdminCreatorListParams = { planStatus: ['Free', 'Pro'] as any }; // Cast as any if type expects string
        await fetchCreators(params);

        const expectedQuery = { planStatus: { $in: ['Free', 'Pro'] } };
        expect(UserModel.find).toHaveBeenCalledWith(expectedQuery);
        expect(UserModel.countDocuments).toHaveBeenCalledWith(expectedQuery);
    });


    it('should map user data correctly', async () => {
      const date1 = new Date('2023-01-01T00:00:00.000Z');
      const date2 = new Date('2023-02-15T00:00:00.000Z');
      const mockUserData = [
        {
          _id: new Types.ObjectId(date1.getTime() / 1000), // Simulate ObjectId from timestamp
          name: 'User One',
          email: 'one@example.com',
          planStatus: 'Pro',
          adminStatus: 'approved',
          profile_picture_url: 'url1',
          mediaKitToken: 'token1',
          // registrationDate é omitido para testar fallback para _id.getTimestamp()
        },
        {
          _id: new Types.ObjectId(),
          name: 'User Two',
          email: 'two@example.com',
          adminStatus: 'pending',
          registrationDate: date2,
          profile_picture_url: 'url2',
          mediaKitToken: undefined,
        },
      ];
      (UserModel.exec as jest.Mock).mockResolvedValueOnce(mockUserData.map(u => ({...u, _id: u._id.toString() }))); // lean() returns plain objects
      (UserModel.countDocuments as jest.Mock).mockResolvedValueOnce(mockUserData.length);

      const { creators } = await fetchCreators({});

      expect(creators.length).toBe(2);
      expect(creators[0]).toEqual(expect.objectContaining({
        _id: mockUserData[0]._id.toString(),
        name: 'User One',
        email: 'one@example.com',
        planStatus: 'Pro',
        adminStatus: 'approved',
        profilePictureUrl: 'url1',
        mediaKitToken: 'token1',
        registrationDate: date1, // from _id.getTimestamp()
      }));
       expect(creators[1]).toEqual(expect.objectContaining({
        _id: mockUserData[1]._id.toString(),
        name: 'User Two',
        email: 'two@example.com',
        adminStatus: 'pending',
        profilePictureUrl: 'url2',
        mediaKitToken: undefined,
        registrationDate: date2,
      }));
    });
  });

  describe('updateCreatorStatus', () => {
    it('should call findByIdAndUpdate with correct parameters', async () => {
      const mockUpdatedUser = { _id: 'creator1', adminStatus: 'approved' };
      (UserModel.exec as jest.Mock).mockResolvedValueOnce(mockUpdatedUser);

      const creatorId = 'creator1';
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
      (UserModel.exec as jest.Mock).mockResolvedValueOnce(null);

      await expect(updateCreatorStatus('notFoundId', { status: 'approved' })).rejects.toThrow('Creator not found.');
    });

    it('should throw error for invalid creatorId format', async () => {
        await expect(updateCreatorStatus('invalidId', { status: 'approved' })).rejects.toThrow('Invalid creatorId format.');
    });
  });

  describe('fetchAffiliates', () => {
    it('should call UserModel.find with correct query for default affiliate params (placeholder)', async () => {
      // Mockear UserModel.exec e UserModel.countDocuments
      (UserModel.exec as jest.Mock).mockResolvedValueOnce([]);
      (UserModel.countDocuments as jest.Mock).mockResolvedValueOnce(0);

      const params: AdminAffiliateListParams = {}; // Usar AdminAffiliateListParams importado
      await fetchAffiliates(params); // Usar fetchAffiliates importado

      // Verificar se connectToDatabase foi chamado
      expect(connectToDatabase).toHaveBeenCalled();
      // Verificar a query base para afiliados (ex: { affiliateStatus: { $exists: true } })
      // e os defaults de paginação/ordenação
      expect(UserModel.find).toHaveBeenCalledWith(expect.objectContaining({
        affiliateStatus: { $exists: true }
      }));
      expect(UserModel.sort).toHaveBeenCalledWith({ registrationDate: -1 }); // Ou 'affiliateSince'
      // ... mais asserções
    });
    // Adicionar mais testes para filtros, busca, paginação, ordenação e mapeamento de dados
  });

  describe('updateAffiliateStatus', () => {
    it('should call findByIdAndUpdate for affiliate status (placeholder)', async () => {
      const mockUpdatedUser = { _id: 'affiliate1', affiliateStatus: 'active' };
      (UserModel.exec as jest.Mock).mockResolvedValueOnce(mockUpdatedUser);


      const userId = 'affiliate1';
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
      const mockAggregate = jest.fn(() => ({ exec: mockExecForFetchRedemptions }));

      // Spy on mongoose.model to return our mock for 'Redemption'
      jest.spyOn(mongoose, 'model').mockImplementation((name: string) => {
          if (name === 'Redemption') {
              return { aggregate: mockAggregate } as any;
          }
          return jest.requireActual('mongoose').model(name); // Fallback for other models if any
      });
    });

    it('should call RedemptionModel.aggregate with correct pipeline for default params', async () => {
      mockExecForFetchRedemptions.mockResolvedValueOnce([]); // Data
      mockExecForFetchRedemptions.mockResolvedValueOnce([{ totalCount: 0 }]); // Count

      const params: AdminRedemptionListParams = {};
      await fetchRedemptions(params);

      expect(connectToDatabase).toHaveBeenCalled();
      const aggregateCalls = (mongoose.model('Redemption').aggregate as jest.Mock).mock.calls;
      expect(aggregateCalls.length).toBeGreaterThanOrEqual(2); // Data and Count calls

      const firstPipeline = aggregateCalls[0][0]; // Pipeline for data
      // Check initial $match (should be empty or only contain base query if one exists in service)
      const initialMatchStage = firstPipeline.find((stage: any) => stage.$match);
      expect(initialMatchStage?.$match || {}).toEqual({}); // Default query is empty

      // Check $lookup, $unwind, $sort stages
      expect(firstPipeline).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ $lookup: expect.any(Object) }),
          expect.objectContaining({ $unwind: expect.any(Object) }),
          expect.objectContaining({ $sort: { requestedAt: -1 } }),
          expect.objectContaining({ $skip: 0 }),
          expect.objectContaining({ $limit: 10 }),
        ])
      );
    });

    it('should include $match for status if status filter is provided', async () => {
      mockExecForFetchRedemptions.mockResolvedValueOnce([]);
      mockExecForFetchRedemptions.mockResolvedValueOnce([{ totalCount: 0 }]);

      const params: AdminRedemptionListParams = { status: 'pending' };
      await fetchRedemptions(params);

      const firstPipeline = (mongoose.model('Redemption').aggregate as jest.Mock).mock.calls[0][0];
      const initialMatchStage = firstPipeline.find((stage: any) => stage.$match && stage.$match.status);
      expect(initialMatchStage?.$match).toEqual({ status: 'pending' });
    });

    it('should include $match for date range if dateFrom and dateTo are provided', async () => {
      mockExecForFetchRedemptions.mockResolvedValueOnce([]);
      mockExecForFetchRedemptions.mockResolvedValueOnce([{ totalCount: 0 }]);

      const dateFromStr = new Date('2023-01-01T00:00:00.000Z').toISOString();
      const dateToStr = new Date('2023-01-31T23:59:59.999Z').toISOString();

      const params: AdminRedemptionListParams = { dateFrom: dateFromStr, dateTo: dateToStr };
      await fetchRedemptions(params);

      const firstPipeline = (mongoose.model('Redemption').aggregate as jest.Mock).mock.calls[0][0];
      const initialMatchStage = firstPipeline.find((stage: any) => stage.$match && stage.$match.requestedAt);

      expect(initialMatchStage?.$match.requestedAt.$gte).toEqual(new Date(dateFromStr));
      // Service adds time to dateTo to make it end of day
      const expectedEndDate = new Date(dateToStr);
      expectedEndDate.setHours(23, 59, 59, 999);
      expect(initialMatchStage?.$match.requestedAt.$lte).toEqual(expectedEndDate);
    });
  });

  describe('updateRedemptionStatus', () => {
    let mockExecForUpdateRedemption: jest.Mock;

    beforeEach(() => {
      mockExecForUpdateRedemption = jest.fn();
      const mockFindByIdAndUpdate = jest.fn(() => ({ exec: mockExecForUpdateRedemption }));

      jest.spyOn(mongoose, 'model').mockImplementation((name: string) => {
          if (name === 'Redemption') {
              return { findByIdAndUpdate: mockFindByIdAndUpdate } as any;
          }
          return jest.requireActual('mongoose').model(name);
      });
    });

    it('should call RedemptionModel.findByIdAndUpdate with correct parameters', async () => {
      const mockUpdatedRedemption = { _id: 'redemption1', status: 'approved', adminNotes: 'Approved by admin' };
      mockExecForUpdateRedemption.mockResolvedValueOnce(mockUpdatedRedemption);

      const redemptionId = 'redemption1';
      const payload: AdminRedemptionUpdateStatusPayload = { status: 'approved', adminNotes: 'Approved by admin' };
      const result = await updateRedemptionStatus(redemptionId, payload);

      expect(mongoose.model('Redemption').findByIdAndUpdate).toHaveBeenCalledWith(
        redemptionId,
        { $set: expect.objectContaining({ status: 'approved', adminNotes: 'Approved by admin' }) },
        { new: true, runValidators: true }
      );
      expect(result).toEqual(mockUpdatedRedemption);
    });

    it('should throw error if redemption not found', async () => {
      mockExecForUpdateRedemption.mockResolvedValueOnce(null);
      await expect(updateRedemptionStatus('notFoundId', { status: 'approved' })).rejects.toThrow('Redemption not found.');
    });

    it('should throw error for invalid redemptionId format', async () => {
      await expect(updateRedemptionStatus('invalid-id', { status: 'approved' })).rejects.toThrow('Invalid redemptionId format.');
    });
  });
});
