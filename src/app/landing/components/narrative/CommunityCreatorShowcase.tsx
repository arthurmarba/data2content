"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

import type { LandingCreatorHighlight } from "@/types/landing";
import { CommunityCreatorProfileImage } from "./CommunityCreatorProfileImage";

type CommunityCreatorShowcaseProps = {
  creators: LandingCreatorHighlight[];
};

function getCommunityAvatarUrl(mediaKitSlug: string) {
  return `https://data2content.ai/api/mediakit/${encodeURIComponent(mediaKitSlug)}/avatar?v=20260723-community-v3`;
}

function CreatorLink({ creator, duplicate = false, eager = false }: { creator: LandingCreatorHighlight; duplicate?: boolean; eager?: boolean }) {
  if (!creator.mediaKitSlug) return null;

  return (
    <Link
      className="d2c-community-person"
      href={`/mediakit/${creator.mediaKitSlug}`}
      target="_blank"
      rel="noreferrer"
      tabIndex={duplicate ? -1 : undefined}
      aria-label={`Abrir o Media Kit de ${creator.name}`}
    >
      <span>
        <CommunityCreatorProfileImage
          name={creator.name}
          mediaKitSlug={creator.mediaKitSlug}
          src={getCommunityAvatarUrl(creator.mediaKitSlug)}
          eager={eager}
        />
      </span>
      <b>{creator.name}<ExternalLink size={12} aria-hidden="true" /></b>
      {creator.username && <small>@{creator.username.replace(/^@/, "")}</small>}
    </Link>
  );
}

export function CommunityCreatorShowcase({ creators }: CommunityCreatorShowcaseProps) {
  const [expanded, setExpanded] = useState(false);
  const publicCreators = creators.filter((creator) => creator.mediaKitSlug);
  const featuredCreators = publicCreators.slice(0, 12);

  if (!featuredCreators.length) return null;

  const renderRail = (items: LandingCreatorHighlight[]) => (
    <div className="d2c-community-wall__viewport">
      <div className="d2c-community-wall__track">
        <div className="d2c-community-wall__set">
          {items.map((creator) => <CreatorLink key={creator.id} creator={creator} eager />)}
        </div>
        <div className="d2c-community-wall__set" aria-hidden="true">
          {items.map((creator) => <CreatorLink key={`copy-${creator.id}`} creator={creator} duplicate eager />)}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <section className="d2c-community-wall d2c-community-wall--featured" aria-label="Creators ativos da comunidade D2C">
        {renderRail(featuredCreators)}
      </section>

      {publicCreators.length > featuredCreators.length ? (
        <div className="d2c-community-directory">
          <button
            type="button"
            className="d2c-community-directory__toggle"
            aria-expanded={expanded}
            aria-controls="landing-community-media-kits"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Ver menos Media Kits" : "Explorar todos os Media Kits"}
          </button>
          {expanded ? (
            <div id="landing-community-media-kits" className="d2c-community-directory__grid">
              {publicCreators.map((creator) => (
                <CreatorLink key={`directory-${creator.id}`} creator={creator} />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
