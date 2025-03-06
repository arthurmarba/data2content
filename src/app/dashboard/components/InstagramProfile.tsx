// src/app/dashboard/components/InstagramProfile.tsx
"use client";

import React from "react";

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
      {/* Foto maior: w-32 h-32 (128px) */}
      <img
        src={image}
        alt={name}
        className="
          w-32
          h-32
          rounded-full
          object-cover
          border border-gray-200
        "
      />
      <div>
        {/* Nome maior: text-lg ou text-xl */}
        <h1 className="text-xl font-semibold text-gray-800">{name}</h1>
        {/* Username maior: text-base */}
        <p className="text-base text-gray-700">@{username}</p>
        {/* Bio maior: text-sm ou text-base */}
        <p className="text-sm text-gray-600 mt-2">{bio}</p>
      </div>
    </div>
  );
};

export default InstagramProfile;
