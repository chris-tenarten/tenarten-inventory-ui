"use client";

import type { ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

// Gate the entire route subtree before mounting any Intake data loaders.
export default function IntakeAccessBoundary({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.ready) return <p className="p-6">Loading access…</p>;
  if (!auth.profile?.isActive || !auth.can('accessIntake')) {
    return <section className="p-6" role="alert"><h1 className="text-xl font-semibold">Intake access restricted</h1><p>Intake is temporarily available to Admin and Developer during early access.</p></section>;
  }
  return children;
}
