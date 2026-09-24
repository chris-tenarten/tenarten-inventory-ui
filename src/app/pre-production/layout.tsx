"use client";

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

// Gate the entire route subtree before mounting any Intake data loaders.
export default function IntakeAccessBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.ready) return <p className="p-6">Loading access…</p>;
  if (!auth.profile?.isActive || !auth.can('viewIntake')) {
    return <section className="p-6" role="alert"><h1 className="text-xl font-semibold">Intake access restricted</h1><p>An active authenticated account with Intake view access is required.</p></section>;
  }
  return children;
}
