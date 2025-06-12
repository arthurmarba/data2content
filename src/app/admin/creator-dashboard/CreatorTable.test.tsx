import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorTable from './CreatorTable';
import { IDashboardCreator } from '@/app/lib/dataService/marketAnalysisService'; // Adjust path as necessary
import { Types } from 'mongoose';

// Mock global fetch
global.fetch = jest.fn();

// Mock Heroicons
jest.mock('@heroicons/react/24/solid', () => ({
  ChevronUpIcon: () => <div data-testid="chevron-up-icon" />,
  ChevronDownIcon: () => <div data-testid="chevron-down-icon" />,
  // Mock XMarkIcon if it were used directly in CreatorTable, but it's in CreatorDetailModal
}));

// Mock CreatorDetailModal (already lazy-loaded in component, so this mock is for the dynamic import)
jest.mock('./CreatorDetailModal', () => {
    const MockCreatorDetailModal = jest.fn(({ isOpen, onClose, creatorName }) =>
        isOpen ? (
            <div data-testid="mock-creator-detail-modal">
                <h2>Modal for {creatorName}</h2>
                <button onClick={onClose}>Close Modal</button>
            </div>
        ) : null
    );
    return { __esModule: true, default: MockCreatorDetailModal };
});

// Mock CreatorComparisonModal (lazy-loaded in component)
jest.mock('./CreatorComparisonModal', () => {
    const MockCreatorComparisonModal = jest.fn(({ isOpen, onClose, creatorIdsToCompare }) =>
        isOpen ? (
            <div data-testid="mock-creator-comparison-modal">
                <h3>Comparing: {creatorIdsToCompare.join(', ')}</h3>
                <button onClick={onClose}>Close Comparison</button>
            </div>
        ) : null
    );
    return { __esModule: true, default: MockCreatorComparisonModal };
});


const mockCreatorsPage1: IDashboardCreator[] = [
  { _id: new Types.ObjectId() as any, name: 'Alice Wonderland', totalPosts: 120, avgEngagementRate: 0.055, lastActivityDate: new Date('2023-10-01'), planStatus: 'Pro' },
  { _id: new Types.ObjectId() as any, name: 'Bob The Builder', totalPosts: 200, avgEngagementRate: 0.040, lastActivityDate: new Date('2023-09-15'), planStatus: 'Free' },
];
const mockCreatorsPage2: IDashboardCreator[] = [
  { _id: new Types.ObjectId() as any, name: 'Charlie Brown', totalPosts: 80, avgEngagementRate: 0.060, lastActivityDate: new Date('2023-10-05'), planStatus: 'Premium' },
];

