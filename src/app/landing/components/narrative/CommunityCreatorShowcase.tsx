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
  const featuredCreators = creators
    .filter((creator) => creator.mediaKitSlug)
    .slice(0, 12);

  if (!featuredCreators.length) return null;

  const renderRail = (items: LandingCreatorHighlight[]) => (
    <div className="d2c-community-wall__viewport">
      <div className="d2c-community-wall__track">
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
      <section className="d2c-community-wall d2c-community-wall--featured" aria-label="Creators ativos da comunidade D2C">
        {renderRail(featuredCreators)}
      </section>

      <Link className="d2c-community-directory-link" href="/casting">
        Explorar todos os Media Kits
        <ExternalLink size={14} aria-hidden="true" />
      </Link>
    </>
  );
}
