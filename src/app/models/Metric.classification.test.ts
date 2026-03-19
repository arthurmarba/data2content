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
    });

    await expect(metric.validate()).resolves.toBeUndefined();
    expect(metric.format).toEqual(["reel"]);
    expect(metric.proposal).toEqual(["call_to_action"]);
    expect(metric.context).toEqual(["fashion_style"]);
    expect(metric.tone).toEqual(["promotional"]);
    expect(metric.references).toEqual(["city"]);
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
});
