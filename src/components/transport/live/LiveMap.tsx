'use client';

import dynamic from 'next/dynamic';

/** Client-only wrapper: MapLibre needs `window` and WebGL. */
export const LiveMap = dynamic(() => import('./LiveMapCanvas'), {
  ssr: false,
  loading: () => <div className="skeleton h-72 w-full rounded-lg" />,
});

export type { MapBus, MapPin } from './LiveMapCanvas';
