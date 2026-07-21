/** @jest-environment node */
jest.mock('@/app/lib/stripe', () => ({
  stripe: { webhooks: { constructEvent: jest.fn() } },
}));
jest.mock('@/server/stripe/handle-stripe-connect-event', () => ({
  handleStripeConnectEvent: jest.fn(),
}));

import { stripe } from '@/app/lib/stripe';
import { handleStripeConnectEvent } from '@/server/stripe/handle-stripe-connect-event';
import { POST } from './route';

describe('Stripe Connect webhook route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET = 'whsec_test';
    (stripe.webhooks.constructEvent as jest.Mock).mockReturnValue({
      id: 'evt_1',
      type: 'transfer.reversed',
      data: { object: {} },
    });
  });

  it('returns 500 so Stripe retries a transient processing failure', async () => {
    (handleStripeConnectEvent as jest.Mock).mockRejectedValue(new Error('mongo unavailable'));
    const response = await POST(new Request('http://localhost/api/stripe/connect-webhook', {
      method: 'POST',
      body: '{}',
      headers: { 'stripe-signature': 'sig_test' },
    }));

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ received: false, error: 'processing-error' });
  });
});
