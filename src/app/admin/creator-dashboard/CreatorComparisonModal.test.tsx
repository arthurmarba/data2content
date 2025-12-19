/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorComparisonModal from './CreatorComparisonModal';
import { ICreatorProfile } from '@/app/lib/dataService/marketAnalysisService'; // Assuming path

// Mock global fetch
global.fetch = jest.fn();

// Mock next/image antes do uso (factory inline para evitar hoisting com const)
jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt ?? ''} {...props} data-testid="mock-image" />,
}));


const mockProfiles: ICreatorProfile[] = [
  { creatorId: 'id1', creatorName: 'Alice', profilePictureUrl: 'alice.jpg', postCount: 100, avgLikes: 50, avgShares: 10, avgEngagementRate: 0.05, topPerformingContext: 'Games' },
  { creatorId: 'id2', creatorName: 'Bob', profilePictureUrl: 'bob.jpg', postCount: 150, avgLikes: 40, avgShares: 5, avgEngagementRate: 0.08, topPerformingContext: 'Tech' }, // Bob has better engagement
  { creatorId: 'id3', creatorName: 'Charlie', profilePictureUrl: 'charlie.jpg', postCount: 80, avgLikes: 60, avgShares: 12, avgEngagementRate: 0.03, topPerformingContext: 'Food' }, // Charlie has most likes/shares
];

const defaultProps = {
  isOpen: true,
  onClose: jest.fn(),
  creatorIdsToCompare: ['id1', 'id2', 'id3'],
};

describe('CreatorComparisonModal Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    defaultProps.onClose.mockClear();
    // Default successful fetch for initial load
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockProfiles,
    });
  });

  test('renders nothing if isOpen is false', () => {
    render(<CreatorComparisonModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Comparativo de Criadores')).not.toBeInTheDocument();
  });

  test('renders modal with title when open', () => {
    render(<CreatorComparisonModal {...defaultProps} />);
    expect(screen.getByText(`Comparativo de Criadores (${defaultProps.creatorIdsToCompare.length})`)).toBeInTheDocument();
  });

  test('calls onClose when close button is clicked', () => {
    render(<CreatorComparisonModal {...defaultProps} />);
    fireEvent.click(screen.getByTitle('Fechar modal'));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  test('fetches comparison data on mount if isOpen and creatorIds are provided', async () => {
    render(<CreatorComparisonModal {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith('/api/admin/dashboard/creators/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creatorIds: defaultProps.creatorIdsToCompare }),
    });
  });

  test('does not fetch if creatorIdsToCompare has less than 2 IDs', () => {
    render(<CreatorComparisonModal {...defaultProps} creatorIdsToCompare={['id1']} />);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('Nenhum dado de criador disponível para comparação ou IDs inválidos.')).toBeInTheDocument();
  });

  test('displays loading state', () => {
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Keep it loading
    render(<CreatorComparisonModal {...defaultProps} />);
    expect(screen.getByText('Carregando dados para comparação...')).toBeInTheDocument();
  });

  test('displays error state', async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Failed to fetch'));
    render(<CreatorComparisonModal {...defaultProps} />);
    expect(await screen.findByText('Erro ao carregar dados: Failed to fetch')).toBeInTheDocument();
  });

  test('displays "no data" message if fetch returns empty array or null', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => [] });
    render(<CreatorComparisonModal {...defaultProps} />);
    expect(await screen.findByText('Nenhum dado de criador disponível para comparação ou IDs inválidos.')).toBeInTheDocument();
  });

  describe('With Mock Data Rendered', () => {
    beforeEach(async () => {
      // Ensure fetch is set for successful data load for these tests
      (fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockProfiles,
      });
      render(<CreatorComparisonModal {...defaultProps} />);
      await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)); // Wait for data to load
    });

    test('displays creator names as column headers', () => {
      expect(screen.getAllByText('Alice')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Bob')[0]).toBeInTheDocument();
      expect(screen.getAllByText('Charlie')[0]).toBeInTheDocument();
    });

    test('renders metric labels and data in table cells', () => {
      expect(screen.getByText('Nº de Posts')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument(); // Alice's postCount
      expect(screen.getByText('150')).toBeInTheDocument(); // Bob's postCount

      expect(screen.getByText('Taxa de Engaj. Média')).toBeInTheDocument();
      expect(screen.getByText('5.0%')).toBeInTheDocument(); // Alice's engagement
      expect(screen.getByText('8.0%')).toBeInTheDocument(); // Bob's engagement (highlighted)

      expect(screen.getAllByTestId('mock-image').length).toBe(3); // 3 profile pictures
    });

    test('highlights best values correctly', () => {
      // Bob has best avgEngagementRate (0.08 vs 0.05 vs 0.03)
      const bobEngagementCell = screen.getByText('8.0%').closest('td');
      expect(bobEngagementCell).toHaveClass('font-bold text-green-600 dark:text-green-400');

      // Charlie has best avgLikes (60 vs 50 vs 40)
      const charlieLikesCell = screen.getByText('60').closest('td');
      expect(charlieLikesCell).toHaveClass('font-bold text-green-600 dark:text-green-400');

      // Alice's post count (100) is not the max (Bob has 150)
      const alicePostsCell = screen.getByText('100').closest('td');
      expect(alicePostsCell).not.toHaveClass('font-bold text-green-600 dark:text-green-400');
    });
  });

  test('re-fetches when creatorIdsToCompare prop changes while open', async () => {
    const newIds = ['id4', 'id5'];
    const newMockProfiles = [
      { creatorId: 'id4', creatorName: 'Dave', postCount: 200, avgEngagementRate: 0.1, avgLikes: 10, avgShares: 1, topPerformingContext: 'Music' },
      { creatorId: 'id5', creatorName: 'Eve', postCount: 220, avgEngagementRate: 0.12, avgLikes: 12, avgShares: 2, topPerformingContext: 'Art' },
    ];
    (fetch as jest.Mock).mockReset();
    (fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => mockProfiles })
      .mockResolvedValueOnce({ ok: true, json: async () => newMockProfiles });

    const { rerender } = render(<CreatorComparisonModal {...defaultProps} />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    rerender(<CreatorComparisonModal {...defaultProps} creatorIdsToCompare={newIds} />);

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(fetch).toHaveBeenLastCalledWith('/api/admin/dashboard/creators/compare', expect.objectContaining({
      body: JSON.stringify({ creatorIds: newIds }),
    }));

    const daveCells = await screen.findAllByText('Dave');
    const eveCells = await screen.findAllByText('Eve');

    expect(daveCells.length).toBeGreaterThan(0);
    expect(eveCells.length).toBeGreaterThan(0);
  });

});
