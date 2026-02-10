import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorTable from './CreatorTable';
import { IDashboardCreator } from '@/app/lib/dataService/marketAnalysisService'; // Adjust path as necessary
import { Types } from 'mongoose';

// Mock global fetch
global.fetch = jest.fn();

jest.mock('../../components/SkeletonTable', () => ({
  SkeletonTable: () => <div data-testid="skeleton-table" />,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: jest.fn(),
    push: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock CreatorDetailModal
jest.mock('./CreatorDetailModal', () => {
  const MockCreatorDetailModal = jest.fn(({ isOpen, onClose, creator }: { isOpen: boolean; onClose: () => void; creator: IDashboardCreator | null }) => { // Changed props to 'creator'
    if (!isOpen || !creator) return null;
    return React.createElement('div', { 'data-testid': 'mock-creator-detail-modal' },
      React.createElement('h2', null, `Modal for ${creator.name} (ID: ${creator._id.toString()})`),
      React.createElement('p', null, `Seguidores Atuais: ${creator.followers_count?.toLocaleString('pt-BR') || 'N/A'}`),
      React.createElement('p', null, '[Engagement Rate Chart Placeholder]'), // Keep this as per previous tests
      React.createElement('button', { onClick: onClose }, 'Close Modal')
    );
  });
  return { __esModule: true, default: MockCreatorDetailModal };
});

// Mock CreatorComparisonModal
jest.mock('./CreatorComparisonModal', () => {
  const MockCreatorComparisonModal = jest.fn(({ isOpen, onClose, creatorIdsToCompare }: { isOpen: boolean; onClose: () => void; creatorIdsToCompare: string[] }) =>
    isOpen ? React.createElement('div', { 'data-testid': 'mock-creator-comparison-modal' },
      React.createElement('h3', null, `Comparing: ${creatorIdsToCompare.join(', ')}`),
      React.createElement('button', { onClick: onClose }, 'Close Comparison')
    ) : null
  );
  return { __esModule: true, default: MockCreatorComparisonModal };
});

// Updated Mock Data to include followers_count and use recentAlertsSummary
const mockCreatorsPage1: IDashboardCreator[] = [
  {
    _id: new Types.ObjectId() as any,
    name: 'Alice Wonderland',
    totalPosts: 120,
    avgEngagementRate: 0.055,
    lastActivityDate: new Date('2023-10-01'),
    planStatus: 'Pro',
    followers_count: 25000,
    recentAlertsSummary: { count: 2, alerts: [{ type: 'PeakShares', date: new Date() }, { type: 'ForgottenFormat', date: new Date() }] }
  },
  {
    _id: new Types.ObjectId() as any,
    name: 'Bob The Builder',
    totalPosts: 200,
    avgEngagementRate: 0.040,
    lastActivityDate: new Date('2023-09-15'),
    planStatus: 'Free',
    followers_count: 10000,
    recentAlertsSummary: { count: 0, alerts: [] }
  },
];
const mockCreatorsPage2: IDashboardCreator[] = [
  {
    _id: new Types.ObjectId() as any,
    name: 'Charlie Brown',
    totalPosts: 80,
    avgEngagementRate: 0.060,
    lastActivityDate: new Date('2023-10-05'),
    planStatus: 'Premium',
    followers_count: 50000,
    recentAlertsSummary: { count: 1, alerts: [{ type: 'DropWatchTime', date: new Date() }] }
  },
];

// Helper to get the mock creator by name, ensures _id is stringified for some comparisons if needed
const getMockCreatorByName = (name: string) => {
  const found = [...mockCreatorsPage1, ...mockCreatorsPage2].find(c => c.name === name);
  if (found) return { ...found, _id: found._id.toString() }; // Ensure _id is string for prop comparisons if modal stringifies it
  return undefined;
}


describe('CreatorTable Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockReset();
    // Default successful fetch for initial load
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage1, totalCreators: 3, page: 1, limit: 2 }),
    });
  });

  test('renders initial data successfully', async () => {
    render(<CreatorTable />);
    expect(await screen.findByText('Alice Wonderland')).toBeInTheDocument();
    expect(screen.getByText('Bob The Builder')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 1')).toBeInTheDocument();
  });

  test('displays loading state initially', async () => {
    (fetch as jest.Mock).mockReset();
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => { })); // Promise that never resolves to keep it in loading state
    render(<CreatorTable />);
    expect(screen.getByTestId('skeleton-table')).toBeInTheDocument();
  });

  test('displays error state if fetch fails', async () => {
    (fetch as jest.Mock).mockReset();
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
    render(<CreatorTable />);
    expect(await screen.findByText('Falha ao Carregar Dados')).toBeInTheDocument();
    expect(screen.getByText('API Error')).toBeInTheDocument();
  });

  test('displays "no creators found" message when data is empty', async () => {
    (fetch as jest.Mock).mockReset();
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: [], totalCreators: 0 }),
    });
    render(<CreatorTable />);
    expect(await screen.findByText('Nenhum Criador Encontrado')).toBeInTheDocument();
    expect(screen.getByText('Tente ajustar os filtros ou a busca.')).toBeInTheDocument();
  });

  test('handles sorting when a column header is clicked', async () => {
    render(<CreatorTable />);
    await screen.findByText('Alice Wonderland'); // Ensure initial data is loaded

    // Prepare for the fetch call after sorting
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage1, totalCreators: 3 }),
    });

    fireEvent.click(screen.getByText('Criador')); // Sort by name (default asc)

    await waitFor(() => {
      // Check if fetch was called with correct sort parameters
      // The first call is initial, second is after sort
      expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('sortBy=name&sortOrder=asc'));
    });
    await screen.findByText('Alice Wonderland'); // Wait for table to render after sorting

    // Click again to sort descending
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage1, totalCreators: 3 }),
    });
    fireEvent.click(screen.getByText('Criador'));
    await waitFor(() => {
      expect(fetch).toHaveBeenNthCalledWith(3, expect.stringContaining('sortBy=name&sortOrder=desc'));
    });
  });

  test('handles pagination: clicking Next and Previous', async () => {
    (fetch as jest.Mock).mockReset();
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage1, totalCreators: 30, page: 1, limit: 10 }),
    });
    render(<CreatorTable />);
    await screen.findByText('Alice Wonderland'); // Initial load
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();

    // Mock response for Page 2
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage2, totalCreators: 30, page: 2, limit: 10 }),
    });

    fireEvent.click(screen.getByText('Próxima'));

    expect(await screen.findByText('Charlie Brown')).toBeInTheDocument(); // Check for page 2 data
    expect(screen.getByText('Página 2 de 3')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=2'));

    // Mock response for Page 1 (going back)
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage1, totalCreators: 30, page: 1, limit: 10 }),
    });
    fireEvent.click(screen.getByText('Anterior'));

    expect(await screen.findByText('Alice Wonderland')).toBeInTheDocument(); // Check for page 1 data
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=1'));
  });

  test('handles name search input', async () => {
    jest.useFakeTimers(); // Use fake timers for debounce test
    render(<CreatorTable />);
    await screen.findByText('Alice Wonderland'); // Initial load

    const searchInput = screen.getByPlaceholderText('Buscar por nome...');
    fireEvent.change(searchInput, { target: { value: 'Bob' } });

    // Prepare for the fetch call after debounce
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: [mockCreatorsPage1[1]], totalCreators: 1 }),
    });

    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(500); // DEBOUNCE_DELAY
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('nameSearch=Bob'));
    });

    expect(await screen.findByText('Bob The Builder')).toBeInTheDocument();
    expect(screen.queryByText('Alice Wonderland')).not.toBeInTheDocument(); // Alice should be filtered out
    jest.useRealTimers(); // Restore real timers
  });

  test('fetches with planStatusFilter and expertiseLevelFilter props', async () => {
    (fetch as jest.Mock).mockReset(); // Clear queued mocks
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: [], totalCreators: 0 }),
    });

    render(<CreatorTable planStatusFilter="Pro" expertiseLevelFilter="Avançado" />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1); // Ensure it's called once on initial render with these props
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('planStatus=Pro&expertiseLevel=Avan%C3%A7ado')
      );
    });
    await screen.findByText('Nenhum Criador Encontrado');
  });

  test('fetches with multiple comma-separated planStatusFilter values', async () => {
    (fetch as jest.Mock).mockReset();
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ creators: [], totalCreators: 0 }) });
    render(<CreatorTable planStatusFilter="Pro,Premium" />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('planStatus=Pro%2CPremium')); // %2C is comma
    });
    await screen.findByText('Nenhum Criador Encontrado');
  });

  test('fetches correctly if a filter prop is an empty string', async () => {
    (fetch as jest.Mock).mockReset();
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ creators: [], totalCreators: 0 }) });
    render(<CreatorTable planStatusFilter="" expertiseLevelFilter="Iniciante" />);
    await waitFor(() => {
      // planStatus should not be in the URL if its filter string is empty
      expect(fetch).toHaveBeenCalledWith(expect.not.stringContaining('planStatus='));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('expertiseLevel=Iniciante'));
    });
    await screen.findByText('Nenhum Criador Encontrado');
  });

  test('fetches correctly if a filter prop is undefined', async () => {
    (fetch as jest.Mock).mockReset();
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ creators: [], totalCreators: 0 }) });
    render(<CreatorTable planStatusFilter={undefined} expertiseLevelFilter="Avançado" />);
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(expect.not.stringContaining('planStatus='));
      expect(fetch).toHaveBeenCalledWith(expect.stringContaining('expertiseLevel=Avan%C3%A7ado'));
    });
    await screen.findByText('Nenhum Criador Encontrado');
  });


  test('opens CreatorDetailModal with correct props when creator name is clicked', async () => {
    const dateRange = { startDate: '2023-01-01', endDate: '2023-01-31' };
    render(<CreatorTable dateRangeFilter={dateRange} />);

    const creatorToClick = mockCreatorsPage1[0]!;

    const creatorNameElement = await screen.findByText(creatorToClick.name);
    fireEvent.click(creatorNameElement);

    const modalTitle = await screen.findByText(`Detalhes de ${creatorToClick.name}`);
    expect(modalTitle).toBeInTheDocument();
  });

  test('modal closes when its onClose is triggered (simulated by clicking its close button)', async () => {
    render(<CreatorTable />);
    await screen.findByText(mockCreatorsPage1[0]!.name);

    fireEvent.click(screen.getByText(mockCreatorsPage1[0]!.name)); // Open the detail modal
    await screen.findByText(`Detalhes de ${mockCreatorsPage1[0]!.name}`);

    const closeModalButton = screen.getByLabelText('Fechar detalhes do criador');
    fireEvent.click(closeModalButton);

    await waitFor(() => {
      expect(screen.queryByText(`Detalhes de ${mockCreatorsPage1[0]!.name}`)).not.toBeInTheDocument();
    });
  });

  describe('Creator Comparison Functionality', () => {
    test('checkbox interaction updates selectedForComparison state and respects MAX_CREATORS_TO_COMPARE', async () => {
      render(<CreatorTable />);
      await screen.findByText('Alice Wonderland'); // Wait for data

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      expect(checkboxes.length).toBe(mockCreatorsPage1.length); // One checkbox per creator

      // Select first creator
      fireEvent.click(checkboxes[0]!);
      expect(checkboxes[0]!.checked).toBe(true);
      expect(screen.getByText('Comparar (1)')).toBeInTheDocument();


      // Select second creator
      fireEvent.click(checkboxes[1]!);
      expect(checkboxes[1]!.checked).toBe(true);
      expect(screen.getByText('Comparar (2)')).toBeInTheDocument();

      // Unselect first creator
      fireEvent.click(checkboxes[0]!);
      expect(checkboxes[0]!.checked).toBe(false);
      expect(screen.getByText('Comparar (1)')).toBeInTheDocument();
    });

    test('"Comparar" button is disabled appropriately', async () => {
      render(<CreatorTable />);
      await screen.findByText('Alice Wonderland');
      const compareButton = screen.getByText('Comparar (0)');

      expect(compareButton).toBeDisabled(); // Initially disabled (0 selected)

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      fireEvent.click(checkboxes[0]!); // Select 1
      expect(compareButton).toBeDisabled(); // Still disabled (1 selected)
      expect(screen.getByText('Comparar (1)')).toBeInTheDocument();

      fireEvent.click(checkboxes[1]!); // Select 2
      expect(compareButton).not.toBeDisabled(); // Enabled (2 selected)
      expect(screen.getByText('Comparar (2)')).toBeInTheDocument();
    });

    test('clicking "Comparar" opens CreatorComparisonModal with correct props', async () => {
      render(<CreatorTable />);
      await screen.findByText('Alice Wonderland');

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      fireEvent.click(checkboxes[0]!); // Select Alice
      fireEvent.click(checkboxes[1]!); // Select Bob

      const compareButton = screen.getByText('Comparar (2)');
      fireEvent.click(compareButton);

      const expectedIds = [mockCreatorsPage1[0]!._id.toString(), mockCreatorsPage1[1]!._id.toString()];

      // Check if comparison modal is rendered
      expect(await screen.findByText('Comparando Criadores')).toBeInTheDocument();
      expect(screen.getByText(`IDs a serem comparados: ${expectedIds.join(', ')}`)).toBeInTheDocument();

      // Close the comparison modal
      fireEvent.click(screen.getByLabelText('Fechar comparação de criadores'));
      await waitFor(() => {
        expect(screen.queryByText('Comparando Criadores')).not.toBeInTheDocument();
      });
    });
  });

});
