import Link from 'next/link';
import Image from 'next/image';
import { BRANDING } from '@/lib/dev-branding.mjs';

export default function InstallTargetPage({ title, destination, description }: { title: string; destination: string; description: string }) {
  const icon = BRANDING.showDeveloperArtwork ? '/tendev-app-icon-192.png' : '/tenops-gold-app-icon-192.png';
  return <main className="mx-auto flex min-h-[calc(100dvh-5rem)] w-full max-w-xl items-center px-4 py-10">
    <section className="w-full rounded-lg border border-slate-300 bg-white p-6 text-center sm:p-8">
      <Image src={icon} alt={`${BRANDING.productName} app icon`} width={96} height={96} className="mx-auto h-24 w-24 rounded-[22%]" />
      <div className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">Add TenOps to iPhone</div>
      <h1 className="mt-2 text-2xl font-semibold text-slate-950">{title}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-5 rounded-md bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.</div>
      <p className="mt-4 text-xs text-slate-500">This icon will launch <span className="font-semibold text-slate-700">{destination}</span>.</p>
      <Link href={destination} className="mt-5 inline-flex h-11 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-blue-800">Preview destination</Link>
    </section>
  </main>;
}
