export type VariantBucket = "context_weak" | "beginner" | "direct";

type RolloutConfig = {
  experimentId: string;
  weights: Partial<Record<VariantBucket, Array<{ variant: "A" | "B" | "C"; pct: number }>>>;
};

export const experimentConfig: RolloutConfig = {
  experimentId: "exp_prompt_variants_v1",
  weights: {
    context_weak: [
      { variant: "C", pct: 80 },
      { variant: "B", pct: 20 },
    ],
    beginner: [
      { variant: "B", pct: 70 },
      { variant: "A", pct: 30 },
    ],
    direct: [
      { variant: "A", pct: 60 },
      { variant: "B", pct: 20 },
      { variant: "C", pct: 20 },
    ],
  },
};

export function chooseVariantFromRollout(bucket: VariantBucket): { variant: "A" | "B" | "C"; experimentId: string } {
  const { weights, experimentId } = experimentConfig;
  const bucketWeights = weights[bucket];
  if (!bucketWeights || !bucketWeights.length) return { variant: "A", experimentId };
  const total = bucketWeights.reduce((acc, item) => acc + item.pct, 0);
  const rnd = Math.random() * total;
  let acc = 0;
  for (const item of bucketWeights) {
    acc += item.pct;
    if (rnd <= acc) return { variant: item.variant, experimentId };
  }
  const fallbackVariant = bucketWeights[0]?.variant || "A";
  return { variant: fallbackVariant, experimentId };
}
