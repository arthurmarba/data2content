// src/app/admin/components/AdminAuthGuard.test.tsx
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import AdminAuthGuard from './AdminAuthGuard';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Mock next-auth/react
jest.mock('next-auth/react');
const mockUseSession = useSession as jest.Mock;

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn().mockReturnValue('/admin/some-page'), // Exemplo
}));
const mockUseRouter = useRouter as jest.Mock;
const mockRouterReplace = jest.fn();

describe('AdminAuthGuard', () => {
  beforeEach(() => {
    mockUseSession.mockReturnValue({ data: null, status: 'loading' });
    mockUseRouter.mockReturnValue({ replace: mockRouterReplace });
    mockRouterReplace.mockClear();
  });

  it('should render loading state initially', () => {
    render(<AdminAuthGuard><div>Protected Content</div></AdminAuthGuard>);
    expect(screen.getByText('Verificando autorização...')).toBeInTheDocument();
  });

  it('should redirect to /login if unauthenticated', async () => {
    mockUseSession.mockReturnValue({ data: null, status: 'unauthenticated' });
    render(<AdminAuthGuard><div>Protected Content</div></AdminAuthGuard>);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {
      // useEffects run after render
    });
    expect(mockRouterReplace).toHaveBeenCalledWith('/login?error=SessionRequired&callbackUrl=/admin/creator-dashboard');
  });

  it('should redirect to /unauthorized if authenticated but not admin (no role/isAdmin)', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Test User' } }, // Sem role ou isAdmin
      status: 'authenticated'
    });
    render(<AdminAuthGuard><div>Protected Content</div></AdminAuthGuard>);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {});
    expect(mockRouterReplace).toHaveBeenCalledWith('/unauthorized?error=AdminAccessRequired');
  });

  it('should redirect to /unauthorized if authenticated but role is not admin', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Test User', role: 'user' } },
      status: 'authenticated'
    });
    render(<AdminAuthGuard><div>Protected Content</div></AdminAuthGuard>);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {});
    expect(mockRouterReplace).toHaveBeenCalledWith('/unauthorized?error=AdminAccessRequired');
  });

  it('should redirect to /unauthorized if authenticated but isAdmin is false', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Test User', isAdmin: false } },
      status: 'authenticated'
    });
    render(<AdminAuthGuard><div>Protected Content</div></AdminAuthGuard>);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {});
    expect(mockRouterReplace).toHaveBeenCalledWith('/unauthorized?error=AdminAccessRequired');
  });

  it('should render children if authenticated and admin (by role)', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Admin User', role: 'admin' } },
      status: 'authenticated'
    });
    render(<AdminAuthGuard><div>Protected Content</div></AdminAuthGuard>);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {});
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('should render children if authenticated and admin (by isAdmin flag)', async () => {
    mockUseSession.mockReturnValue({
      data: { user: { name: 'Admin User', isAdmin: true } },
      status: 'authenticated'
    });
    render(<AdminAuthGuard><div>Protected Content</div></AdminAuthGuard>);
    // eslint-disable-next-line testing-library/no-unnecessary-act
    await act(async () => {});
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });
});
