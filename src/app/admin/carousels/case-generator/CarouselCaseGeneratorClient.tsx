"use client";

import React, { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import dynamic from "next/dynamic";
import NextImage from "next/image";
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  PhotoIcon,
  PresentationChartBarIcon,
  SparklesIcon,
  VideoCameraIcon,
} from "@heroicons/react/24/outline";

import type {
  CarouselCaseDeck,
  CarouselCaseDraftSummary,
  CarouselCaseObjective,
  CarouselCasePeriod,
  CarouselCaseSlide,
  CarouselCaseSource,
  CarouselCaseFeaturedPost,
  CarouselCaseSourceInsight,
  CarouselCaseVisualPreset,
} from "@/types/admin/carouselCase";

const CreatorQuickSearch = dynamic(
  () => import("@/app/admin/creator-dashboard/components/CreatorQuickSearch"),
  { ssr: false },
);

type AdminTargetUser = {
  id: string;
  name: string;
  profilePictureUrl?: string | null;
};

type ExportRenderMode = "auto" | "foreign-object-only";
type ExportRendererUsed = "playwright-screenshot" | "foreign-object" | "canvas-fallback";
type ExportDownloadResult = {
  url: string;
  rendererUsed: ExportRendererUsed;
  cleanup?: () => void;
};
type ExportVideoDownloadResult = {
  url: string;
  cleanup?: () => void;
};

const PERIOD_OPTIONS: Array<{ value: CarouselCasePeriod; label: string }> = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
];

const OBJECTIVE_OPTIONS: Array<{ value: CarouselCaseObjective; label: string }> = [
  { value: "engagement", label: "Engajamento" },
  { value: "reach", label: "Alcance" },
  { value: "leads", label: "Intenção de lead" },
];

const VISUAL_PRESET_OPTIONS: Array<{
  value: CarouselCaseVisualPreset;
  label: string;
  description: string;
}> = [
  { value: "signature", label: "Signature", description: "Equilíbrio padrão da D2C com glow e contraste limpo." },
  { value: "spotlight", label: "Spotlight", description: "Mais palco para creator e hero visual mais dramático." },
  { value: "editorial", label: "Editorial", description: "Mais sóbrio, mais gráfico e com leitura de revista." },
];

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function splitBullets(value?: string) {
  return (value || "")
    .split("•")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatSlideFilename(baseName: string, index: number) {
  return formatSlideAssetFilename(baseName, index, "png");
}

function formatSlideVideoFilename(baseName: string, index: number) {
  return formatSlideAssetFilename(baseName, index, "mp4");
}

function formatSlideAssetFilename(baseName: string, index: number, extension: "png" | "webm" | "mp4") {
  const slug = baseName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${slug || "carrossel-case"}-slide-${String(index + 1).padStart(2, "0")}.${extension}`;
}

const EXPORT_TARGET_WIDTH = 1080;
const EXPORT_TARGET_HEIGHT = 1440;
const VIDEO_EXPORT_TARGET_WIDTH = 1200;
const VIDEO_EXPORT_TARGET_HEIGHT = 1600;
const COVER_SLIDE_VIDEO_EXPORT_MS = 5_000;
const NARRATIVE_VIDEO_EXPORT_MIN_MS = 7_000;
const NARRATIVE_VIDEO_EXPORT_MAX_MS = 15_000;
const NARRATIVE_VIDEO_EXPORT_FALLBACK_MS = 8_000;
const EDITORIAL_ANIMATED_SLIDE_EXPORT_MS = 6_500;
const EXPORT_SAFE_SANS_STACK = 'Poppins, "Helvetica Neue", Arial, sans-serif';
const EXPORT_SAFE_SERIF_STACK = 'Georgia, "Times New Roman", Times, serif';
const APPLE_BENTO_SANS_STACK = 'Inter, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';
const EXPORT_TEXT_SELECTOR = "p, h1, h2, h3, h4, h5, h6, span, li, button, em, strong, div[data-export-text]";
// Preview is the single source of truth for the narrative slide layout.
// The export path must reuse these exact metrics instead of maintaining a second set.
const NARRATIVE_EDITORIAL_PALETTE = {
  title: "#0F172A",
  eyebrow: "#FF2C7E",
  label: "#0F172A",
  facts: "#475569",
  metricAccent: "#FF2C7E",
  metricMuted: "#6B7280",
  consistency: "#94A3B8",
  topicAccentPrimary: "#FF2C7E",
  topicAccentSecondary: "#246BFD",
  cardOuter: "rgba(255,255,255,0.98)",
  cardInner: "#F8FAFC",
  cardSpeaker: "#D6DAE3",
  cardOverlayGradient:
    "linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,44,126,0.10) 58%, rgba(36,107,253,0.06) 100%)",
  cardOverlayTint: "rgba(255,44,126,0.035)",
} as const;
const EDITORIAL_SLIDE_TYPOGRAPHY = {
  format: {
    headingMaxWidth: "10rem",
    headingFontSize: "20.8px",
    headingLetterSpacing: "2.28px",
    headingLineHeight: 0.86,
    indexFontSize: "8.32px",
    labelFontSize: "7.68px",
    labelLetterSpacing: "1.08px",
    bodyTitleFontSize: "17.92px",
    bodyTitleLetterSpacing: "-0.46px",
    bodyTitleLineHeight: 1.08,
  },
  timing: {
    headingMaxWidth: "9.6rem",
    headingFontSize: "20.16px",
    headingLetterSpacing: "2.22px",
    headingLineHeight: 0.86,
    labelFontSize: "7.68px",
    labelLetterSpacing: "1.08px",
    secondaryFontSize: "10.88px",
    secondaryLineHeight: 1.18,
    metricFontSize: "7.68px",
  },
  recommendation: {
    headingMaxWidth: "10.2rem",
    headingFontSize: "20.48px",
    headingLetterSpacing: "2.24px",
    headingLineHeight: 0.86,
    indexFontSize: "8.32px",
    metaFontSize: "7.36px",
    metaLetterSpacing: "1px",
    bodyTitleFontSize: "16.72px",
    bodyTitleLetterSpacing: "-0.4px",
    bodyTitleLineHeight: 1.1,
  },
  cta: {
    headingMaxWidth: "10rem",
    headingFontSize: "21.44px",
    headingLetterSpacing: "2.28px",
    headingLineHeight: 0.85,
    supportFontSize: "13.12px",
    supportLineHeight: 1.5,
    labelFontSize: "7.68px",
    labelLetterSpacing: "1.08px",
    priceFontSize: "26.24px",
    priceLetterSpacing: "-0.07em",
    priceLineHeight: 0.94,
    footerSerifFontSize: "11.2px",
    footerSerifLineHeight: 1.34,
  },
} as const;
const EDITORIAL_BENTO_PANEL_BASE_CLASS =
  "relative overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/70 shadow-[rgba(0,0,0,0.04)_0px_8px_32px_0px] ring-1 ring-inset ring-white/50 backdrop-blur-xl";

function getExportSafeNarrativeBackgroundMarkup() {
  return `
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,#FFFFFF 0%,#F8FAFC 54%,#FFFFFF 100%);"></div>
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 18% 18%,rgba(255,44,126,0.11) 0%,rgba(255,44,126,0) 28%),radial-gradient(circle at 84% 14%,rgba(36,107,253,0.09) 0%,rgba(36,107,253,0) 30%);"></div>
    <div style="position:absolute;left:-8%;top:-6%;width:58%;height:32%;border-radius:9999px;background:radial-gradient(circle at 50% 50%,rgba(255,255,255,0.92) 0%,rgba(255,255,255,0.34) 44%,rgba(255,255,255,0) 100%);opacity:0.92;"></div>
    <div style="position:absolute;left:-10%;top:22%;width:42%;height:28%;border-radius:9999px;background:radial-gradient(circle at 50% 50%,rgba(255,44,126,0.10) 0%,rgba(255,44,126,0.04) 36%,rgba(255,44,126,0) 100%);opacity:0.72;"></div>
    <div style="position:absolute;right:-10%;top:4%;width:48%;height:30%;border-radius:9999px;background:radial-gradient(circle at 50% 50%,rgba(36,107,253,0.12) 0%,rgba(36,107,253,0.06) 34%,rgba(36,107,253,0) 100%);opacity:0.78;"></div>
    <div style="position:absolute;right:2%;bottom:12%;width:42%;height:30%;border-radius:9999px;background:radial-gradient(circle at 50% 50%,rgba(36,107,253,0.07) 0%,rgba(36,107,253,0.03) 36%,rgba(36,107,253,0) 100%);opacity:0.58;"></div>
    <div style="position:absolute;left:-6%;bottom:8%;width:34%;height:24%;border-radius:9999px;background:radial-gradient(circle at 50% 50%,rgba(255,44,126,0.07) 0%,rgba(255,44,126,0.025) 42%,rgba(255,44,126,0) 100%);opacity:0.54;"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0.05) 100%);"></div>
    <div style="position:absolute;inset:0;opacity:0.028;background-image:radial-gradient(rgba(71,85,105,0.34) 0.52px,transparent 0.72px),radial-gradient(rgba(255,255,255,0.42) 0.38px,transparent 0.64px);background-position:0 0,3px 3px;background-size:8px 8px;"></div>
  `;
}

function getExportImageScale(size?: string | null) {
  const normalized = String(size || "").trim().toLowerCase();
  if (!normalized || normalized === "cover" || normalized === "contain") return null;

  const parts = normalized.split(/\s+/).filter(Boolean);
  const parsePart = (part?: string) => {
    if (!part || part === "auto") return null;
    if (part.endsWith("%")) {
      const numeric = Number.parseFloat(part.slice(0, -1));
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric / 100;
      }
    }
    return null;
  };

  const x = parsePart(parts[0]);
  const y = parsePart(parts[1]) ?? x;

  if (!x && !y) return null;

  return {
    x: x ?? 1,
    y: y ?? 1,
  };
}

function toAbsoluteExportUrl(value?: string | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    return new URL(raw, window.location.href).toString();
  } catch {
    return raw;
  }
}

function copyComputedStylesToTarget(source: Element, target: Element) {
  const computed = window.getComputedStyle(source);
  const styledTarget = target as Element & { style?: CSSStyleDeclaration };

  if (styledTarget.style) {
    for (const propertyName of Array.from(computed)) {
      styledTarget.style.setProperty(
        propertyName,
        computed.getPropertyValue(propertyName),
        computed.getPropertyPriority(propertyName),
      );
    }
  }

  return computed;
}

async function waitForNodeImages(node: HTMLElement) {
  const images = Array.from(node.querySelectorAll("img"));

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          const finalize = () => resolve();
          if (image.complete && image.naturalWidth > 0) {
            if (typeof image.decode === "function") {
              image.decode().catch(() => null).finally(finalize);
              return;
            }
            finalize();
            return;
          }

          image.addEventListener("load", finalize, { once: true });
          image.addEventListener("error", finalize, { once: true });
        }),
    ),
  );
}

function getExportCounterMarkup() {
  return `<style>
      [data-export-title] {
        opacity: 0;
        filter: blur(10px);
        transform: translateY(22px) scale(0.95);
        transform-origin: left bottom;
        will-change: transform, opacity, filter;
      }

      [data-export-title-done="true"] {
        opacity: 1;
        filter: blur(0);
        transform: translateY(0) scale(1);
      }

      [data-export-counter-active="true"] {
        animation: export-counter-pop 560ms cubic-bezier(0.22, 1, 0.36, 1);
        transform-origin: left center;
        will-change: transform, opacity, filter;
      }

      [data-export-bar] {
        transform-origin: left center;
        will-change: width, opacity, transform, filter;
      }

      [data-export-bar-active="true"] {
        animation: export-bar-pop 640ms cubic-bezier(0.22, 1, 0.36, 1);
      }

      @keyframes export-counter-pop {
        0% {
          opacity: 0.56;
          filter: blur(1.4px);
          transform: translateY(7px) scale(0.92);
        }
        52% {
          opacity: 1;
          filter: blur(0);
          transform: translateY(0) scale(1.05);
        }
        100% {
          opacity: 1;
          filter: blur(0);
          transform: translateY(0) scale(1);
        }
      }

      @keyframes export-bar-pop {
        0% {
          opacity: 0.52;
          filter: blur(1px);
          transform: scaleX(0.82) translateY(1px);
        }
        58% {
          opacity: 1;
          filter: blur(0);
          transform: scaleX(1.03) translateY(0);
        }
        100% {
          opacity: 1;
          filter: blur(0);
          transform: scaleX(1) translateY(0);
        }
      }
    </style>
    <script>
      (() => {
        const getTitles = () => Array.from(document.querySelectorAll("[data-export-title]"));
        const getElements = () => Array.from(document.querySelectorAll("[data-export-counter-target]"));
        const getBars = () => Array.from(document.querySelectorAll("[data-export-bar-target-width]"));

        const formatCounterValue = (element, rawValue) => {
          const divisor = Number(element.dataset.exportCounterDivisor || "1");
          const decimals = Number(element.dataset.exportCounterDecimals || "0");
          const suffix = element.dataset.exportCounterSuffix || "";
          const scaledValue = rawValue / (Number.isFinite(divisor) && divisor > 0 ? divisor : 1);
          const formatted = new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          }).format(scaledValue);
          return \`\${formatted}\${suffix}\`;
        };

        const prepareTitles = () => {
          const titles = getTitles();
          titles.forEach((title) => {
            title.dataset.exportTitleActive = "false";
            title.dataset.exportTitleDone = "false";
            title.dataset.exportTitleState = "ready";
            title.style.opacity = "0";
            title.style.filter = "blur(10px)";
            title.style.transform = "translateY(22px) scale(0.95)";
          });
        };

        const prepareCounters = () => {
          const elements = getElements();
          elements.forEach((element) => {
            const target = Number(element.dataset.exportCounterTarget || "");
            if (!Number.isFinite(target)) return;
            element.textContent = formatCounterValue(element, 0);
            element.dataset.exportCounterState = "ready";
          });
        };

        const prepareBars = () => {
          const bars = getBars();
          bars.forEach((bar) => {
            bar.dataset.exportBar = "true";
            bar.style.width = "0%";
            bar.dataset.exportBarState = "ready";
          });
        };

        const startCounters = () => {
          if (window.__d2cCountersStarted) return;
          window.__d2cCountersStarted = true;
          prepareTitles();
          prepareCounters();
          prepareBars();

          const titles = getTitles();
          const elements = getElements();
          const bars = getBars();
          if (!titles.length && !elements.length && !bars.length) return;

          const startedAt = performance.now();
          const step = (now) => {
            let keepRunning = false;

            titles.forEach((title) => {
              const delay = Number(title.dataset.exportTitleDelay || "0");
              const duration = Number(title.dataset.exportTitleDuration || "920");
              const elapsed = now - startedAt - delay;

              if (elapsed < 0) {
                keepRunning = true;
                return;
              }

              const progress = Math.min(elapsed / Math.max(duration, 1), 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const scalePop = Math.sin(progress * Math.PI) * 0.018;
              const translateY = (1 - eased) * 22;
              const blur = (1 - eased) * 10;
              const opacity = Math.min(1, 0.12 + eased * 0.88);
              const scale = 0.95 + eased * 0.05 + scalePop;

              title.dataset.exportTitleActive = progress > 0 && progress < 1 ? "true" : "false";
              title.style.opacity = opacity.toFixed(3);
              title.style.filter = "blur(" + blur.toFixed(2) + "px)";
              title.style.transform =
                "translateY(" + translateY.toFixed(2) + "px) scale(" + scale.toFixed(4) + ")";

              if (progress < 1) {
                keepRunning = true;
                return;
              }

              title.dataset.exportTitleDone = "true";
              title.style.opacity = "1";
              title.style.filter = "blur(0)";
              title.style.transform = "translateY(0) scale(1)";
            });

            elements.forEach((element) => {
              const target = Number(element.dataset.exportCounterTarget || "");
              if (!Number.isFinite(target)) return;

              const delay = Number(element.dataset.exportCounterDelay || "0");
              const duration = Number(element.dataset.exportCounterDuration || "1400");
              const elapsed = now - startedAt - delay;

              if (elapsed < 0) {
                keepRunning = true;
                return;
              }

              const progress = Math.min(elapsed / Math.max(duration, 1), 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              element.textContent = formatCounterValue(element, target * eased);

              if (progress > 0 && progress < 1) {
                element.dataset.exportCounterActive = "true";
                keepRunning = true;
              } else if (progress >= 1) {
                element.textContent = formatCounterValue(element, target);
                element.dataset.exportCounterActive = "false";
              } else {
                keepRunning = true;
              }
            });

            bars.forEach((bar) => {
              const targetWidth = Number(bar.dataset.exportBarTargetWidth || "0");
              const delay = Number(bar.dataset.exportBarDelay || "0");
              const duration = Number(bar.dataset.exportBarDuration || "1200");
              const elapsed = now - startedAt - delay;

              if (elapsed < 0) {
                keepRunning = true;
                return;
              }

              const progress = Math.min(elapsed / Math.max(duration, 1), 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const width = Math.max(0, Math.min(100, targetWidth * eased));
              bar.style.width = width + "%";

              if (progress > 0 && progress < 1) {
                bar.dataset.exportBarActive = "true";
                keepRunning = true;
              } else if (progress >= 1) {
                bar.style.width = targetWidth + "%";
                bar.dataset.exportBarActive = "false";
              } else {
                keepRunning = true;
              }
            });

            if (keepRunning) {
              window.requestAnimationFrame(step);
            }
          };

          window.requestAnimationFrame(step);
        };

        window.__d2cStartCounters = startCounters;

        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => {
            prepareTitles();
            prepareCounters();
          }, { once: true });
        } else {
          prepareTitles();
          prepareCounters();
        }
      })();
    </script>`;
}

function buildServerExportHtml(
  node: HTMLDivElement,
  targetWidth: number = EXPORT_TARGET_WIDTH,
  targetHeight: number = EXPORT_TARGET_HEIGHT,
  options?: {
    animateCounters?: boolean;
  },
) {
  const rect = node.getBoundingClientRect();
  const nodeWidth = Math.max(rect.width, 1);
  const nodeHeight = Math.max(rect.height, 1);
  const clonedNode = node.cloneNode(true) as HTMLDivElement;
  const liveElements = [node, ...Array.from(node.querySelectorAll("*"))];
  const clonedElements = [clonedNode, ...Array.from(clonedNode.querySelectorAll("*"))];
  const scaleX = targetWidth / nodeWidth;
  const scaleY = targetHeight / nodeHeight;

  clonedNode.style.width = `${nodeWidth}px`;
  clonedNode.style.minWidth = `${nodeWidth}px`;
  clonedNode.style.maxWidth = `${nodeWidth}px`;
  clonedNode.style.height = `${nodeHeight}px`;
  clonedNode.style.minHeight = `${nodeHeight}px`;
  clonedNode.style.maxHeight = `${nodeHeight}px`;
  clonedNode.style.margin = "0";

  clonedElements.forEach((element, index) => {
    const liveElement = liveElements[index];
    if (!(liveElement instanceof Element) || !(element instanceof Element)) return;

    const computed = copyComputedStylesToTarget(liveElement, element);

    if (element instanceof HTMLElement && liveElement instanceof HTMLElement) {
      element.style.width = computed.width;
      element.style.minWidth = computed.minWidth;
      element.style.maxWidth = computed.maxWidth;
      element.style.height = computed.height;
      element.style.minHeight = computed.minHeight;
      element.style.maxHeight = computed.maxHeight;
    }

    if (element instanceof HTMLElement && element.dataset.exportBg !== undefined) {
      const absoluteSrc = toAbsoluteExportUrl(element.dataset.exportBg?.trim());
      if (absoluteSrc) {
        const wrapper = element.cloneNode(false) as HTMLElement;
        const image = document.createElement("img");
        image.src = absoluteSrc;
        image.alt = element.getAttribute("aria-label") || "";
        image.draggable = false;
        image.loading = "eager";
        image.decoding = "sync";
        image.style.position = "absolute";
        image.style.inset = "0";
        image.style.width = "100%";
        image.style.height = "100%";
        image.style.objectFit = "cover";
        image.style.objectPosition =
          element.dataset.exportBgPosition?.trim() || element.style.backgroundPosition || "50% 50%";
        image.style.transformOrigin = "center center";
        image.style.pointerEvents = "none";
        image.style.userSelect = "none";

        const scale = getExportImageScale(element.dataset.exportBgSize?.trim() || element.style.backgroundSize);
        if (scale) {
          image.style.transform = `scale(${scale.x}, ${scale.y})`;
        }

        wrapper.style.backgroundImage = "none";
        wrapper.style.backgroundColor = "transparent";
        wrapper.replaceChildren(image);
        element.replaceWith(wrapper);
        clonedElements[index] = wrapper;
      }
    }

    if (element instanceof HTMLImageElement && liveElement instanceof HTMLImageElement) {
      const absoluteSrc = toAbsoluteExportUrl(liveElement.currentSrc || liveElement.getAttribute("src"));
      if (absoluteSrc) {
        element.src = absoluteSrc;
      }
      element.loading = "eager";
      element.decoding = "sync";
    }

    if (element instanceof HTMLVideoElement && liveElement instanceof HTMLVideoElement) {
      const absoluteSrc = toAbsoluteExportUrl(liveElement.currentSrc || liveElement.getAttribute("src"));
      const absolutePoster = toAbsoluteExportUrl(
        liveElement.poster || liveElement.dataset.exportPoster?.trim() || liveElement.getAttribute("poster"),
      );

      if (absoluteSrc) {
        element.src = absoluteSrc;
      }
      if (absolutePoster) {
        element.poster = absolutePoster;
      }

      element.autoplay = true;
      element.controls = false;
      element.defaultMuted = true;
      element.loop = true;
      element.muted = true;
      element.playsInline = true;
      element.preload = "auto";
    }

    if (element instanceof HTMLElement && element.matches(EXPORT_TEXT_SELECTOR) && !element.style.fontFamily) {
      element.style.fontFamily = element.classList.contains("font-serif")
        ? EXPORT_SAFE_SERIF_STACK
        : EXPORT_SAFE_SANS_STACK;
    }
  });

  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=${targetWidth},initial-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: ${targetWidth}px;
        height: ${targetHeight}px;
        overflow: hidden;
        background: transparent;
      }

      body {
        -webkit-font-smoothing: antialiased;
        text-rendering: geometricPrecision;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }
    </style>
    ${options?.animateCounters ? getExportCounterMarkup() : ""}
  </head>
  <body>
    <div
      id="export-stage"
      style="width:${targetWidth}px;height:${targetHeight}px;overflow:hidden;"
    >
      <div
        style="width:${nodeWidth}px;height:${nodeHeight}px;transform-origin:top left;transform:scale(${scaleX}, ${scaleY});"
      >${clonedNode.outerHTML}</div>
    </div>
  </body>
