import Image from "next/image";

import type { LandingCreatorHighlight } from "@/types/landing";

type CreatorAvatarProps = {
  creator: LandingCreatorHighlight;
  size?: number;
  priority?: boolean;
};

export function CreatorAvatar({ creator, size = 44, priority = false }: CreatorAvatarProps) {
  const initials = creator.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="d2c-avatar" style={{ width: size, height: size }}>
      {creator.avatarUrl ? (
        <Image
          src={creator.avatarUrl}
          alt={`Foto de ${creator.name}`}
          fill
          sizes={`${size}px`}
          className="object-cover"
          priority={priority}
        />
      ) : (
        <span>{initials}</span>
      )}
    </span>
  );
}
