/** @jest-environment node */

import {
  evaluateMcpToolPlan,
  MCP_ADMIN_QUALITY_EVAL_CASES,
  MCP_QUALITY_EVAL_CASES,
} from "./qualityEvals";

describe("MCP cross-client quality gates", () => {
  it.each(MCP_QUALITY_EVAL_CASES.flatMap((evalCase) =>
    evalCase.clients.map((client) => ({ evalCase, client })),
  ))("accepts the canonical $client plan for $evalCase.id", ({ evalCase }) => {
    const calls = evalCase.requiredTools.map((name) => ({
      name,
      afterExplicitUserConfirmation: name === "save_script",
    }));
    expect(evaluateMcpToolPlan(evalCase, calls)).toEqual({ passed: true, violations: [] });
  });

  it.each(MCP_ADMIN_QUALITY_EVAL_CASES.flatMap((evalCase) =>
    evalCase.clients.map((client) => ({ evalCase, client })),
  ))("accepts the canonical admin $client plan for $evalCase.id", ({ evalCase }) => {
    const calls = evalCase.requiredTools.map((name) => ({ name }));
    expect(evaluateMcpToolPlan(evalCase, calls)).toEqual({ passed: true, violations: [] });
  });

  it("rejects the historical error of estimating a period from top-content samples", () => {
    const evalCase = MCP_QUALITY_EVAL_CASES.find((item) => item.id === "exact_last_week_count")!;
    const result = evaluateMcpToolPlan(evalCase, [{ name: "list_top_content" }]);
    expect(result.passed).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      "missing_required_tool:analyze_creator_period",
      "forbidden_tool:list_top_content",
      "period_answer_without_exact_inventory",
    ]));
  });

  it("rejects saving a script without explicit user confirmation", () => {
    const evalCase = MCP_QUALITY_EVAL_CASES.find((item) => item.id === "confirmed_script_save")!;
    const result = evaluateMcpToolPlan(evalCase, [{ name: "save_script" }]);
    expect(result).toEqual({
      passed: false,
      violations: ["save_without_explicit_confirmation"],
    });
  });

  it("rejects administrative analysis before creator resolution", () => {
    const evalCase = MCP_ADMIN_QUALITY_EVAL_CASES.find(
      (item) => item.id === "admin_analyze_creator_30_days",
    )!;
    const result = evaluateMcpToolPlan(evalCase, [
      { name: "analyze_creator_period" },
      { name: "search" },
      { name: "fetch" },
    ]);
    expect(result.passed).toBe(false);
    expect(result.violations).toContain("admin_creator_not_resolved_before_analysis");
  });
});
