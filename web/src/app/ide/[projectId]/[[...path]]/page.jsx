'use client';
import { use } from 'react';
import dynamic from 'next/dynamic';

const IDE = dynamic(() => import('@/frontend/ide/IDE'), {
  ssr: false,
  loading: () => <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-app)' }} />,
});

export default function IdePage({ params }) {
  const { projectId, path } = use(params);
  return <IDE projectId={decodeURIComponent(projectId)} path={path} />;
}
