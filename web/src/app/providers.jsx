'use client';
import { ToastProvider } from '@/frontend/ui';

export default function Providers({ children }) {
  return <ToastProvider>{children}</ToastProvider>;
}
