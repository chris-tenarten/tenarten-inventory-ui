import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Inventory' };
export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
