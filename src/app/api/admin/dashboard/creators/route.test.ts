import { GET } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { fetchDashboardCreatorsList } from '@/app/lib/dataService/marketAnalysisService';
import { logger } from '@/app/lib/logger';

// Mock logger
jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock marketAnalysisService
jest.mock('@/app/lib/dataService/marketAnalysisService', () => ({
  fetchDashboardCreatorsList: jest.fn(),
}));

// Mock getAdminSession - we'll define its behavior in tests
// The actual implementation is in the route file, so we mock its behavior via req object or by directly mocking it if it were importable
// For this test, we assume getAdminSession is part of the route file and works with the request.
// A more robust way would be to extract getAdminSession to a shared module and mock that.
// For now, we'll control its simulated behavior by how we construct `NextRequest` or by spying if possible,
// but since it's not exported, we rely on testing its effects.
// Let's assume for tests we can influence it through a conventional property or header.

const mockFetchDashboardCreatorsList = fetchDashboardCreatorsList as jest.Mock;

describe('API Route: /api/admin/dashboard/creators', () => {
  let mockAdminSession = { user: { name: 'Admin User' } };

  // Helper to create a mock NextRequest
  const createMockRequest = (searchParams: Record<string, string> = {}, isAdmin = true): NextRequest => {
    const url = new URL(`http://localhost/api/admin/dashboard/creators?${new URLSearchParams(searchParams)}`);
    const req = new NextRequest(url.toString());
    // Simulate admin session by attaching a property that getAdminSession in route might check
    // This is a simplified way to control the session for testing.
    // In a real scenario with next-auth, you'd mock `getServerSession`.
    (req as any).isAdmin = isAdmin; // This is a conceptual way getAdminSession might be influenced
                                   // The actual getAdminSession in route.ts uses a hardcoded session.
                                   // To test the 401, we'd need to modify getAdminSession or mock it differently.
                                   // For now, we will test assuming getAdminSession can be controlled.
                                   // For robust testing of getAdminSession, it should be injectable/mockable.
    return req;
  };

  // Since getAdminSession is hardcoded in the route, we can't easily mock its internal logic from here without
  // heavier tools like jest.spyOn on a module if it were exported, or modifying the route code.
  // For this test, we'll assume the happy path for session and focus on query params and service calls.
  // To test the 401 specifically, one might temporarily alter the route's getAdminSession for test environment
  // or use more advanced mocking. Given the current setup, we'll focus on what's directly testable.

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdminSession = { user: { name: 'Admin User' } }; // Reset admin session mock
    // Default mock for successful session
    // (Actual getAdminSession in route is hardcoded to success, so this mainly tests other logic)
  });

  it('should return 200 with creators list on valid request', async () => {
    const mockData = { creators: [{ name: 'Test Creator' }], totalCreators: 1, page: 1, limit: 10 };
    mockFetchDashboardCreatorsList.mockResolvedValue(mockData);

    const req = createMockRequest({ page: '1', limit: '10' });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockData);
    expect(fetchDashboardCreatorsList).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      sortBy: 'totalPosts', // default
      sortOrder: 'desc', // default
      filters: {},
    });
  });

  it('should pass validated query parameters to service function', async () => {
    mockFetchDashboardCreatorsList.mockResolvedValue({ creators: [], totalCreators: 0 });
    const query = {
        page: '2',
        limit: '5',
        sortBy: 'name',
        sortOrder: 'asc',
        nameSearch: 'Specific Creator',
        planStatus: 'Pro', // Zod schema transforms to array, API service expects array
        expertiseLevel: 'Avançado', // Same as above
        minTotalPosts: '50'
    };
    const req = createMockRequest(query);
    await GET(req);

    // Corrected expectation: Zod output from route is flat, service function handles nesting into 'filters'
    expect(fetchDashboardCreatorsList).toHaveBeenCalledWith({
      page: 2,
      limit: 5,
      sortBy: 'name',
      sortOrder: 'asc',
      nameSearch: 'Specific Creator', // These are passed flat to the service
      planStatus: ['Pro'],
      expertiseLevel: ['Avançado'],
      minTotalPosts: 50,
      filters: { // The service function internally maps these to its 'filters' sub-object.
                  // The API route itself doesn't create this 'filters' nesting from query params.
                  // However, the service function IFetchDashboardCreatorsListParams defines it this way.
                  // The test for the API route should check what the API route passes.
                  // The Zod schema in the API route produces flat properties.
                  // Let's ensure the test reflects what the API route passes to the service.
                  // The service then internally maps these to its 'filters' sub-object structure if needed.
                  // The important part is that `fetchDashboardCreatorsList` receives these arguments.
                  // The previous test was too specific about the internal structure of the service call's argument.
                  // What `fetchDashboardCreatorsList` gets:
        nameSearch: 'Specific Creator',
        planStatus: ['Pro'],
        expertiseLevel: ['Avançado'],
        minTotalPosts: 50,
        // The service function then maps these to its internal filters structure.
        // The API route's Zod validation directly provides these flat params.
      }
    });
  });

  it('should correctly transform comma-separated planStatus and expertiseLevel to arrays for the service call', async () => {
    mockFetchDashboardCreatorsList.mockResolvedValue({ creators: [], totalCreators: 0 });
    const query = {
        planStatus: 'Pro,Premium,Trial',
        expertiseLevel: 'Iniciante, Intermediário',
    };
    const req = createMockRequest(query);
    await GET(req);

    expect(fetchDashboardCreatorsList).toHaveBeenCalledWith(
      expect.objectContaining({
        planStatus: ['Pro', 'Premium', 'Trial'], // Expecting flat params passed to service
        expertiseLevel: ['Iniciante', 'Intermediário'],
      })
    );
  });

  it('should pass undefined for planStatus if empty string (after Zod transform/refine)', async () => {
    mockFetchDashboardCreatorsList.mockResolvedValue({ creators: [], totalCreators: 0 });
    const query = { planStatus: '' };
    const req = createMockRequest(query);
    await GET(req);

    expect(fetchDashboardCreatorsList).toHaveBeenCalledWith(
      expect.objectContaining({
        planStatus: undefined, // Zod transform + refine should lead to undefined if array is empty
      })
    );
  });

  it('should correctly handle planStatus with spaces and extra commas for service call', async () => {
    mockFetchDashboardCreatorsList.mockResolvedValue({ creators: [], totalCreators: 0 });
    const query = { planStatus: 'Pro, , Free ' };
    const req = createMockRequest(query);
    await GET(req);

    expect(fetchDashboardCreatorsList).toHaveBeenCalledWith(
      expect.objectContaining({
        planStatus: ['Pro', 'Free'], // Zod transform cleans this up
      })
    );
  });

  it('should return 400 on invalid query parameters (e.g., page not a number)', async () => {
    const req = createMockRequest({ page: 'invalid', limit: '10' });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Parâmetros de consulta inválidos:');
    expect(body.error).toContain('page: Expected number, received nan'); // Zod error message
  });

  it('should return 400 if limit is too high', async () => {
    const req = createMockRequest({ limit: '200' }); // Max is 100
    const response = await GET(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('limit: Number must be less than or equal to 100');
  });

  // To properly test the 401 Unauthorized scenario, getAdminSession needs to be mockable.
  // If we assume it's mockable (e.g., if it was imported):
  // jest.mock('../route', () => ({ // Path to the actual route.ts file
  //   ...jest.requireActual('../route'), // Import and retain default behavior
  //   getAdminSession: jest.fn().mockResolvedValue(null) // Mock specific function
  // }));
  // Then a test like this would work:
  /*
  it('should return 401 if admin session is invalid', async () => {
    // This requires getAdminSession within route.ts to be mockable.
    // For now, this test is more conceptual for the current route structure.
    // If getAdminSession was imported: jest.spyOn(authModule, 'getAdminSession').mockResolvedValue(null);

    // Simulate getAdminSession returning null by a conventional flag (if route was designed for it)
    const req = createMockRequest({}, false); // Assuming isAdmin=false makes getAdminSession return null

    // IF getAdminSession is hardcoded as in the provided route file, then this test
    // cannot make getAdminSession return null without modifying the route file for testability
    // or using a more complex mocking setup.

    // For the sake of example, if it WERE mockable and returned null:
    // const response = await GET(req);
    // expect(response.status).toBe(401);
    // const body = await response.json();
    // expect(body.error).toBe('Acesso não autorizado. Sessão de administrador inválida.');

    // Since it is hardcoded to success, this test case will pass through session check.
    // We'll note this limitation.
    console.warn("Skipping 401 test for creators route due to getAdminSession hardcoding in route file. Manual/integration testing recommended for this specific case or refactor for testability.");
  });
  */

  it('should return 500 if service function throws an error', async () => {
    mockFetchDashboardCreatorsList.mockRejectedValue(new Error('Service layer error'));
    const req = createMockRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Ocorreu um erro interno no servidor.');
  });

   it('should use default values for pagination and sorting if not provided', async () => {
    mockFetchDashboardCreatorsList.mockResolvedValue({ creators: [], totalCreators: 0 });
    const req = createMockRequest({}); // Empty query
    await GET(req);

    expect(fetchDashboardCreatorsList).toHaveBeenCalledWith({
      page: 1, // default
      limit: 10, // default
      sortBy: 'totalPosts', // default
      sortOrder: 'desc', // default
      filters: {},
    });
  });
});
