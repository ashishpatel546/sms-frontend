'use client';

import { useEffect, useState } from 'react';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'loading' | 'enabled' | 'disabled' | 'error'>('loading');

  useEffect(() => {
    authFetch(`${API_BASE_URL}/school/features`)
      .then((res) => {
        if (!res.ok) { setStatus('error'); return; }
        return res.json();
      })
      .then((features: Record<string, boolean> | undefined) => {
        if (!features) return;
        setStatus(features['library_management'] === true ? 'enabled' : 'disabled');
      })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="w-6 h-6 border-2 border-lime-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'disabled') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center px-4">
        <div className="text-5xl">📚</div>
        <h2 className="text-xl font-semibold text-slate-700 dark:text-slate-200">Library Management is not enabled</h2>
        <p className="text-slate-500 dark:text-slate-400 max-w-sm">
          Contact your school administrator to enable the Library Management module.
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
