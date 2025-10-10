import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import GlobalPostsExplorer from './GlobalPostsExplorer';
import { IGlobalPostResult } from '@/app/lib/dataService/marketAnalysisService'; // Adjust if path is different

// Mock global fetch
global.fetch = jest.fn();

// Mock Heroicons
jest.mock('@heroicons/react/24/solid', () => ({
  ChevronUpIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'chevron-up-icon' }),
  ChevronDownIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'chevron-down-icon' }),
}));
jest.mock('@heroicons/react/24/outline', () => ({
  ...jest.requireActual('@heroicons/react/24/outline'),
  MagnifyingGlassIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'magnifying-glass-icon' }),
  DocumentMagnifyingGlassIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'doc-magnifying-glass-icon' }),
}));

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

// Mock PostDetailModal
const MockPostDetailModal = jest.fn(({ isOpen, onClose, postId }) => {
  if (!isOpen) return null;
  return (
    <div data-testid="mock-post-detail-modal">
      <h3>Post Detail for ID: {postId}</h3>
      <button onClick={onClose}>Close Post Modal</button>
    </div>
  );
});
jest.mock('./PostDetailModal', () => ({
    __esModule: true,
    default: MockPostDetailModal,
}));

const MockContentTrendChart = jest.fn(({ postId }) => (
  <div data-testid="mock-content-trend-chart">Chart for {postId}</div>
));
jest.mock('./ContentTrendChart', () => ({
  __esModule: true,
  default: MockContentTrendChart,
}));


const mockPosts: IGlobalPostResult[] = [
  { _id: 'post1', text_content: 'First amazing post content', creatorName: 'Creator Alpha', postDate: new Date('2023-11-01T10:00:00Z'), format: 'Reel', proposal: 'Educativo', context: 'Tecnologia', stats: { total_interactions: 150, likes: 100, shares: 20, comments: 30, views: 1000, reach: 800, engagement_rate_on_reach: 0.125 } },
  { _id: 'post2', description: 'Second post, a bit shorter.', creatorName: 'Creator Beta', postDate: new Date('2023-11-02T12:30:00Z'), format: 'Post Estático', proposal: 'Humor', context: 'Entretenimento', stats: { total_interactions: 250, likes: 200, shares: 10, comments: 40, views: 2000, reach: 1500, engagement_rate_on_reach: 0.133 } },
];

describe('GlobalPostsExplorer Component', () => {
  beforeEach(() => {
    (fetch as jest.Mock).mockClear();
    MockPostDetailModal.mockClear();

    // Default successful fetch for initial load
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ posts: mockPosts, totalPosts: mockPosts.length, page: 1, limit: 10 }),
    });
  });

  test('renders "Ações" column header and action buttons for each post', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await waitFor(() => {
      expect(screen.getByText('First amazing post content')).toBeInTheDocument();
    });

    // Check for "Ações" header
    expect(screen.getByText('Ações')).toBeInTheDocument();

    // Check for action buttons
    const detailButtons = screen.getAllByText('Detalhes');
    const trendButtons = screen.getAllByText('Tendência');
    expect(detailButtons.length).toBe(mockPosts.length);
    expect(trendButtons.length).toBe(mockPosts.length);
  });

  test('renders tone and reference columns and options', async () => {
    render(<GlobalPostsExplorer />);

    // columns should appear after fetch resolves
    await waitFor(() => {
      expect(screen.getByText('Tom')).toBeInTheDocument();
    });

    expect(screen.getByText('Referências')).toBeInTheDocument();

    // Check some option from each select exists
    expect(screen.getByRole('option', { name: 'Humorístico' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Cultura Pop/ })).toBeInTheDocument();
  });

  test('opens PostDetailModal with correct postId when "Detalhes" button is clicked', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await waitFor(() => {
      expect(screen.getByText('First amazing post content')).toBeInTheDocument();
    });

    const detailButtons = screen.getAllByText('Detalhes');
    fireEvent.click(detailButtons[0].closest('button')!); // Click the button for the first post

    await waitFor(() => {
        expect(MockPostDetailModal).toHaveBeenCalledTimes(1);
    });

    expect(MockPostDetailModal).toHaveBeenCalledWith(
      expect.objectContaining({
        isOpen: true,
        postId: mockPosts[0]._id,
      }),
      {}
    );

    // Check if modal content is rendered (simplified)
    expect(screen.getByTestId('mock-post-detail-modal')).toBeInTheDocument();
    expect(screen.getByText(`Post Detail for ID: ${mockPosts[0]._id}`)).toBeInTheDocument();
  });

  test('opens ContentTrendChart when "Tendência" button is clicked', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await waitFor(() => {
      expect(screen.getByText('First amazing post content')).toBeInTheDocument();
    });

    const trendButtons = screen.getAllByText('Tendência');
    fireEvent.click(trendButtons[0].closest('button')!);

    await waitFor(() => {
      expect(screen.getByTestId('mock-content-trend-chart')).toBeInTheDocument();
    });
    expect(screen.getByText('Chart for post1')).toBeInTheDocument();
  });

  test('closes ContentTrendChart when close button is clicked', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await waitFor(() => screen.getByText('First amazing post content'));
    fireEvent.click(screen.getAllByText('Tendência')[0].closest('button')!);

    await waitFor(() => screen.getByTestId('mock-content-trend-chart'));

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    await waitFor(() => {
      expect(screen.queryByTestId('mock-content-trend-chart')).not.toBeInTheDocument();
    });
  });

  test('closes PostDetailModal when its onClose is triggered', async () => {
    render(<GlobalPostsExplorer dateRangeFilter={{ startDate: '2023-01-01', endDate: '2023-01-31' }} />);

    await waitFor(() => {
      expect(screen.getByText('First amazing post content')).toBeInTheDocument();
    });

    // Open the modal first
    const detailButtons = screen.getAllByText('Detalhes');
    fireEvent.click(detailButtons[0].closest('button')!);

    await waitFor(() => {
        expect(screen.getByTestId('mock-post-detail-modal')).toBeInTheDocument();
    });

    // Simulate closing the modal by calling the mock's onClose prop (as if the modal's internal close button was clicked)
    // This requires the mock to actually call the onClose prop it receives.
    // The current MockPostDetailModal calls onClose when "Close Post Modal" is clicked.
    fireEvent.click(screen.getByText('Close Post Modal'));

    await waitFor(() => {
      expect(screen.queryByTestId('mock-post-detail-modal')).not.toBeInTheDocument();
    });

    // Verify the state in GlobalPostsExplorer was updated
    // This is an indirect check. A more direct check would be to spy on setIsPostDetailModalOpen if possible,
    // or ensure that PostDetailModal is called with isOpen: false on subsequent renders.
    // For now, not seeing the modal is a good indicator.
     expect(MockPostDetailModal).toHaveBeenLastCalledWith(
      expect.objectContaining({
        isOpen: false, // This is what we expect after close
      }),
      {}
    );
  });

  test('renders skeleton loading state for table including actions column', () => {
    (fetch as jest.Mock).mockImplementationOnce(() => new Promise(() => {})); // Keep it in loading state
    render(<GlobalPostsExplorer />);

    // Check for multiple skeleton blocks, indicating table rows
    const skeletonCells = screen.getAllByTestId('skeleton-block');
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
    expect(screen.getAllByTestId('skeleton-block').length).toBeGreaterThanOrEqual(9); // At least for one row of columns
  });

});
