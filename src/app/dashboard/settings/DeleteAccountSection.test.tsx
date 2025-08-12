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
  });

  it('shows blocked modal when plan active', async () => {
    mockUseSession.mockReturnValue({ data: { user: { planStatus: 'active', affiliateBalances: {} } } });
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getAllByText('Excluir conta')[1]);
    expect(await screen.findByText('Você precisa cancelar sua assinatura primeiro')).toBeInTheDocument();
  });

  it('allows deletion when plan inactive after typing EXCLUIR', async () => {
    mockUseSession.mockReturnValue({ data: { user: { planStatus: 'inactive', affiliateBalances: {} } } });
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }) as any;
    render(<DeleteAccountSection />);
    fireEvent.click(screen.getAllByText('Excluir conta')[1]);
    expect(await screen.findByText('Excluir conta — ação permanente')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('Digite EXCLUIR');
    const button = screen.getByText('Excluir definitivamente') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'EXCLUIR' } });
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled());
  });
});
