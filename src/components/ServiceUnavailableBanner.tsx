'use client';

import { useEffect, useState } from 'react';

export default function ServiceUnavailableBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('service-unavailable', handler);
    return () => window.removeEventListener('service-unavailable', handler);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm mx-4 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-lg font-semibold text-gray-800 mb-2">
          Service Temporarily Unavailable
        </h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          We&rsquo;re unable to connect to the server right now. Please contact
          your school administrator for assistance.
        </p>
      </div>
    </div>
  );
}
