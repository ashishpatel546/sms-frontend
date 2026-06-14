'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';

export function AiFeatureGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'error'>('loading');

  useEffect(() => {
    authFetch(`${API_BASE_URL}/school/features`)
      .then((res) => {
        if (!res.ok) { setStatus('error'); return; }
        return res.json();
      })
      .then((features: Record<string, boolean> | undefined) => {
        if (!features) return;
        setStatus(features['ai_tools'] === true ? 'enabled' : 'disabled');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'disabled') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-violet-50 border border-violet-200 flex items-center justify-center text-3xl mb-5">
          🔒
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">AI Features Not Enabled</h2>
        <p className="text-gray-500 text-sm max-w-sm">
          AI features are not enabled for your school. Please contact your administrator or reach out to support to activate them.
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-red-500">Failed to load feature status. Please refresh.</p>
      </div>
    );
  }

  return <>{children}</>;
}
