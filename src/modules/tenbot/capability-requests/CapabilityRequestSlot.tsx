'use client';

import {createContext, useContext, useSyncExternalStore, type ReactNode} from 'react';
import {CapabilityRequestCard} from './CapabilityRequestCard';
import {capabilityRequestPreviewAdapter, capabilityRequestPreviewGap} from './presentation-fixture';
import {unavailableCapabilityRequestAdapter, type CapabilityRequestAdapter, type CapabilitySignal} from './model';

type CapabilityRequestContextValue = {
  ownerId: string;
  accessKey: string;
  signal: CapabilitySignal | null;
  adapter: CapabilityRequestAdapter;
};
const CapabilityRequestContext = createContext<CapabilityRequestContextValue | null>(null);
const subscribeToLocation = (callback: () => void) => {
  window.addEventListener('popstate', callback);
  return () => window.removeEventListener('popstate', callback);
};
const readPreview = () => process.env.NODE_ENV === 'development'
  && window.location.hostname === 'localhost'
  && new URLSearchParams(window.location.search).get('tenbotCapabilityPreview') === '1';
const noServerPreview = () => false;

/** A backend-owned integration may inject a signal without changing conversation APIs. */
export function CapabilityRequestProvider({ownerId, accessKey, signal = null, adapter = unavailableCapabilityRequestAdapter, children}: {
  ownerId: string;
  accessKey: string;
  signal?: CapabilitySignal | null;
  adapter?: CapabilityRequestAdapter;
  children?: ReactNode;
}) {
  return <CapabilityRequestContext.Provider value={{ownerId, accessKey, signal, adapter}}>{children}</CapabilityRequestContext.Provider>;
}

export function CapabilityRequestSlot({ownerId, accessKey}: {ownerId: string; accessKey: string}) {
  const integration = useContext(CapabilityRequestContext);
  const preview = useSyncExternalStore(subscribeToLocation, readPreview, noServerPreview);

  if (!ownerId || !accessKey) return null;
  if (integration?.ownerId === ownerId && integration.accessKey === accessKey && integration.signal) {
    return <CapabilityRequestCard key={`${ownerId}:${accessKey}:${integration.signal.id}`} signal={integration.signal} adapter={integration.adapter} />;
  }
  if (!preview) return null;
  return <section aria-label="Capability suggestion presentation preview" className="space-y-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Synthetic interaction preview</p>
    <p className="text-sm leading-relaxed text-slate-700">Example help: open Production → Timeline, move the example job to the proposed dates, then choose Review changes. Review the staged schedule and explicitly confirm it to save. This preview makes no schedule changes.</p>
    <CapabilityRequestCard key={`${ownerId}:${accessKey}:presentation-preview`} signal={capabilityRequestPreviewGap} adapter={capabilityRequestPreviewAdapter} />
  </section>;
}
