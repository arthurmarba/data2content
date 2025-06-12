import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CreatorDashboardPage, { GlobalFiltersState } from './page'; // Assuming page.tsx is the default export

// Mocks for child components
jest.mock('./CreatorTable', () => ({
  __esModule: true,
  default: jest.fn((props) => <div data-testid="creator-table-mock" data-props={JSON.stringify(props)}>CreatorTable</div>),
}));
jest.mock('./ContentStatsWidgets', () => ({
  __esModule: true,
  default: jest.fn((props) => <div data-testid="content-stats-mock" data-props={JSON.stringify(props)}>ContentStatsWidgets</div>),
}));
jest.mock('./GlobalPostsExplorer', () => ({
  __esModule: true,
  default: jest.fn((props) => <div data-testid="global-posts-mock" data-props={JSON.stringify(props)}>GlobalPostsExplorer</div>),
}));
jest.mock('./StandaloneChatInterface', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="chat-interface-mock">StandaloneChatInterface</div>),
}));


// Mock Heroicons used in the page (e.g., XMarkIcon for modal close)
jest.mock('@heroicons/react/24/solid', () => ({
  XMarkIcon: () => <div data-testid="x-mark-icon" />,
}));


describe('CreatorDashboardPage Component', () => {
  const CreatorTableMock = require('./CreatorTable').default;
  // const ContentStatsWidgetsMock = require('./ContentStatsWidgets').default; // If needed for assertions

  beforeEach(() => {
    CreatorTableMock.mockClear();
    // ContentStatsWidgetsMock.mockClear();
  });

  test('renders the main title and filter section', () => {
    render(<CreatorDashboardPage />);
    expect(screen.getByText('Creator & Content Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Filtros Globais')).toBeInTheDocument();
  });

  test('initial filter state is correctly set up for multi-selects', () => {
    render(<CreatorDashboardPage />);
    // Check a few checkboxes to ensure they are initially unchecked
    const proCheckbox = screen.getByLabelText('Pro') as HTMLInputElement; // PLAN_STATUS_OPTIONS
    expect(proCheckbox.checked).toBe(false);

    const inicianteCheckbox = screen.getByLabelText('Iniciante') as HTMLInputElement; // EXPERTISE_LEVEL_OPTIONS
    expect(inicianteCheckbox.checked).toBe(false);
  });

  test('updates planStatus filter state when checkboxes are clicked', () => {
    render(<CreatorDashboardPage />);
    const proCheckbox = screen.getByLabelText('Pro') as HTMLInputElement;
    const premiumCheckbox = screen.getByLabelText('Premium') as HTMLInputElement;

    fireEvent.click(proCheckbox); // Check Pro
    expect(proCheckbox.checked).toBe(true);
    // (filters.planStatus should now include 'Pro') - state is internal, will check via prop passed

    fireEvent.click(premiumCheckbox); // Check Premium
    expect(premiumCheckbox.checked).toBe(true);
    // (filters.planStatus should now include 'Pro', 'Premium')

    fireEvent.click(proCheckbox); // Uncheck Pro
    expect(proCheckbox.checked).toBe(false);
    // (filters.planStatus should now only include 'Premium')
  });

  test('updates expertiseLevel filter state when checkboxes are clicked', () => {
    render(<CreatorDashboardPage />);
    const inicianteCheckbox = screen.getByLabelText('Iniciante') as HTMLInputElement;
    fireEvent.click(inicianteCheckbox);
    expect(inicianteCheckbox.checked).toBe(true);
  });

  test('passes correct comma-separated filter props to CreatorTable after applying filters', async () => {
    render(<CreatorDashboardPage />);

    // Simulate selecting 'Pro' and 'Premium' for planStatus
    fireEvent.click(screen.getByLabelText('Pro'));
    fireEvent.click(screen.getByLabelText('Premium'));

    // Simulate selecting 'Avançado' for expertiseLevel
    fireEvent.click(screen.getByLabelText('Avançado'));

    // Click "Aplicar Filtros"
    // This button click causes a re-render due to refreshKey change.
    // CreatorTableMock will receive new props.
    fireEvent.click(screen.getByText('Aplicar Filtros'));

    // Wait for the component to re-render and pass new props
    await waitFor(() => {
      // CreatorTableMock is called multiple times (initial render, then re-render on key change)
      // We care about the props passed in the last call.
      const lastCallProps = JSON.parse(CreatorTableMock.mock.calls[CreatorTableMock.mock.calls.length - 1][0]['data-props']);
      expect(lastCallProps.planStatusFilter).toBe('Pro,Premium');
      expect(lastCallProps.expertiseLevelFilter).toBe('Avançado');
    });
  });

  test('passes undefined to CreatorTable if no checkboxes for a filter are selected', async () => {
    render(<CreatorDashboardPage />);

    // Ensure 'Pro' is checked then uncheck it
    const proCheckbox = screen.getByLabelText('Pro');
    fireEvent.click(proCheckbox); // Check
    fireEvent.click(proCheckbox); // Uncheck
    expect((proCheckbox as HTMLInputElement).checked).toBe(false);


    fireEvent.click(screen.getByText('Aplicar Filtros'));

    await waitFor(() => {
      const lastCallProps = JSON.parse(CreatorTableMock.mock.calls[CreatorTableMock.mock.calls.length - 1][0]['data-props']);
      expect(lastCallProps.planStatusFilter).toBeUndefined(); // Or "" depending on join behavior with empty array
      // For `filters.planStatus.join(',')` if planStatus is [], it results in "".
      // The API route's Zod transform with `.refine` should turn "" into `undefined`.
      // So, the prop passed to CreatorTable can be "" if it's `filters.planStatus.join(',')`
      // Let's adjust the expectation based on current implementation:
      // `planStatusFilter={filters.planStatus.length > 0 ? filters.planStatus.join(',') : undefined}`
      // This means if array is empty, `undefined` is passed.
    });
  });

  test('toggles AI Chat Modal visibility', () => {
    render(<CreatorDashboardPage />);
    const chatButton = screen.getByText('Chat IA');

    // Modal should not be visible initially
    expect(screen.queryByTestId('chat-interface-mock')).not.toBeInTheDocument();

    fireEvent.click(chatButton); // Open modal
    expect(screen.getByTestId('chat-interface-mock')).toBeInTheDocument();
    expect(screen.getByText('Assistente IA')).toBeInTheDocument(); // Modal title

    // Find and click close button (assuming XMarkIcon is rendered as a button or inside one)
    // The XMarkIcon itself is mocked as <div data-testid="x-mark-icon" />
    // The button containing it is: <button onClick={() => setIsAiChatVisible(false)} ... title="Fechar chat">
    const closeButton = screen.getByTitle('Fechar chat');
    fireEvent.click(closeButton);

    expect(screen.queryByTestId('chat-interface-mock')).not.toBeInTheDocument();
  });

});
