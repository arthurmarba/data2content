import Link from "next/link";
import { ExternalLink } from "lucide-react";

import type { LandingCreatorHighlight } from "@/types/landing";
import { CommunityCreatorProfileImage } from "./CommunityCreatorProfileImage";

type CommunityCreatorShowcaseProps = {
  creators: LandingCreatorHighlight[];
};

function CreatorLink({ creator, duplicate = false }: { creator: LandingCreatorHighlight; duplicate?: boolean }) {
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
          src={creator.avatarUrl || "/images/default-profile.png"}
        />
      </span>
      <b>{creator.name}<ExternalLink size={12} aria-hidden="true" /></b>
      {creator.username && <small>@{creator.username.replace(/^@/, "")}</small>}
    </Link>
  );
}

export function CommunityCreatorShowcase({ creators }: CommunityCreatorShowcaseProps) {
  if (!creators.length) return null;

  const firstRow = creators.filter((_, index) => index % 2 === 0);
  const secondRow = creators.filter((_, index) => index % 2 === 1);

  const renderRail = (items: LandingCreatorHighlight[], reverse = false) => (
    <div className="d2c-community-wall__viewport">
      <div className={`d2c-community-wall__track${reverse ? " is-reverse" : ""}`}>
        <div className="d2c-community-wall__set">
          {items.map((creator) => <CreatorLink key={creator.id} creator={creator} />)}
        </div>
        <div className="d2c-community-wall__set" aria-hidden="true">
          {items.map((creator) => <CreatorLink key={`copy-${creator.id}`} creator={creator} duplicate />)}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="d2c-community-wall d2c-community-wall--desktop" aria-label="Creators ativos da comunidade D2C">
        {renderRail(firstRow)}
        {secondRow.length > 0 && renderRail(secondRow, true)}
      </div>

      <div className="d2c-community-wall d2c-community-wall--mobile" aria-label="Creators ativos da comunidade D2C">
        <div className="d2c-community-wall__viewport">
          <div className="d2c-community-wall__track">
            <div className="d2c-community-wall__set">
              {creators.map((creator) => <CreatorLink key={`mobile-${creator.id}`} creator={creator} />)}
            </div>
          </div>
        </div>
      </div>

      <details className="d2c-community-directory">
        <summary>Explorar todos os Media Kits</summary>
        <div className="d2c-community-directory__grid">
          {creators.map((creator) => <CreatorLink key={`directory-${creator.id}`} creator={creator} />)}
        </div>
      </details>
    </>
  );
}