</html>`;
}

function getStableTextStyle(
  kind: "sans" | "serif",
  overrides?: React.CSSProperties,
): React.CSSProperties {
  return {
    fontFamily: kind === "serif" ? EXPORT_SAFE_SERIF_STACK : EXPORT_SAFE_SANS_STACK,
    fontKerning: "none",
    fontVariantLigatures: "none",
    fontFeatureSettings: '"kern" 0, "liga" 0, "clig" 0, "calt" 0',
    textRendering: "geometricPrecision",
    ...overrides,
  };
}

function getCleanSansTextStyle(overrides?: React.CSSProperties): React.CSSProperties {
  return getStableTextStyle("sans", {
    fontFamily: APPLE_BENTO_SANS_STACK,
    ...overrides,
  });
}

function canvasLooksBlank(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return false;

  const width = canvas.width;
  const height = canvas.height;
  const stepX = Math.max(1, Math.floor(width / 36));
  const stepY = Math.max(1, Math.floor(height / 36));
  const sample = context.getImageData(0, 0, width, height).data;

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const offset = (y * width + x) * 4;
      if ((sample[offset + 3] || 0) > 8) {
        return false;
      }
    }
  }

  return true;
}

function splitSentences(value?: string) {
  return (value || "")
    .split(/(?<=[.?!])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function rankWidth(index: number) {
  return ["100%", "82%", "68%", "56%"][index] || "48%";
}

function clampText(value: string | undefined, maxLength: number) {
  const normalized = toWellFormedText(String(value || "").replace(/\s+/g, " ").trim());
  if (!normalized) return "";
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}

function clampTextPreservingLineBreaks(value: string | undefined, maxLength: number) {
  const normalized = toWellFormedText(String(value || "").trim())
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

  if (!normalized) return "";

  const compact = normalized.replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return normalized;

  return clampText(compact, maxLength);
}

function toWellFormedText(value: string) {
  const maybeWellFormed = (value as string & { toWellFormed?: () => string }).toWellFormed;
  return typeof maybeWellFormed === "function" ? maybeWellFormed.call(value) : value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toPreviewImageUrl(value?: string | null) {
  const raw = toWellFormedText(String(value || "").trim());
  if (!raw) return null;
  if (raw.startsWith("/api/proxy/thumbnail/")) return raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      return `/api/proxy/thumbnail/${encodeURIComponent(raw)}`;
    } catch {
      return null;
    }
  }
  return raw;
}

function toPreviewVideoUrl(value?: string | null) {
  const raw = toWellFormedText(String(value || "").trim());
  if (!raw) return null;
  if (raw.startsWith("/api/proxy/video/")) return raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      return `/api/proxy/video/${encodeURIComponent(raw)}`;
    } catch {
      return null;
    }
  }
  return raw;
}

function getExportCounterDescriptor(value?: number | null, finalLabel?: string | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return null;

  const label = String(finalLabel || "").trim();
  const normalized = label.toLowerCase();
  const numericPortion = label.replace(/[^\d,.-]/g, "");
  const decimalSeparatorMatch = numericPortion.match(/[,.](\d+)/);
  const hasThousandsSuffix = /\bmil\b/.test(normalized);
  const hasMillionsSuffix = /\bmi\b/.test(normalized) && !hasThousandsSuffix;

  return {
    target: value,
    divisor: hasThousandsSuffix ? 1_000 : hasMillionsSuffix ? 1_000_000 : 1,
    suffix: hasThousandsSuffix ? " mil" : hasMillionsSuffix ? " mi" : "",
    decimals: decimalSeparatorMatch?.[1]?.length ? decimalSeparatorMatch[1].length : 0,
  };
}

function getBackgroundPosition(post?: CarouselCaseFeaturedPost | null) {
  const hint = `${post?.formatLabel || ""} ${post?.contextLabel || ""} ${post?.title || ""}`.toLowerCase();
  if (hint.includes("story") || hint.includes("short")) return "center 22%";
  if (hint.includes("reel") || hint.includes("video")) return "center 18%";
  if (hint.includes("carrossel") || hint.includes("carousel")) return "center 12%";
  return "center 16%";
}

function getProofMediaStyle(post?: CarouselCaseFeaturedPost | null) {
  const hint = `${post?.formatLabel || ""} ${post?.contextLabel || ""} ${post?.title || ""}`.toLowerCase();

  if (hint.includes("story") || hint.includes("short")) {
    return { backgroundPosition: "center 18%", backgroundSize: "112%" };
  }

  if (hint.includes("reel") || hint.includes("video")) {
    return { backgroundPosition: "center 24%", backgroundSize: "114%" };
  }

  if (hint.includes("carrossel") || hint.includes("carousel")) {
    return { backgroundPosition: "center 10%", backgroundSize: "106%" };
  }

  return { backgroundPosition: "center 18%", backgroundSize: "110%" };
}

function splitTimingPointLabel(label?: string) {
  const normalized = String(label || "").trim();
  if (!normalized) return { primary: "", secondary: "" };

  const [first, ...rest] = normalized.split(/\s+/);
  return {
    primary: first,
    secondary: rest.join(" "),
  };
}

function getCoverPhotoPosition() {
  return "68% 12%";
}

function normalizeLooseText(value?: string) {
  return toWellFormedText(String(value || ""))
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function renderEditorialText(value?: string) {
  const normalized = toWellFormedText(String(value || "").trim());
  if (!normalized) return null;

  return normalized.split(/\n+/).map((line, lineIndex) => (
    <span key={`line-${lineIndex}`} className="block">
      {line
        .split(/(\*[^*]+\*)/g)
        .filter(Boolean)
        .map((fragment, fragmentIndex) =>
          fragment.startsWith("*") && fragment.endsWith("*") ? (
            <em key={`fragment-${lineIndex}-${fragmentIndex}`} className="font-normal italic">
              {fragment.slice(1, -1)}
            </em>
          ) : (
            <React.Fragment key={`fragment-${lineIndex}-${fragmentIndex}`}>
              {fragment}
            </React.Fragment>
          ),
        )}
    </span>
  ));
}

function CoverPaginationDots({
  activeIndex,
  total,
}: {
  activeIndex: number;
  total: number;
}) {
  const dots = Array.from({ length: Math.max(total, 1) });

  return (
    <div className="flex items-center gap-1.5">
      {dots.map((_, index) => (
        <span
          key={`cover-dot-${index}`}
          className={cx(
            "block h-1.5 rounded-full transition-all duration-200",
            index === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/[0.38]",
          )}
        />
      ))}
    </div>
  );
}

function CoverImage({
  src,
  alt,
  className,
  position,
  size = "cover",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  position?: string;
  size?: string;
}) {
  const resolvedSrc = toPreviewImageUrl(src);
  const resolvedAlt = toWellFormedText(alt);
  if (!resolvedSrc) return null;

  return (
    <div
      role="img"
      aria-label={resolvedAlt}
      data-export-bg={resolvedSrc}
      data-export-bg-position={position || ""}
      data-export-bg-size={size || ""}
      className={cx("absolute inset-0 block select-none", className)}
      style={{
        backgroundImage: `url("${resolvedSrc}")`,
        backgroundPosition: position,
        backgroundRepeat: "no-repeat",
        backgroundSize: size,
      }}
    />
  );
}

function getStandardizedSlideHeadline(slide: CarouselCaseSlide) {
  const normalized = normalizeLooseText(slide.headline);

  if (slide.id === "resonance") {
    if (
      !normalized ||
      normalized === "o que mais conecta" ||
      normalized === "o que mais gera conexao" ||
      normalized === "melhor narrativa" ||
      normalized === "melhores narrativas"
    ) {
      return "Melhores narrativas";
    }
  }

  if (slide.id === "execution") {
    if (
      !normalized ||
      normalized === "a embalagem que entrega" ||
      normalized === "a embalagem que mais gera resposta" ||
      normalized === "formato + duracao" ||
      normalized === "que engaja o seguidor"
    ) {
      return "QUE ENGAJA O\nSEGUIDOR";
    }
  }

  if (slide.id === "timing") {
    if (
      !normalized ||
      normalized === "melhores janelas" ||
      normalized === "as janelas que mais geram resposta" ||
      normalized === "que engaja o seguidor"
    ) {
      return "DIAS QUE GERAM ENGAJAMENTO NESSA NARRATIVA";
    }
  }

  return slide.headline;
}

function getPreviewHeadline(slide: CarouselCaseSlide) {
  const limits: Record<CarouselCaseSlide["type"], number> = {
    cover: 66,
    insight: 54,
    narrative: 52,
    format: 52,
    timing: 50,
    recommendation: 54,
    cta: 48,
  };

  return clampTextPreservingLineBreaks(getStandardizedSlideHeadline(slide), limits[slide.type]);
}

function getPreviewBody(slide: CarouselCaseSlide) {
  const limits: Record<CarouselCaseSlide["type"], number> = {
    cover: 54,
    insight: 92,
    narrative: 74,
    format: 74,
    timing: 72,
    recommendation: 88,
    cta: 86,
  };

  return clampText(slide.body, limits[slide.type]);
}

function formatHeroMetricValue(value?: number | null, fallback?: string | null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1_000_000) {
      const millions = value / 1_000_000;
      return `${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: millions >= 100 ? 0 : 1,
      }).format(millions)} mi`;
    }

    if (value >= 1_000) {
      const thousands = value / 1_000;
      return `${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: thousands >= 100 ? 0 : 1,
      }).format(thousands)} mil`;
    }

    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: 0,
    }).format(value);
  }

  return clampText(fallback || "", 12);
}

function getObjectiveVisualTheme(
  objective?: CarouselCaseObjective,
  visualPreset: CarouselCaseVisualPreset = "signature",
) {
  if (objective === "reach") {
    return {
      shellBg:
        visualPreset === "editorial"
          ? "bg-[linear-gradient(180deg,#090B12_0%,#0B1220_46%,#0A0F1C_100%)]"
          : "bg-[radial-gradient(circle_at_82%_18%,rgba(36,107,253,0.28),transparent_30%),radial-gradient(circle_at_18%_74%,rgba(255,179,71,0.16),transparent_34%),linear-gradient(180deg,#090B12_0%,#0B1220_46%,#0A0F1C_100%)]",
      accent: "blue" as const,
      badge: "Alcance",
    };
  }

  if (objective === "leads") {
    return {
      shellBg:
        visualPreset === "editorial"
          ? "bg-[linear-gradient(180deg,#090B12_0%,#15111A_48%,#0A0F1C_100%)]"
          : "bg-[radial-gradient(circle_at_18%_18%,rgba(255,179,71,0.22),transparent_28%),radial-gradient(circle_at_80%_20%,rgba(255,44,126,0.18),transparent_30%),linear-gradient(180deg,#090B12_0%,#15111A_48%,#0A0F1C_100%)]",
      accent: "sun" as const,
      badge: "Leads",
    };
  }

  return {
    shellBg:
      visualPreset === "editorial"
        ? "bg-[linear-gradient(180deg,#090B12_0%,#0E1321_44%,#0A0F1C_100%)]"
        : "bg-[radial-gradient(circle_at_18%_18%,rgba(255,44,126,0.22),transparent_34%),radial-gradient(circle_at_82%_16%,rgba(36,107,253,0.22),transparent_30%),linear-gradient(180deg,#090B12_0%,#0E1321_44%,#0A0F1C_100%)]",
    accent: "pink" as const,
    badge: "Engajamento",
  };
}

type SlideSurfaceTheme = {
  mode: "dark" | "light";
  shellBg: string;
  gridClass: string;
  frameClass: string;
  topMetaClass: string;
  topDividerClass: string;
  logoWrapClass: string;
  logoTextClass: string;
  textPrimaryClass: string;
  textSecondaryClass: string;
  textMutedClass: string;
  panelClass: string;
  panelStrongClass: string;
  subtlePanelClass: string;
  chipClass: string;
  footerTextClass: string;
  footerButtonClass: string;
  ghostClass: string;
  eyebrowClass: string;
  serifClass: string;
  rankIndexClass: string;
  rankTrackClass: string;
  chartClass: string;
  portraitFrameClass: string;
};

type SlideNarrativeMeta = {
  chapter: string;
  stageLabel: string;
  nextLabel: string | null;
};

function getSlideNarrativeMeta(
  slideType: CarouselCaseSlide["type"],
): SlideNarrativeMeta {
  switch (slideType) {
    case "cover":
      return { chapter: "Abertura", stageLabel: "análise de perfil", nextLabel: "ressonância" };
    case "insight":
      return { chapter: "Diagnóstico", stageLabel: "leitura central", nextLabel: "narrativas" };
    case "narrative":
      return { chapter: "Ressonância", stageLabel: "conteúdo vencedor", nextLabel: "execução" };
    case "format":
      return { chapter: "Execução", stageLabel: "formato + duração", nextLabel: "timing" };
    case "timing":
      return { chapter: "Timing", stageLabel: "janela ideal", nextLabel: "pautas" };
    case "recommendation":
      return { chapter: "Pautas", stageLabel: "ideias sugeridas", nextLabel: "convite" };
    case "cta":
      return { chapter: "Convite", stageLabel: "entrada na d2c", nextLabel: null };
    default:
      return { chapter: "Case", stageLabel: "editorial", nextLabel: null };
  }
}

function getSlideSurfaceTheme(
  objective?: CarouselCaseObjective,
  visualPreset: CarouselCaseVisualPreset = "signature",
): SlideSurfaceTheme {
  const objectiveVisualTheme = getObjectiveVisualTheme(objective, visualPreset);
  const accent = objectiveVisualTheme.accent;
  const shellBg =
    accent === "blue"
      ? "bg-[radial-gradient(circle_at_84%_14%,rgba(36,107,253,0.12),transparent_30%),radial-gradient(circle_at_14%_20%,rgba(255,44,126,0.06),transparent_26%),linear-gradient(180deg,#FFFFFF_0%,#FBFAF7_52%,#F5F1EA_100%)]"
      : accent === "sun"
        ? "bg-[radial-gradient(circle_at_84%_14%,rgba(255,179,71,0.14),transparent_30%),radial-gradient(circle_at_14%_20%,rgba(255,44,126,0.05),transparent_26%),linear-gradient(180deg,#FFFFFF_0%,#FBF8F3_52%,#F4EEE6_100%)]"
        : "bg-[radial-gradient(circle_at_84%_14%,rgba(36,107,253,0.08),transparent_30%),radial-gradient(circle_at_14%_20%,rgba(255,44,126,0.10),transparent_26%),linear-gradient(180deg,#FFFFFF_0%,#FBFAF7_52%,#F4EEE6_100%)]";

  return {
    mode: "light",
    shellBg,
    gridClass: "opacity-[0.012] [background-image:linear-gradient(rgba(15,23,42,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.04)_1px,transparent_1px)] [background-size:44px_44px]",
    frameClass: "border-slate-200/60",
    topMetaClass: "text-slate-400",
    topDividerClass: "bg-gradient-to-r from-slate-200 via-slate-100 to-transparent",
    logoWrapClass: "bg-slate-950 text-white",
    logoTextClass: "text-slate-950",
    textPrimaryClass: "text-slate-950",
    textSecondaryClass: "text-slate-700",
    textMutedClass: "text-slate-400/90",
    panelClass: "border-slate-200/80 bg-white/96 shadow-[0_8px_18px_rgba(20,33,61,0.035)]",
    panelStrongClass: "border-slate-200/80 bg-white shadow-[0_12px_24px_rgba(20,33,61,0.04)]",
    subtlePanelClass: "border-slate-200/80 bg-white/92 shadow-[0_6px_14px_rgba(20,33,61,0.025)]",
    chipClass: "border-slate-200/80 bg-white text-slate-700",
    footerTextClass: "text-slate-200",
    footerButtonClass: "bg-gradient-to-r from-brand-primary to-brand-accent text-white shadow-[0_18px_34px_rgba(36,107,253,0.14)]",
    ghostClass: "text-slate-900/[0.024]",
    eyebrowClass:
      accent === "blue"
        ? "text-brand-accent"
        : accent === "sun"
          ? "text-[#9A6200]"
          : "text-brand-primary",
    serifClass: "font-serif italic text-slate-500",
    rankIndexClass: "bg-slate-950 text-white",
    rankTrackClass: "bg-slate-200",
    chartClass: "border-slate-200/80 bg-white shadow-[0_8px_18px_rgba(20,33,61,0.035)]",
    portraitFrameClass: "border-slate-200/80 bg-white",
  };
}

function isEditorialLandingSlideType(
  slideType: CarouselCaseSlide["type"],
) {
  return (
    slideType === "narrative" ||
    slideType === "format" ||
    slideType === "timing" ||
    slideType === "recommendation" ||
    slideType === "cta"
  );
}

function getNarrativeInspiredSurfaceTheme(
  surfaceTheme: SlideSurfaceTheme,
): SlideSurfaceTheme {
  return {
    ...surfaceTheme,
    shellBg:
      "bg-[radial-gradient(circle_at_18%_18%,rgba(255,44,126,0.11),transparent_28%),radial-gradient(circle_at_84%_14%,rgba(36,107,253,0.09),transparent_30%),linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_54%,#FFFFFF_100%)]",
    textPrimaryClass: "text-slate-950",
    textSecondaryClass: "text-slate-600",
    textMutedClass: "text-slate-400/90",
    panelClass:
      "border-[rgba(214,218,227,0.9)] bg-white/94 shadow-[0_10px_24px_rgba(20,33,61,0.045)]",
    panelStrongClass:
      "border-[rgba(214,218,227,0.92)] bg-white/96 shadow-[0_14px_30px_rgba(20,33,61,0.05)]",
    subtlePanelClass:
      "border-[rgba(214,218,227,0.86)] bg-white/92 shadow-[0_8px_20px_rgba(20,33,61,0.04)]",
    chipClass: "border-[rgba(214,218,227,0.92)] bg-white text-slate-700",
    eyebrowClass: "text-brand-primary",
    serifClass: "font-serif italic text-brand-accent/80",
    rankTrackClass: "bg-slate-300/80",
    chartClass:
      "border-[rgba(214,218,227,0.9)] bg-white/92 shadow-[0_12px_28px_rgba(20,33,61,0.045)]",
    portraitFrameClass: "border-[rgba(214,218,227,0.92)] bg-white/96",
  };
}

function getHeroMetric(source?: CarouselCaseSource | null) {
  const topPost = source?.featuredPosts?.[0];
  if (!topPost) return null;
  return {
    value: formatHeroMetricValue(topPost.metricValue, topPost.metricValueLabel),
    label: topPost.metricLabel,
  };
}

function FeaturedPostMetricBadge({
  post,
  tone = "default",
}: {
  post: CarouselCaseFeaturedPost;
  tone?: "default" | "pink" | "blue" | "sun";
}) {
  const toneClass =
    tone === "pink"
      ? "border-brand-primary/18 bg-brand-primary/8 text-slate-950"
      : tone === "blue"
        ? "border-brand-accent/18 bg-brand-accent/8 text-slate-950"
        : tone === "sun"
          ? "border-brand-sun/22 bg-brand-sun/14 text-slate-950"
          : "border-slate-900/10 bg-white text-slate-950";

  return (
    <div
      data-export-text
      className={cx("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]", toneClass)}
      style={getStableTextStyle("sans", {
        fontSize: "10px",
        fontWeight: 900,
        letterSpacing: "0.14em",
        lineHeight: 1,
        textTransform: "uppercase",
      })}
    >
      {post.metricLabel}: {post.metricValueLabel || post.metricValue}
    </div>
  );
}

function getEditorialProofToneClass(
  tone: "default" | "pink" | "blue" | "sun" = "default",
) {
  if (tone === "pink") {
    return "shadow-[0_18px_36px_rgba(255,44,126,0.12)]";
  }

  if (tone === "blue") {
    return "shadow-[0_18px_36px_rgba(36,107,253,0.12)]";
  }

  if (tone === "sun") {
    return "shadow-[0_18px_36px_rgba(15,23,42,0.08)]";
  }

  return "shadow-[0_18px_36px_rgba(20,33,61,0.08)]";
}

function getEditorialProofFallbackClass(
  tone: "default" | "pink" | "blue" | "sun" = "default",
) {
  if (tone === "pink") {
    return "bg-[radial-gradient(circle_at_30%_20%,rgba(255,44,126,0.24),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(36,107,253,0.16),transparent_42%),#F8FAFC]";
  }

  if (tone === "blue") {
    return "bg-[radial-gradient(circle_at_30%_20%,rgba(36,107,253,0.22),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(255,44,126,0.14),transparent_42%),#F8FAFC]";
  }

  return "bg-[radial-gradient(circle_at_30%_20%,rgba(255,44,126,0.18),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(36,107,253,0.18),transparent_42%),#F8FAFC]";
}

function FeaturedPostsShowcase({
  posts,
  title,
  tone = "default",
  showMetaBadges = false,
}: {
  posts: CarouselCaseFeaturedPost[];
  title: string;
  tone?: "default" | "pink" | "blue" | "sun";
  showMetaBadges?: boolean;
}) {
  if (!posts.length) return null;

  const visiblePosts = posts.slice(0, 2);
  const renderTile = (post: CarouselCaseFeaturedPost, size: "main" | "side", key: string) => {
    const mediaStyle = getProofMediaStyle(post);
    const metricBadge =
      post.metricValueLabel && post.metricLabel
        ? `${post.metricValueLabel} ${getNarrativeMetricCopy(post.metricLabel, "pill")}`
        : null;
    const metaBadges = [post.formatLabel, post.durationLabel].filter(Boolean) as string[];

    return (
      <div
        key={key}
        className={cx(
          "rounded-[1.45rem] border border-white/90 bg-white/96 p-[4px]",
          getEditorialProofToneClass(tone),
          size === "main" ? "h-[10.8rem] w-full" : "h-[8.9rem] w-full",
        )}
      >
        <div className="relative h-full overflow-hidden rounded-[1.18rem] bg-slate-100">
          {post.thumbnailUrl ? (
            <CoverImage
              src={post.thumbnailUrl}
              alt={post.title}
              position={mediaStyle.backgroundPosition}
            />
          ) : (
            <div className={cx("absolute inset-0", getEditorialProofFallbackClass(tone))} />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,44,126,0.08)_58%,rgba(36,107,253,0.05)_100%)]" />
          {showMetaBadges ? (
            <>
              {metricBadge ? (
                <div className="absolute left-2 top-2">
                  <span
                    className="inline-flex rounded-full border border-white/12 bg-[rgba(15,23,42,0.72)] px-2 py-1 text-[0.42rem] font-semibold tracking-[0.04em] text-white shadow-[0_10px_24px_rgba(15,23,42,0.24)]"
                    style={getStableTextStyle("sans", {
                      fontSize: "0.42rem",
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      lineHeight: 1,
                    })}
                  >
                    {metricBadge}
                  </span>
                </div>
              ) : null}
              {metaBadges.length ? (
                <div className="absolute inset-x-0 bottom-0 flex flex-wrap gap-1 p-2">
                  {metaBadges.map((badge) => (
                    <span
                      key={`${post.id}-${badge}`}
                      className="inline-flex rounded-full border border-white/70 bg-white/88 px-2 py-[0.18rem] text-[0.4rem] font-semibold uppercase tracking-[0.12em] text-slate-700 shadow-[0_8px_16px_rgba(15,23,42,0.08)]"
                      style={getStableTextStyle("sans", {
                        fontSize: "0.4rem",
                        fontWeight: 700,
                        letterSpacing: "0.12em",
                        lineHeight: 1,
                        textTransform: "uppercase",
                      })}
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="ml-auto mt-4 grid w-full max-w-[8.6rem] gap-3">
      {visiblePosts.map((post, index) => (
        <div
          key={post.id}
          className={cx(
            index === 0 ? "translate-y-2" : "translate-y-4",
          )}
        >
          {renderTile(post, index === 0 ? "main" : "side", post.id)}
        </div>
      ))}
      {!visiblePosts.length ? null : visiblePosts.length === 1 ? (
        <div className="h-0" />
      ) : null}
    </div>
  );
}

function FeaturedPostsStrip({
  posts,
  tone = "default",
}: {
  posts: CarouselCaseFeaturedPost[];
  tone?: "default" | "pink" | "blue" | "sun";
}) {
  const visiblePosts = posts.slice(0, 2);
  if (!visiblePosts.length) return null;

  return (
    <div className="flex items-end gap-3 overflow-visible">
      {visiblePosts.map((post, index) => (
        <div
          key={post.id}
          className={cx(
            "rounded-[1.3rem] border border-white/90 bg-white/96 p-[4px]",
            getEditorialProofToneClass(tone),
            index === 0 ? "h-[7.95rem] w-[6.35rem] translate-y-2" : "h-[7.1rem] w-[5.7rem] translate-y-5",
          )}
        >
          <div className="relative h-full overflow-hidden rounded-[1.04rem] bg-slate-100">
            {post.thumbnailUrl ? (
              <CoverImage
                src={post.thumbnailUrl}
                alt={post.title}
                position={getProofMediaStyle(post).backgroundPosition}
              />
            ) : (
              <div className={cx("absolute inset-0", getEditorialProofFallbackClass(tone))} />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,44,126,0.08)_58%,rgba(36,107,253,0.05)_100%)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function createNarrativeExportTarget(
  slide: CarouselCaseSlide,
  source: CarouselCaseSource | null | undefined,
  surfaceTheme: SlideSurfaceTheme,
) {
  const root = document.createElement("div");
  root.dataset.exportSlideId = slide.id;
  root.dataset.exportSynthetic = "true";
  root.style.position = "fixed";
  root.style.left = "-10000px";
  root.style.top = "0";
  root.style.width = "320px";
  root.style.height = "426.6667px";
  root.style.overflow = "hidden";
  root.style.borderRadius = "0";
  root.style.border = "1px solid #e2e8f0";
  root.style.background = "#FFFFFF";
  root.style.zIndex = "-1";

  document.body.appendChild(root);

  const reactRoot = createRoot(root);
  flushSync(() => {
    reactRoot.render(<NarrativeEditorialSlide slide={slide} source={source} surfaceTheme={surfaceTheme} />);
  });

  return {
    node: root,
    cleanup: () => {
      reactRoot.unmount();
      root.remove();
    },
  };
}

function getNarrativeVideoPosts(slide: CarouselCaseSlide, source?: CarouselCaseSource | null) {
  if (slide.type !== "narrative") return [] as CarouselCaseFeaturedPost[];

  const { evidencePosts } = getNarrativeEditorialData(slide, source);
  return [
    ...evidencePosts,
    ...(source?.evidence.narrativePosts || []),
    ...(source?.featuredPosts || []),
  ]
    .filter((post): post is CarouselCaseFeaturedPost => Boolean(post))
    .filter((post, index, posts) => posts.findIndex((candidate) => candidate.id === post.id) === index);
}

function canExportSlideVideo(slide: CarouselCaseSlide, source?: CarouselCaseSource | null) {
  if (slide.type === "cover" || slide.type === "format" || slide.type === "timing") return true;
  if (slide.type !== "narrative") return false;
  const candidatePosts = getNarrativeVideoPosts(slide, source);
  return candidatePosts.some((post) => post.isVideo && post.videoUrl);
}

function getSlideVideoExportDurationMs(slide: CarouselCaseSlide, source?: CarouselCaseSource | null) {
  if (slide.type === "cover") {
    return COVER_SLIDE_VIDEO_EXPORT_MS;
  }

  if (slide.type === "format" || slide.type === "timing") {
    return EDITORIAL_ANIMATED_SLIDE_EXPORT_MS;
  }

  const candidatePosts = getNarrativeVideoPosts(slide, source).filter((post) => post.isVideo && post.videoUrl);
  const longestDurationMs = Math.max(
    0,
    ...candidatePosts.map((post) =>
      typeof post.durationSeconds === "number" && Number.isFinite(post.durationSeconds)
        ? Math.round(post.durationSeconds * 1000)
        : 0,
    ),
  );

  if (longestDurationMs <= 0) {
    return NARRATIVE_VIDEO_EXPORT_FALLBACK_MS;
  }

  return Math.min(
    Math.max(longestDurationMs, NARRATIVE_VIDEO_EXPORT_MIN_MS),
    NARRATIVE_VIDEO_EXPORT_MAX_MS,
  );
}

function formatNarrativeLiftLine(item: CarouselCaseSourceInsight) {
  const lift = item.liftVsProfileAverage;

  if (lift === null || lift === undefined || (item.postsCount && item.postsCount < 3)) {
    return {
      label: "Amostra inicial em observação",
      tone: "muted" as const,
    };
  }

  if (lift < -5) {
    return {
      label: "Abaixo da média do perfil",
      tone: "muted" as const,
    };
  }

  if (lift < 5) {
    return {
      label: "Estável: em linha com a média geral",
      tone: "muted" as const,
    };
  }

  const formattedLift = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Math.abs(lift) >= 10 ? 0 : 1,
    maximumFractionDigits: Math.abs(lift) >= 10 ? 0 : 1,
  }).format(lift);

  return {
    label: `Em alta: +${formattedLift}% vs. média do perfil`,
    tone: "accent" as const,
  };
}

function getNarrativeKindLabel(kind?: CarouselCaseSourceInsight["kind"]) {
  if (kind === "context") return "CONTEXTO";
  if (kind === "proposal") return "PROPOSTA";
  if (kind === "format") return "FORMATO";
  return "CATEGORIA";
}

function getNarrativeKindOrder(kind?: CarouselCaseSourceInsight["kind"]) {
  if (kind === "proposal") return 0;
  if (kind === "context") return 1;
  if (kind === "format") return 2;
  return 3;
}

function getNarrativeEditorialData(slide: CarouselCaseSlide, source?: CarouselCaseSource | null) {
  const fallbackTitles = (slide.chips?.length ? slide.chips : splitSentences(slide.body)).slice(0, 2);
  const baseEvidencePosts = (
    source?.evidence.narrativePosts?.length ? source.evidence.narrativePosts : source?.featuredPosts || []
  ).slice(0, 2);
  const baseNarrativeItems: CarouselCaseSourceInsight[] = (
    source?.topNarratives?.length
      ? source.topNarratives
      : fallbackTitles.map((item) => ({
          title: item,
          reason: "",
          evidence: null,
          confidence: "medium" as const,
          kind: undefined,
          postsCount: 0,
          avgMetricValue: 0,
          avgMetricValueLabel: "",
          liftVsProfileAverage: null,
          aboveAverageCount: null,
        }))
  ).slice(0, 2);
  const narrativePairs = baseNarrativeItems
    .map((item, index) => ({
      item,
      post: baseEvidencePosts[index] || null,
      originalIndex: index,
    }))
    .sort((a, b) => {
      const orderDiff = getNarrativeKindOrder(a.item.kind) - getNarrativeKindOrder(b.item.kind);
      if (orderDiff !== 0) return orderDiff;
      return a.originalIndex - b.originalIndex;
    });

  const narrativeItems = narrativePairs.map((pair) => pair.item);
  const evidencePosts = narrativePairs.map((pair) => pair.post);

  return {
    title: toWellFormedText(String(getStandardizedSlideHeadline(slide) || "Melhores narrativas").toUpperCase()),
    eyebrow: toWellFormedText(String(slide.eyebrow || "O que mais ressoa").toUpperCase()),
    narrativeItems,
    evidencePosts,
    primaryLift: narrativeItems[0] ? formatNarrativeLiftLine(narrativeItems[0]) : null,
    secondaryLift: narrativeItems[1] ? formatNarrativeLiftLine(narrativeItems[1]) : null,
  };
}

function normalizeEditorialKey(value?: string | null) {
  return toWellFormedText(String(value || ""))
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function formatEditorialCount(value?: number | null, singular = "post", plural = "posts") {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return `${value} ${value === 1 ? singular : plural}`;
}

function getFormatEvidenceLine(
  formatInsight?: CarouselCaseSource["topFormats"][number] | null,
  source?: CarouselCaseSource | null,
) {
  const parts = [
    formatEditorialCount(formatInsight?.postsCount, "post", "posts"),
    formatInsight?.avgMetricValueLabel
      ? `média de ${formatInsight.avgMetricValueLabel} em ${String(
          formatInsight.metricLabel || source?.analysisMeta.metricShortLabel || "resultado",
        ).toLowerCase()}`
      : null,
  ].filter(Boolean) as string[];

  if (parts.length) return parts.join(" • ");

  const fallback = splitSentences(formatInsight?.evidence || formatInsight?.whyItWorks || source?.insightSummary.strongestPatternReason);
  return fallback[0] || "Melhor média recente dentro do recorte analisado.";
}

function getDurationEvidenceLine(durationInsight?: CarouselCaseSource["topDuration"] | null) {
  const parts = [
    formatEditorialCount(durationInsight?.postsCount, "vídeo", "vídeos"),
    durationInsight?.averageMetricValueLabel
      ? `média de ${durationInsight.averageMetricValueLabel} em ${String(durationInsight.metricLabel || "engajamento").toLowerCase()}`
      : null,
  ].filter(Boolean) as string[];

  if (parts.length) return parts.join(" • ");

  const fallback = splitSentences(durationInsight?.reason);
  return fallback[0] || "Faixa com a leitura mais sólida entre os vídeos recentes.";
}

function getFormatInterpretation(formatLabel?: string | null) {
  const normalized = normalizeEditorialKey(formatLabel);

  if (normalized.includes("carrossel")) {
    return "Formato que organiza a tese em etapas e sustenta clareza sem depender só do assunto.";
  }

  if (normalized.includes("reel") || normalized.includes("video") || normalized.includes("vídeo")) {
    return "Formato que empacota a tese com mais ritmo e impulso visual para este perfil.";
  }

  if (normalized.includes("story") || normalized.includes("stories")) {
    return "Formato que reduz fricção e favorece resposta rápida quando a mensagem é direta.";
  }

  if (normalized.includes("live") || normalized.includes("ao vivo")) {
    return "Formato que ganha força quando a autoridade segura atenção por mais tempo.";
  }

  if (
    normalized.includes("foto") ||
    normalized.includes("imagem") ||
    normalized.includes("estatico") ||
    normalized.includes("estático")
  ) {
    return "Formato que concentra a promessa em um frame direto e fácil de reconhecer.";
  }

  return "É a embalagem que sustenta melhor a resposta sem repetir exatamente o mesmo tema do slide anterior.";
}

function getDurationInterpretation(durationLabel?: string | null) {
  const normalized = normalizeEditorialKey(durationLabel);
  const values = Array.from(normalized.matchAll(/\d+(?:[.,]\d+)?/g))
    .map((match) => Number(match[0].replace(",", ".")))
    .filter((value) => Number.isFinite(value));
  const upperBound = values.length ? Math.max(...values) : null;

  if (upperBound !== null) {
    if (upperBound <= 20) {
      return "Faixa curta que entrega a promessa rápido e preserva o ritmo da resposta.";
    }

    if (upperBound <= 45) {
      return "Faixa enxuta que dá contexto suficiente sem esfriar a entrega.";
    }

    if (upperBound <= 90) {
      return "Faixa intermediária que sustenta contexto sem alongar demais o argumento.";
    }

    return "Faixa longa que só vale quando a promessa segura atenção até o fim.";
  }

  if (normalized.includes("curt")) {
    return "Faixa curta que prioriza velocidade e leitura imediata da promessa.";
  }

  if (normalized.includes("medio") || normalized.includes("médio")) {
    return "Faixa intermediária que equilibra contexto e ritmo.";
  }

  if (normalized.includes("long")) {
    return "Faixa longa que depende de retenção forte para sustentar resultado.";
  }

  return "É a duração que melhor acomoda a tese sem diluir o que já provou funcionar.";
}

function formatExecutionPercent(value?: number | null, maximumFractionDigits = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: maximumFractionDigits > 0 ? 1 : 0,
    maximumFractionDigits,
  }).format(value)}%`;
}

