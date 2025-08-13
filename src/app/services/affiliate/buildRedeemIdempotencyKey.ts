export function buildRedeemIdempotencyKey(
  userId: string,
  amountCents: number,
  date: Date = new Date()
): string {
  const yyyymmdd = date.toISOString().slice(0,10).replace(/-/g, "");
  return `redeem_${userId}_${amountCents}_${yyyymmdd}`;
}
