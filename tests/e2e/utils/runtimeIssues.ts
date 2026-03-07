import type { ConsoleMessage, Page, Request, Response } from "@playwright/test";

export type RuntimeIssue = {
  kind: "console" | "pageerror" | "requestfailed" | "response";
  message: string;
  url?: string;
};

function normalizeBaseOrigin() {
  const configured = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3101";
  return new URL(configured).origin;
}

function isSameAppUrl(url: string, baseOrigin: string) {
  try {
    return new URL(url).origin === baseOrigin;
  } catch {
    return false;
  }
}

function shouldIgnoreUrl(url: string) {
  return (
    url.includes("/analytics/") ||
    url.includes("/_vercel/") ||
    url.includes("googletagmanager") ||
    url.includes("google-analytics") ||
    url.includes("sentry") ||
    url.includes("hotjar")
  );
}

function shouldIgnoreConsoleMessage(message: ConsoleMessage, baseOrigin: string) {
  const text = message.text();
  const locationUrl = message.location().url || "";
  if (!text) return true;
  if (text === "null") return true;
  if (text.includes("Failed to load resource") && text.includes("404")) {
    if (locationUrl.includes("/_next/static/")) return true;
  }
  if (locationUrl && !isSameAppUrl(locationUrl, baseOrigin) && shouldIgnoreUrl(locationUrl)) {
    return true;
  }
  return false;
}

function buildRequestFailedMessage(request: Request) {
  const failure = request.failure();
  return `${request.method()} ${request.url()}${failure?.errorText ? ` :: ${failure.errorText}` : ""}`;
}

function shouldIgnoreRequestFailure(request: Request) {
  const failure = request.failure();
  const errorText = failure?.errorText ?? "";
  if (errorText.includes("ERR_ABORTED")) return true;
  return false;
}

function buildResponseMessage(response: Response) {
  return `${response.status()} ${response.request().method()} ${response.url()}`;
}

export function attachRuntimeIssueCollector(page: Page) {
  const baseOrigin = normalizeBaseOrigin();
  const issues: RuntimeIssue[] = [];

  page.on("pageerror", (error) => {
    issues.push({
      kind: "pageerror",
      message: error.message,
    });
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (shouldIgnoreConsoleMessage(message, baseOrigin)) return;
    issues.push({
      kind: "console",
      message: message.text(),
      url: message.location().url || undefined,
    });
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (!isSameAppUrl(url, baseOrigin) || shouldIgnoreUrl(url)) return;
    if (shouldIgnoreRequestFailure(request)) return;
    issues.push({
      kind: "requestfailed",
      message: buildRequestFailedMessage(request),
      url,
    });
  });

  page.on("response", (response) => {
    const url = response.url();
    if (!isSameAppUrl(url, baseOrigin) || shouldIgnoreUrl(url)) return;
    if (response.status() < 500) return;
    issues.push({
      kind: "response",
      message: buildResponseMessage(response),
      url,
    });
  });

  return {
    takeSnapshot() {
      return [...issues];
    },
    clear() {
      issues.length = 0;
    },
  };
}
