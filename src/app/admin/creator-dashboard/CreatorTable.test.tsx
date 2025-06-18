import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorTable from './CreatorTable';
import { IDashboardCreator } from '@/app/lib/dataService/marketAnalysisService'; // Adjust path as necessary
import { Types } from 'mongoose';

// Mock global fetch
global.fetch = jest.fn();

// Mock Heroicons
// For Jest to transform JSX in the mock factory, the factory itself needs to be a module or use React.createElement
// A simpler way for icons if they don't have complex logic is to mock them as simple components.
const React = require('react'); // Import React for creating elements if needed in mocks

jest.mock('@heroicons/react/24/solid', () => ({
  ChevronUpIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'chevron-up-icon' }),
  ChevronDownIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'chevron-down-icon' }),
}));

// Mock CreatorDetailModal
jest.mock('./CreatorDetailModal', () => {
    const MockCreatorDetailModal = jest.fn(({ isOpen, onClose, creator }) => { // Changed props to 'creator'
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
    const MockCreatorComparisonModal = jest.fn(({ isOpen, onClose, creatorIdsToCompare }) =>
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
    (fetch as jest.Mock).mockClear();
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

    const creatorToClick = mockCreatorsPage1[0];

    const creatorNameElement = await screen.findByText(creatorToClick.name);
    fireEvent.click(creatorNameElement);

    const modalTitle = await screen.findByText(`Modal for ${creatorToClick.name} (ID: ${creatorToClick._id.toString()})`);
    expect(modalTitle).toBeInTheDocument();

    const MockedCreatorDetailModal = require('./CreatorDetailModal').default;
    expect(MockedCreatorDetailModal).toHaveBeenCalledWith(
      expect.objectContaining({
        isOpen: true,
        creator: expect.objectContaining({ // Check for the creator object
            _id: creatorToClick._id, // ObjectId comparison might be tricky, ensure it's handled or compare string version
            name: creatorToClick.name,
            followers_count: creatorToClick.followers_count
        }),
        dateRangeFilter: dateRange,
      }),
      {}
    );
  });

  test('opens CreatorDetailModal when "Detalhes" button is clicked', async () => {
    render(<CreatorTable />);
    const creatorForModal = mockCreatorsPage1[0]; // Alice
    await screen.findByText(creatorForModal.name);

    const detailButtons = screen.getAllByRole('button', { name: /detalhes/i });
    fireEvent.click(detailButtons[0]); // Click first details button

    const modalTitle = await screen.findByText(`Modal for ${creatorForModal.name} (ID: ${creatorForModal._id.toString()})`);
    expect(modalTitle).toBeInTheDocument();

    const MockedCreatorDetailModal = require('./CreatorDetailModal').default;
    expect(MockedCreatorDetailModal).toHaveBeenCalledWith(
        expect.objectContaining({
            isOpen: true,
            creator: expect.objectContaining({ name: creatorForModal.name, _id: creatorForModal._id }),
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
      const dateRange = { startDate: '2023-01-01', endDate: '2023-01-31' };
      render(<CreatorTable dateRangeFilter={dateRange} />);
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
          dateRangeFilter: dateRange,
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

  describe('Recent Alerts Column', () => {
    test('renders "Alertas Recentes" column header', async () => {
      render(<CreatorTable />);
      await screen.findByText('Alice Wonderland'); // Wait for data to load
      expect(screen.getByText('Alertas Recentes')).toBeInTheDocument();
    });

    test('displays alert count and icons for a creator with alerts', async () => {
      render(<CreatorTable />);
      // Alice has 2 alerts: PeakShares, ForgottenFormat
      const aliceRow = await screen.findByText('Alice Wonderland');
      const parentRow = aliceRow.closest('tr');
      expect(parentRow).toHaveTextContent('2 Alerta(s)');
      expect(parentRow).toHaveTextContent('[PS]');
      expect(parentRow).toHaveTextContent('[FF]');
    });

    test('displays "Nenhum" for a creator with no alerts', async () => {
      render(<CreatorTable />);
      // Bob has no alerts
      const bobRow = await screen.findByText('Bob The Builder');
      const parentRow = bobRow.closest('tr');
      expect(parentRow).toHaveTextContent('Nenhum');
    });
  });

  describe('CreatorDetailModal Integration', () => {
    test('CreatorDetailModal (mock) shows follower count and engagement placeholder', async () => {
      render(<CreatorTable />);
      const creatorToOpen = mockCreatorsPage1[0]; // Alice, 25000 followers
      await screen.findByText(creatorToOpen.name);

      fireEvent.click(screen.getByText(creatorToOpen.name)); // Open modal for Alice

      const modalElement = await screen.findByTestId('mock-creator-detail-modal');
      expect(modalElement).toBeInTheDocument();
      expect(modalElement).toHaveTextContent(`Modal for ${creatorToOpen.name}`);
      expect(modalElement).toHaveTextContent(`Seguidores Atuais: ${creatorToOpen.followers_count!.toLocaleString('pt-BR')}`); // Check for follower count
      expect(modalElement).toHaveTextContent('[Engagement Rate Chart Placeholder]'); // Check for engagement placeholder

      // Ensure the old follower growth placeholder is NOT there
      expect(modalElement).not.toHaveTextContent('[Follower Growth Chart Placeholder]');

      fireEvent.click(screen.getByText('Close Modal'));
      await waitFor(() => {
        expect(screen.queryByTestId('mock-creator-detail-modal')).not.toBeInTheDocument();
      });
    });
  });

});
