'use client';
import Image from 'next/image';
import { FaStar } from 'react-icons/fa';

interface TestimonialCardProps {
  name: string;
  handle: string;
  quote: string;
  avatarUrl: string;
}

export default function TestimonialCard({ name, handle, quote, avatarUrl }: TestimonialCardProps) {
  return (
    <div className="bg-white p-8 rounded-xl h-full shadow-lg flex flex-col">
      <div className="flex text-yellow-400 gap-1 mb-4">{[...Array(5)].map((_, i) => <FaStar key={i} />)}</div>
      <p className="text-gray-700 italic flex-grow">"{quote}"</p>
      <div className="flex items-center mt-6">
        <div className="relative w-12 h-12 rounded-full overflow-hidden">
          <Image src={avatarUrl} alt={`Avatar de ${name}`} fill className="object-cover" sizes="48px" />
        </div>
        <div className="ml-4">
          <p className="font-bold text-brand-dark">{name}</p>
          <p className="text-sm text-gray-500">{handle}</p>
        </div>
      </div>
    </div>
  );
}
