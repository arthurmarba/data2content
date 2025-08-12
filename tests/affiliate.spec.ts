describe('Afiliados + Stripe', () => {
  it('aplica 10% na primeira fatura sem cupom manual', async () => {/* ... */});
  it('não acumula cupom manual com afiliado', async () => {/* ... */});
  it('paga 10% do subtotal via Connect quando moeda compatível', async () => {/* ... */});
  it('mantém held no ledger quando moeda não compatível', async () => {/* ... */});
  it('clawback se refund em até 7 dias', async () => {/* ... */});
  it('bloqueia self-referral', async () => {/* ... */});
  it('upgrade/downgrade não gera nova comissão', async () => {/* ... */});
});
