"use client";

import React from "react";
import Image from "next/image";

interface InstagramProfileProps {
  image: string;
  name: string;
  username: string;
  bio: string;
}

const InstagramProfile: React.FC<InstagramProfileProps> = ({
  image,
  name,
  username,
  bio,
}) => {
  return (
    <div className="flex items-center gap-6">
      {/* Foto maior: 128px de largura/altura */}
      <div className="relative w-32 h-32">
        <Image
          src={image}
          alt={name}
          fill
          sizes="128px"
          // or width={128} height={128} se preferir fixo
          className="rounded-full object-cover border border-gray-200"
        />
      </div>
      <div>
        {/* Nome maior: text-xl */}
        <h1 className="text-xl font-semibold text-gray-800">{name}</h1>
        {/* Username maior: text-base */}
        <p className="text-base text-gray-700">@{username}</p>
        {/* Bio maior: text-sm */}
        <p className="text-sm text-gray-600 mt-2">{bio}</p>
      </div>
    </div>
  );
};

export default InstagramProfile;
