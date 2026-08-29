import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Circulars',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
