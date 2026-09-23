'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { loadOperationalProfiles, type OperationalProfile } from './operational-profiles';
const Manager = dynamic(() => import('./OperationalProfileManager'));
export default function OperationalProfilesSettings() {
 const auth = useAuth();
 const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
 const [profiles, setProfiles] = useState<OperationalProfile[]>([]);
 const refresh = async () => { setProfiles(await loadOperationalProfiles()); setError(''); };
 if (!auth.profile?.isActive || !['admin', 'developer'].includes(auth.profile.role)) return null;
 return <div className="mt-3"><button type="button" disabled={busy} onClick={async () => { setBusy(true); try { await refresh(); setOpen(true); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to load profiles.'); } finally { setBusy(false); } }} className="min-h-10 border border-slate-400 bg-white px-3 text-sm">Formulation Profiles</button>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{open && <Manager profiles={profiles} onChanged={refresh} onClose={() => setOpen(false)}/>}</div>;
}
