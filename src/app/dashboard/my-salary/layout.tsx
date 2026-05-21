'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';

export default function MySalaryLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'error'>('loading');

  useEffect(() => {
    authFetch(`${API_BASE_URL}/school/features`)
      .then((res) => {
        if (!res.ok) { setStatus('error'); return; }
        return res.json();
      })
      .then((features: Record<string, boolean> | undefined) => {
        if (!features) return;
        setStatus(features['hr_portal'] === true ? 'enabled' : 'disabled');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'disabled') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-3xl mb-5">
          🔒
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">HR Portal Not Enabled</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          The HR Portal feature is not enabled for your school. Please contact your administrator or reach out to support to activate it.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-3xl mb-5">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Could Not Load HR Portal</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          There was a problem checking access. Please refresh the page or try again later.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
