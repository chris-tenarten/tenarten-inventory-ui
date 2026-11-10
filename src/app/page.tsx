import ProductionWorkspace from '../modules/production/ProductionWorkspace';
import { Suspense } from 'react';

export default function HomePage() {
  return <Suspense fallback={null}><ProductionWorkspace /></Suspense>;
}
