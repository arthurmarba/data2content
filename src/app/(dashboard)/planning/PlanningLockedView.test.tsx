/**
 * Verifies that PlanningLockedView hydrates without mismatches to catch regressions.
 */
import React from "react";
import ReactDOMServer from "react-dom/server";
import { hydrateRoot } from "react-dom/client";

import PlanningLockedView from "./PlanningLockedView";

describe("PlanningLockedView hydration", () => {
  it("hydrates without throwing", () => {
    const markup = ReactDOMServer.renderToString(<PlanningLockedView />);
    document.body.innerHTML = `<div id="root">${markup}</div>`;

    expect(() =>
      hydrateRoot(document.getElementById("root") as HTMLElement, <PlanningLockedView />)
    ).not.toThrow();
  });
});
