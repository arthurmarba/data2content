"use client";

import { useEffect } from 'react';
import { track } from '@/lib/track';

export default function DiscoverViewTracker() {
  useEffect(() => {
    try { track('discover_view'); } catch {}
  }, []);
  return null;
}

