import { STRIPE_STATUS, STRIPE_DISABLED_REASON, CURRENCY_HELP } from '../stripe';

describe('stripe copy', () => {
  it('matches snapshot', () => {
    expect({ STRIPE_STATUS, STRIPE_DISABLED_REASON, CURRENCY_HELP }).toMatchSnapshot();
  });
});
