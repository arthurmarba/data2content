import { Types } from "mongoose";

import MetricModel from "@/app/models/Metric";

describe("Metric classification validation", () => {
  const buildMetric = (overrides: Record<string, unknown> = {}) =>
    new MetricModel({
      user: new Types.ObjectId(),
      postDate: new Date("2026-03-18T00:00:00.000Z"),
      ...overrides,
    });

  it("canonicalizes known classification values before save validation", async () => {
    const metric = buildMetric({
      format: ["Reel"],
      proposal: ["Chamada"],
      context: ["Moda/Estilo"],
      tone: ["promotional (Promocional/Comercial)"],
      references: ["geography", "geography.city"],
      contentIntent: ["Ensinar"],
      narrativeForm: ["Rotina/Vlog"],
      contentSignals: ["Patrocinado/Publi"],
      stance: ["Critico"],
      proofStyle: ["Antes e Depois"],
      commercialMode: ["Parceria Paga"],
      entityTargets: [{ type: "brand", label: "Marca X", canonicalId: "marca_x" }],
      classificationMeta: {
        confidence: { contentIntent: 0.9, proofStyle: 0.7 },
        evidence: { contentIntent: ["Trecho 1"] },
        primary: "contentIntent",
      },
    });

    await expect(metric.validate()).resolves.toBeUndefined();
    expect(metric.format).toEqual(["reel"]);
    expect(metric.proposal).toEqual([]);
    expect(metric.context).toEqual(["fashion_style"]);
    expect(metric.tone).toEqual(["promotional"]);
    expect(metric.references).toEqual(["city"]);
    expect(metric.contentIntent).toEqual(["teach"]);
    expect(metric.narrativeForm).toEqual(["day_in_the_life"]);
    expect(metric.contentSignals).toEqual(["sponsored"]);
    expect(metric.stance).toEqual(["critical"]);
    expect(metric.proofStyle).toEqual(["before_after"]);
    expect(metric.commercialMode).toEqual(["paid_partnership"]);
    expect(
      metric.entityTargets?.map(({ type, label, canonicalId }) => ({
        type,
        label,
        canonicalId,
      }))
    ).toEqual([{ type: "brand", label: "Marca X", canonicalId: "marca_x" }]);
    expect(metric.classificationMeta).toEqual({
      confidence: { contentIntent: 0.9, proofStyle: 0.7 },
      evidence: { contentIntent: ["Trecho 1"] },
      primary: "contentIntent",
    });
  });

  it("rejects unknown classification values in canonical fields", async () => {
    const metric = buildMetric({
      format: ["announcement"],
    });

    await expect(metric.validate()).rejects.toMatchObject({
      errors: {
        format: expect.objectContaining({
          message: expect.stringContaining("Unknown classification values for format"),
        }),
      },
    });
  });

  it("rejects unknown values in V2 classification fields", async () => {
    const metric = buildMetric({
      contentIntent: ["sem_categoria_v2"],
      stance: ["sem_categoria_v25"],
    });

    await expect(metric.validate()).rejects.toMatchObject({
      errors: {
        contentIntent: expect.objectContaining({
          message: expect.stringContaining("Unknown classification values for contentIntent"),
        }),
        stance: expect.objectContaining({
          message: expect.stringContaining("Unknown classification values for stance"),
        }),
      },
    });
  });
});
