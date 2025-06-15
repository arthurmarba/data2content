import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostDetailModal from './PostDetailModal';

// Mock Heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  ...jest.requireActual('@heroicons/react/24/outline'),
  XMarkIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'x-mark-icon' }),
  TagIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'tag-icon' }),
  InformationCircleIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'info-circle-icon' }),
  ArrowTrendingUpIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'arrow-trending-up-icon' }),
  ChartBarIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'chart-bar-icon' }),
  EyeIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'eye-icon' }),
  HeartIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'heart-icon' }),
  ChatBubbleOvalLeftEllipsisIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'chat-bubble-icon' }),
  ShareIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'share-icon' }),
  UsersIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'users-icon' }),
  PresentationChartLineIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'presentation-chart-icon' }),
  ExclamationCircleIcon: (props) => React.createElement('div', { ...props, 'data-testid': 'exclamation-circle-icon-modal' }),
}));

// Mock SkeletonBlock
jest.mock('../components/SkeletonBlock', () => {
  return {
    __esModule: true,
    default: ({ width, height, className }: { width?: string; height?: string; className?: string; }) => (
      <div data-testid="skeleton-block" className={`mock-skeleton ${width} ${height} ${className}`}></div>
    ),
  };
});

jest.useFakeTimers();

describe('PostDetailModal Component', () => {
  const mockOnClose = jest.fn();
  const testPostId = 'testPost123';

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('does not render if isOpen is false', () => {
    render(<PostDetailModal isOpen={false} onClose={mockOnClose} postId={testPostId} />);
    expect(screen.queryByText(`Detalhes do Post`)).not.toBeInTheDocument();
  });

  test('does not render if postId is null', () => {
    render(<PostDetailModal isOpen={true} onClose={mockOnClose} postId={null} />);
    expect(screen.queryByText(`Detalhes do Post`)).not.toBeInTheDocument();
  });

  test('renders loading state with skeletons initially when open with postId', () => {
    render(<PostDetailModal isOpen={true} onClose={mockOnClose} postId={testPostId} />);
    expect(screen.getByText(`Detalhes do Post`)).toBeInTheDocument();
    expect(screen.queryAllByTestId('skeleton-block').length).toBeGreaterThan(0);
  });

  describe('When data is loaded', () => {
    beforeEach(async () => {
      render(<PostDetailModal isOpen={true} onClose={mockOnClose} postId={testPostId} />);
      jest.runAllTimers(); // Complete the simulated fetch
      // Wait for a piece of content that indicates loading is complete
      await screen.findByText((content, element) => content.startsWith('Link:'));
    });

    test('renders modal title with postId and sections', () => {
      expect(screen.getByText((content, element) => content.includes('Detalhes do Post') && content.includes(`(ID: ${testPostId})`))).toBeInTheDocument();
      expect(screen.getByText('Informações Gerais')).toBeInTheDocument();
      expect(screen.getByText('Métricas Principais')).toBeInTheDocument();
      expect(screen.getByText('Desempenho Diário')).toBeInTheDocument();
    });

    test('displays fetched post details correctly', async () => {
      // Example: Check for description (use regex for partial match due to randomness)
      expect(screen.getByText(/Esta é uma descrição detalhada para o post testPost123/)).toBeInTheDocument();

      // Example: Check for a stat (Views - its value is random, so check for label)
      expect(screen.getByText('Visualizações')).toBeInTheDocument();

      // Example: Check for daily snapshot data (presence of table headers or first row)
      // Since data is random, just check if the table structure for daily snapshots is there
      expect(screen.getByText((content, el) => el?.tagName.toLowerCase() === 'th' && content === 'Data')).toBeInTheDocument();
      expect(screen.getByText((content, el) => el?.tagName.toLowerCase() === 'th' && content === 'Visualizações')).toBeInTheDocument();
      expect(screen.getByText((content, el) => el?.tagName.toLowerCase() === 'th' && content === 'Curtidas')).toBeInTheDocument();

      // Check for engagement rate formatting (value is random, so we check for '%')
      // The label is "Engaj./Alcance"
      const engagementRateLabel = screen.getByText('Engaj./Alcance');
      const engagementRateValueElement = engagementRateLabel.closest('.bg-gray-50')?.querySelector('p.text-gray-800');
      expect(engagementRateValueElement).toHaveTextContent(/%$/); // Ends with %
    });

    test('renders daily performance chart placeholder', () => {
      expect(screen.getByText('[Daily Performance Chart Placeholder]')).toBeInTheDocument();
    });

    test('calls onClose when the close button in the header is clicked', () => {
      fireEvent.click(screen.getByTestId('x-mark-icon').closest('button')!);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    test('calls onClose when the "Fechar" button in the footer is clicked', () => {
      fireEvent.click(screen.getByText('Fechar'));
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  test('renders error state if fetching data fails', async () => {
    const originalSetTimeout = global.setTimeout;
    // @ts-ignore
    global.setTimeout = (callback, timeout) => {
      // Simulate error by calling callback with logic that would lead to error
      // or modify the component to accept a prop that forces an error for testing
      // For this specific component, the error is set if generatedPostData throws.
      // We can mock a part of the data generation to throw.
      const originalMathRandom = Math.random;
      Math.random = () => { throw new Error("Simulated data generation error"); };
      try {
        // @ts-ignore
        callback(); // This should now trigger the catch block in useEffect
      } finally {
        Math.random = originalMathRandom; // Restore
      }
      return 0 as unknown as NodeJS.Timeout; // Return a dummy timeout ID
    };

    render(<PostDetailModal isOpen={true} onClose={mockOnClose} postId="errorId" />);
    // No need to runAllTimers if setTimeout is mocked to call immediately

    await waitFor(() => {
      expect(screen.getByText('Falha ao carregar os detalhes do post.')).toBeInTheDocument();
    });
    expect(screen.getByTestId('exclamation-circle-icon-modal')).toBeInTheDocument();

    global.setTimeout = originalSetTimeout; // Restore setTimeout
  });

});