function getBenchmarkConfidenceLabel(value?: "high" | "medium" | "low" | null) {
  if (value === "high") return "confiança alta";
  if (value === "medium") return "confiança média";
  if (value === "low") return "confiança baixa";
  return null;
}

function getExecutionBenchmarkMetaLine(summary?: CarouselCaseSource["executionSummary"] | null) {
  const benchmark = summary?.benchmark;
  if (!benchmark?.canShow) return null;

  const parts = [
    typeof benchmark.creatorCount === "number" && benchmark.creatorCount > 0
      ? `${new Intl.NumberFormat("pt-BR").format(benchmark.creatorCount)} criadores`
      : null,
    benchmark.label || null,
    getBenchmarkConfidenceLabel(benchmark.confidence),
  ].filter(Boolean) as string[];

  return parts.join(" • ");
}

function getFormatUsageSupportLine(summary: CarouselCaseSource["executionSummary"] | null | undefined, formatTitle: string) {
  if (!summary?.formatUsageLeaderLabel) return null;

  if (normalizeEditorialKey(summary.formatUsageLeaderLabel) === normalizeEditorialKey(formatTitle)) {
    const shareLabel = formatExecutionPercent(summary.formatUsageSharePct);
    return shareLabel
      ? `Mais recorrente: representa ${shareLabel} da base de formatos recentes.`
      : "O formato mais consistente no recorte analisado.";
  }

  return `Oportunidade: ${summary.formatUsageLeaderLabel} tem mais histórico, mas ${formatTitle} entrega melhor.`;
}

function getDurationUsageSupportLine(summary: CarouselCaseSource["executionSummary"] | null | undefined, durationTitle: string) {
  if (!summary?.durationUsageLeaderLabel) return null;

  if (normalizeEditorialKey(summary.durationUsageLeaderLabel) === normalizeEditorialKey(durationTitle)) {
    const shareLabel = formatExecutionPercent(summary.durationUsageSharePct);
    return shareLabel
      ? `Maior fatia: concentra ${shareLabel} dos vídeos analisados.`
      : "Faixa de duração líder no recorte atual.";
  }

  return `Curiosidade: ${summary.durationUsageLeaderLabel} aparece mais, mas ${durationTitle} é quem responde.`;
}

function getFormatLeadBadge(summary?: CarouselCaseSource["executionSummary"] | null) {
  if (typeof summary?.formatLeadVsRunnerUpPct !== "number" || !Number.isFinite(summary.formatLeadVsRunnerUpPct)) {
    return null;
  }

  if (summary.formatLeadVsRunnerUpPct < 5) {
    return "Liderança técnica";
  }

  return `+${formatExecutionPercent(summary.formatLeadVsRunnerUpPct)} vs 2º formato`;
}

function getDurationLeadBadge(summary?: CarouselCaseSource["executionSummary"] | null) {
  if (typeof summary?.durationLeadVsRunnerUpPct !== "number" || !Number.isFinite(summary.durationLeadVsRunnerUpPct)) {
    return null;
  }

  if (summary.durationLeadVsRunnerUpPct < 5) {
    return "Liderança técnica";
  }

  return `+${formatExecutionPercent(summary.durationLeadVsRunnerUpPct)} vs 2ª faixa`;
}

function getDurationCoverageNote(summary?: CarouselCaseSource["executionSummary"] | null) {
  if (typeof summary?.durationCoverageRate === "number" && summary.durationCoverageRate < 0.7) {
    return `Cobertura de duração: ${formatExecutionPercent(summary.durationCoverageRate * 100)} dos vídeos.`;
  }

  if (typeof summary?.lowSampleDurationBuckets === "number" && summary.lowSampleDurationBuckets > 0) {
    return `${summary.lowSampleDurationBuckets} faixa(s) ainda com base curta.`;
  }

  return null;
}

function getFormatCardFooterNote(
  summary: CarouselCaseSource["executionSummary"] | null | undefined,
  formatTitle: string,
) {
  if (summary?.formatUsageLeaderLabel && normalizeEditorialKey(summary.formatUsageLeaderLabel) === normalizeEditorialKey(formatTitle)) {
    const shareLabel = formatExecutionPercent(summary.formatUsageSharePct);
    if (shareLabel) return `${shareLabel} da base`;
  }

  if (typeof summary?.formatLeadVsRunnerUpPct === "number" && Number.isFinite(summary.formatLeadVsRunnerUpPct)) {
    if (summary.formatLeadVsRunnerUpPct < 5) return "liderança técnica";
    return `+${formatExecutionPercent(summary.formatLeadVsRunnerUpPct)} vs 2º`;
  }

  return null;
}

