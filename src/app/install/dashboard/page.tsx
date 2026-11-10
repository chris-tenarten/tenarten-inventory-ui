import type { Metadata } from 'next';
import InstallTargetPage from '../InstallTargetPage';

export const metadata: Metadata = {
  title: 'Install Dashboard',
  manifest: '/manifest-dashboard.webmanifest',
  robots: { index: false, follow: false },
};

export default function InstallDashboardPage() {
  return <InstallTargetPage title="TenOps · Dashboard" destination="/" description="Install the general TenOps shortcut that opens the normal Dashboard experience." />;
}
