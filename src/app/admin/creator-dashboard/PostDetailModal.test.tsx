import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PostDetailModal, { IPostDetailsData } from './PostDetailModal'; // Import IPostDetailsData if needed for mock typing

// Mock global fetch
global.fetch = jest.fn();

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

// Mock Recharts (definido dentro da factory para evitar hoisting antes das consts)
jest.mock('recharts', () => {
  const MockResponsiveContainer = ({ children }) => <div data-testid="responsive-container">{children}</div>;
  const MockLineChart = ({ data, children }) => <div data-testid="line-chart" data-chartdata={JSON.stringify(data)}>{children}</div>;
  const MockLine = ({ dataKey, name }) => <div data-testid={`line-${dataKey}`} data-name={name}>Line-{dataKey}</div>;
  const MockXAxis = ({ dataKey }) => <div data-testid={`xaxis-${dataKey}`}>XAxis-{dataKey}</div>;
  const MockYAxis = () => <div data-testid="yaxis">YAxis</div>;
  const MockCartesianGrid = () => <div data-testid="cartesian-grid">CartesianGrid</div>;
  const MockTooltip = () => <div data-testid="tooltip">Tooltip</div>;
  const MockLegend = () => <div data-testid="legend">Legend</div>;
  return {
    ResponsiveContainer: MockResponsiveContainer,
    LineChart: MockLineChart,
    Line: MockLine,
    XAxis: MockXAxis,
    YAxis: MockYAxis,
    CartesianGrid: MockCartesianGrid,
    Tooltip: MockTooltip,
    Legend: MockLegend,
  };
});


describe('PostDetailModal Component', () => {
  const mockOnClose = jest.fn();
  const testPostId = 'testPost123';

  const mockPostDetailsData: IPostDetailsData = {
    _id: testPostId,
    postLink: `https://example.com/post/${testPostId}`,
    description: `Esta é uma descrição detalhada para o post ${testPostId}.`,
    postDate: new Date('2023-10-26T10:00:00Z'),
    type: 'REEL',
    format: 'Tutorial',
    proposal: 'Educativo',
    context: 'Tecnologia',
    stats: {
      views: 12000,
      likes: 1500,
      comments: 80,
      shares: 40,
      reach: 20000,
      engagement_rate_on_reach: 0.08, // 8%
    },
    dailySnapshots: [
      { date: new Date('2023-10-20T00:00:00Z'), dailyViews: 1000, dailyLikes: 100 },
      { date: new Date('2023-10-21T00:00:00Z'), dailyViews: 1200, dailyLikes: 110 },
      { date: new Date('2023-10-22T00:00:00Z'), dailyViews: 1500, dailyLikes: 130 },
      { date: new Date('2023-10-23T00:00:00Z'), dailyViews: 1300, dailyLikes: 120 },
      { date: new Date('2023-10-24T00:00:00Z'), dailyViews: 1600, dailyLikes: 140 },
    ],
  };

  beforeEach(() => {
    mockOnClose.mockClear();
    (fetch as jest.Mock).mockClear();
    // Default successful fetch
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => mockPostDetailsData,
    });
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

  describe('When data is loaded successfully', () => {
    beforeEach(async () => {
      render(<PostDetailModal isOpen={true} onClose={mockOnClose} postId={testPostId} />);
      // Wait for loading to finish (fetch mock resolves)
      await waitFor(() => expect(screen.queryByTestId('skeleton-block')).not.toBeInTheDocument());
    });

    test('renders modal title with postId and sections', async () => {
      // Ensure data is displayed (e.g., description)
      expect(await screen.findByText(mockPostDetailsData.description)).toBeInTheDocument();

      expect(screen.getByText((content, element) => content.includes('Detalhes do Post') && content.includes(`(ID: ${testPostId})`))).toBeInTheDocument();
      expect(screen.getByText('Informações Gerais')).toBeInTheDocument();
      expect(screen.getByText('Métricas Principais')).toBeInTheDocument();
      expect(screen.getByText('Desempenho Diário')).toBeInTheDocument();
    });

    test('displays fetched post details correctly', async () => {
      // Example: Check for description (use regex for partial match due to randomness)
      expect(screen.getByText(mockPostDetailsData.description)).toBeInTheDocument();
      expect(screen.getByText(mockPostDetailsData.stats.views!.toLocaleString('pt-BR'))).toBeInTheDocument();
      // Check for engagement rate formatting
      const engagementRateValue = (mockPostDetailsData.stats.engagement_rate_on_reach! * 100).toFixed(2) + '%';
      expect(screen.getByText(engagementRateValue)).toBeInTheDocument();
    });

    test('renders daily performance chart with correct data and line components', () => {
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
      const lineChart = screen.getByTestId('line-chart');
      expect(lineChart).toBeInTheDocument();

      const chartData = JSON.parse(lineChart.getAttribute('data-chartdata') || '[]');
      // Dates in chartData will be ISO strings because of JSON.stringify.
      // Compare length and key values, or convert dates in mockPostDetailsData.dailySnapshots to ISO strings for exact match.
      expect(chartData.length).toEqual(mockPostDetailsData.dailySnapshots.length);
      expect(chartData[0].dailyViews).toEqual(mockPostDetailsData.dailySnapshots[0].dailyViews);

      expect(screen.getByTestId('xaxis-date')).toBeInTheDocument();
      expect(screen.getByTestId('yaxis')).toBeInTheDocument();
      expect(screen.getByTestId('line-dailyViews')).toHaveAttribute('data-name', 'Visualizações Diárias');
      expect(screen.getByTestId('line-dailyLikes')).toHaveAttribute('data-name', 'Curtidas Diárias');
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });

    test('displays "Dados diários insuficientes..." if dailySnapshots has less than 2 items', async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockPostDetailsData, dailySnapshots: [mockPostDetailsData.dailySnapshots[0]] }), // Only 1 item
      });
      // Re-render or trigger a re-fetch if the component was already mounted.
      // For simplicity, we'll render it fresh for this specific test condition.
      render(<PostDetailModal isOpen={true} onClose={mockOnClose} postId="testPostWithFewSnapshots" />);
      await waitFor(() => expect(screen.queryByTestId('skeleton-block')).not.toBeInTheDocument());

      expect(screen.getByText('Dados diários insuficientes para exibir o gráfico.')).toBeInTheDocument();
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
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
    (fetch as jest.Mock).mockRejectedValueOnce(new Error('Falha na API simulada'));
    render(<PostDetailModal isOpen={true} onClose={mockOnClose} postId="errorPostId" />);

    expect(await screen.findByText('Falha na API simulada')).toBeInTheDocument();
    // Check for your error icon if it's consistently rendered with errors
    // expect(screen.getByTestId('exclamation-circle-icon-modal')).toBeInTheDocument();
  });

  test('renders 404 error state if post not found', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: 'Post não encontrado.' }),
    });
    render(<PostDetailModal isOpen={true} onClose={mockOnClose} postId="notFoundPostId" />);

    expect(await screen.findByText('Post não encontrado.')).toBeInTheDocument();
  });

});
