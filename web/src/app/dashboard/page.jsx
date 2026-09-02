'use client';
import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('@/frontend/screens/Dashboard'), { ssr: false });

export default function DashboardPage() {
  return <Dashboard />;
}
