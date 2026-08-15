import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DeleteAccountSection from './DeleteAccountSection';
import { useSession, signOut } from 'next-auth/react';

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('react-hot-toast', () => ({ success: jest.fn(), error: jest.fn() }));

describe('DeleteAccountSection', () => {
  const mockUseSession = useSession as jest.Mock;
  const mockSignOut = signOut as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false }),
    }) as any;
  });

  it('shows blocked modal when plan active', async () => {
    mockUseSession.mockReturnValue({ data: { user: { planStatus: 'active', affiliateBalances: {} } } });
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    expect(await screen.findByRole('dialog', { name: 'Ação necessária' })).toBeInTheDocument();
    expect(screen.getByText(/primeiro cancele sua assinatura/i)).toBeInTheDocument();
  });

  it('allows deletion when plan inactive after typing EXCLUIR', async () => {
    mockUseSession.mockReturnValue({ data: { user: { planStatus: 'inactive', affiliateBalances: {} } } });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: false }) }) as any;
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir minha conta' }));
    expect(await screen.findByRole('dialog', { name: 'Tem certeza?' })).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Digite "EXCLUIR"');
    const button = screen.getByText('Excluir permanentemente') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'EXCLUIR' } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith('/api/account/delete', { method: 'DELETE' }));
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
