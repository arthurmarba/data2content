describe('Google Analytics helpers', () => {
  const originalTrackingId = process.env.NEXT_PUBLIC_GA_ID;

  afterEach(() => {
    if (originalTrackingId === undefined) {
      delete process.env.NEXT_PUBLIC_GA_ID;
    } else {
      process.env.NEXT_PUBLIC_GA_ID = originalTrackingId;
    }
    delete (window as Window & { gtag?: jest.Mock }).gtag;
    jest.resetModules();
  });

  async function loadHelpers(trackingId?: string) {
    if (trackingId === undefined) {
      delete process.env.NEXT_PUBLIC_GA_ID;
    } else {
      process.env.NEXT_PUBLIC_GA_ID = trackingId;
    }
    jest.resetModules();
    return import('./gtag');
  }

  it('sends a GA4 page_view with the current document context', async () => {
    const gtag = jest.fn();
    (window as Window & { gtag?: jest.Mock }).gtag = gtag;
    document.title = 'Dashboard';
    const { pageview } = await loadHelpers('G-TEST123');

    pageview('/dashboard?tab=overview');

    expect(gtag).toHaveBeenCalledWith('event', 'page_view', {
      page_path: '/dashboard?tab=overview',
      page_location: `${window.location.origin}/dashboard?tab=overview`,
      page_title: 'Dashboard',
    });
  });

  it('does nothing when the measurement ID is not configured', async () => {
    const gtag = jest.fn();
    (window as Window & { gtag?: jest.Mock }).gtag = gtag;
    const { event, pageview } = await loadHelpers();

    expect(() => pageview('/dashboard')).not.toThrow();
    expect(() => event('cta_click', { location: 'hero' })).not.toThrow();
    expect(gtag).not.toHaveBeenCalled();
  });

  it('does not break the application while gtag is unavailable', async () => {
    const { event, pageview } = await loadHelpers('G-TEST123');

    expect(() => pageview('/dashboard')).not.toThrow();
    expect(() => event('cta_click', { location: 'hero' })).not.toThrow();
  });
});
