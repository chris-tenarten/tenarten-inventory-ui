import type { Metadata } from 'next';
import InstallTargetPage from '../InstallTargetPage';

export const metadata: Metadata = {
  title: 'Install My Work',
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
};

export default function InstallMyWorkPage() {
  return <InstallTargetPage title="TenOps · My Work" destination="/my-work" description="Install a focused TenOps shortcut that opens directly to your personal task workspace." />;
}
