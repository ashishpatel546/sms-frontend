'use client';

import { use } from 'react';
import { TripScreen } from '@/components/transport/trip/TripScreen';

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <TripScreen tripId={Number(id)} backHref="/dashboard/transport/today" />;
}
