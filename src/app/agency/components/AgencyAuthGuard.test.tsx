import React from 'react';
import { render, screen, act } from '@testing-library/react';
import AgencyAuthGuard from './AgencyAuthGuard';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

jest.mock('next-auth/react');
const mockUseSession = useSession as jest.Mock;

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn().mockReturnValue('/agency/some-page'),
}));
const mockUseRouter = useRouter as jest.Mock;
const mockRouterReplace = jest.fn();

describe('AgencyAuthGuard', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseRouter.mockReturnValue({ replace: mockRouterReplace });
    mockRouterReplace.mockClear();
  });

  it('should render loading state initially', () => {
    render(<AgencyAuthGuard><div>Protected</div></AgencyAuthGuard>);
    expect(screen.getByText('Verificando autorização...')).toBeInTheDocument();
  });

  it('should redirect to /login if unauthenticated', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<AgencyAuthGuard><div>Protected</div></AgencyAuthGuard>);
    await act(async () => {});
    expect(mockRouterReplace).toHaveBeenCalledWith('/login?error=SessionRequired&callbackUrl=/agency/dashboard');
  });

  it('should redirect to /unauthorized if authenticated but not agency', async () => {
    mockUseSession.mockReturnValue({ data: { user: { name: 'User' } }, status: 'authenticated' });
    render(<AgencyAuthGuard><div>Protected</div></AgencyAuthGuard>);
    await act(async () => {});
    expect(mockRouterReplace).toHaveBeenCalledWith('/unauthorized?error=AgencyAccessRequired');
  });

  it('should redirect to subscription if agency plan inactive', async () => {
    mockUseSession.mockReturnValue({ data: { user: { name: 'Agent', role: 'agency', agencyPlanStatus: 'inactive' } }, status: 'authenticated' });
    render(<AgencyAuthGuard><div>Protected</div></AgencyAuthGuard>);
    await act(async () => {});
    expect(mockRouterReplace).toHaveBeenCalledWith('/agency/subscription');
  });

  it('should render children if authenticated and agency with active plan', async () => {
    mockUseSession.mockReturnValue({ data: { user: { name: 'Agent', role: 'agency', agencyPlanStatus: 'active' } }, status: 'authenticated' });
    render(<AgencyAuthGuard><div>Protected</div></AgencyAuthGuard>);
    await act(async () => {});
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
