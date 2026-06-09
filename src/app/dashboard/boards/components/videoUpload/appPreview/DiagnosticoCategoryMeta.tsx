"use client";

import type { ReactNode } from "react";
import { HC } from "./diagnosticoTokens";

export type CategoryId =
  | "narrative"
  | "strategic"
  | "execution"
  | "instagram"
  | "brands"
  | "collabs"
  | "community"
  | "readings"
  | "ideas";

export interface CategoryMeta {
  id: CategoryId;
  title: string;          // "Sua Narrativa" (sentence case for detail header)
  category: string;       // "Sua Narrativa" (Title Case for full-width tile)
  shortCategory: string;  // "Narrativa" (single word for compact 2-col tile)
  iconBg: string;
  catColor: string;
  icon: ReactNode;
}

/* ── Icons ─────────────────────────────────────────────────────────────── */

function NarrativeIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="white" />
    </svg>
  );
}

function StrategyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExecutionIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12h3l3-9 4 18 3-12 2 6h3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="white" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.8" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="white" />
    </svg>
  );
}

function BrandIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="7" y1="7" x2="7.01" y2="7" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function CollabIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3" stroke="white" strokeWidth="1.8" />
      <path d="M3 21v-1a6 6 0 0 1 6-6" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="17" cy="9" r="2.5" stroke="white" strokeWidth="1.8" />
      <path d="M13 21v-1a5 5 0 0 1 4-4.9" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.89L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CommunityIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9" cy="7" r="3" stroke="white" strokeWidth="1.8" />
      <path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="18" cy="8" r="2.2" stroke="white" strokeWidth="1.6" />
      <path d="M17 14a5 5 0 0 1 5 5v1" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IdeasIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 18h6M10 21h4M12 3a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2v.3h6v-.3c0-.8.4-1.5 1-2A7 7 0 0 0 12 3z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Registry ──────────────────────────────────────────────────────────── */

export const CATEGORY_META: Record<CategoryId, CategoryMeta> = {
  narrative: {
    id: "narrative",
    title: "Sua Narrativa",
    category: "Sua Narrativa",
    shortCategory: "Narrativa",
    iconBg: HC.narrative.bg,
    catColor: HC.narrative.text,
    icon: <NarrativeIcon />,
  },
  strategic: {
    id: "strategic",
    title: "Foco Estratégico",
    category: "Foco Estratégico",
    shortCategory: "Foco",
    iconBg: HC.nextMove.bg,
    catColor: HC.nextMove.text,
    icon: <StrategyIcon />,
  },
  execution: {
    id: "execution",
    title: "Como Você Executa",
    category: "Como Você Executa",
    shortCategory: "Execução",
    iconBg: HC.execution.bg,
    catColor: HC.execution.text,
    icon: <ExecutionIcon />,
  },
  instagram: {
    id: "instagram",
    title: "Instagram",
    category: "Instagram",
    shortCategory: "Instagram",
    iconBg: HC.reach.bg,
    catColor: HC.reach.text,
    icon: <InstagramIcon />,
  },
  brands: {
    id: "brands",
    title: "Marcas Recomendadas",
    category: "Marcas Recomendadas",
    shortCategory: "Marcas",
    iconBg: HC.territory.bg,
    catColor: HC.territory.text,
    icon: <BrandIcon />,
  },
  collabs: {
    id: "collabs",
    title: "Collabs",
    category: "Collabs",
    shortCategory: "Collabs",
    iconBg: "bg-blue-600",
    catColor: "text-blue-700",
    icon: <CollabIcon />,
  },
  community: {
    id: "community",
    title: "Comunidade",
    category: "Comunidade",
    shortCategory: "Comunidade",
    iconBg: "bg-teal-600",
    catColor: "text-teal-700",
    icon: <CommunityIcon />,
  },
  readings: {
    id: "readings",
    title: "Suas Análises",
    category: "Suas Análises",
    shortCategory: "Análises",
    iconBg: "bg-zinc-700",
    catColor: "text-zinc-700",
    icon: <VideoIcon />,
  },
  ideas: {
    id: "ideas",
    title: "Roteiros",
    category: "Roteiros",
    shortCategory: "Roteiros",
    iconBg: HC.nextMove.bg,
    catColor: HC.nextMove.text,
    icon: <IdeasIcon />,
  },
};