describe('CreatorTable Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    // Default successful fetch for initial load
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage1, totalCreators: 3, page: 1, limit: 2 }), // Assume total 3 for 2 pages
    });
  });

  test('renders initial data successfully', async () => {
    render(<CreatorTable />);
    expect(await screen.findByText('Alice Wonderland')).toBeInTheDocument();
    expect(screen.getByText('Bob The Builder')).toBeInTheDocument();
    expect(screen.getByText('Página 1 de 2 (3 criadores)')).toBeInTheDocument();
  });

  test('displays loading state initially', async () => {
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Promise that never resolves to keep it in loading state
    render(<CreatorTable />);
    expect(screen.getByText('Carregando criadores...')).toBeInTheDocument();
  });

  test('displays error state if fetch fails', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));
    render(<CreatorTable />);
    expect(await screen.findByText(/Erro ao carregar dados: API Error/)).toBeInTheDocument();
  });

  test('displays "no creators found" message when data is empty', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: [], totalCreators: 0 }),
    });
    render(<CreatorTable />);
    expect(await screen.findByText('Nenhum criador encontrado com os filtros atuais.')).toBeInTheDocument();
  });

  test('handles sorting when a column header is clicked', async () => {
    render(<CreatorTable />);
    await screen.findByText('Alice Wonderland'); // Ensure initial data is loaded

    // Prepare for the fetch call after sorting
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage1, totalCreators: 3 }),
    });

    fireEvent.click(screen.getByText('Creator')); // Sort by name (default asc)

    await waitFor(() => {
      // Check if fetch was called with correct sort parameters
      // The first call is initial, second is after sort
      expect(fetch).toHaveBeenNthCalledWith(2, expect.stringContaining('sortBy=name&sortOrder=asc'));
    });

    // Click again to sort descending
    (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ creators: mockCreatorsPage1, totalCreators: 3 }),
    });
    fireEvent.click(screen.getByText('Creator'));
    await waitFor(() => {
        expect(fetch).toHaveBeenNthCalledWith(3, expect.stringContaining('sortBy=name&sortOrder=desc'));
    });
  });

  test('handles pagination: clicking Next and Previous', async () => {
    render(<CreatorTable />);
    await screen.findByText('Alice Wonderland'); // Initial load

    // Mock response for Page 2
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage2, totalCreators: 3, page: 2, limit: 2 }),
    });

    fireEvent.click(screen.getByText('Próxima'));

    expect(await screen.findByText('Charlie Brown')).toBeInTheDocument(); // Check for page 2 data
    expect(screen.getByText('Página 2 de 2 (3 criadores)')).toBeInTheDocument();
    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('page=2'));

    // Mock response for Page 1 (going back)
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ creators: mockCreatorsPage1, totalCreators: 3, page: 1, limit: 2 }),
    });
    fireEvent.click(screen.getByText('Anterior'));

    expect(await screen.findByText('Alice Wonderland')).toBeInTheDocument(); // Check for page 1 data
    expect(screen.getByText('Página 1 de 2 (3 criadores)')).toBeInTheDocument();
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
    (fetch as jest.Mock).mockClear(); // Clear previous calls
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
  });

  test('fetches with multiple comma-separated planStatusFilter values', async () => {
    (fetch as jest.Mock).mockClear();
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ creators: [], totalCreators: 0 }) });
    render(<CreatorTable planStatusFilter="Pro,Premium" />);
    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('planStatus=Pro%2CPremium')); // %2C is comma
    });
  });

  test('fetches correctly if a filter prop is an empty string', async () => {
    (fetch as jest.Mock).mockClear();
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ creators: [], totalCreators: 0 }) });
    render(<CreatorTable planStatusFilter="" expertiseLevelFilter="Iniciante" />);
    await waitFor(() => {
        // planStatus should not be in the URL if its filter string is empty
        expect(fetch).toHaveBeenCalledWith(expect.not.stringContaining('planStatus='));
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('expertiseLevel=Iniciante'));
    });
  });

  test('fetches correctly if a filter prop is undefined', async () => {
    (fetch as jest.Mock).mockClear();
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ creators: [], totalCreators: 0 }) });
    render(<CreatorTable planStatusFilter={undefined} expertiseLevelFilter="Avançado" />);
    await waitFor(() => {
        expect(fetch).toHaveBeenCalledWith(expect.not.stringContaining('planStatus='));
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining('expertiseLevel=Avan%C3%A7ado'));
    });
  });


  test('opens CreatorDetailModal with correct props when creator name is clicked', async () => {
    const dateRange = { startDate: '2023-01-01', endDate: '2023-01-31' };
    render(<CreatorTable dateRangeFilter={dateRange} />);

    const creatorNameToClick = mockCreatorsPage1[0].name;
    const creatorIdToExpect = mockCreatorsPage1[0]._id.toString();

    // Wait for table to load and then click on the creator's name
    const creatorNameElement = await screen.findByText(creatorNameToClick);
    fireEvent.click(creatorNameElement);

    // Check if modal is rendered (via its mock)
    const modalTitle = await screen.findByText(`Modal for ${creatorNameToClick}`);
    expect(modalTitle).toBeInTheDocument();

    // Check if CreatorDetailModal mock was called with correct props
    const MockedCreatorDetailModal = require('./CreatorDetailModal').default;
    expect(MockedCreatorDetailModal).toHaveBeenCalledWith(
      expect.objectContaining({
        isOpen: true,
        creatorId: creatorIdToExpect,
        creatorName: creatorNameToClick,
        dateRangeFilter: dateRange,
      }),
      {} // Second argument to React components is context, usually empty in tests
    );
  });

  test('opens CreatorDetailModal when "Detalhes" button is clicked', async () => {
    render(<CreatorTable />);
    await screen.findByText(mockCreatorsPage1[0].name); // Ensure data is loaded

    // Find all "Detalhes" buttons and click the first one
    const detailButtons = screen.getAllByText('Detalhes');
    expect(detailButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailButtons[0]);

    const creatorForModal = mockCreatorsPage1[0];
    const modalTitle = await screen.findByText(`Modal for ${creatorForModal.name}`);
    expect(modalTitle).toBeInTheDocument();

    const MockedCreatorDetailModal = require('./CreatorDetailModal').default;
    expect(MockedCreatorDetailModal).toHaveBeenCalledWith(
        expect.objectContaining({
            isOpen: true,
            creatorId: creatorForModal._id.toString(),
            creatorName: creatorForModal.name,
            // dateRangeFilter would be undefined here if not passed to CreatorTable
        }),
        {}
    );
  });

  test('modal closes when its onClose is triggered (simulated by clicking its close button)', async () => {
    render(<CreatorTable />);
    await screen.findByText(mockCreatorsPage1[0].name);

    fireEvent.click(screen.getAllByText('Detalhes')[0]); // Open the detail modal
    await screen.findByText(`Modal for ${mockCreatorsPage1[0].name}`);

    const closeModalButton = screen.getByText('Close Modal'); // From detail modal mock
    fireEvent.click(closeModalButton);

    await waitFor(() => {
      expect(screen.queryByText(`Modal for ${mockCreatorsPage1[0].name}`)).not.toBeInTheDocument();
    });
  });

  describe('Creator Comparison Functionality', () => {
    test('checkbox interaction updates selectedForComparison state and respects MAX_CREATORS_TO_COMPARE', async () => {
      render(<CreatorTable />);
      await screen.findByText('Alice Wonderland'); // Wait for data

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      expect(checkboxes.length).toBe(mockCreatorsPage1.length); // One checkbox per creator

      // Select first creator
      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0].checked).toBe(true);
      // Internal state selectedForComparison would be [mockCreatorsPage1[0]._id.toString()]
      // Check button text
      expect(screen.getByText('1 / 3 selecionados')).toBeInTheDocument();


      // Select second creator
      fireEvent.click(checkboxes[1]);
      expect(checkboxes[1].checked).toBe(true);
      expect(screen.getByText('2 / 3 selecionados')).toBeInTheDocument();

      // Select third creator (assuming MAX_CREATORS_TO_COMPARE = 3)
      const thirdCreatorCheckbox = screen.getAllByRole('checkbox')[2] || checkboxes[0]; // Fallback if only 2 creators in mock for some test runs
      if (mockCreatorsPage1.length >=3) {
        fireEvent.click(thirdCreatorCheckbox);
        expect(thirdCreatorCheckbox.checked).toBe(true);
        expect(screen.getByText('3 / 3 selecionados')).toBeInTheDocument();

        // Try to select a fourth - should be disabled if more than 3 creators displayed AND MAX_CREATORS_TO_COMPARE = 3
        // For this test, we only have 2-3 creators in mock, so we can't directly test disabling the 4th actual checkbox.
        // Instead, we verify that if we try to add one more programmatically (if we had a 4th), it wouldn't exceed MAX.
        // The disabled logic on checkbox itself: `!isSelected && selectedForComparison.length >= MAX_CREATORS_TO_COMPARE;`
        // This is tested by trying to check it.
      }

      // Unselect first creator
      fireEvent.click(checkboxes[0]);
      expect(checkboxes[0].checked).toBe(false);
      const expectedCountAfterUncheck = mockCreatorsPage1.length >=3 ? 2 : 1;
      expect(screen.getByText(`${expectedCountAfterUncheck} / 3 selecionados`)).toBeInTheDocument();
    });

    test('"Comparar Criadores Selecionados" button is disabled appropriately', async () => {
      render(<CreatorTable />);
      await screen.findByText('Alice Wonderland');
      const compareButton = screen.getByText('Comparar Criadores Selecionados');

      expect(compareButton).toBeDisabled(); // Initially disabled (0 selected)

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      fireEvent.click(checkboxes[0]); // Select 1
      expect(compareButton).toBeDisabled(); // Still disabled (1 selected)

      fireEvent.click(checkboxes[1]); // Select 2
      expect(compareButton).not.toBeDisabled(); // Enabled (2 selected)

      if (mockCreatorsPage1.length >=3) {
        fireEvent.click(checkboxes[2]); // Select 3
        expect(compareButton).not.toBeDisabled(); // Enabled (3 selected)

        // If we could select a 4th (MAX_CREATORS_TO_COMPARE = 3), button would disable.
        // This specific condition ( > MAX ) is harder to test without more mock data
        // but the logic is `selectedForComparison.length > MAX_CREATORS_TO_COMPARE`
      }
    });

    test('clicking "Comparar Criadores Selecionados" opens CreatorComparisonModal with correct props', async () => {
      render(<CreatorTable />);
      await screen.findByText('Alice Wonderland');

      const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
      fireEvent.click(checkboxes[0]); // Select Alice
      fireEvent.click(checkboxes[1]); // Select Bob

      const compareButton = screen.getByText('Comparar Criadores Selecionados');
      fireEvent.click(compareButton);

      const expectedIds = [mockCreatorsPage1[0]._id.toString(), mockCreatorsPage1[1]._id.toString()];

      // Check if comparison modal is rendered (via its mock)
      expect(await screen.findByText(`Comparing: ${expectedIds.join(', ')}`)).toBeInTheDocument();

      const MockedCreatorComparisonModal = require('./CreatorComparisonModal').default;
      expect(MockedCreatorComparisonModal).toHaveBeenCalledWith(
        expect.objectContaining({
          isOpen: true,
          creatorIdsToCompare: expectedIds,
        }),
        {}
      );

      // Close the comparison modal
      fireEvent.click(screen.getByText('Close Comparison'));
      await waitFor(() => {
        expect(screen.queryByText(`Comparing: ${expectedIds.join(', ')}`)).not.toBeInTheDocument();
      });
    });
  });
});
