import type { ScriptAdjustTarget } from "./adjustScope";

type SegmentKind = "scene" | "paragraph";

export type ScriptSegment = {
  kind: SegmentKind;
  index: number;
  start: number;
  end: number;
  text: string;
  heading?: string;
};

type ScopedResolution = {
  segment: ScriptSegment;
  normalizedTargetType: ScriptAdjustTarget["type"];
  normalizedTargetIndex: number | null;
};

const SCENE_HEADING_LINE_REGEX =
  /^\s*(?:\[\s*)?(?:cena|scene)\s*(?:#\s*)?(\d{1,3})\b(?:[^\]]*)?(?:\]\s*)?$/i;

function normalizeContent(value: string): string {
  return (value || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseSceneSegments(content: string): ScriptSegment[] {
  const lines = content.split("\n");
  const lineStarts: number[] = [];
  let cursor = 0;
  for (const line of lines) {
    lineStarts.push(cursor);
    cursor += line.length + 1;
  }

  const sceneHeaders: Array<{ sceneNumber: number; start: number }> = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] || "";
    const match = line.match(SCENE_HEADING_LINE_REGEX);
    if (!match?.[1]) continue;
    sceneHeaders.push({
      sceneNumber: Number(match[1]),
      start: lineStarts[i] || 0,
    });
  }

  if (!sceneHeaders.length) return [];

  const segments: ScriptSegment[] = [];
  for (let i = 0; i < sceneHeaders.length; i += 1) {
    const current = sceneHeaders[i];
    if (!current) continue;
    const next = sceneHeaders[i + 1];
    const start = current.start;
    const end = next ? next.start : content.length;
    const text = content.slice(start, end).trim();
    if (!text) continue;
    const firstLine = text.split("\n")[0]?.trim() || "";
    segments.push({
      kind: "scene",
      index: current.sceneNumber,
      start,
      end,
      text,
      heading: firstLine,
    });
  }

  return segments;
}

function parseParagraphSegments(content: string): ScriptSegment[] {
  const segments: ScriptSegment[] = [];
  const paragraphBreakRegex = /\n\s*\n/g;

  let start = 0;
  let paragraphIndex = 1;
  let match: RegExpExecArray | null = null;

  while ((match = paragraphBreakRegex.exec(content)) !== null) {
    const end = match.index;
    const raw = content.slice(start, end);
    const text = raw.trim();
    if (text) {
      segments.push({
        kind: "paragraph",
        index: paragraphIndex,
        start,
        end,
        text,
      });
      paragraphIndex += 1;
    }
    start = match.index + match[0].length;
  }

  const tailRaw = content.slice(start);
  const tailText = tailRaw.trim();
  if (tailText) {
    segments.push({
      kind: "paragraph",
      index: paragraphIndex,
      start,
      end: content.length,
      text: tailText,
    });
  }

  return segments;
}

function detectSceneHeading(text: string): string | null {
  const firstLine = String(text || "").split("\n")[0]?.trim() || "";
  if (!firstLine) return null;
  return SCENE_HEADING_LINE_REGEX.test(firstLine) ? firstLine : null;
}

export function resolveScopedSegment(contentRaw: string, target: ScriptAdjustTarget): ScopedResolution | null {
  const content = normalizeContent(contentRaw);
  if (!content) return null;

  if (target.type === "scene") {
    const scenes = parseSceneSegments(content);
    const match = scenes.find((scene) => scene.index === target.index) || null;
    if (!match) return null;
    return {
      segment: match,
      normalizedTargetType: "scene",
      normalizedTargetIndex: target.index,
    };
  }

  const paragraphs = parseParagraphSegments(content);
  if (!paragraphs.length) return null;

  if (target.type === "paragraph") {
    const match = paragraphs.find((paragraph) => paragraph.index === target.index) || null;
    if (!match) return null;
    return {
      segment: match,
      normalizedTargetType: "paragraph",
      normalizedTargetIndex: target.index,
    };
  }

  if (target.type === "first_paragraph") {
    const match = paragraphs[0] || null;
    if (!match) return null;
    return {
      segment: match,
      normalizedTargetType: "first_paragraph",
      normalizedTargetIndex: 1,
    };
  }

  if (target.type === "last_paragraph") {
    const match = paragraphs[paragraphs.length - 1] || null;
    if (!match) return null;
    return {
      segment: match,
      normalizedTargetType: "last_paragraph",
      normalizedTargetIndex: paragraphs.length,
    };
  }

  return null;
}

export function mergeScopedSegment(contentRaw: string, scoped: ScopedResolution, replacementRaw: string): string {
  const content = normalizeContent(contentRaw);
  const replacement = String(replacementRaw || "").trim() || scoped.segment.text;
  let nextSegmentText = replacement;

  if (scoped.segment.kind === "scene") {
    const originalHeading = scoped.segment.heading || detectSceneHeading(scoped.segment.text);
    const replacementHeading = detectSceneHeading(replacement);
    if (originalHeading && !replacementHeading) {
      nextSegmentText = `${originalHeading}\n${replacement}`.trim();
    }
  }

  return `${content.slice(0, scoped.segment.start)}${nextSegmentText}${content.slice(scoped.segment.end)}`.trim();
}
