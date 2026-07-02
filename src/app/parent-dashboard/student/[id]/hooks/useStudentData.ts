import useSWR from 'swr';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';

const fetcher = async (url: string) => {
  const res = await authFetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
}

export function useStudentInfo(studentId: string) {
  return useSWR(`${API_BASE_URL}/parent/student/${studentId}/info`, fetcher);
}

export function useAttendance(studentId: string, year: number, month: number) {
  return useSWR(
    `${API_BASE_URL}/parent/student/${studentId}/attendance?year=${year}&month=${month}`,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useFees(studentId: string, academicYearString: string) {
  return useSWR(
    academicYearString
      ? `${API_BASE_URL}/parent/student/${studentId}/fees?academicYear=${academicYearString}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );
}

export function useExamResults(studentId: string, sessionId: number | null) {
  return useSWR(
    sessionId
      ? `${API_BASE_URL}/parent/student/${studentId}/exam-results?sessionId=${sessionId}`
      : null,
    fetcher,
  );
}

export function useCurrentExamResults(studentId: string) {
  // Step 1: get the active academic session (same URL page.tsx uses — SWR deduplicates)
  const { data: sessions, isLoading: sessionsLoading } = useSWR(
    `${API_BASE_URL}/parent/academic-sessions`,
    fetcher,
    { revalidateOnFocus: false },
  );

  const activeSessionId: number | null = sessions
    ? ((sessions as any[]).find((s: any) => s.isActive)?.id ??
      (sessions as any[])[0]?.id ??
      null)
    : null;

  // Step 2: fetch results only once we have a session ID
  const result = useSWR(
    activeSessionId && studentId
      ? `${API_BASE_URL}/parent/student/${studentId}/exam-results?sessionId=${activeSessionId}`
      : null,
    fetcher,
    { revalidateOnFocus: false },
  );

  return { ...result, isLoading: sessionsLoading || result.isLoading };
}

export function useHolidays(studentId: string) {
  return useSWR(
    `${API_BASE_URL}/parent/student/${studentId}/holidays`,
    fetcher,
  );
}

export function useHomework(studentId: string, date: string) {
  return useSWR(
    `${API_BASE_URL}/parent/student/${studentId}/homework?date=${date}`,
    fetcher,
  );
}

export function useLeaves(studentId: string, page: number = 1) {
  return useSWR(
    `${API_BASE_URL}/parent/student/${studentId}/leaves?page=${page}&limit=10`,
    fetcher,
  );
}

export function useNotifications() {
  return useSWR<AppNotification[]>(
    `${API_BASE_URL}/api/app-notifications`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // don't re-fetch for 1 min if already loaded
      errorRetryCount: 2,
    },
  );
}

export function useLibraryIssuances(studentId: string, page = 1, limit = 10) {
  return useSWR(
    studentId
      ? `${API_BASE_URL}/parent/student/${studentId}/library-issuances?page=${page}&limit=${limit}`
      : null,
    fetcher,
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
}
