'use client';
import React from 'react';

interface CreatorTypeCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
}

export default function CreatorTypeCard({ icon: Icon, title, description }: CreatorTypeCardProps) {
  return (
    <div className="group relative h-full rounded-2xl bg-gradient-to-br from-white to-gray-50 p-8 text-left transition-all duration-300 hover:shadow-2xl hover:-translate-y-2">
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-pink-200/50 to-purple-200/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative">
        <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-pink/10 text-3xl text-brand-pink shadow-inner shadow-pink-100 transition-all duration-300 group-hover:scale-110 group-hover:bg-brand-pink group-hover:text-white">
          <Icon />
        </div>
        <h3 className="text-xl font-bold text-brand-dark">{title}</h3>
        <p className="mt-3 text-base text-gray-600">{description}</p>
      </div>
    </div>
  );
}