function getDurationCardFooterNote(
  summary: CarouselCaseSource["executionSummary"] | null | undefined,
  durationTitle: string,
) {
  if (summary?.durationUsageLeaderLabel && normalizeEditorialKey(summary.durationUsageLeaderLabel) === normalizeEditorialKey(durationTitle)) {
    const shareLabel = formatExecutionPercent(summary.durationUsageSharePct);
    if (shareLabel) return `${shareLabel} dos vídeos`;
  }

  if (typeof summary?.durationLeadVsRunnerUpPct === "number" && Number.isFinite(summary.durationLeadVsRunnerUpPct)) {
    if (summary.durationLeadVsRunnerUpPct < 5) return "liderança técnica";
    return `+${formatExecutionPercent(summary.durationLeadVsRunnerUpPct)} vs 2ª`;
  }

  return null;
}

function getFormatEditorialData(slide: CarouselCaseSlide, source?: CarouselCaseSource | null) {
  const formatInsight = source?.topFormats[0] || null;
  const durationInsight = source?.topDuration || null;
  const executionSummary = source?.executionSummary || null;
  const chips = (slide.chips || []).filter(Boolean);
  const fallbackSentences = splitSentences(slide.body);
  const headlineCandidate = String(getStandardizedSlideHeadline(slide) || "").trim();
  const eyebrowCandidate = String(slide.eyebrow || "").trim();
  const title =
    normalizeEditorialKey(headlineCandidate) === "formato + duração"
      ? "QUE ENGAJA O\nSEGUIDOR"
      : toWellFormedText(headlineCandidate || "QUE ENGAJA O\nSEGUIDOR").toUpperCase();
  const eyebrow = toWellFormedText(eyebrowCandidate || "Formato e duração").toUpperCase();
  const evidencePosts = (
    source?.evidence.formatPosts?.length ? source.evidence.formatPosts : source?.featuredPosts || []
  ).slice(0, 2);
  const formatTitle = toWellFormedText(String(formatInsight?.label || chips[0] || "Reel"));
  const durationTitle = toWellFormedText(String(durationInsight?.label || chips[1] || "Até 45s"));
  const formatMetricCaption = `média de ${getNarrativeMetricCopy(
    formatInsight?.metricLabel || source?.analysisMeta.metricShortLabel,
    "body",
  )}`;
  const durationMetricCaption = `média de ${getNarrativeMetricCopy(
    durationInsight?.metricLabel || source?.analysisMeta.metricShortLabel,
    "body",
  )}`;
  const comboLabel = executionSummary?.comboLabel || [formatTitle, durationTitle].filter(Boolean).join(" + ");

  return {
    title,
    eyebrow,
    comboLabel,
    benchmarkMetaLine: getExecutionBenchmarkMetaLine(executionSummary),
    durationCoverageNote: getDurationCoverageNote(executionSummary),
    evidencePosts,
    formatBlock: {
      label: "FORMATO",
      title: formatTitle,
      metricRawValue: formatInsight?.avgMetricValue ?? null,
      metricValue: formatInsight?.avgMetricValueLabel || null,
      metricCaption: formatMetricCaption,
      volumeLabel: formatInsight?.postsCount ? `${formatInsight.postsCount} posts` : null,
      footerNote: getFormatCardFooterNote(executionSummary, formatTitle),
      proof: getFormatEvidenceLine(formatInsight, source),
      support:
        getFormatUsageSupportLine(executionSummary, formatTitle) ||
        getFormatInterpretation(formatTitle),
      badge: getFormatLeadBadge(executionSummary),
    },
    durationBlock: {
      label: "DURAÇÃO",
      title: durationTitle,
      metricRawValue: durationInsight?.averageMetricValue ?? null,
      metricValue: durationInsight?.averageMetricValueLabel || null,
      metricCaption: durationMetricCaption,
      volumeLabel: durationInsight?.postsCount ? `${durationInsight.postsCount} vídeos` : null,
      footerNote: getDurationCardFooterNote(executionSummary, durationTitle),
      proof: getDurationEvidenceLine(durationInsight) || fallbackSentences[1] || fallbackSentences[0] || "",
      support:
        getDurationUsageSupportLine(executionSummary, durationTitle) ||
        getDurationInterpretation(durationTitle),
      badge: getDurationLeadBadge(executionSummary),
    },
  };
}

function getNarrativeMetricCopy(value?: string | null, mode: "pill" | "body" = "body") {
  const normalized = String(value || "").toLowerCase();

  if (normalized.includes("engajamento") || normalized.includes("interações")) {
    return mode === "pill" ? "Engaj." : "interações";
  }

  if (normalized.includes("alcance")) {
    return mode === "pill" ? "Alcance" : "alcance";
  }

  if (normalized.includes("views")) {
    return mode === "pill" ? "Views" : "views";
  }

  if (normalized.includes("intenção")) {
    return mode === "pill" ? "Intenção" : "intenção";
  }

  if (normalized.includes("visitas")) {
    return mode === "pill" ? "Visitas" : "visitas";
  }

  return mode === "pill" ? String(value || "Métrica") : String(value || "resultado").toLowerCase();
}

function NarrativeEditorialBackground() {
  return (
    <div data-export-narrative-bg className="absolute inset-0" aria-hidden="true">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#FFFFFF_0%,#F8FAFC_54%,#FFFFFF_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,44,126,0.11),transparent_28%),radial-gradient(circle_at_84%_14%,rgba(36,107,253,0.09),transparent_30%)]" />
      <div className="absolute left-[-8%] top-[-6%] h-[32%] w-[58%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.92),rgba(255,255,255,0.34)_44%,rgba(255,255,255,0)_100%)] opacity-90 blur-[42px]" />
      <div className="absolute left-[-10%] top-[22%] h-[28%] w-[42%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,44,126,0.10),rgba(255,44,126,0.04)_36%,rgba(255,44,126,0)_100%)] opacity-70 blur-[48px]" />
      <div className="absolute right-[-10%] top-[4%] h-[30%] w-[48%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(36,107,253,0.12),rgba(36,107,253,0.06)_34%,rgba(36,107,253,0)_100%)] opacity-75 blur-[54px]" />
      <div className="absolute bottom-[12%] right-[2%] h-[30%] w-[42%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(36,107,253,0.07),rgba(36,107,253,0.03)_36%,rgba(36,107,253,0)_100%)] opacity-60 blur-[48px]" />
      <div className="absolute bottom-[8%] left-[-6%] h-[24%] w-[34%] rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,44,126,0.07),rgba(255,44,126,0.025)_42%,rgba(255,44,126,0)_100%)] opacity-55 blur-[42px]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.22)_0%,rgba(255,255,255,0.05)_100%)]" />
      <div className="absolute inset-0 opacity-[0.028] [background-image:radial-gradient(rgba(71,85,105,0.34)_0.52px,transparent_0.72px),radial-gradient(rgba(255,255,255,0.42)_0.38px,transparent_0.64px)] [background-position:0_0,3px_3px] [background-size:8px_8px]" />
    </div>
  );
}

function EditorialLandingCanvas({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative h-full overflow-hidden">
      <NarrativeEditorialBackground />
      <div className="relative z-10 flex h-full flex-col px-5 py-5">{children}</div>
    </div>
  );
}

function getEditorialSectionEyebrowTextStyle(color: string) {
  return getStableTextStyle("sans", {
    color,
    fontSize: "7.68px",
    fontWeight: 600,
    letterSpacing: "1.84px",
    lineHeight: 1.04,
    margin: 0,
    textTransform: "uppercase",
  });
}

function getEditorialSectionHeadingTextStyle({
  maxWidth,
  fontSize = "21.12px",
  letterSpacing = "2.36px",
  lineHeight = 0.86,
}: {
  maxWidth: string;
  fontSize?: string;
  letterSpacing?: string;
  lineHeight?: number;
}) {
  return getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize,
    fontWeight: 600,
    letterSpacing,
    lineHeight,
    margin: 0,
    maxWidth,
    textTransform: "uppercase",
  });
}

function getEditorialSectionLabelTextStyle(
  color: string,
  {
    fontSize = "8.32px",
    fontWeight = 900,
    letterSpacing = "1.16px",
    lineHeight = 1.04,
  }: {
    fontSize?: string;
    fontWeight?: number;
    letterSpacing?: string;
    lineHeight?: number;
  } = {},
) {
  return getStableTextStyle("sans", {
    color,
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight,
    margin: 0,
    textTransform: "uppercase",
  });
}

function getEditorialBodyTitleTextStyle({
  fontSize = "16.96px",
  letterSpacing = "-0.52px",
  lineHeight = 1.06,
  color = NARRATIVE_EDITORIAL_PALETTE.title,
}: {
  fontSize?: string;
  letterSpacing?: string;
  lineHeight?: number;
  color?: string;
} = {}) {
  return getStableTextStyle("serif", {
    color,
    fontSize,
    fontWeight: 400,
    letterSpacing,
    lineHeight,
    margin: 0,
  });
}

function getEditorialBodyCopyTextStyle(
  color: string,
  fontSize = "10.56px",
  lineHeight = 1.34,
  {
    fontWeight = 500,
    letterSpacing = "0.02px",
  }: {
    fontWeight?: number;
    letterSpacing?: string;
  } = {},
) {
  return getStableTextStyle("sans", {
    color,
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight,
    margin: 0,
  });
}

type EditorialPillTone = "pink" | "blue" | "sun" | "neutral";

function getEditorialBentoPanelClass(surfaceTheme: SlideSurfaceTheme) {
  return cx(EDITORIAL_BENTO_PANEL_BASE_CLASS, surfaceTheme.panelStrongClass);
}

function getEditorialBentoValueTextStyle({
  color = NARRATIVE_EDITORIAL_PALETTE.title,
  fontSize = "18.56px",
  fontWeight = 800,
  letterSpacing = "-0.05em",
  lineHeight = 1.02,
}: {
  color?: string;
  fontSize?: string;
  fontWeight?: number;
  letterSpacing?: string;
  lineHeight?: number;
} = {}) {
  return getStableTextStyle("sans", {
    color,
    fontSize,
    fontWeight,
    letterSpacing,
    lineHeight,
    margin: 0,
  });
}

function getEditorialMutedCaptionTextStyle(color = NARRATIVE_EDITORIAL_PALETTE.metricMuted) {
  return getStableTextStyle("sans", {
    color,
    fontSize: "7.04px",
    fontWeight: 600,
    letterSpacing: "0.06em",
    lineHeight: 1.2,
    margin: 0,
  });
}

function getEditorialPillToneStyles(tone: EditorialPillTone) {
  if (tone === "pink") {
    return {
      backgroundColor: "rgba(255,44,126,0.12)",
      borderColor: "rgba(255,44,126,0.18)",
      color: NARRATIVE_EDITORIAL_PALETTE.metricAccent,
    };
  }

  if (tone === "blue") {
    return {
      backgroundColor: "rgba(36,107,253,0.10)",
      borderColor: "rgba(36,107,253,0.18)",
      color: NARRATIVE_EDITORIAL_PALETTE.topicAccentSecondary,
    };
  }

  if (tone === "sun") {
    return {
      backgroundColor: "rgba(255,179,71,0.14)",
      borderColor: "rgba(255,179,71,0.22)",
      color: "#9A6200",
    };
  }

  return {
    backgroundColor: "rgba(15,23,42,0.05)",
    borderColor: "rgba(148,163,184,0.24)",
    color: NARRATIVE_EDITORIAL_PALETTE.metricMuted,
  };
}

function EditorialInfoPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: EditorialPillTone;
}) {
  const toneStyle = getEditorialPillToneStyles(tone);

  return (
    <span
      className="inline-flex rounded-full border px-2.5 py-1"
      style={{
        ...toneStyle,
        ...getStableTextStyle("sans", {
          fontSize: "7.36px",
          fontWeight: 700,
          letterSpacing: "0.08em",
          lineHeight: 1,
          margin: 0,
          textTransform: "uppercase",
        }),
      }}
    >
      {label}
    </span>
  );
}

function EditorialSectionRule({
  label,
  ruleClassName = "bg-slate-200/90",
}: {
  label: string;
  ruleClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <p
        className="uppercase font-bold"
        style={getEditorialSectionLabelTextStyle(NARRATIVE_EDITORIAL_PALETTE.metricMuted, {
          fontSize: "7.1px",
          letterSpacing: "1.08px",
        })}
      >
        {label}
      </p>
      <span className={cx("block h-px flex-1", ruleClassName)} />
    </div>
  );
}

function EditorialSlideHeader({
  eyebrow,
  title,
  maxWidth = "16rem",
  fontSize = "20.8px",
  letterSpacing = "2.24px",
  lineHeight = 0.86,
}: {
  eyebrow?: string | null;
  title?: string | null;
  maxWidth?: string;
  fontSize?: string;
  letterSpacing?: string;
  lineHeight?: number;
}) {
  return (
    <div className="space-y-1.5 px-1">
      {eyebrow ? (
        <p className="uppercase" style={getEditorialSectionEyebrowTextStyle(NARRATIVE_EDITORIAL_PALETTE.eyebrow)}>
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h3
          className="uppercase"
          style={getEditorialSectionHeadingTextStyle({
            maxWidth,
            fontSize,
            letterSpacing,
            lineHeight,
          })}
        >
          {title}
        </h3>
      ) : null}
    </div>
  );
}

function EditorialBentoPanel({
  surfaceTheme,
  className,
  glowColor,
  children,
}: {
  surfaceTheme: SlideSurfaceTheme;
  className?: string;
  glowColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cx(getEditorialBentoPanelClass(surfaceTheme), className)}>
      {glowColor ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply"
          style={{ background: `radial-gradient(circle at top left, ${glowColor} 0%, transparent 72%)` }}
        />
      ) : null}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

function getCompactEditorialLine(
  value: string | null | undefined,
  fallback: string,
  maxChars = 68,
) {
  const firstLine = splitSentences(value || "")[0] || fallback;
  return clampText(firstLine, maxChars);
}

function getEditorialCardTitle(value: string | null | undefined, fallback: string) {
  return String(value || fallback).replace(/-/g, "\u2011");
}

