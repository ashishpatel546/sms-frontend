import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Classes',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
