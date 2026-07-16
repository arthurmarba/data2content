import { fireEvent, render } from '@testing-library/react';
import AnalyticsClickTracker from './AnalyticsClickTracker';
import { track } from '@/lib/track';

jest.mock('@/lib/track', () => ({ track: jest.fn() }));

const trackMock = track as jest.MockedFunction<typeof track>;

describe('AnalyticsClickTracker', () => {
  beforeEach(() => {
    trackMock.mockClear();
  });

  it('tracks a button with stable page and section dimensions', () => {
    const { getByRole } = render(
      <AnalyticsClickTrackerFixture />,
    );

    fireEvent.click(getByRole('button', { name: 'Começar agora' }));

    expect(trackMock).toHaveBeenCalledWith('button_click', {
      button_name: 'start_trial',
      button_section: 'hero',
      page_path: '/',
      destination: undefined,
      element_type: 'button',
    });
  });

  it('tracks internal links without collecting query-string values', () => {
    const { getByRole } = render(
      <>
        <AnalyticsClickTracker />
        <a href="/dashboard?token=sensitive">Dashboard</a>
      </>,
    );

    fireEvent.click(getByRole('link', { name: 'Dashboard' }));

    expect(trackMock).toHaveBeenCalledWith('button_click', {
      button_name: 'dashboard',
      button_section: 'page',
      page_path: '/',
      destination: '/dashboard',
      element_type: 'link',
    });
  });

  it('ignores consent controls and explicitly excluded regions', () => {
    const { getByRole } = render(
      <>
        <AnalyticsClickTracker />
        <div data-analytics-ignore="true">
          <button>Aceitar cookies</button>
        </div>
      </>,
    );

    fireEvent.click(getByRole('button', { name: 'Aceitar cookies' }));

    expect(trackMock).not.toHaveBeenCalled();
  });
});

function AnalyticsClickTrackerFixture() {
  return (
    <>
      <AnalyticsClickTracker />
      <section data-analytics-section="hero">
        <button data-analytics-name="start_trial">Começar agora</button>
      </section>
    </>
  );
}
