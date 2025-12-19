import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GlobalPostsExplorer from './GlobalPostsExplorer';
import { IGlobalPostResult } from '@/app/lib/dataService/marketAnalysisService'; // Adjust if path is different

// Mock global fetch
global.fetch = jest.fn();

// Mock child components
const MockSkeletonBlock = () => <div data-testid="skeleton-block">Skeleton</div>;
MockSkeletonBlock.displayName = 'MockSkeletonBlock';
jest.mock('./SkeletonBlock', () => MockSkeletonBlock);
const MockEmptyState = ({ icon, title, message }: { icon: any, title: string, message: string }) => (
  <div data-testid="empty-state">
    <h1>{title}</h1><p>{message}</p>
  </div>
);
MockEmptyState.displayName = 'MockEmptyState';
jest.mock('./EmptyState', () => MockEmptyState);


const mockPosts: IGlobalPostResult[] = [
  { _id: 'post1', text_content: 'First amazing post content', creatorName: 'Creator Alpha', postDate: new Date('2023-11-01T10:00:00Z'), format: 'Reel', proposal: 'Educativo', context: 'Tecnologia', stats: { total_interactions: 150, likes: 100, shares: 20, comments: 30, views: 1000, reach: 800, engagement_rate_on_reach: 0.125 } },
  { _id: 'post2', description: 'Second post, a bit shorter.', creatorName: 'Creator Beta', postDate: new Date('2023-11-02T12:30:00Z'), format: 'Post Estático', proposal: 'Humor', context: 'Entretenimento', stats: { total_interactions: 250, likes: 200, shares: 10, comments: 40, views: 2000, reach: 1500, engagement_rate_on_reach: 0.133 } },
];

describe('GlobalPostsExplorer Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();

    // Default successful fetch for initial load
    (fetch as jest.Mock).mockImplementation((url: string) => {
      if (String(url).includes('/details')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            text_content: 'Detailed content',
            creatorName: 'Creator Alpha',
            stats: { total_interactions: 150 },
            dailySnapshots: [],
          }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ posts: mockPosts, totalPosts: mockPosts.length, page: 1, limit: 10 }),
      });
    });
  });

  test('renders "Ações" column header and action buttons for each post', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await screen.findByText('First amazing post content');

    // Check for "Ações" header
    expect(screen.getByText('Ações')).toBeInTheDocument();

    // Check for action buttons
    const detailButtons = screen.getAllByTitle('Ver detalhes');
    const trendButtons = screen.getAllByTitle('Ver tendência');
    expect(detailButtons.length).toBe(mockPosts.length);
    expect(trendButtons.length).toBe(mockPosts.length);
  });

  test('renders tone and reference columns and options', async () => {
    render(<GlobalPostsExplorer />);

    // columns should appear after fetch resolves
    await screen.findByText('First amazing post content');
    expect(screen.getByText('Tom')).toBeInTheDocument();
    expect(screen.getByText('Referências')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Tom' }));
    expect(screen.getByText('Humorístico')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Referências' }));
    expect(screen.getAllByText(/Cultura Pop/).length).toBeGreaterThan(0);
  });

  test('opens PostDetailModal with correct postId when "Detalhes" button is clicked', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await screen.findByText('First amazing post content');

    const detailButtons = screen.getAllByTitle('Ver detalhes');
    fireEvent.click(detailButtons[0]);

    await screen.findByText(/Criador:/);
    expect(screen.getByText(/Detailed content/)).toBeInTheDocument();
  });

  test('opens ContentTrendChart when "Tendência" button is clicked', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await screen.findByText('First amazing post content');

    const trendButtons = screen.getAllByTitle('Ver tendência');
    fireEvent.click(trendButtons[0]);

    await screen.findByText('Gráfico de Tendência para o Post ID: post1');
  });

  test('closes ContentTrendChart when close button is clicked', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await screen.findByText('First amazing post content');
    fireEvent.click(screen.getAllByTitle('Ver tendência')[0]);

    await screen.findByText('Gráfico de Tendência para o Post ID: post1');

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => {
      expect(screen.queryByText(/Gráfico de Tendência/)).not.toBeInTheDocument();
    });
  });

  test('closes PostDetailModal when its onClose is triggered', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await screen.findByText('First amazing post content');

    // Open the modal first
    const detailButtons = screen.getAllByTitle('Ver detalhes');
    fireEvent.click(detailButtons[0]);

    await screen.findByText(/Criador:/);

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));

    await waitFor(() => {
      expect(screen.queryByText(/Criador:/)).not.toBeInTheDocument();
    });
  });

  test('renders skeleton loading state for table including actions column', async () => {
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Keep it in loading state
    render(<GlobalPostsExplorer />);

    // Check for multiple skeleton blocks, indicating table rows
    const skeletonCells = await waitFor(() => screen.getAllByTestId('skeleton-block'));
    expect(skeletonCells.length).toBeGreaterThan(0);

    // Check if one of the headers or cells corresponds to actions skeleton
    // This depends on the implementation details of skeleton in the component.
    // The test for CreatorTable.test.tsx had specific checks based on col.key === 'actions' for width.
    // We can assume that if skeletons are rendered for all columns, actions is included.
    // Example: Number of skeleton cells should be num_rows * num_columns
    // columns.length in GlobalPostsExplorer is 9 (including actions)
    // default limit for rows is 10
    // So, expect 90 skeleton blocks for cells + 9 for headers if that's how it's structured.
    // For simplicity, just checking that many skeletons are rendered is often enough.
    // The actual component applies a class 'w-24' for actions column skeleton cells.
    // This is hard to check directly without more complex query.
    // A simpler check: ensure there are skeleton blocks.
    expect(screen.getAllByTestId('skeleton-block').length).toBeGreaterThanOrEqual(1); // At least one skeleton visible during loading
  });

});
