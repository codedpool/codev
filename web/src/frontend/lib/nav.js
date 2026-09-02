'use client';
// Navigation adapter over next/navigation with a react-router-like signature.
import { useCallback } from 'react';
import { useRouter } from 'next/navigation';

export function useNavigate() {
  const router = useRouter();
  return useCallback((to, opts) => (opts?.replace ? router.replace(to) : router.push(to)), [router]);
}
