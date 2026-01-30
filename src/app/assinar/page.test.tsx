import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import PublicSubscribePage from './page';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

jest.mock('next-auth/react');
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

const mockUseSearchParams = useSearchParams as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;
const mockUseSession = useSession as jest.Mock;

const mockReplace = jest.fn();

describe('PublicSubscribePage', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams('codigo_agencia=abc'));
    mockUseRouter.mockReturnValue({ replace: mockReplace });
    mockUseSession.mockReturnValue({ status: 'unauthenticated' });
  });

  it('shows agency name when invite is valid', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ name: 'Parceiro X' }) }) as any;
    render(<PublicSubscribePage />);
    await waitFor(() => {
      expect(screen.getByText('Bem-vindo como convidado de Parceiro X!')).toBeInTheDocument();
      expect(screen.getByText(/39,90/)).toBeInTheDocument();
    });
  });

  it('redirects when invite is invalid', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as any;
    render(<PublicSubscribePage />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/assinar?alert=convite_invalido');
    });
  });
});
