// src/lib/services/adminCreatorService.test.ts
import { fetchCreators, updateCreatorStatus } from './adminCreatorService';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/dataService/connection'; // Reutilize a conexão existente
import { AdminCreatorListParams } from '@/types/admin/creators';
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
          profile_picture_url: 'url1'
          // registrationDate é omitido para testar fallback para _id.getTimestamp()
        },
        {
          _id: new Types.ObjectId(),
          name: 'User Two',
          email: 'two@example.com',
          adminStatus: 'pending',
          registrationDate: date2,
          profile_picture_url: 'url2'
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
        registrationDate: date1, // from _id.getTimestamp()
      }));
       expect(creators[1]).toEqual(expect.objectContaining({
        _id: mockUserData[1]._id.toString(),
        name: 'User Two',
        email: 'two@example.com',
        adminStatus: 'pending',
        profilePictureUrl: 'url2',
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
});
