import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Document trace',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
