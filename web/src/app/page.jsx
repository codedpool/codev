'use client';
import dynamic from 'next/dynamic';

// The UI is fully client-rendered (CodeMirror, keyboard shortcuts, localStorage layout state).
const Landing = dynamic(() => import('@/frontend/screens/Landing'), { ssr: false });

export default function HomePage() {
  return <Landing />;
}
