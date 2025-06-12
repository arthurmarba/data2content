import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorTable from './CreatorTable';
import { IDashboardCreator } from '@/app/lib/dataService/marketAnalysisService'; // Adjust path as necessary
import { Types } from 'mongoose';

// Mock global fetch
global.fetch = jest.fn();

// Mock Heroicons (optional, if they cause issues or just to simplify)
jest.mock('@heroicons/react/24/solid', () => ({
  ChevronUpIcon: () => <svg>Up</svg>,
  ChevronDownIcon: () => <svg>Down</svg>,
}));

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
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('planStatus=Pro&expertiseLevel=Avan%C3%A7ado')
        );
    });
  });
});
