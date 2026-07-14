// @jest-environment node
import { NextRequest } from 'next/server';
import {
  isMobileDashboardEntryPath,
  isMobileRequestSignal,
  middleware,
  shouldRedirectMobileDashboardEntry,
} from './middleware';

const originalMobileProfileFlag = process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED;

function createRequest(path: string, headers?: HeadersInit) {
  return new NextRequest(`http://localhost${path}`, { headers });
}

afterEach(() => {
  if (originalMobileProfileFlag === undefined) {
    delete process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED;
    return;
  }
  process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED = originalMobileProfileFlag;
});

describe('affiliate code cookie', () => {
  it('sets cookie when valid ref parameter is present', async () => {
    const res = await middleware(createRequest('/?ref=abc123'));
    expect(res.cookies.get('d2c_ref')?.value).toBe('ABC123');
  });

  it('ignores invalid codes', async () => {
    const res = await middleware(createRequest('/?ref=!!'));
    expect(res.cookies.get('d2c_ref')).toBeUndefined();
  });
});

describe('mobile strategic profile entry redirect', () => {
  const iphoneHeaders = new Headers({
    'user-agent':
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
  });
  const desktopHeaders = new Headers({
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  });

  it('identifies only dashboard entry paths as mobile app entry points', () => {
    expect(isMobileDashboardEntryPath('/')).toBe(false);
    expect(isMobileDashboardEntryPath('/dashboard')).toBe(true);
    expect(isMobileDashboardEntryPath('/dashboard/home')).toBe(true);
    expect(isMobileDashboardEntryPath('/dashboard/boards/mobile-strategic-profile')).toBe(false);
  });

  it('uses user-agent and client hints as mobile request signals', () => {
    expect(isMobileRequestSignal(iphoneHeaders)).toBe(true);
    expect(isMobileRequestSignal(new Headers({ 'sec-ch-ua-mobile': '?1' }))).toBe(true);
    expect(isMobileRequestSignal(desktopHeaders)).toBe(false);
  });

  it('keeps the public landing at the root on mobile', () => {
    expect(
      shouldRedirectMobileDashboardEntry({
        appEnabled: true,
        headers: iphoneHeaders,
        pathname: '/',
        searchParams: new URLSearchParams(),
      }),
    ).toBe(false);
  });

  it('redirects enabled mobile dashboard entries before the legacy app can render', () => {
    expect(
      shouldRedirectMobileDashboardEntry({
        appEnabled: true,
        headers: iphoneHeaders,
        pathname: '/dashboard/home',
        searchParams: new URLSearchParams(),
      }),
    ).toBe(true);
  });

  it('keeps desktop, print and post creation entry behavior unchanged', () => {
    expect(
      shouldRedirectMobileDashboardEntry({
        appEnabled: true,
        headers: desktopHeaders,
        pathname: '/',
        searchParams: new URLSearchParams(),
      }),
    ).toBe(false);

    expect(
      shouldRedirectMobileDashboardEntry({
        appEnabled: true,
        headers: iphoneHeaders,
        pathname: '/dashboard',
        searchParams: new URLSearchParams('print=true'),
      }),
    ).toBe(false);

    expect(
      shouldRedirectMobileDashboardEntry({
        appEnabled: true,
        headers: iphoneHeaders,
        pathname: '/',
        searchParams: new URLSearchParams('board=post-creation'),
      }),
    ).toBe(false);
  });

  it('returns a temporary redirect to the real mobile app route', async () => {
    process.env.NEXT_PUBLIC_MOBILE_STRATEGIC_PROFILE_ENABLED = '1';
    const res = await middleware(
      createRequest('/dashboard?ref=abc123', {
        'user-agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
      }),
    );

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost/dashboard/boards/mobile-strategic-profile?ref=abc123',
    );
    expect(res.cookies.get('d2c_ref')?.value).toBe('ABC123');
  });
});
