"use client";

import type { DiagnosticoPageData } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import { AudienceConnectPrompt, AudienceInsightsCard } from "./AudienceInsightsCard";
import {
  CARD_RADIUS,
  CARD_SHADOW,
  CS_INK_HEX,
  TEXT_PRIMARY_HEX,
  TEXT_SECONDARY_HEX,
} from "./diagnosticoTokens";

export interface DiagnosticoDeferredProfileSectionsProps {
  audienceInsights: DiagnosticoPageData["audienceInsights"];
  instagramConnected: boolean;
  isPro: boolean;
  isMapReadyForExpansion: boolean;
  brandName: string | null;
  brandSubtitle: string;
  onConnectInstagram?: () => void;
  onGeneratePautasForTerritory?: (territoryLabel: string) => void;
  onOpenBrands?: () => void;
}

export function DiagnosticoDeferredProfileSections({
  audienceInsights,
  instagramConnected,
  isPro,
  isMapReadyForExpansion,
  brandName,
  brandSubtitle,
  onConnectInstagram,
  onGeneratePautasForTerritory,
  onOpenBrands,
}: DiagnosticoDeferredProfileSectionsProps) {
  return (
    <>
      <div style={{ padding: "14px 18px 0" }}>
        {!instagramConnected ? (
          <AudienceConnectPrompt onConnectInstagram={onConnectInstagram} isPro={isPro} />
        ) : audienceInsights?.hasAny ? (
          <AudienceInsightsCard
            insights={audienceInsights}
            instagramConnected
            onReviewTerritories={() =>
              document
                .getElementById("diagnostico-mapa")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            onGeneratePautasForTerritory={onGeneratePautasForTerritory}
          />
        ) : (
          <AudienceConnectPrompt pending />
        )}
      </div>

      {isMapReadyForExpansion && brandName ? (
        <>
          <div style={{ padding: "20px 22px 8px" }}>
            <h2
              style={{
                color: TEXT_SECONDARY_HEX,
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 0.2,
                margin: 0,
                textTransform: "uppercase",
              }}
            >
              Expansão
            </h2>
          </div>
          <div style={{ padding: "0 18px" }}>
            <button
              type="button"
              onClick={onOpenBrands}
              style={{
                background: "var(--ds-color-brand-soft)",
                border: "none",
                borderRadius: CARD_RADIUS,
                boxShadow: CARD_SHADOW,
                cursor: onOpenBrands ? "pointer" : "default",
                display: "flex",
                flexDirection: "column",
                fontFamily: "inherit",
                minHeight: 130,
                overflow: "hidden",
                padding: "18px 22px 22px",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div style={{ alignItems: "center", display: "flex", gap: 12, marginBottom: 14 }}>
                <span
                  aria-hidden="true"
                  style={{
                    alignItems: "center",
                    background: CS_INK_HEX,
                    borderRadius: 9999,
                    color: "var(--ds-color-on-brand)",
                    display: "inline-flex",
                    height: 38,
                    justifyContent: "center",
                    width: 38,
                  }}
                >
                  <svg width="21" height="21" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M7.5 1.5h4v4l-6 6L1.5 7.5l6-6z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinejoin="round"
                    />
                    <circle cx="9.5" cy="4.5" r="0.9" fill="currentColor" />
                  </svg>
                </span>
                <p
                  style={{
                    color: TEXT_PRIMARY_HEX,
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: -0.3,
                    margin: 0,
                  }}
                >
                  Marcas Recomendadas
                </p>
              </div>
              <div style={{ display: "flex", flex: 1, flexDirection: "column", justifyContent: "flex-end", marginTop: 14 }}>
                <p
                  style={{
                    color: CS_INK_HEX,
                    display: "-webkit-box",
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: -0.35,
                    lineHeight: 1.3,
                    margin: 0,
                    overflow: "hidden",
                    overflowWrap: "break-word",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 2,
                  }}
                >
                  {brandName}
                </p>
                <p
                  style={{
                    color: TEXT_SECONDARY_HEX,
                    fontSize: 13,
                    fontWeight: 400,
                    letterSpacing: -0.1,
                    lineHeight: 1.35,
                    margin: "5px 0 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {brandSubtitle}
                </p>
              </div>
            </button>
          </div>
          <div style={{ height: 28 }} />
        </>
      ) : null}

      <div style={{ height: 40 }} />
    </>
  );
}
