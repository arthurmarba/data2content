'use client';

import { useEffect } from 'react';
import { track } from '@/lib/track';

const CLICKABLE_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  'input[type="button"]',
  'input[type="submit"]',
  '[data-analytics-name]',
].join(',');

const SECTION_SELECTOR = [
  '[data-analytics-section]',
  'section',
  'header',
  'nav',
  'main',
  'footer',
  'aside',
  'form',
  '[role="dialog"]',
].join(',');

function normalizeAnalyticsValue(value: string | null | undefined, fallback: string) {
  const normalized = value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return normalized || fallback;
}

function resolveElementType(element: HTMLElement) {
  if (element.tagName === 'A') return 'link' as const;
  if (element.tagName === 'INPUT') return 'input' as const;
  if (element.tagName === 'BUTTON') return 'button' as const;
  return 'role_button' as const;
}

function resolveButtonName(element: HTMLElement) {
  return normalizeAnalyticsValue(
    element.dataset.analyticsName ||
      element.id ||
      element.getAttribute('name') ||
      element.getAttribute('aria-label') ||
      element.getAttribute('title') ||
      element.textContent,
    'unnamed_control',
  );
}

function resolveSection(element: HTMLElement) {
  const section = element.closest<HTMLElement>(SECTION_SELECTOR);
  if (!section) return 'page';

  return normalizeAnalyticsValue(
    section.dataset.analyticsSection ||
      section.id ||
      section.getAttribute('aria-label') ||
      section.getAttribute('role') ||
      section.tagName,
    'page',
  );
}

function resolveDestination(element: HTMLElement) {
  const href = element instanceof HTMLAnchorElement ? element.href : null;
  if (!href) return undefined;

  try {
    const destination = new URL(href, window.location.href);
    return destination.origin === window.location.origin
      ? destination.pathname
      : destination.hostname;
  } catch {
    return undefined;
  }
}

export default function AnalyticsClickTracker() {
  useEffect(() => {
    const handleClick = (clickEvent: MouseEvent) => {
      if (!(clickEvent.target instanceof Element)) return;

      const element = clickEvent.target.closest<HTMLElement>(CLICKABLE_SELECTOR);
      if (!element || element.closest('[data-analytics-ignore="true"]')) return;
      if (
        element.hasAttribute('disabled') ||
        element.getAttribute('aria-disabled') === 'true'
      ) {
        return;
      }

      track('button_click', {
        button_name: resolveButtonName(element),
        button_section: resolveSection(element),
        page_path: window.location.pathname,
        destination: resolveDestination(element),
        element_type: resolveElementType(element),
      });
    };

    document.addEventListener('click', handleClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, []);

  return null;
}
