export interface BillingService {
  updateSubscription(userId: string): Promise<void>;
}

const billingService: BillingService = {
  async updateSubscription(userId: string): Promise<void> {
    // Placeholder: integrate with billing provider
    void userId;
  },
};

export default billingService;