function NarrativeEditorialSlide({
  slide,
  source,
  surfaceTheme,
}: {
  slide: CarouselCaseSlide;
  source?: CarouselCaseSource | null;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const { title, eyebrow, narrativeItems, evidencePosts } = getNarrativeEditorialData(slide, source);
  const proposalItem =
    narrativeItems.find((item) => item.kind === "proposal") ||
    source?.topNarratives?.find((item) => item.kind === "proposal") ||
    narrativeItems[0] ||
    null;
  const contextItem =
    narrativeItems.find((item) => item.kind === "context") ||
    source?.topNarratives?.find((item) => item.kind === "context") ||
    narrativeItems[1] ||
    source?.topNarratives?.find((item) => item.kind === "format") ||
    null;
  const proposalLift = proposalItem ? formatNarrativeLiftLine(proposalItem) : null;
  const contextLift = contextItem ? formatNarrativeLiftLine(contextItem) : null;
  const metricLabel = getNarrativeMetricCopy(source?.analysisMeta.metricShortLabel, "body");
  const contentPosts = [
    ...evidencePosts.filter(Boolean),
    ...(source?.evidence.narrativePosts || []),
    ...(source?.featuredPosts || []),
  ]
    .filter((post): post is CarouselCaseFeaturedPost => Boolean(post))
    .filter((post, index, posts) => posts.findIndex((candidate) => candidate.id === post.id) === index)
    .slice(0, 2);
  const getCompactLiftCopy = (lift: ReturnType<typeof formatNarrativeLiftLine> | null) => {
    if (!lift?.label) return null;
    if (lift.tone === "accent") {
      return lift.label.replace(/^Em alta:\s*/i, "").replace(/\s+do perfil$/i, "");
    }

    if (lift.label === "Abaixo da média do perfil") return "abaixo da média";
    if (lift.label === "Estável: em linha com a média geral") return "em linha com a média";
    return clampText(lift.label, 28);
  };
  const getLiftInlineCopy = (lift: ReturnType<typeof formatNarrativeLiftLine> | null) => {
    const compact = getCompactLiftCopy(lift);
    if (!compact) return null;

    if (compact.includes(" vs.")) {
      return {
        value: compact.split(" vs.")[0],
        meta: "vs média",
      };
    }

    if (compact === "abaixo da média") {
      return {
        value: "abaixo",
        meta: "da média",
      };
    }

    if (compact === "em linha com a média") {
      return {
        value: "em linha",
        meta: "com a média",
      };
    }

    return {
      value: compact,
      meta: "",
    };
  };
  const headerEyebrowStyle = getStableTextStyle("sans", {
    color: "#94A3B8",
    fontSize: "7.2px",
    fontWeight: 600,
    letterSpacing: "0.22em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const headerTitleStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "18.2px",
    fontWeight: 700,
    letterSpacing: "-0.018em",
    lineHeight: 0.9,
    margin: 0,
    maxWidth: "11.8rem",
    textTransform: "uppercase",
    whiteSpace: "pre-line",
  });
  const labelStyle = getStableTextStyle("sans", {
    color: "#7F889C",
    fontSize: "7.1px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const cardTitleStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "15.8px",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1.02,
    margin: 0,
  });
  const metricSupportStyle = getStableTextStyle("sans", {
    color: "#A1A8B7",
    fontSize: "6.7px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    lineHeight: 1.02,
    margin: 0,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  });
  const footerInfoStyle = getStableTextStyle("sans", {
    color: "#8F97A6",
    fontSize: "6.8px",
    fontWeight: 500,
    letterSpacing: "0.02em",
    lineHeight: 1,
    margin: 0,
    whiteSpace: "nowrap",
  });
  const metricValueStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "31px",
    fontWeight: 800,
    letterSpacing: "-0.065em",
    lineHeight: 0.86,
    margin: 0,
    whiteSpace: "nowrap",
    textAlign: "left",
  });
  const footerMetaStyle = getStableTextStyle("sans", {
    color: "#6B7280",
    fontSize: "7.2px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  });
  const getLiftValueStyle = (color: string): React.CSSProperties =>
    getStableTextStyle("sans", {
      color,
      fontSize: "8.8px",
      fontWeight: 800,
      letterSpacing: "-0.03em",
      lineHeight: 1,
      margin: 0,
    });

  const renderMetricCard = (
    label: string,
    item: CarouselCaseSourceInsight | null,
    lift: ReturnType<typeof formatNarrativeLiftLine> | null,
    color: string,
    glowColor: string,
  ) => {
    const liftCopy = getLiftInlineCopy(lift);
    const metricCopy = `média de ${metricLabel}`;
    const counterDescriptor = getExportCounterDescriptor(item?.avgMetricValue, item?.avgMetricValueLabel);
    const counterDelay = label === "PROPOSTA" ? 120 : 280;
    const counterDuration = label === "PROPOSTA" ? 1380 : 1560;

    return (
      <EditorialBentoPanel
        surfaceTheme={surfaceTheme}
        glowColor={glowColor}
        className="h-full min-h-0 px-[16px] py-[14px]"
      >
        <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_auto_1fr_auto] gap-y-1">
          <p style={labelStyle}>{label}</p>
          <p
            style={{
              ...cardTitleStyle,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
            }}
          >
            {getEditorialCardTitle(item?.title, `Sem ${label.toLowerCase()} dominante`)}
          </p>
          <p
            data-export-counter-target={counterDescriptor ? String(counterDescriptor.target) : undefined}
            data-export-counter-divisor={counterDescriptor ? String(counterDescriptor.divisor) : undefined}
            data-export-counter-suffix={counterDescriptor?.suffix || undefined}
            data-export-counter-decimals={counterDescriptor ? String(counterDescriptor.decimals) : undefined}
            data-export-counter-delay={counterDescriptor ? String(counterDelay) : undefined}
            data-export-counter-duration={counterDescriptor ? String(counterDuration) : undefined}
            style={metricValueStyle}
          >
            {item?.avgMetricValueLabel || "--"}
          </p>
          <p style={metricSupportStyle}>{metricCopy}</p>
          <div aria-hidden="true" />
          <div className="flex w-full flex-nowrap items-center gap-1.5 border-t border-[rgba(229,229,231,0.72)] pt-2">
            {item?.postsCount ? <span style={footerMetaStyle}>{item.postsCount} posts</span> : null}
            {item?.postsCount && liftCopy ? <span className="h-3.5 w-px bg-[rgba(148,163,184,0.16)]" /> : null}
            {liftCopy ? (
              <div className="flex min-w-0 items-baseline gap-0.5 whitespace-nowrap leading-none">
                <span style={getLiftValueStyle(color)}>{liftCopy.value}</span>
                {liftCopy.meta ? <span style={footerInfoStyle}>{liftCopy.meta}</span> : null}
              </div>
            ) : null}
          </div>
        </div>
      </EditorialBentoPanel>
    );
  };

  const renderProofCard = (post: CarouselCaseFeaturedPost | undefined) => {
    if (!post) {
      return (
        <EditorialBentoPanel surfaceTheme={surfaceTheme} className="flex h-full min-h-0 items-center justify-center">
          <p style={footerInfoStyle}>Sem capa disponível</p>
        </EditorialBentoPanel>
      );
    }

    const viewsValue = post.viewsValueLabel;
    const viewsCounterDescriptor = getExportCounterDescriptor(post.viewsValue, post.viewsValueLabel);
    const mediaStyle = getProofMediaStyle(post);
    const videoUrl = post.isVideo ? toPreviewVideoUrl(post.videoUrl) : null;
    const posterUrl = toPreviewImageUrl(post.thumbnailUrl);
    const mediaScale = getExportImageScale(mediaStyle.backgroundSize);
    const mediaTransform = mediaScale ? `scale(${mediaScale.x}, ${mediaScale.y})` : undefined;

    return (
      <EditorialBentoPanel surfaceTheme={surfaceTheme} className="min-h-0 overflow-hidden p-0">
        <div className="relative h-full min-h-0 overflow-hidden">
          {videoUrl ? (
            <video
              aria-label={post.title}
              autoPlay
              className="absolute inset-0 h-full w-full select-none object-cover"
              data-export-poster={posterUrl || ""}
              disablePictureInPicture
              loop
              muted
              onCanPlay={(event) => {
                void event.currentTarget.play().catch(() => undefined);
              }}
              playsInline
              poster={posterUrl || undefined}
              preload="auto"
              src={videoUrl}
              style={{
                objectPosition: mediaStyle.backgroundPosition,
                pointerEvents: "none",
                transform: mediaTransform,
                transformOrigin: "center center",
                userSelect: "none",
              }}
            />
          ) : post.thumbnailUrl ? (
            <CoverImage
              src={post.thumbnailUrl}
              alt={post.title}
              position={mediaStyle.backgroundPosition}
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_22%,rgba(255,44,126,0.20),transparent_34%),radial-gradient(circle_at_84%_18%,rgba(36,107,253,0.18),transparent_36%),#E5E7EB]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.01),rgba(15,23,42,0.05)_68%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[48%] bg-[linear-gradient(180deg,rgba(15,23,42,0)_0%,rgba(15,23,42,0.14)_30%,rgba(15,23,42,0.72)_100%)]" />
          {viewsValue ? (
            <div className="absolute bottom-5 left-5">
              <p
                data-export-counter-target={viewsCounterDescriptor ? String(viewsCounterDescriptor.target) : undefined}
                data-export-counter-divisor={viewsCounterDescriptor ? String(viewsCounterDescriptor.divisor) : undefined}
                data-export-counter-suffix={viewsCounterDescriptor?.suffix || undefined}
                data-export-counter-decimals={viewsCounterDescriptor ? String(viewsCounterDescriptor.decimals) : undefined}
                data-export-counter-delay={viewsCounterDescriptor ? "240" : undefined}
                data-export-counter-duration={viewsCounterDescriptor ? "1280" : undefined}
                style={getStableTextStyle("sans", {
                  color: "#FFFFFF",
                  fontSize: "14px",
                  fontWeight: 800,
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                  margin: 0,
                  whiteSpace: "nowrap",
                  textShadow: "0 2px 14px rgba(15,23,42,0.58), 0 0 24px rgba(15,23,42,0.28)",
                })}
              >
                {viewsValue}
              </p>
              <p
                style={getStableTextStyle("sans", {
                  color: "rgba(255,255,255,0.78)",
                  fontSize: "6.8px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  lineHeight: 1,
                  margin: "4px 0 0 0",
                  textShadow: "0 2px 14px rgba(15,23,42,0.48)",
                })}
              >
                views
              </p>
            </div>
          ) : null}
        </div>
      </EditorialBentoPanel>
    );
  };

  return (
    <EditorialLandingCanvas>
      <div className="flex h-full flex-col gap-2.5 pt-1.5">
        <div className="space-y-2.5 pr-1">
          <p style={headerEyebrowStyle}>{eyebrow}</p>
          <h3 style={headerTitleStyle}>{title}</h3>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[0.98fr_0.86fr] gap-2.5">
          <div className="grid h-full min-h-0 grid-rows-[1fr_1fr] gap-2.5">
            {renderMetricCard("PROPOSTA", proposalItem, proposalLift, "#FF2C7E", "rgba(255,44,126,0.12)")}
            {renderMetricCard("CONTEXTO", contextItem, contextLift, "#246BFD", "rgba(36,107,253,0.12)")}
          </div>

          <div className="grid min-h-0 grid-rows-2 gap-2.5">
            {renderProofCard(contentPosts[0])}
            {renderProofCard(contentPosts[1])}
          </div>
        </div>
      </div>
    </EditorialLandingCanvas>
  );
}

function EditorialChartMetricValue({
  value,
  emphasized = false,
}: {
  value: number;
  emphasized?: boolean;
}) {
  return (
    <span
      className="uppercase"
      style={getStableTextStyle("sans", {
        color: NARRATIVE_EDITORIAL_PALETTE.metricMuted,
        fontSize: emphasized ? "12.6px" : "9.4px",
        fontWeight: 800,
        letterSpacing: emphasized ? "0.06em" : "0.06em",
        lineHeight: 1,
        margin: 0,
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      })}
    >
      {formatHeroMetricValue(value)}
    </span>
  );
}

function FormatMiniChart({
  source,
  surfaceTheme,
}: {
  source?: CarouselCaseSource | null;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const formats = source?.evidence.formatChart || [];
  if (!formats.length) return null;

  const visibleFormats = formats.slice(0, 3);
  const baseBentoClass = getEditorialBentoPanelClass(surfaceTheme);
  const isSparse = visibleFormats.length <= 2;
  const isSolo = visibleFormats.length === 1;

  return (
    <div className={cx("flex min-h-0 flex-1 flex-col space-y-3 px-[18px] py-[16px]", baseBentoClass)}>
      <EditorialSectionRule label="PERFORMANCE POR FORMATO" ruleClassName="bg-slate-200/55" />

      <div className={cx("flex min-h-0 flex-1 flex-col", isSparse ? "justify-center gap-4" : "justify-between")}>
        {visibleFormats.map((format, index) => {
          return (
            <div
              key={`${format.name}-${index}`}
              className={cx(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-100/35 last:border-0",
                isSolo ? "py-5" : "py-3",
              )}
            >
              <div className="min-w-0 space-y-1">
                <p
                  className="uppercase font-extrabold"
                  style={getEditorialSectionLabelTextStyle(NARRATIVE_EDITORIAL_PALETTE.label, {
                    fontSize: isSolo ? "10.2px" : "8.4px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                  })}
                >
                  {format.name}
                </p>
                {typeof format.postsCount === "number" ? (
                  <p
                    style={getEditorialBodyCopyTextStyle(
                      NARRATIVE_EDITORIAL_PALETTE.facts,
                      isSolo ? "7.2px" : "6.6px",
                      1.05,
                      { fontWeight: 500 }
                    )}
                  >
                    {format.postsCount} posts
                  </p>
                ) : null}
              </div>
              <div className="pl-2 text-right">
                <EditorialChartMetricValue value={format.value} emphasized={isSolo} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExecutionMiniChart({
  source,
  surfaceTheme,
}: {
  source?: CarouselCaseSource | null;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const buckets = source?.evidence.durationChart || [];
  if (!buckets.length) return null;

  const visibleBuckets = buckets.slice(0, 3);
  const baseBentoClass = getEditorialBentoPanelClass(surfaceTheme);
  const isSparse = visibleBuckets.length <= 2;
  const isSolo = visibleBuckets.length === 1;

  return (
    <div className={cx("flex min-h-0 flex-1 flex-col space-y-3 px-[18px] py-[16px]", baseBentoClass)}>
      <EditorialSectionRule label="PERFORMANCE POR TEMPO" ruleClassName="bg-slate-200/55" />

      <div className={cx("flex min-h-0 flex-1 flex-col", isSparse ? "justify-center gap-4" : "justify-between")}>
        {visibleBuckets.map((bucket, index) => {
          return (
            <div
              key={`${bucket.label}-${index}`}
              className={cx(
                "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-slate-100/35 last:border-0",
                isSolo ? "py-5" : "py-3",
              )}
            >
              <div className="min-w-0 space-y-1">
                <p
                  className="uppercase font-extrabold"
                  style={getEditorialSectionLabelTextStyle(NARRATIVE_EDITORIAL_PALETTE.label, {
                    fontSize: isSolo ? "10.2px" : "8.4px",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                  })}
                >
                  {bucket.label}
                </p>
                <p
                  style={getEditorialBodyCopyTextStyle(
                    NARRATIVE_EDITORIAL_PALETTE.facts,
                    isSolo ? "7.2px" : "6.6px",
                    1.05,
                    { fontWeight: 500 }
                  )}
                >
                  {bucket.postsCount} posts
                </p>
              </div>
              <div className="pl-2 text-right">
                <EditorialChartMetricValue value={bucket.averageInteractions} emphasized={isSolo} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FormatEditorialSlide({
  slide,
  source,
  surfaceTheme,
}: {
  slide: CarouselCaseSlide;
  source?: CarouselCaseSource | null;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const { title, eyebrow, formatBlock, durationBlock } = getFormatEditorialData(slide, source);
  const blocks = [
    {
      ...formatBlock,
      accentColor: "rgba(255,44,126,0.12)",
      tone: "pink" as const,
    },
    {
      ...durationBlock,
      accentColor: "rgba(36,107,253,0.12)",
      tone: "blue" as const,
    },
  ];
  const timingBuckets = (source?.evidence.durationChart || []).slice(0, 3);
  const performanceMaxValue = Math.max(...timingBuckets.map((bucket) => Number(bucket.averageInteractions || 0)), 1);
  const headerEyebrowStyle = getStableTextStyle("sans", {
    color: "#94A3B8",
    fontSize: "7.2px",
    fontWeight: 600,
    letterSpacing: "0.22em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const headerTitleStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "19.8px",
    fontWeight: 700,
    letterSpacing: "-0.018em",
    lineHeight: 0.98,
    margin: 0,
    maxWidth: "12.2rem",
    textTransform: "uppercase",
    whiteSpace: "pre-line",
  });
  const blockLabelStyle = getStableTextStyle("sans", {
    color: "#7F889C",
    fontSize: "7.1px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const blockTitleStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "17.6px",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1.02,
    margin: 0,
    textAlign: "left",
  });
  const blockMetricStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "31px",
    fontWeight: 800,
    letterSpacing: "-0.065em",
    lineHeight: 0.86,
    margin: 0,
    textAlign: "left",
  });
  const blockMetricCaptionStyle = getStableTextStyle("sans", {
    color: "#A1A8B7",
    fontSize: "6.7px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    lineHeight: 1.02,
    margin: 0,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    textAlign: "left",
  });
  const blockFooterMetaStyle = getStableTextStyle("sans", {
    color: "#6B7280",
    fontSize: "7.5px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  });
  const getBlockFooterAccentStyle = (tone: "pink" | "blue") =>
    getStableTextStyle("sans", {
      color: tone === "pink" ? NARRATIVE_EDITORIAL_PALETTE.metricAccent : NARRATIVE_EDITORIAL_PALETTE.topicAccentSecondary,
      fontSize: "9.2px",
      fontWeight: 800,
      letterSpacing: "-0.02em",
      lineHeight: 1,
      margin: 0,
      whiteSpace: "nowrap",
    });
  const performanceCardTitleStyle = getStableTextStyle("sans", {
    color: "#7F889C",
    fontSize: "7.1px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const performanceCardSubtitleStyle = getStableTextStyle("sans", {
    color: "#A1A8B7",
    fontSize: "6px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const performanceRowLabelStyle = getStableTextStyle("sans", {
    color: "#7F889C",
    fontSize: "9.4px",
    fontWeight: 700,
    letterSpacing: "0.02em",
    lineHeight: 1,
    margin: 0,
    whiteSpace: "nowrap",
  });
  const performanceRowMetaStyle = getStableTextStyle("sans", {
    color: "#94A3B8",
    fontSize: "7.2px",
    fontWeight: 600,
    letterSpacing: "0.02em",
    lineHeight: 1,
    margin: 0,
    whiteSpace: "nowrap",
  });
  const performanceRowValueStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "14.2px",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    lineHeight: 1,
    margin: 0,
    whiteSpace: "nowrap",
  });

  return (
    <EditorialLandingCanvas>
      <div className="flex h-full flex-col gap-2.5 pt-1.5">
        <div className="space-y-2.5 pr-1">
          <p style={headerEyebrowStyle}>{eyebrow}</p>
          <h3 style={headerTitleStyle}>{title}</h3>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[0.92fr_1.08fr] gap-2.5">
          <div className="grid h-full min-h-0 grid-cols-2 gap-2.5">
            {blocks.map((block) => {
              const needsOpticalLeftNudge = block.label === "DURAÇÃO";
              const blockTitleInlineStyle = needsOpticalLeftNudge
                ? { ...blockTitleStyle, marginLeft: "-2px" }
                : blockTitleStyle;
              const blockMetricInlineStyle = needsOpticalLeftNudge
                ? { ...blockMetricStyle, marginLeft: "-2px" }
                : blockMetricStyle;
              const counterDescriptor = getExportCounterDescriptor(block.metricRawValue, block.metricValue);
              const counterDelay = block.label === "FORMATO" ? 140 : 320;
              const counterDuration = block.label === "FORMATO" ? 1320 : 1480;

              return (
                <EditorialBentoPanel
                  key={block.label}
                  surfaceTheme={surfaceTheme}
                  glowColor={block.accentColor}
                  className="h-full min-h-0 px-[16px] py-[14px]"
                >
                  <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_auto_1fr_auto] gap-y-1">
                    <p style={blockLabelStyle}>{block.label}</p>
                    <p style={blockTitleInlineStyle}>{clampText(block.title, 20)}</p>
                    <p
                      data-export-counter-target={counterDescriptor ? String(counterDescriptor.target) : undefined}
                      data-export-counter-divisor={counterDescriptor ? String(counterDescriptor.divisor) : undefined}
                      data-export-counter-suffix={counterDescriptor?.suffix || undefined}
                      data-export-counter-decimals={counterDescriptor ? String(counterDescriptor.decimals) : undefined}
                      data-export-counter-delay={counterDescriptor ? String(counterDelay) : undefined}
                      data-export-counter-duration={counterDescriptor ? String(counterDuration) : undefined}
                      style={blockMetricInlineStyle}
                    >
                      {block.metricValue || "--"}
                    </p>
                    <p style={blockMetricCaptionStyle}>{block.metricCaption || "média"}</p>
                    <div aria-hidden="true" />

                    <div className="flex w-full flex-nowrap items-center gap-1.5 border-t border-[rgba(229,229,231,0.72)] pt-2">
                      {block.volumeLabel ? <span style={blockFooterMetaStyle}>{block.volumeLabel}</span> : null}
                      {block.volumeLabel && block.footerNote ? <span className="h-3.5 w-px bg-[rgba(148,163,184,0.16)]" /> : null}
                      {block.footerNote ? <span style={getBlockFooterAccentStyle(block.tone)}>{block.footerNote}</span> : null}
                    </div>
                  </div>
                </EditorialBentoPanel>
              );
            })}
          </div>

          <EditorialBentoPanel
            surfaceTheme={surfaceTheme}
            glowColor="rgba(36,107,253,0.10)"
            className="min-h-0 px-[18px] py-[16px]"
          >
            <div className="flex h-full min-h-0 flex-col gap-3">
              <div className="space-y-1">
                <p style={performanceCardTitleStyle}>PERFORMANCE POR TEMPO</p>
                <p style={performanceCardSubtitleStyle}>média de interações</p>
              </div>

              <div className="flex min-h-0 flex-1 flex-col justify-between">
                {timingBuckets.map((bucket, index) => (
                  (() => {
                    const bucketWidth = Math.max(
                      14,
                      Math.round((Number(bucket.averageInteractions || 0) / performanceMaxValue) * 100),
                    );
                    const counterDescriptor = getExportCounterDescriptor(
                      bucket.averageInteractions,
                      formatHeroMetricValue(bucket.averageInteractions),
                    );
                    return (
                  <div
                    key={`${bucket.label}-${index}`}
                    className="grid grid-cols-[4.6rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[rgba(229,229,231,0.58)] py-3 last:border-0 last:pb-0"
                  >
                    <div className="space-y-1">
                      <p style={performanceRowLabelStyle}>{bucket.label}</p>
                      <p style={performanceRowMetaStyle}>{bucket.postsCount} posts</p>
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-slate-200/75">
                        <div
                          data-export-bar="true"
                          data-export-bar-target-width={String(bucketWidth)}
                          data-export-bar-delay={String(220 + index * 140)}
                          data-export-bar-duration={String(980 + index * 140)}
                          className={cx(
                            "h-full rounded-full",
                            index === 0 && "bg-brand-primary",
                            index === 1 && "bg-brand-accent",
                            index === 2 && "bg-slate-400",
                          )}
                          style={{ width: `${bucketWidth}%` }}
                        />
                      </div>
                    </div>
                    <p
                      data-export-counter-target={counterDescriptor ? String(counterDescriptor.target) : undefined}
                      data-export-counter-divisor={counterDescriptor ? String(counterDescriptor.divisor) : undefined}
                      data-export-counter-suffix={counterDescriptor?.suffix || undefined}
                      data-export-counter-decimals={counterDescriptor ? String(counterDescriptor.decimals) : undefined}
                      data-export-counter-delay={counterDescriptor ? String(260 + index * 140) : undefined}
                      data-export-counter-duration={counterDescriptor ? String(1080 + index * 140) : undefined}
                      style={performanceRowValueStyle}
                    >
                      {formatHeroMetricValue(bucket.averageInteractions)}
                    </p>
                  </div>
                    );
                  })()
                ))}
              </div>
            </div>
          </EditorialBentoPanel>
        </div>
      </div>
    </EditorialLandingCanvas>
  );
}

function TimingEditorialSlide({
  slide,
  source,
  surfaceTheme,
}: {
  slide: CarouselCaseSlide;
  source?: CarouselCaseSource | null;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const points = source?.evidence.timingChart || [];
  const winningWindows = source?.winningWindows || [];
  const metricCaption = `média de ${getNarrativeMetricCopy(source?.analysisMeta.metricShortLabel, "body")}`;
  const timingRows = (points.length
    ? points.slice(0, 3).map((point) => ({
        label: point.label || "N/A",
        value: point.value,
        postsLabel: point.helper || "",
      }))
    : winningWindows.slice(0, 3).map((window) => ({
        label: window.label || "N/A",
        value: null as number | null,
        postsLabel: "",
      })));
  const primaryRow = timingRows[0] || { label: "N/A", value: null as number | null, postsLabel: "" };
  const secondaryRow = timingRows[1] || null;
  const performanceMaxValue = Math.max(
    ...timingRows.map((row) => (typeof row.value === "number" ? row.value : 0)),
    1,
  );
  const primaryLiftVsSecondary =
    secondaryRow &&
    typeof primaryRow.value === "number" &&
    primaryRow.value > 0 &&
    typeof secondaryRow.value === "number" &&
    secondaryRow.value > 0
      ? Math.round(((primaryRow.value / secondaryRow.value) - 1) * 100)
      : null;
  const summaryCards = [
    {
      label: "JANELA PRINCIPAL",
      title: primaryRow.label,
      rawMetricValue: primaryRow.value,
      metricValue: formatHeroMetricValue(primaryRow.value, "--"),
      metricCaption: metricCaption,
      volumeLabel: primaryRow.postsLabel,
      footerNote: primaryLiftVsSecondary && primaryLiftVsSecondary > 0
        ? `+${primaryLiftVsSecondary}% vs 2ª`
        : "melhor janela",
      accentColor: "rgba(36,107,253,0.12)",
      footerTone: "blue" as const,
    },
    secondaryRow
      ? {
          label: "APOIO",
          title: secondaryRow.label,
          rawMetricValue: secondaryRow.value,
          metricValue: formatHeroMetricValue(secondaryRow.value, "--"),
          metricCaption: metricCaption,
          volumeLabel: secondaryRow.postsLabel,
          footerNote: "apoio",
          accentColor: "rgba(255,44,126,0.12)",
          footerTone: "neutral" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    label: string;
    title: string;
    rawMetricValue: number | null;
    metricValue: string;
    metricCaption: string;
    volumeLabel: string;
    footerNote: string;
    accentColor: string;
    footerTone: "pink" | "blue" | "neutral";
  }>;
  const headerEyebrowStyle = getStableTextStyle("sans", {
    color: "#94A3B8",
    fontSize: "7.2px",
    fontWeight: 600,
    letterSpacing: "0.22em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const headerTitleStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "19.8px",
    fontWeight: 700,
    letterSpacing: "-0.018em",
    lineHeight: 0.98,
    margin: 0,
    maxWidth: "12.8rem",
    textTransform: "uppercase",
    whiteSpace: "pre-line",
  });
  const blockLabelStyle = getStableTextStyle("sans", {
    color: "#7F889C",
    fontSize: "7.1px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const blockTitleStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "16.8px",
    fontWeight: 800,
    letterSpacing: "-0.04em",
    lineHeight: 1.02,
    margin: 0,
    textAlign: "left",
  });
  const blockMetricStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "29.4px",
    fontWeight: 800,
    letterSpacing: "-0.065em",
    lineHeight: 0.88,
    margin: 0,
    textAlign: "left",
  });
  const blockMetricCaptionStyle = getStableTextStyle("sans", {
    color: "#A1A8B7",
    fontSize: "6.6px",
    fontWeight: 600,
    letterSpacing: "0.08em",
    lineHeight: 1.02,
    margin: 0,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    textAlign: "left",
  });
  const blockFooterMetaStyle = getStableTextStyle("sans", {
    color: "#6B7280",
    fontSize: "7.5px",
    fontWeight: 700,
    letterSpacing: "0.06em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
    whiteSpace: "nowrap",
  });
  const getBlockFooterAccentStyle = (tone: "pink" | "blue" | "neutral") =>
    getStableTextStyle("sans", {
      color:
        tone === "pink"
          ? NARRATIVE_EDITORIAL_PALETTE.metricAccent
          : tone === "blue"
            ? NARRATIVE_EDITORIAL_PALETTE.topicAccentSecondary
            : "#94A3B8",
      fontSize: "8.6px",
      fontWeight: tone === "neutral" ? 700 : 800,
      letterSpacing: "-0.02em",
      lineHeight: 1,
      margin: 0,
      whiteSpace: "nowrap",
    });
  const performanceCardTitleStyle = getStableTextStyle("sans", {
    color: "#7F889C",
    fontSize: "6.9px",
    fontWeight: 700,
    letterSpacing: "0.15em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const performanceCardSubtitleStyle = getStableTextStyle("sans", {
    color: "#B2BAC8",
    fontSize: "5.7px",
    fontWeight: 600,
    letterSpacing: "0.1em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
  });
  const performanceRowLabelStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "9.4px",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    lineHeight: 1.06,
    margin: 0,
    whiteSpace: "nowrap",
  });
  const performanceRowMetaStyle = getStableTextStyle("sans", {
    color: "#94A3B8",
    fontSize: "6.6px",
    fontWeight: 600,
    letterSpacing: "0.02em",
    lineHeight: 1,
    margin: 0,
    whiteSpace: "nowrap",
    textTransform: "uppercase",
  });
  const performanceRowValueStyle = getStableTextStyle("sans", {
    color: NARRATIVE_EDITORIAL_PALETTE.title,
    fontSize: "14.2px",
    fontWeight: 800,
    letterSpacing: "-0.03em",
    lineHeight: 1,
    margin: 0,
    whiteSpace: "nowrap",
  });

  return (
    <EditorialLandingCanvas>
      <div className="flex h-full flex-col gap-2.5 pt-1.5">
        <div className="space-y-2.5 pr-1">
          {slide.eyebrow ? <p style={headerEyebrowStyle}>{slide.eyebrow}</p> : null}
          <h3 style={headerTitleStyle}>{getPreviewHeadline(slide)}</h3>
        </div>

        <div className="grid min-h-0 flex-1 grid-rows-[0.82fr_1.18fr] gap-2.5">
          <div className={cx("grid h-full min-h-0 gap-2.5", summaryCards.length > 1 ? "grid-cols-2" : "grid-cols-1")}>
            {summaryCards.map((card, index) => {
              const counterDescriptor = getExportCounterDescriptor(card.rawMetricValue, card.metricValue);

              return (
                <EditorialBentoPanel
                  key={card.label}
                  surfaceTheme={surfaceTheme}
                  glowColor={card.accentColor}
                  className="h-full min-h-0 px-[16px] py-[14px]"
                >
                  <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_auto_1fr_auto] gap-y-1">
                    <p style={blockLabelStyle}>{card.label}</p>
                    <p style={blockTitleStyle}>{clampText(card.title, 18)}</p>
                    <p
                      data-export-counter-target={counterDescriptor ? String(counterDescriptor.target) : undefined}
                      data-export-counter-divisor={counterDescriptor ? String(counterDescriptor.divisor) : undefined}
                      data-export-counter-suffix={counterDescriptor?.suffix || undefined}
                      data-export-counter-decimals={counterDescriptor ? String(counterDescriptor.decimals) : undefined}
                      data-export-counter-delay={counterDescriptor ? String(120 + index * 180) : undefined}
                      data-export-counter-duration={counterDescriptor ? String(1360 + index * 180) : undefined}
                      style={blockMetricStyle}
                    >
                      {card.metricValue}
                    </p>
                    <p style={blockMetricCaptionStyle}>{card.metricCaption}</p>
                    <div aria-hidden="true" />

                    <div className="flex w-full flex-nowrap items-center gap-1.5 border-t border-[rgba(229,229,231,0.72)] pt-2">
                      {card.volumeLabel ? <span style={blockFooterMetaStyle}>{card.volumeLabel}</span> : null}
                      {card.volumeLabel && card.footerNote ? <span className="h-3.5 w-px bg-[rgba(148,163,184,0.16)]" /> : null}
                      {card.footerNote ? <span style={getBlockFooterAccentStyle(card.footerTone)}>{card.footerNote}</span> : null}
                    </div>
                  </div>
                </EditorialBentoPanel>
              );
            })}
          </div>

          <EditorialBentoPanel
            surfaceTheme={surfaceTheme}
            glowColor="rgba(36,107,253,0.10)"
            className="min-h-0 px-[18px] py-[16px]"
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="space-y-0.5 pb-2.5">
                <p style={performanceCardTitleStyle}>PERFORMANCE POR JANELA</p>
                <p style={performanceCardSubtitleStyle}>{metricCaption}</p>
              </div>

              <div className="grid min-h-0 flex-1 grid-rows-3">
                {timingRows.map((row, index) => (
                  (() => {
                    const barWidth = Math.max(
                      12,
                      Math.round(((typeof row.value === "number" ? row.value : 0) / performanceMaxValue) * 100),
                    );
                    const counterDescriptor = getExportCounterDescriptor(
                      row.value,
                      formatHeroMetricValue(row.value, "--"),
                    );

                    return (
                      <div
                        key={`${row.label}-${index}`}
                        className="grid h-full grid-cols-[5.1rem_minmax(0,1fr)_4.9rem] items-center gap-4 border-b border-[rgba(229,229,231,0.42)] py-0 last:border-0"
                      >
                        <div className="flex flex-col gap-[4px]">
                          <p style={performanceRowLabelStyle}>{row.label}</p>
                          {row.postsLabel ? <p style={performanceRowMetaStyle}>{row.postsLabel}</p> : null}
                        </div>

                        <div className="pr-1">
                          <div className="h-[10px] overflow-hidden rounded-full bg-slate-200/65">
                            <div
                              data-export-bar="true"
                              data-export-bar-target-width={String(barWidth)}
                              data-export-bar-delay={String(240 + index * 150)}
                              data-export-bar-duration={String(980 + index * 150)}
                              className={cx(
                                "h-full rounded-full",
                                index === 0 && "bg-brand-accent",
                                index === 1 && "bg-brand-primary",
                                index === 2 && "bg-slate-400",
                              )}
                              style={{ width: `${barWidth}%` }}
                            />
                          </div>
                        </div>

                        <p
                          className="text-right"
                          data-export-counter-target={counterDescriptor ? String(counterDescriptor.target) : undefined}
                          data-export-counter-divisor={counterDescriptor ? String(counterDescriptor.divisor) : undefined}
                          data-export-counter-suffix={counterDescriptor?.suffix || undefined}
                          data-export-counter-decimals={counterDescriptor ? String(counterDescriptor.decimals) : undefined}
                          data-export-counter-delay={counterDescriptor ? String(280 + index * 150) : undefined}
                          data-export-counter-duration={counterDescriptor ? String(1100 + index * 150) : undefined}
                          style={performanceRowValueStyle}
                        >
                          {formatHeroMetricValue(row.value, "--")}
                        </p>
                      </div>
                    );
                  })()
                ))}
              </div>
            </div>
          </EditorialBentoPanel>
        </div>
      </div>
    </EditorialLandingCanvas>
  );
}

function SlideShell({
  slide,
  creatorName,
  children,
  surfaceTheme,
}: {
  slide: CarouselCaseSlide;
  creatorName: string;
  children: React.ReactNode;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const narrativeMeta = getSlideNarrativeMeta(slide.type);
  const isCover = slide.type === "cover";
  const isEditorialLanding = isEditorialLandingSlideType(slide.type);
  const isFullBleed = isCover || slide.id === "resonance" || isEditorialLanding;

  return (
    <>
      <div className={cx("absolute inset-0", surfaceTheme.shellBg)} />
      {isCover ? <div className={cx("absolute inset-0", surfaceTheme.gridClass)} /> : null}

      <div
        className={cx(
          "relative z-10 flex h-full flex-col justify-between",
          isFullBleed ? "px-0 py-0" : "px-5 py-5",
          surfaceTheme.textPrimaryClass,
        )}
      >
        <div className="h-0" />

        <div className={cx("flex-1 min-h-0 overflow-visible", isFullBleed ? "py-0" : "py-1")}>
          <div className="h-full">{children}</div>
        </div>
      </div>
    </>
  );
}

function CoverSlide({
  slide,
  creatorName,
  photoUrl,
  slideIndex,
  totalSlides,
  source,
}: {
  slide: CarouselCaseSlide;
  creatorName: string;
  photoUrl?: string | null;
  slideIndex: number;
  totalSlides: number;
  source?: CarouselCaseSource | null;
}) {
  const coverPhoto = toPreviewImageUrl(photoUrl);
  const generatedHeadline =
    source?.objective.value === "reach"
      ? "O que mais gera\n*alcance*\nneste perfil"
      : source?.objective.value === "leads"
        ? "O que mais gera\n*intenção*\nneste perfil"
        : source
          ? "O que mais gera\n*resposta*\nneste perfil"
          : null;
  const generatedBody = "";
  const autoHeadlineCandidates = [
    creatorName,
    "O que está puxando mais resposta neste perfil",
    "O que está puxando mais alcance neste perfil",
    "O que está puxando mais intenção neste perfil",
    "O que gera mais resposta neste perfil",
    "O que gera mais alcance neste perfil",
    "O que gera mais intenção neste perfil",
    "O que mais gera resposta neste perfil",
    "O que mais gera alcance neste perfil",
    "O que mais gera intenção neste perfil",
    generatedHeadline,
  ]
    .map((value) => normalizeLooseText(value || ""))
    .filter(Boolean);
  const autoBodyCandidates = [
    "Leitura estratégica D2C",
    generatedBody,
    source?.insightSummary.strongestPattern,
    source?.insightSummary.strongestPatternReason,
    source?.period.label ? `${source.period.label} leitura estratégica D2C` : "",
    "Leitura do padrão que vale repetir agora.",
    "Leitura do padrão a repetir agora.",
  ]
    .map((value) => normalizeLooseText(value))
    .filter(Boolean);
  const isAutoHeadline = autoHeadlineCandidates.includes(normalizeLooseText(slide.headline));
  const isAutoBody = autoBodyCandidates.includes(normalizeLooseText(slide.body));
  const coverHeadline = isAutoHeadline && generatedHeadline
    ? clampText(generatedHeadline, 56)
    : clampText(slide.headline, 56);
  const coverBody = isAutoBody ? generatedBody : clampText(slide.body, 74);
  const coverKicker = creatorName;
  const topMetaLabel = slide.eyebrow || "";
  const coverKickerStyle = getStableTextStyle("sans", {
    fontSize: "0.5rem",
    fontWeight: 800,
    letterSpacing: "0.2em",
    lineHeight: 1,
    margin: 0,
    textTransform: "uppercase",
    color: "rgba(255,255,255,0.78)",
  });
  const coverTitleStyle = getStableTextStyle("sans", {
    fontWeight: 620,
    lineHeight: 0.88,
    letterSpacing: "-0.048em",
    margin: 0,
    color: "#FFFFFF",
  });
  const coverIndexStyle = getStableTextStyle("sans", {
    color: "rgba(255,255,255,0.48)",
    fontSize: "0.44rem",
    fontWeight: 600,
    letterSpacing: "0.22em",
    lineHeight: 1,
    textTransform: "uppercase",
  });

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0 bg-[#06080E]" />
      {coverPhoto ? (
        <>
          <CoverImage
            src={coverPhoto}
            alt={creatorName}
            className="scale-[1.34] opacity-[0.18]"
            position={getCoverPhotoPosition()}
          />
          <CoverImage
            src={coverPhoto}
            alt={creatorName}
            className="scale-[1.08] opacity-[0.98]"
            position={getCoverPhotoPosition()}
          />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 50% 18%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0) 30%), radial-gradient(circle at 22% 18%, rgba(255,44,126,0.28) 0%, rgba(255,44,126,0) 34%), radial-gradient(circle at 84% 16%, rgba(36,107,253,0.28) 0%, rgba(36,107,253,0) 30%), linear-gradient(180deg, #111827 0%, #0B1220 42%, #05070C 100%)",
          }}
        />
      )}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 52% 12%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 30%), linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(5,8,16,0.02) 34%, rgba(4,6,11,0.08) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 16% 14%, rgba(255,44,126,0.16) 0%, rgba(255,44,126,0) 26%), radial-gradient(circle at 86% 12%, rgba(36,107,253,0.14) 0%, rgba(36,107,253,0) 28%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(4,6,11,0.07) 0%, rgba(4,6,11,0) 18%, rgba(4,6,11,0) 82%, rgba(4,6,11,0.06) 100%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,6,11,0) 0%, rgba(4,6,11,0) 58%, rgba(4,6,11,0.08) 76%, rgba(4,6,11,0.24) 100%), linear-gradient(90deg, rgba(4,6,11,0.22) 0%, rgba(4,6,11,0.12) 16%, rgba(4,6,11,0.03) 34%, rgba(4,6,11,0) 58%)",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 76% 58% at 18% 84%, rgba(4,6,11,0.68) 0%, rgba(4,6,11,0.42) 24%, rgba(4,6,11,0.18) 46%, rgba(4,6,11,0.05) 64%, rgba(4,6,11,0) 80%)",
        }}
      />

      <div className="absolute z-20" style={{ left: "20px", top: "18px" }}>
          <div className="flex items-center gap-[6px]">
            <div className="relative h-[31px] w-[28px] shrink-0 overflow-hidden">
              <NextImage
                src="/images/Colorido-Simbolo.png"
                alt="D2C"
                width={44}
                height={44}
                className="pointer-events-none absolute left-[-10px] top-[-7px] max-w-none object-contain"
              />
            </div>
          <div className="flex min-w-0 flex-col gap-0">
            <p
              className="text-[0.42rem] tracking-[0.02em] text-white"
              style={getStableTextStyle("sans", {
                fontSize: "0.42rem",
                fontWeight: 600,
                letterSpacing: "0.02em",
                lineHeight: 0.92,
                margin: 0,
                color: "rgba(255,255,255,0.92)",
                textShadow: "0 2px 4px rgba(0,0,0,0.24)",
              })}
            >
              www.data2content.ai
            </p>
            {topMetaLabel ? (
              <p
                className="text-[0.35rem] uppercase tracking-[0.16em]"
                style={getStableTextStyle("sans", {
                  fontSize: "0.35rem",
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  lineHeight: 0.92,
                  margin: 0,
                  textTransform: "uppercase",
                  color: "rgba(230,236,246,0.62)",
                  textShadow: "0 2px 4px rgba(0,0,0,0.24)",
                })}
              >
                {topMetaLabel}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-6 pt-16">
        <div className="max-w-[12rem] space-y-4">
          <div className="space-y-2">
            <p style={coverKickerStyle}>{coverKicker}</p>
            <h2
              className="max-w-[11.9rem] text-[1.44rem] leading-[0.88] [text-shadow:0_14px_34px_rgba(0,0,0,0.42)]"
              data-export-title="true"
              data-export-title-delay="420"
              data-export-title-duration="1280"
            >
              <span style={coverTitleStyle}>
                {renderEditorialText(coverHeadline)}
              </span>
            </h2>
          </div>

          <div className="flex items-center gap-3 pt-0.5">
            <p data-export-text style={coverIndexStyle}>
              {String(slideIndex + 1).padStart(2, "0")}
            </p>
            <CoverPaginationDots activeIndex={slideIndex} total={totalSlides} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightSlide({
  slide,
  source,
  surfaceTheme,
}: {
  slide: CarouselCaseSlide;
  source?: CarouselCaseSource | null;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const sentences = splitSentences(slide.body);
  const mainSentence = clampText(sentences[0] || slide.body || "", 120);
  const heroMetric = getHeroMetric(source);

  return (
    <div className="flex h-full flex-col justify-between gap-4">
      <div className="space-y-3">
        {slide.eyebrow ? (
          <p className={cx("text-[10px] font-black uppercase tracking-[0.24em]", surfaceTheme.eyebrowClass)}>{slide.eyebrow}</p>
        ) : null}
        <p
          className={cx("text-[0.72rem] leading-4", surfaceTheme.serifClass)}
          style={getStableTextStyle("serif")}
        >
          o sinal mais forte do recorte atual
        </p>
        <h3
          className={cx("max-w-[10.6rem] text-[1.56rem] font-black uppercase leading-[0.9] tracking-[-0.05em]", surfaceTheme.textPrimaryClass)}
          style={getStableTextStyle("sans", { lineHeight: 0.9, letterSpacing: "-0.045em", margin: 0 })}
        >
          {getPreviewHeadline(slide)}
        </h3>
      </div>

      <div className="space-y-4">
        {heroMetric ? (
          <div className="space-y-1.5">
            <p
              className={cx("pl-1 text-[0.62rem] font-black uppercase tracking-[0.18em]", surfaceTheme.textMutedClass)}
              style={getStableTextStyle("sans", { letterSpacing: "0.16em", margin: 0 })}
            >
              {heroMetric.label}
            </p>
            <p
              className={cx("text-[3rem] font-black leading-[0.92] tracking-[-0.08em]", surfaceTheme.textPrimaryClass)}
              style={getStableTextStyle("sans", { lineHeight: 0.92, letterSpacing: "-0.06em", margin: 0 })}
            >
              {heroMetric.value}
            </p>
          </div>
        ) : null}
        <div className={cx("rounded-[1.3rem] border px-4 py-3", surfaceTheme.panelStrongClass)}>
          <p
            className={cx("text-[1rem] leading-[1.34]", surfaceTheme.textPrimaryClass)}
            style={getStableTextStyle("sans", { lineHeight: 1.34, margin: 0 })}
          >
            {mainSentence}
          </p>
        </div>
        {source ? (
          <p className={cx("text-[0.68rem] leading-5", surfaceTheme.serifClass)} style={getStableTextStyle("serif")}>
            base em {source.analysisMeta.postsAnalyzed} posts analisados
          </p>
        ) : null}
      </div>
    </div>
  );
}

function RankedSlide({
  slide,
  variant,
  source,
  surfaceTheme,
}: {
  slide: CarouselCaseSlide;
  variant: "narrative" | "format" | "timing";
  source?: CarouselCaseSource | null;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const bullets = splitBullets(slide.body);
  const sentences = bullets.length ? bullets : splitSentences(slide.body);
  const items = (slide.chips?.length ? slide.chips : sentences).slice(0, 3);

  const accentTone =
    variant === "narrative" ? "pink" : variant === "format" ? "blue" : "pink";
  const evidencePosts =
    variant === "narrative"
      ? source?.evidence.narrativePosts || []
      : variant === "format"
        ? source?.evidence.formatPosts || []
        : source?.evidence.timingPosts || [];

  if (variant === "narrative") {
    return <NarrativeEditorialSlide slide={slide} source={source} surfaceTheme={surfaceTheme} />;
  }

  if (variant === "format") {
    return <FormatEditorialSlide slide={slide} source={source} surfaceTheme={surfaceTheme} />;
  }

  const variantTypography = EDITORIAL_SLIDE_TYPOGRAPHY.timing;

  return (
    <EditorialLandingCanvas>
      <div className={cx("flex h-full flex-col", variant === "timing" ? "justify-start gap-5 pt-1" : "justify-start gap-5 pt-1")}>
        <div className="space-y-3">
          {slide.eyebrow ? (
            <p className="uppercase" style={getEditorialSectionEyebrowTextStyle(NARRATIVE_EDITORIAL_PALETTE.eyebrow)}>{slide.eyebrow}</p>
          ) : null}
          <h3
            className="uppercase"
            style={getEditorialSectionHeadingTextStyle({
              maxWidth: variantTypography.headingMaxWidth,
              fontSize: variantTypography.headingFontSize,
              letterSpacing: variantTypography.headingLetterSpacing,
              lineHeight: variantTypography.headingLineHeight,
            })}
          >
            {getPreviewHeadline(slide)}
          </h3>
        </div>

        {variant === "timing" ? (
          <div className="flex flex-1 flex-col justify-between gap-5">
            <ExecutionMiniChart source={source} surfaceTheme={surfaceTheme} />
            {evidencePosts.length ? (
              <div className="translate-y-2">
                <FeaturedPostsStrip posts={evidencePosts} tone={accentTone} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[0.92fr_1.08fr] items-start gap-4">
            <div className="space-y-4 pt-0.5">
              {items.slice(0, 2).map((item, index) => (
                <div key={`${item}-${index}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={cx("tabular-nums", surfaceTheme.textPrimaryClass)}
                      style={getEditorialSectionLabelTextStyle(NARRATIVE_EDITORIAL_PALETTE.label, {
                        fontSize: EDITORIAL_SLIDE_TYPOGRAPHY.format.indexFontSize,
                      })}
                    >
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <p
                      className="uppercase"
                      style={getEditorialSectionLabelTextStyle(NARRATIVE_EDITORIAL_PALETTE.metricMuted, {
                        fontSize: EDITORIAL_SLIDE_TYPOGRAPHY.format.labelFontSize,
                        letterSpacing: EDITORIAL_SLIDE_TYPOGRAPHY.format.labelLetterSpacing,
                      })}
                    >
                      {variant === "format" ? (index === 0 ? "formato" : "duração") : index === 0 ? "vencedora" : "apoio"}
                    </p>
                  </div>
                  <p
                    style={getEditorialBodyTitleTextStyle({
                      fontSize: EDITORIAL_SLIDE_TYPOGRAPHY.format.bodyTitleFontSize,
                      letterSpacing: EDITORIAL_SLIDE_TYPOGRAPHY.format.bodyTitleLetterSpacing,
                      lineHeight: EDITORIAL_SLIDE_TYPOGRAPHY.format.bodyTitleLineHeight,
                    })}
                  >
                    {clampText(item, 28)}
                  </p>
                  <span className={cx("block h-px w-14", surfaceTheme.rankTrackClass)}>
                    <span className={cx("block h-full", index === 0 ? "w-full bg-brand-primary" : "w-10 bg-brand-accent")} />
                  </span>
                </div>
              ))}
            </div>

            <div className="min-h-0 self-start pt-0.5">
              {evidencePosts.length ? (
                <FeaturedPostsShowcase
                  posts={evidencePosts}
                  title="Prova principal"
                  tone={accentTone}
                />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </EditorialLandingCanvas>
  );
}

function getActionBadge(note: string, _typography: typeof EDITORIAL_SLIDE_TYPOGRAPHY.recommendation) {
  const norm = note.toLowerCase();

  if (norm.includes("testar")) {
    return <EditorialInfoPill label="TESTAR" tone="blue" />;
  }

  if (norm.includes("escalar") || norm.includes("repetir")) {
    return <EditorialInfoPill label="ESCALAR" tone="pink" />;
  }

  return <EditorialInfoPill label={clampText(note, 28)} tone="neutral" />;
}

function getIdeaSupportLine(
  item: { title: string; meta: string; note: string; impact: string },
  index: number,
) {
  const noteLine = splitSentences(item.note || "")[0];
  if (noteLine) return noteLine;
  if (item.meta) return `${item.meta} como melhor encaixe para repetir a tese agora.`;
  if (index === 0) return "Repetir a linha vencedora com hook novo e promessa mais clara no começo.";
  if (index === 1) return "Abrir um segundo teste mantendo a promessa, mas variando entrada e formato.";
  return "Usar como desdobramento da tese campeã para ampliar cobertura sem perder consistência.";
}

function RecommendationSlide({
  slide,
  source,
  surfaceTheme,
}: {
  slide: CarouselCaseSlide;
  source?: CarouselCaseSource | null;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const ideaItems =
    slide.id === "ideas" && source?.contentIdeas?.length
      ? source.contentIdeas.slice(0, 3).map((idea) => ({
          title: idea.title,
          meta: [idea.timingLabel, idea.formatLabel].filter(Boolean).join(" • "),
          note: idea.note || "",
          impact: idea.note && idea.note.toLowerCase().includes("alto potencial") ? "Estimativa de Alto Impacto" : "",
        }))
      : splitBullets(slide.body).slice(0, 3).map((item) => ({ title: item, meta: "", note: "", impact: "" }));
  const typography = EDITORIAL_SLIDE_TYPOGRAPHY.recommendation;
  const primaryIdea = ideaItems[0] || null;
  const secondaryIdeas = ideaItems.slice(1, 3);

  return (
    <EditorialLandingCanvas>
      <div className="flex h-full flex-col gap-2.5 pt-1.5">
        <EditorialSlideHeader
          eyebrow={slide.eyebrow}
          title={getPreviewHeadline(slide)}
          maxWidth={typography.headingMaxWidth}
          fontSize={typography.headingFontSize}
          letterSpacing={typography.headingLetterSpacing}
          lineHeight={typography.headingLineHeight}
        />

        <div className="grid min-h-0 flex-1 grid-cols-[1.08fr_0.92fr] gap-2.5">
          {primaryIdea ? (
            <EditorialBentoPanel
              surfaceTheme={surfaceTheme}
              glowColor="rgba(255,44,126,0.16)"
              className="min-h-0 px-4 py-3.5"
            >
              <div className="flex h-full flex-col justify-between gap-3">
                <div className="space-y-2">
                  <EditorialSectionRule label="PRIORIDADE 01" />
                  <p
                    style={getEditorialBentoValueTextStyle({
                      fontSize: "18.24px",
                      fontWeight: 800,
                      lineHeight: 1.03,
                    })}
                  >
                    {clampText(primaryIdea.title, 36)}
                  </p>
                  {primaryIdea.meta ? <p style={getEditorialMutedCaptionTextStyle()}>{clampText(primaryIdea.meta, 42)}</p> : null}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {primaryIdea.note ? getActionBadge(primaryIdea.note, typography) : <EditorialInfoPill label="RECOMENDADO" tone="pink" />}
                    {primaryIdea.impact ? <EditorialInfoPill label="ALTO IMPACTO" tone="sun" /> : null}
                  </div>
                  <p style={getEditorialBodyCopyTextStyle(NARRATIVE_EDITORIAL_PALETTE.facts, "8.8px", 1.2, { fontWeight: 550 })}>
                    {getCompactEditorialLine(
                      getIdeaSupportLine(primaryIdea, 0),
                      "Repetir a tese vencedora com um hook mais claro.",
                      56,
                    )}
                  </p>
                </div>
              </div>
            </EditorialBentoPanel>
          ) : (
            <div />
          )}

          <div className="flex min-h-0 flex-col gap-2.5">
            {secondaryIdeas.map((item, index) => (
              <EditorialBentoPanel
                key={`${item.title}-${index}`}
                surfaceTheme={surfaceTheme}
                glowColor={index === 0 ? "rgba(36,107,253,0.12)" : "rgba(255,179,71,0.12)"}
                className="flex-1 min-h-0 px-4 py-3.5"
              >
                <div className="flex h-full flex-col justify-between gap-2.5">
                  <div className="space-y-2">
                    <EditorialSectionRule label={`PRIORIDADE ${String(index + 2).padStart(2, "0")}`} />
                    <p
                      style={getEditorialBentoValueTextStyle({
                        fontSize: "15.6px",
                        fontWeight: 760,
                        lineHeight: 1.06,
                      })}
                    >
                      {clampText(item.title, 24)}
                    </p>
                    {item.meta ? <p style={getEditorialMutedCaptionTextStyle()}>{clampText(item.meta, 28)}</p> : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {item.note ? getActionBadge(item.note, typography) : null}
                    {item.impact ? <EditorialInfoPill label="ALTO IMPACTO" tone="sun" /> : null}
                  </div>
                </div>
              </EditorialBentoPanel>
            ))}
          </div>
        </div>
      </div>
    </EditorialLandingCanvas>
  );
}

function CtaSlide({
  slide,
  surfaceTheme,
}: {
  slide: CarouselCaseSlide;
  surfaceTheme: SlideSurfaceTheme;
}) {
  const ctaSupport = "Análise do perfil, pautas e consultorias da D2C.";
  const typography = EDITORIAL_SLIDE_TYPOGRAPHY.cta;

  return (
    <EditorialLandingCanvas>
      <div className="flex h-full flex-col gap-2.5 pt-1.5">
        <EditorialSlideHeader
          eyebrow={slide.eyebrow}
          title={getPreviewHeadline(slide)}
          maxWidth={typography.headingMaxWidth}
          fontSize={typography.headingFontSize}
          letterSpacing={typography.headingLetterSpacing}
          lineHeight={typography.headingLineHeight}
        />

        <div className="grid min-h-0 flex-1 grid-cols-[1.05fr_0.95fr] gap-2.5">
          <EditorialBentoPanel
            surfaceTheme={surfaceTheme}
            glowColor="rgba(255,44,126,0.16)"
            className="min-h-0 px-4 py-3.5"
          >
            <div className="flex h-full flex-col justify-between gap-3">
              <div className="space-y-2">
                <EditorialSectionRule label="ACESSO IMEDIATO" />
                <p
                  className={surfaceTheme.textPrimaryClass}
                  style={getEditorialBentoValueTextStyle({
                    fontSize: typography.priceFontSize,
                    fontWeight: 800,
                    letterSpacing: typography.priceLetterSpacing,
                    lineHeight: typography.priceLineHeight,
                  })}
                >
                  R$49,90/mês
                </p>
                <p
                  className={surfaceTheme.textSecondaryClass}
                  style={getEditorialBodyCopyTextStyle(
                    NARRATIVE_EDITORIAL_PALETTE.facts,
                    "9.6px",
                    1.2,
                    { fontWeight: 550 },
                  )}
                >
                  descubra o que postar e quando postar
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <EditorialInfoPill label="ANÁLISE" tone="pink" />
                <EditorialInfoPill label="PAUTAS" tone="blue" />
              </div>
            </div>
          </EditorialBentoPanel>

          <div className="flex min-h-0 flex-col">
            <EditorialBentoPanel
              surfaceTheme={surfaceTheme}
              glowColor="rgba(36,107,253,0.12)"
              className="flex-1 min-h-0 px-4 py-3.5"
            >
              <div className="flex h-full flex-col justify-between gap-3">
                <div className="space-y-2">
                  <EditorialSectionRule label="O QUE VOCÊ LEVA" />
                  <p
                    className={surfaceTheme.textSecondaryClass}
                    style={getEditorialBodyCopyTextStyle(
                      NARRATIVE_EDITORIAL_PALETTE.facts,
                      "9.4px",
                      1.22,
                      { fontWeight: 550 },
                    )}
                  >
                    {getCompactEditorialLine(ctaSupport, ctaSupport, 68)}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <EditorialInfoPill label="CONSULTORIA" tone="neutral" />
                    <EditorialInfoPill label="PLANO PRÁTICO" tone="neutral" />
                  </div>
                </div>

                <div>
                  <div
                    data-export-text
                    className={cx(
                      "inline-flex rounded-full px-5 py-3 text-[0.88rem] font-black uppercase tracking-[0.14em]",
                      surfaceTheme.footerButtonClass,
                    )}
                    style={getStableTextStyle("sans", {
                      fontSize: "0.88rem",
                      fontWeight: 900,
                      letterSpacing: "0.14em",
                      lineHeight: 1,
                      textTransform: "uppercase",
                    })}
                  >
                    Entrar na D2C
                  </div>
                </div>
              </div>
            </EditorialBentoPanel>
          </div>
        </div>
      </div>
    </EditorialLandingCanvas>
  );
}

function SlideCard({
  slide,
  creatorName,
  photoUrl,
  slideIndex,
  totalSlides,
  slideRef,
  source,
  objective,
  visualPreset,
}: {
  slide: CarouselCaseSlide;
  creatorName: string;
  photoUrl?: string | null;
  slideIndex: number;
  totalSlides: number;
  slideRef: (node: HTMLDivElement | null) => void;
  source?: CarouselCaseSource | null;
  objective?: CarouselCaseObjective;
  visualPreset?: CarouselCaseVisualPreset;
}) {
  const baseSurfaceTheme = getSlideSurfaceTheme(objective, visualPreset);
  const surfaceTheme = isEditorialLandingSlideType(slide.type)
    ? getNarrativeInspiredSurfaceTheme(baseSurfaceTheme)
    : baseSurfaceTheme;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            Slide {slideIndex + 1}
          </p>
          <p className="text-sm font-semibold text-slate-900">{slide.eyebrow || "Carrossel-case"}</p>
        </div>
      </div>
      <div
        className="group relative mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.12)]"
      >
        <div
          ref={slideRef}
          data-export-slide-id={slide.id}
          className="relative h-full w-full overflow-hidden"
        >
          <SlideShell
            slide={slide}
            creatorName={creatorName}
            surfaceTheme={surfaceTheme}
          >
            {slide.type === "cover" ? (
              <CoverSlide
                slide={slide}
                creatorName={creatorName}
                photoUrl={photoUrl}
                slideIndex={slideIndex}
                totalSlides={totalSlides}
                source={source}
              />
            ) : null}
            {slide.type === "insight" ? <InsightSlide slide={slide} source={source} surfaceTheme={surfaceTheme} /> : null}
            {slide.type === "narrative" ? <RankedSlide slide={slide} variant="narrative" source={source} surfaceTheme={surfaceTheme} /> : null}
            {slide.type === "format" ? <RankedSlide slide={slide} variant="format" source={source} surfaceTheme={surfaceTheme} /> : null}
            {slide.type === "timing" ? <TimingEditorialSlide slide={slide} source={source} surfaceTheme={surfaceTheme} /> : null}
            {slide.type === "recommendation" ? <RecommendationSlide slide={slide} source={source} surfaceTheme={surfaceTheme} /> : null}
            {slide.type === "cta" ? (
              <CtaSlide slide={slide} surfaceTheme={surfaceTheme} />
            ) : null}
          </SlideShell>
        </div>
      </div>
    </div>
  );
}

export default function CarouselCaseGeneratorClient() {
  const [selectedCreator, setSelectedCreator] = useState<AdminTargetUser | null>(null);
  const [period, setPeriod] = useState<CarouselCasePeriod>("30d");
  const [objective, setObjective] = useState<CarouselCaseObjective>("engagement");
  const [visualPreset, setVisualPreset] = useState<CarouselCaseVisualPreset>("signature");
  const [source, setSource] = useState<CarouselCaseSource | null>(null);
  const [deck, setDeck] = useState<CarouselCaseDeck | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportingIndex, setExportingIndex] = useState<number | null>(null);
  const [exportingVideoIndex, setExportingVideoIndex] = useState<number | null>(null);
  const [diagnosticExportingIndex, setDiagnosticExportingIndex] = useState<number | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [diagnosticExportingAll, setDiagnosticExportingAll] = useState(false);
  const [lastExportReport, setLastExportReport] = useState<string | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [drafts, setDrafts] = useState<CarouselCaseDraftSummary[]>([]);
  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isAnyExportRunning =
    exportingIndex !== null ||
    exportingVideoIndex !== null ||
    diagnosticExportingIndex !== null ||
    exportingAll ||
    diagnosticExportingAll;

  const canGenerate = !!selectedCreator?.id && !loading;
  const summaryChips = useMemo(() => {
    if (!source) return [];
    return [
      source.objective.label,
      source.period.label,
      `${source.topNarratives.length} narrativas`,
      `${source.winningWindows.length} janelas`,
    ];
  }, [source]);

  const selectedPresetMeta = useMemo(
    () => VISUAL_PRESET_OPTIONS.find((option) => option.value === visualPreset),
    [visualPreset],
  );

  const loadDrafts = async () => {
    try {
      const response = await fetch("/api/admin/carousels/case-generator/drafts", {
        cache: "no-store",
      });
      const data = await response.json();
      if (response.ok) {
        setDrafts(data.items || []);
      }
    } catch {
      setDrafts([]);
    }
  };

  React.useEffect(() => {
    void loadDrafts();
  }, []);

  const handleGenerate = async () => {
    if (!selectedCreator) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        creatorId: selectedCreator.id,
        creatorName: selectedCreator.name,
        profilePictureUrl: selectedCreator.profilePictureUrl || "",
        period,
        objective,
      });

      const sourceRes = await fetch(`/api/admin/carousels/case-generator/source?${params.toString()}`, {
        cache: "no-store",
      });

      const sourceJson = await sourceRes.json();
      if (!sourceRes.ok) {
        throw new Error(sourceJson.error || "Falha ao montar source do carrossel.");
      }

      const nextSource = sourceJson.source as CarouselCaseSource;
      setSource(nextSource);

      const deckRes = await fetch("/api/admin/carousels/case-generator/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: nextSource }),
      });

      const deckJson = await deckRes.json();
      if (!deckRes.ok) {
        throw new Error(deckJson.error || "Falha ao gerar deck do carrossel.");
      }

      setDeck(deckJson.deck as CarouselCaseDeck);
    } catch (requestError: any) {
      setError(requestError?.message || "Não foi possível gerar o carrossel.");
    } finally {
      setLoading(false);
    }
  };

  const handleSlideEdit = (
    slideId: string,
    field: "headline" | "body",
    value: string,
  ) => {
    setDeck((current) => {
      if (!current) return current;

      return {
        ...current,
        slides: current.slides.map((slide) =>
          slide.id === slideId ? { ...slide, [field]: value } : slide,
        ),
      };
    });
  };

  const exportSlide = async (
    slide: CarouselCaseSlide,
    index: number,
    mode: ExportRenderMode = "auto",
  ) => {
    const node = slideRefs.current[slide.id];
    if (!node || !deck) return;

    if (mode === "foreign-object-only") {
      setDiagnosticExportingIndex(index);
    } else {
      setExportingIndex(index);
    }
    setError(null);

    try {
      const result =
        mode === "foreign-object-only"
          ? await exportNodeToPng(node, slide, source, mode)
          : await exportNodeWithBrowserScreenshot(node, formatSlideFilename(deck.deckTitle, index));
      const link = document.createElement("a");
      link.href = result.url;
      link.download =
        mode === "foreign-object-only"
          ? formatSlideFilename(`${deck.deckTitle}-diagnostico-fo`, index)
          : formatSlideFilename(deck.deckTitle, index);
      link.click();
      setLastExportReport(
        mode === "foreign-object-only"
          ? "Diagnóstico: slide exportado com foreignObject puro."
          : "Último export: screenshot real do slide via Playwright.",
      );
      window.setTimeout(() => {
        result.cleanup?.();
      }, 1500);
    } catch (exportError: any) {
      setError(exportError?.message || "Não foi possível exportar o slide.");
    } finally {
      if (mode === "foreign-object-only") {
        setDiagnosticExportingIndex(null);
      } else {
        setExportingIndex(null);
      }
    }
  };

  const exportSlideVideo = async (slide: CarouselCaseSlide, index: number) => {
    const node = slideRefs.current[slide.id];
    if (!node || !deck || !canExportSlideVideo(slide, source)) return;
    const durationMs = getSlideVideoExportDurationMs(slide, source);

    setExportingVideoIndex(index);
    setError(null);

    try {
      const result = await exportNodeWithBrowserVideoRecording(
        node,
        formatSlideVideoFilename(deck.deckTitle, index),
        durationMs,
      );
      const link = document.createElement("a");
      link.href = result.url;
      link.download = formatSlideVideoFilename(deck.deckTitle, index);
      link.click();
      setLastExportReport(
        `Último export: MP4 animado do slide ${index + 1}, sem áudio (${Math.round(durationMs / 1000)}s).`,
      );
      window.setTimeout(() => {
        result.cleanup?.();
      }, 1500);
    } catch (exportError: any) {
      setError(exportError?.message || "Não foi possível exportar o vídeo do slide.");
    } finally {
      setExportingVideoIndex(null);
    }
  };

  const exportNodeWithBrowserScreenshot = async (
    node: HTMLDivElement,
    fileName: string,
  ): Promise<ExportDownloadResult> => {
    const fontSet = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fontSet?.ready) {
      await fontSet.ready.catch(() => null);
    }

    await waitForNodeImages(node);
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));

    const response = await fetch("/api/admin/carousels/case-generator/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: buildServerExportHtml(node, EXPORT_TARGET_WIDTH, EXPORT_TARGET_HEIGHT),
        width: EXPORT_TARGET_WIDTH,
        height: EXPORT_TARGET_HEIGHT,
        fileName,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Não foi possível gerar o PNG no navegador de exportação.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    return {
      url,
      rendererUsed: "playwright-screenshot",
      cleanup: () => URL.revokeObjectURL(url),
    };
  };

  const exportNodeWithBrowserVideoRecording = async (
    node: HTMLDivElement,
    fileName: string,
    durationMs: number,
  ): Promise<ExportVideoDownloadResult> => {
    const fontSet = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fontSet?.ready) {
      await fontSet.ready.catch(() => null);
    }

    await waitForNodeImages(node);
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));

    const response = await fetch("/api/admin/carousels/case-generator/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "video",
        videoFormat: "mp4",
        html: buildServerExportHtml(node, VIDEO_EXPORT_TARGET_WIDTH, VIDEO_EXPORT_TARGET_HEIGHT, {
          animateCounters: true,
        }),
        width: VIDEO_EXPORT_TARGET_WIDTH,
        height: VIDEO_EXPORT_TARGET_HEIGHT,
        durationMs,
        fileName,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Não foi possível gerar o vídeo no navegador de exportação.");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);

    return {
      url,
      cleanup: () => URL.revokeObjectURL(url),
    };
  };

  const exportNodeToPng = async (
    node: HTMLDivElement,
    slide: CarouselCaseSlide,
    sourceData?: CarouselCaseSource | null,
    mode: ExportRenderMode = "auto",
  ): Promise<ExportDownloadResult> => {
    const narrativeExportSurfaceTheme = getNarrativeInspiredSurfaceTheme(
      getSlideSurfaceTheme(sourceData?.objective.value, visualPreset),
    );
    const syntheticTarget =
      slide.type === "narrative"
        ? createNarrativeExportTarget(slide, sourceData, narrativeExportSurfaceTheme)
        : null;
    const exportNode = syntheticTarget?.node || node;
    const slideId = slide.id;
    const isSyntheticNarrativeExport = exportNode !== node;
    const blobToDataUrl = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === "string") {
            resolve(result);
            return;
          }
          reject(new Error("Falha ao converter blob para data URL."));
        };
        reader.onerror = () => reject(reader.error || new Error("Falha ao ler blob."));
        reader.readAsDataURL(blob);
      });

    const fontSet = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    if (fontSet?.ready) {
      await fontSet.ready.catch(() => null);
    }

    try {
      await waitForNodeImages(exportNode);
      const images = Array.from(exportNode.querySelectorAll("img"));
      const videos = Array.from(exportNode.querySelectorAll("video"));

      const backgroundUrls = Array.from(exportNode.querySelectorAll<HTMLElement>("[data-export-bg]"))
        .map((element) => toAbsoluteExportUrl(element.dataset.exportBg?.trim()))
        .filter((value): value is string => Boolean(value));

      const inlineImageUrls = images
        .map((image) => toAbsoluteExportUrl(image.currentSrc || image.getAttribute("src")))
        .filter((value): value is string => Boolean(value));

      const videoPosterUrls = videos
        .map((video) => toAbsoluteExportUrl(video.poster || video.dataset.exportPoster?.trim()))
        .filter((value): value is string => Boolean(value));

      const exportAssetMap = new Map<string, string>();
      const assetUrls = Array.from(new Set([...backgroundUrls, ...inlineImageUrls, ...videoPosterUrls]));

      await Promise.all(
        assetUrls.map(
          (url) =>
            new Promise<void>((resolve) => {
              const preload = new Image();
              preload.crossOrigin = "anonymous";
              preload.decoding = "sync";
              preload.onload = () => resolve();
              preload.onerror = () => resolve();
              preload.src = url;
            }),
        ),
      );

      await Promise.all(
        assetUrls.map(async (url) => {
          try {
            const response = await fetch(url, { cache: "force-cache" });
            if (!response.ok) return;
            const blob = await response.blob();
            const dataUrl = await blobToDataUrl(blob);
            exportAssetMap.set(url, dataUrl);
          } catch {
            // Se a conversão falhar, o export ainda tenta usar a URL absoluta.
          }
        }),
      );

      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));

      const exportScale = Math.max(
        isSyntheticNarrativeExport ? 4 : 2,
        EXPORT_TARGET_WIDTH / Math.max(exportNode.offsetWidth, 1),
        EXPORT_TARGET_HEIGHT / Math.max(exportNode.offsetHeight, 1),
      );

      const html2canvas = (await import("html2canvas")).default;
      const renderCanvas = (foreignObjectRendering: boolean) =>
        html2canvas(exportNode, {
          backgroundColor: null,
          scale: exportScale,
          useCORS: true,
          foreignObjectRendering,
          removeContainer: true,
          width: exportNode.offsetWidth,
          height: exportNode.offsetHeight,
          windowWidth: exportNode.offsetWidth,
          windowHeight: exportNode.offsetHeight,
          scrollX: 0,
          scrollY: 0,
          imageTimeout: 0,
          logging: false,
          onclone: (clonedDocument) => {
            const clonedNode = clonedDocument.querySelector<HTMLElement>(`[data-export-slide-id="${slideId}"]`);
            if (!clonedNode) return;
            copyComputedStylesToTarget(document.documentElement, clonedDocument.documentElement);
            copyComputedStylesToTarget(document.body, clonedDocument.body);

            const liveElements = [exportNode, ...Array.from(exportNode.querySelectorAll<HTMLElement>("*"))];
            const clonedElements = [clonedNode, ...Array.from(clonedNode.querySelectorAll<HTMLElement>("*"))];

            clonedNode.style.width = `${exportNode.offsetWidth}px`;
            clonedNode.style.minWidth = `${exportNode.offsetWidth}px`;
            clonedNode.style.maxWidth = `${exportNode.offsetWidth}px`;
            clonedNode.style.height = `${exportNode.offsetHeight}px`;
            clonedNode.style.minHeight = `${exportNode.offsetHeight}px`;
            clonedNode.style.maxHeight = `${exportNode.offsetHeight}px`;
            clonedNode.style.aspectRatio = `${exportNode.offsetWidth} / ${exportNode.offsetHeight}`;

            clonedElements.forEach((element, index) => {
              const liveElement = liveElements[index];
              const computed = liveElement ? copyComputedStylesToTarget(liveElement, element) : null;

              if (computed) {
                element.style.width = computed.width;
                element.style.minWidth = computed.minWidth;
                element.style.maxWidth = computed.maxWidth;
                element.style.height = computed.height;
                element.style.minHeight = computed.minHeight;
                element.style.maxHeight = computed.maxHeight;
              }

              if (!element.matches(EXPORT_TEXT_SELECTOR)) {
                return;
              }

              if (!element.style.fontFamily) {
                element.style.fontFamily = element.classList.contains("font-serif")
                  ? EXPORT_SAFE_SERIF_STACK
                  : EXPORT_SAFE_SANS_STACK;
              }
            });

            const clonedNarrativeBackground = clonedNode.querySelector<HTMLElement>("[data-export-narrative-bg]");
            if (clonedNarrativeBackground && !foreignObjectRendering) {
              clonedNarrativeBackground.innerHTML = getExportSafeNarrativeBackgroundMarkup();
            }

            clonedNode.querySelectorAll<HTMLElement>("[data-export-bg]").forEach((element) => {
              const absoluteSrc = toAbsoluteExportUrl(element.dataset.exportBg?.trim());
              if (!absoluteSrc) return;

              const wrapper = clonedDocument.createElement("div");
              wrapper.style.cssText = element.style.cssText;
              wrapper.style.backgroundImage = "none";
              wrapper.style.backgroundColor = "transparent";
              wrapper.setAttribute("role", element.getAttribute("role") || "img");
              if (element.getAttribute("aria-label")) {
                wrapper.setAttribute("aria-label", element.getAttribute("aria-label") || "");
              }

              const image = clonedDocument.createElement("img");
              image.src = exportAssetMap.get(absoluteSrc) || absoluteSrc;
              image.alt = element.getAttribute("aria-label") || "";
              image.draggable = false;
              image.style.position = "absolute";
              image.style.inset = "0";
              image.style.width = "100%";
              image.style.height = "100%";
              image.style.objectFit = "cover";
              image.style.objectPosition =
                element.dataset.exportBgPosition?.trim() || element.style.backgroundPosition || "50% 50%";
              image.style.transformOrigin = "center center";
              image.style.pointerEvents = "none";
              image.style.userSelect = "none";

              const scale = getExportImageScale(element.dataset.exportBgSize?.trim() || element.style.backgroundSize);
              if (scale) {
                image.style.transform = `scale(${scale.x}, ${scale.y})`;
              }

              wrapper.replaceChildren(image);
              element.replaceWith(wrapper);
            });

            clonedNode.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
              const absoluteSrc = toAbsoluteExportUrl(image.currentSrc || image.getAttribute("src"));
              if (!absoluteSrc) return;
              image.src = exportAssetMap.get(absoluteSrc) || absoluteSrc;
            });

            clonedNode.querySelectorAll<HTMLVideoElement>("video").forEach((video) => {
              const absolutePoster = toAbsoluteExportUrl(video.poster || video.dataset.exportPoster?.trim());
              const absoluteSrc = toAbsoluteExportUrl(video.currentSrc || video.getAttribute("src"));
              const fallbackSrc = absolutePoster || absoluteSrc;
              if (!fallbackSrc) return;

              const image = clonedDocument.createElement("img");
              image.src = exportAssetMap.get(fallbackSrc) || fallbackSrc;
              image.alt = video.getAttribute("aria-label") || "";
              image.draggable = false;
              image.style.cssText = video.style.cssText;
              image.style.position = "absolute";
              image.style.inset = "0";
              image.style.width = "100%";
              image.style.height = "100%";
              image.style.objectFit = "cover";
              image.style.pointerEvents = "none";
              image.style.userSelect = "none";
              image.style.display = "block";
              video.replaceWith(image);
            });
          },
        });

      const attemptForeignObjectRender = async () => {
        let lastCanvas: HTMLCanvasElement | null = null;
        let lastError: unknown = null;
        let lastFailure: "blank" | "error" | null = null;

        for (let attempt = 0; attempt < 3; attempt += 1) {
          try {
            lastCanvas = await renderCanvas(true);
            if (!canvasLooksBlank(lastCanvas)) {
              return { canvas: lastCanvas, lastError: null, lastFailure: null };
            }
            lastFailure = "blank";
          } catch (error) {
            lastCanvas = null;
            lastFailure = "error";
            lastError = error;
          }

          await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
        }

        return { canvas: lastCanvas, lastError, lastFailure };
      };

      const attemptCanvasFallbackRender = async () => {
        let lastCanvas: HTMLCanvasElement | null = null;
        let lastError: unknown = null;

        for (let attempt = 0; attempt < 2; attempt += 1) {
          try {
            lastCanvas = await renderCanvas(false);
            if (!canvasLooksBlank(lastCanvas)) {
              return { canvas: lastCanvas, lastError: null };
            }
          } catch (error) {
            lastCanvas = null;
            lastError = error;
          }

          await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
        }

        return { canvas: lastCanvas, lastError };
      };

      let rendererUsed: ExportRendererUsed = "foreign-object";
      const foreignObjectAttempt = await attemptForeignObjectRender();
      let canvas = foreignObjectAttempt.canvas;

      if (mode === "foreign-object-only") {
        if (!canvas || canvasLooksBlank(canvas)) {
          const detail =
            foreignObjectAttempt.lastFailure === "error"
              ? `erro do renderer: ${foreignObjectAttempt.lastError instanceof Error ? foreignObjectAttempt.lastError.message : "falha desconhecida"}`
              : foreignObjectAttempt.lastFailure === "blank"
                ? "canvas em branco"
                : "falha desconhecida";
          throw new Error(
            isSyntheticNarrativeExport
              ? `Diagnóstico FO falhou: o foreignObject puro não conseguiu renderizar este slide (${detail}). No slide narrativo, o export normal usa o renderer estável em canvas.`
              : `Diagnóstico FO falhou: o foreignObject puro não conseguiu renderizar este slide (${detail}).`,
          );
        }

        return {
          url: canvas.toDataURL("image/png"),
          rendererUsed,
        };
      }

      if (!canvas || canvasLooksBlank(canvas)) {
        const fallbackAttempt = await attemptCanvasFallbackRender();
        if (fallbackAttempt.canvas && !canvasLooksBlank(fallbackAttempt.canvas)) {
          canvas = fallbackAttempt.canvas;
          rendererUsed = "canvas-fallback";
        } else if (!canvas) {
          throw new Error("PNG export failed");
        }
      }

      return {
        url: canvas.toDataURL("image/png"),
        rendererUsed,
      };
    } finally {
      if (syntheticTarget) {
        syntheticTarget.cleanup();
      }
    }
  };

  const handleExportAll = async (mode: ExportRenderMode = "auto") => {
    if (!deck) return;

    if (mode === "foreign-object-only") {
      setDiagnosticExportingAll(true);
    } else {
      setExportingAll(true);
    }
    setError(null);

    try {
      let browserScreenshotCount = 0;
      let foreignObjectCount = 0;
      let fallbackCount = 0;

      for (const [index, slide] of deck.slides.entries()) {
        const node = slideRefs.current[slide.id];
        if (!node) continue;
        const result =
          mode === "foreign-object-only"
            ? await exportNodeToPng(node, slide, source, mode)
            : await exportNodeWithBrowserScreenshot(node, formatSlideFilename(deck.deckTitle, index));
        const link = document.createElement("a");
        link.href = result.url;
        link.download =
          mode === "foreign-object-only"
            ? formatSlideFilename(`${deck.deckTitle}-diagnostico-fo`, index)
            : formatSlideFilename(deck.deckTitle, index);
        link.click();
        if (result.rendererUsed === "playwright-screenshot") {
          browserScreenshotCount += 1;
        } else if (result.rendererUsed === "foreign-object") {
          foreignObjectCount += 1;
        } else if (result.rendererUsed === "canvas-fallback") {
          fallbackCount += 1;
        }
        window.setTimeout(() => {
          result.cleanup?.();
        }, 1500);
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
      setLastExportReport(
        mode === "foreign-object-only"
          ? `Diagnóstico: ${foreignObjectCount} slide(s) exportado(s) com foreignObject puro.`
          : `Último export: ${browserScreenshotCount} slide(s) exportado(s) via screenshot real do navegador.`,
      );
    } catch (exportError: any) {
      setError(exportError?.message || "Não foi possível exportar todos os slides.");
    } finally {
      if (mode === "foreign-object-only") {
        setDiagnosticExportingAll(false);
      } else {
        setExportingAll(false);
      }
    }
  };

  const handleSaveDraft = async () => {
    if (!source || !deck || !selectedCreator) return;

    setSavingDraft(true);
    try {
      const response = await fetch("/api/admin/carousels/case-generator/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: selectedCreator.id,
          creatorName: selectedCreator.name,
          visualPreset,
          source,
          deck,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Falha ao salvar draft.");
      }
      await loadDrafts();
    } catch (saveError: any) {
      setError(saveError?.message || "Não foi possível salvar o draft.");
    } finally {
      setSavingDraft(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-primary/15 bg-brand-primary/5 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand-primary">
          <SparklesIcon className="h-4 w-4" />
          Gerador assistido
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            Carrossel-case para creators da D2C
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
            Escolha o creator, defina o recorte da análise e gere um deck inicial em formato
            <strong className="font-semibold text-slate-900"> 3:4 (1080x1440)</strong> com preview visual,
            edição manual, exportação em PNG por slide e MP4 nos slides animados.
          </p>
        </div>
      </header>

      <section className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-5 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Configuração
            </p>
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              Fonte editorial do case
            </h2>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">Creator</label>
            <CreatorQuickSearch
              onSelect={(creator) =>
                setSelectedCreator({
                  id: creator.id,
                  name: creator.name,
                  profilePictureUrl: creator.profilePictureUrl,
                })
              }
              selectedCreatorName={selectedCreator?.name || null}
              selectedCreatorPhotoUrl={selectedCreator?.profilePictureUrl || null}
              onClear={() => {
                setSelectedCreator(null);
                setSource(null);
                setDeck(null);
              }}
              apiPrefix="/api/admin"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <label className="space-y-2">
              <span className="block text-sm font-semibold text-slate-700">Período</span>
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value as CarouselCasePeriod)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/10"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-sm font-semibold text-slate-700">Objetivo</span>
              <select
                value={objective}
                onChange={(event) => setObjective(event.target.value as CarouselCaseObjective)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/10"
              >
                {OBJECTIVE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <span className="block text-sm font-semibold text-slate-700">Preset visual</span>
            <div className="grid gap-2">
              {VISUAL_PRESET_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setVisualPreset(option.value)}
                  className={cx(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    visualPreset === option.value
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300",
                  )}
                >
                  <p className="text-sm font-black tracking-tight">{option.label}</p>
                  <p className={cx("mt-1 text-xs leading-5", visualPreset === option.value ? "text-white/72" : "text-slate-500")}>
                    {option.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loading ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <PresentationChartBarIcon className="h-5 w-5" />}
            {loading ? "Gerando..." : "Gerar carrossel-case"}
          </button>

          {error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          ) : null}

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Estado atual
            </p>
            {source ? (
              <div className="mt-3 space-y-3">
                <p className="text-sm font-semibold leading-6 text-slate-800">
                  {source.insightSummary.strongestPattern}
                </p>
                <div className="flex flex-wrap gap-2">
                  {summaryChips.map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                    >
                      {chip}
                    </span>
                  ))}
                  {selectedPresetMeta ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {selectedPresetMeta.label}
                    </span>
                  ) : null}
                </div>
                {source.caveats.length ? (
                  <ul className="space-y-2 text-xs leading-5 text-slate-500">
                    {source.caveats.slice(0, 2).map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Selecione um creator e gere o primeiro deck para abrir o preview.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                Preview
              </p>
              <h2 className="text-lg font-black tracking-tight text-slate-900">
                Deck 3:4 pronto para revisão
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {deck ? (
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={savingDraft}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingDraft ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
                  Salvar draft
                </button>
              ) : null}
              {deck ? (
                <button
                  type="button"
                  onClick={() => void handleExportAll()}
                  disabled={isAnyExportRunning}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {exportingAll ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <ArrowDownTrayIcon className="h-4 w-4" />}
                  Exportar todos
                </button>
              ) : null}
              {deck ? (
                <button
                  type="button"
                  onClick={() => void handleExportAll("foreign-object-only")}
                  disabled={isAnyExportRunning}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-accent/20 bg-brand-accent/5 px-3 py-1.5 text-xs font-semibold text-brand-accent transition hover:border-brand-accent/35 hover:bg-brand-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {diagnosticExportingAll ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
                  Diagnóstico FO
                </button>
              ) : null}
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <PhotoIcon className="h-4 w-4" />
                1080x1440
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                <VideoCameraIcon className="h-4 w-4" />
                MP4 animado sem audio
              </div>
            </div>
          </div>

          {lastExportReport ? (
            <div className="mt-4 rounded-2xl border border-brand-accent/12 bg-brand-accent/5 px-4 py-3 text-sm text-slate-700">
              {lastExportReport}
            </div>
          ) : null}

          {!deck ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center text-slate-500">
              <PresentationChartBarIcon className="h-10 w-10 text-slate-300" />
              <p className="max-w-md text-sm leading-6">
                O preview aparece aqui assim que o deck for gerado. A estrutura já está travada
                para carrossel-case com fechamento convidando o creator para entrar na D2C.
              </p>
            </div>
          ) : (
            <div className="space-y-8 pt-6">
              {deck.slides.map((slide, index) => (
                <div key={slide.id} className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
                  <SlideCard
                    slide={slide}
                    creatorName={selectedCreator?.name || "Creator"}
                    photoUrl={selectedCreator?.profilePictureUrl}
                    slideIndex={index}
                    totalSlides={deck.slides.length}
                    source={source}
                    objective={source?.objective.value || objective}
                    visualPreset={visualPreset}
                    slideRef={(node) => {
                      slideRefs.current[slide.id] = node;
                    }}
                  />

                  <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
                          Edição
                        </p>
                        <p className="text-sm font-semibold text-slate-800">{slide.type}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {canExportSlideVideo(slide, source) ? (
                          <button
                            type="button"
                            onClick={() => void exportSlideVideo(slide, index)}
                            disabled={isAnyExportRunning}
                            className="inline-flex items-center gap-2 rounded-xl border border-brand-primary/18 bg-brand-primary/6 px-3 py-2 text-xs font-bold text-brand-primary transition hover:border-brand-primary/30 hover:bg-brand-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {exportingVideoIndex === index ? (
                              <ArrowPathIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <VideoCameraIcon className="h-4 w-4" />
                            )}
                            Exportar MP4
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void exportSlide(slide, index)}
                          disabled={isAnyExportRunning}
                          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {exportingIndex === index ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArrowDownTrayIcon className="h-4 w-4" />
                          )}
                          Exportar PNG
                        </button>
                        <button
                          type="button"
                          onClick={() => void exportSlide(slide, index, "foreign-object-only")}
                          disabled={isAnyExportRunning}
                          className="inline-flex items-center gap-2 rounded-xl border border-brand-accent/20 bg-brand-accent/5 px-3 py-2 text-xs font-bold text-brand-accent transition hover:border-brand-accent/35 hover:bg-brand-accent/10 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {diagnosticExportingIndex === index ? (
                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <SparklesIcon className="h-4 w-4" />
                          )}
                          Diagnóstico FO
                        </button>
                      </div>
                    </div>

                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Headline</span>
                      <textarea
                        value={slide.headline}
                        onChange={(event) => handleSlideEdit(slide.id, "headline", event.target.value)}
                        rows={3}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10"
                      />
                    </label>

                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-slate-700">Body</span>
                      <textarea
                        value={slide.body || ""}
                        onChange={(event) => handleSlideEdit(slide.id, "body", event.target.value)}
                        rows={6}
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/10"
                      />
                    </label>

                    {slide.chips?.length ? (
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-slate-700">Chips</p>
                        <div className="flex flex-wrap gap-2">
                          {slide.chips.map((chip) => (
                            <span
                              key={chip}
                              className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Histórico</p>
            <h2 className="text-lg font-black tracking-tight text-slate-900">Drafts salvos do gerador</h2>
          </div>
          <button
            type="button"
            onClick={() => void loadDrafts()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
          >
            <ArrowPathIcon className="h-4 w-4" />
            Atualizar
          </button>
        </div>

        {drafts.length === 0 ? (
          <div className="py-10 text-sm text-slate-500">
            Nenhum draft salvo ainda.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {drafts.map((draft) => (
              <article key={draft.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="space-y-1">
                  <p className="text-sm font-black tracking-tight text-slate-900">{draft.title}</p>
                  <p className="text-xs text-slate-500">
                    {draft.creatorName} • {draft.periodLabel} • {draft.objectiveLabel} • {draft.visualPreset}
                  </p>
                </div>
                <p className="text-xs font-semibold text-slate-400">
                  {new Date(draft.updatedAt).toLocaleString("pt-BR")}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
